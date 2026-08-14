// ══════════════════════════════════════════════════════════════
//  GROUNDED — PubMed Research Feed
// ══════════════════════════════════════════════════════════════
// Pulls genuinely new papers from PubMed for the compounds in the
// database and stores them so the site always shows current research.
//
// Every field comes directly from NCBI's API — titles, journals,
// dates, and PMIDs are never generated or inferred. If a plain-language
// summary is added, it is clearly derived from the real abstract.
//
// Designed to be run on a schedule (see DEPLOY.md for cron setup).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// NCBI asks that requests identify themselves
const NCBI_TOOL = "grounded-peptide-platform";
const NCBI_EMAIL = Deno.env.get("NCBI_EMAIL") || "";
const NCBI_API_KEY = Deno.env.get("NCBI_API_KEY") || ""; // optional, raises rate limit

// Compounds to monitor. Batched into OR queries to stay well within
// NCBI's rate limits rather than firing one request per compound.
const WATCHLIST = [
  "BPC-157", "TB-500", "Thymosin beta-4", "GHK-Cu", "LL-37", "KPV",
  "Ipamorelin", "CJC-1295", "Sermorelin", "Tesamorelin", "MK-677",
  "Semaglutide", "Tirzepatide", "Retatrutide", "Liraglutide", "Cagrilintide",
  "AOD-9604", "IGF-1 LR3", "Follistatin", "Epitalon", "Thymalin",
  "SS-31 elamipretide", "MOTS-c", "Humanin", "DSIP", "Semax", "Selank",
  "PT-141 bremelanotide", "Thymosin alpha-1", "Kisspeptin",
];
const BATCH_SIZE = 6;      // compounds per OR query
const DAYS_BACK = 45;      // how far back to look
const PER_BATCH_LIMIT = 12; // max papers to keep per batch

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ncbiParams(extra: Record<string, string>) {
  const p = new URLSearchParams({ db: "pubmed", retmode: "json", tool: NCBI_TOOL, ...extra });
  if (NCBI_EMAIL) p.set("email", NCBI_EMAIL);
  if (NCBI_API_KEY) p.set("api_key", NCBI_API_KEY);
  return p.toString();
}

// ── Step 1: find recent PMIDs for a batch of compounds ────────
async function searchBatch(compounds: string[]): Promise<string[]> {
  const term = compounds.map((c) => `"${c}"[Title/Abstract]`).join(" OR ");
  const url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" +
    ncbiParams({
      term,
      sort: "pub_date",
      retmax: String(PER_BATCH_LIMIT),
      datetype: "pdat",
      reldate: String(DAYS_BACK),
    });

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.esearchresult?.idlist ?? [];
}

// ── Step 2: pull real metadata for those PMIDs ────────────────
async function fetchSummaries(pmids: string[]) {
  if (!pmids.length) return [];
  const url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?" +
    ncbiParams({ id: pmids.join(",") });

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const result = data?.result;
  if (!result) return [];

  return pmids
    .map((pmid) => {
      const r = result[pmid];
      if (!r || r.error) return null;
      const authors = Array.isArray(r.authors)
        ? r.authors.slice(0, 3).map((a: { name: string }) => a.name).filter(Boolean)
        : [];
      return {
        pmid,
        title: (r.title || "").replace(/<\/?[^>]+>/g, "").trim(),
        journal: r.fulljournalname || r.source || "",
        pub_date: r.pubdate || r.epubdate || "",
        authors: authors.join(", ") + (r.authors?.length > 3 ? ", et al." : ""),
        pub_type: Array.isArray(r.pubtype) ? r.pubtype.join(", ") : "",
      };
    })
    .filter(Boolean);
}

// ── Step 3: fetch the real abstract text ──────────────────────
async function fetchAbstracts(pmids: string[]): Promise<Record<string, string>> {
  if (!pmids.length) return {};
  const url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" +
    new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      rettype: "abstract",
      retmode: "text",
      tool: NCBI_TOOL,
      ...(NCBI_EMAIL ? { email: NCBI_EMAIL } : {}),
      ...(NCBI_API_KEY ? { api_key: NCBI_API_KEY } : {}),
    }).toString();

  const res = await fetch(url);
  if (!res.ok) return {};
  const text = await res.text();

  // efetch returns records separated by blank lines with PMID markers
  const out: Record<string, string> = {};
  const chunks = text.split(/\n\n(?=\d+\.\s)/);
  chunks.forEach((chunk) => {
    const pmidMatch = chunk.match(/PMID:\s*(\d+)/);
    if (!pmidMatch) return;
    // Take the body between the author list and the PMID line
    const body = chunk
      .replace(/^[\s\S]*?\n\n/, "")
      .replace(/\n(Author information|DOI|PMID|PMCID)[\s\S]*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (body.length > 80) out[pmidMatch[1]] = body.slice(0, 4000);
  });
  return out;
}

// ── Step 4: optional plain-language summary of the real abstract ──
async function summarize(title: string, abstract: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY || !abstract) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // cheap; this runs across many papers
        max_tokens: 260,
        system:
          "You summarise biomedical abstracts for an educated general audience. " +
          "Rules: use ONLY information present in the abstract provided. Never add " +
          "findings, numbers, or context that is not there. If the abstract is a review " +
          "or has no results, say so plainly. State the study type (in vitro, animal, " +
          "human trial) when the abstract makes it clear, since that determines how much " +
          "weight the finding carries. Two to three sentences. No preamble.",
        messages: [{
          role: "user",
          content: `Title: ${title}\n\nAbstract: ${abstract}\n\nSummarise in 2-3 plain sentences.`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.content || []).map((b: { type: string; text?: string }) =>
      b.type === "text" ? b.text : "").join("").trim() || null;
  } catch {
    return null;
  }
}

// ── Supabase helpers (service role — server side only) ────────
async function sbRequest(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function getExistingPmids(): Promise<Set<string>> {
  const res = await sbRequest("research_feed?select=pmid");
  if (!res.ok) return new Set();
  const rows = await res.json();
  return new Set(rows.map((r: { pmid: string }) => r.pmid));
}

// ══════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const url = new URL(req.url);
  const withSummaries = url.searchParams.get("summarize") !== "false";

  const existing = await getExistingPmids();
  const collected: Record<string, unknown>[] = [];
  const seenThisRun = new Set<string>();

  // Walk the watchlist in batches
  for (let i = 0; i < WATCHLIST.length; i += BATCH_SIZE) {
    const batch = WATCHLIST.slice(i, i + BATCH_SIZE);
    try {
      const pmids = await searchBatch(batch);
      const fresh = pmids.filter((p) => !existing.has(p) && !seenThisRun.has(p));
      fresh.forEach((p) => seenThisRun.add(p));
      if (!fresh.length) { await sleep(400); continue; }

      const summaries = await fetchSummaries(fresh);
      await sleep(400);
      const abstracts = await fetchAbstracts(fresh);

      for (const s of summaries) {
        if (!s) continue;
        const rec = s as Record<string, string>;
        const abstract = abstracts[rec.pmid] || "";
        collected.push({
          pmid: rec.pmid,
          title: rec.title,
          journal: rec.journal,
          pub_date: rec.pub_date,
          authors: rec.authors,
          pub_type: rec.pub_type,
          abstract,
          compounds: batch.join(", "),
          plain_summary: null as string | null,
        });
      }
      await sleep(400); // stay well under NCBI's 3 req/sec
    } catch (e) {
      console.error("Batch failed:", batch, e);
    }
  }

  // Add plain-language summaries (cheap model, capped to control cost)
  if (withSummaries && ANTHROPIC_API_KEY) {
    const cap = Math.min(collected.length, 25);
    for (let i = 0; i < cap; i++) {
      const item = collected[i] as Record<string, string | null>;
      if (item.abstract) {
        item.plain_summary = await summarize(item.title as string, item.abstract as string);
      }
    }
  }

  if (!collected.length) {
    return json({ ok: true, inserted: 0, message: "No new papers found." });
  }

  const insertRes = await sbRequest("research_feed", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(collected),
  });

  if (!insertRes.ok) {
    const detail = await insertRes.text();
    return json({ error: "Insert failed", detail }, 500);
  }

  return json({
    ok: true,
    inserted: collected.length,
    summarised: collected.filter((c) => c.plain_summary).length,
  });
});
