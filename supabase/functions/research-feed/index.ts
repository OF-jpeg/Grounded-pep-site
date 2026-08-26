// ══════════════════════════════════════════════════════════════
//  GROUNDED — Multi-Source Research Feed
// ══════════════════════════════════════════════════════════════
// Pulls new research from three public sources:
//   • PubMed          — peer-reviewed published papers
//   • ClinicalTrials  — trials in progress, often years before publication
//   • Europe PMC      — broader coverage incl. preprints and EU sources
//
// Everything stored comes directly from those APIs. Nothing is invented.
// Summaries, when enabled, derive only from the real abstract text.
//
// A relevance filter drops anything that doesn't actually name one of our
// compounds. Search APIs match loosely, and unrelated papers in the feed
// make the whole thing look untrustworthy.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const NCBI_TOOL = "grounded-peptide-platform";
const NCBI_EMAIL = Deno.env.get("NCBI_EMAIL") || "";
const NCBI_API_KEY = Deno.env.get("NCBI_API_KEY") || "";

// Aliases matter — a paper may use the brand name, chemical name, or
// abbreviation, and the filter needs to catch all of them.
const WATCHLIST: { name: string; aliases: string[] }[] = [
  { name: "BPC-157", aliases: ["BPC157", "body protection compound", "pentadecapeptide BPC"] },
  { name: "TB-500", aliases: ["TB500", "thymosin beta-4", "thymosin beta 4"] },
  { name: "GHK-Cu", aliases: ["GHK copper", "glycyl-histidyl-lysine"] },
  { name: "LL-37", aliases: ["LL37", "cathelicidin"] },
  { name: "KPV", aliases: ["lysine-proline-valine"] },
  { name: "Ipamorelin", aliases: [] },
  { name: "CJC-1295", aliases: ["CJC1295"] },
  { name: "Sermorelin", aliases: [] },
  { name: "Tesamorelin", aliases: ["Egrifta"] },
  { name: "MK-677", aliases: ["MK677", "ibutamoren"] },
  { name: "Semaglutide", aliases: ["Ozempic", "Wegovy", "Rybelsus"] },
  { name: "Tirzepatide", aliases: ["Mounjaro", "Zepbound"] },
  { name: "Retatrutide", aliases: ["LY3437943"] },
  { name: "Liraglutide", aliases: ["Victoza", "Saxenda"] },
  { name: "Cagrilintide", aliases: ["CagriSema"] },
  { name: "AOD-9604", aliases: ["AOD9604", "HGH fragment"] },
  { name: "IGF-1 LR3", aliases: ["IGF-1 long R3"] },
  { name: "Follistatin", aliases: [] },
  { name: "Epitalon", aliases: ["Epithalon", "epithalamin"] },
  { name: "Thymalin", aliases: [] },
  { name: "Elamipretide", aliases: ["SS-31", "SS31", "MTP-131"] },
  { name: "MOTS-c", aliases: ["MOTSc"] },
  { name: "Humanin", aliases: [] },
  { name: "DSIP", aliases: ["delta sleep-inducing peptide", "emideltide"] },
  { name: "Semax", aliases: [] },
  { name: "Selank", aliases: [] },
  { name: "Bremelanotide", aliases: ["PT-141", "PT141", "Vyleesi"] },
  { name: "Thymosin alpha-1", aliases: ["thymalfasin", "Zadaxin"] },
  { name: "Kisspeptin", aliases: [] },
];

const BATCH_SIZE = 6;
const DAYS_BACK = 45;
const PER_BATCH_LIMIT = 12;
const TRIALS_LIMIT = 20;
const EPMC_LIMIT = 20;
const SUMMARY_CAP = 25;

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
const norm = (s: string) => (s || "").toLowerCase().replace(/[\s\-\u2013\u2014_\u00b7]/g, "");

// ── Relevance filter ──────────────────────────────────────────
// Returns compounds actually named in the text, or [] if none.
function matchedCompounds(text: string): string[] {
  const hay = norm(text);
  const hits: string[] = [];
  for (const c of WATCHLIST) {
    const terms = [c.name, ...c.aliases];
    const found = terms.some((t) => {
      const n = norm(t);
      return n.length >= 4 && hay.includes(n);
    });
    if (found && !hits.includes(c.name)) hits.push(c.name);
  }
  return hits;
}

function ncbiParams(extra: Record<string, string>) {
  const p = new URLSearchParams({ db: "pubmed", retmode: "json", tool: NCBI_TOOL, ...extra });
  if (NCBI_EMAIL) p.set("email", NCBI_EMAIL);
  if (NCBI_API_KEY) p.set("api_key", NCBI_API_KEY);
  return p.toString();
}

// ══════════════ SOURCE 1: PubMed ══════════════
async function pubmedSearch(compounds: string[]): Promise<string[]> {
  const term = compounds.map((c) => `"${c}"[Title/Abstract]`).join(" OR ");
  const url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" +
    ncbiParams({ term, sort: "pub_date", retmax: String(PER_BATCH_LIMIT), datetype: "pdat", reldate: String(DAYS_BACK) });
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.esearchresult?.idlist ?? [];
}

async function pubmedSummaries(pmids: string[]) {
  if (!pmids.length) return [];
  const url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?" + ncbiParams({ id: pmids.join(",") });
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const result = data?.result;
  if (!result) return [];
  return pmids.map((pmid) => {
    const r = result[pmid];
    if (!r || r.error) return null;
    const auth = Array.isArray(r.authors)
      ? r.authors.slice(0, 3).map((a: { name: string }) => a.name).filter(Boolean) : [];
    return {
      ext_id: pmid,
      source: "pubmed",
      title: (r.title || "").replace(/<\/?[^>]+>/g, "").trim(),
      journal: r.fulljournalname || r.source || "",
      pub_date: r.pubdate || r.epubdate || "",
      authors: auth.join(", ") + (r.authors?.length > 3 ? ", et al." : ""),
      pub_type: Array.isArray(r.pubtype) ? r.pubtype.join(", ") : "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
  }).filter(Boolean);
}

async function pubmedAbstracts(pmids: string[]): Promise<Record<string, string>> {
  if (!pmids.length) return {};
  const p: Record<string, string> = {
    db: "pubmed", id: pmids.join(","), rettype: "abstract", retmode: "text", tool: NCBI_TOOL,
  };
  if (NCBI_EMAIL) p.email = NCBI_EMAIL;
  if (NCBI_API_KEY) p.api_key = NCBI_API_KEY;
  const res = await fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?" + new URLSearchParams(p).toString());
  if (!res.ok) return {};
  const text = await res.text();
  const out: Record<string, string> = {};
  text.split(/\n\n(?=\d+\.\s)/).forEach((chunk) => {
    const m = chunk.match(/PMID:\s*(\d+)/);
    if (!m) return;
    const body = chunk.replace(/^[\s\S]*?\n\n/, "")
      .replace(/\n(Author information|DOI|PMID|PMCID)[\s\S]*$/i, "")
      .replace(/\s+/g, " ").trim();
    if (body.length > 80) out[m[1]] = body.slice(0, 4000);
  });
  return out;
}

// ══════════════ SOURCE 2: ClinicalTrials.gov ══════════════
// Trials in progress — often years before anything is published.
async function fetchTrials(compounds: string[]) {
  const url = "https://clinicaltrials.gov/api/v2/studies?" + new URLSearchParams({
    "query.intr": compounds.join(" OR "),
    pageSize: String(TRIALS_LIMIT),
    sort: "LastUpdatePostDate:desc",
    format: "json",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const studies = data?.studies ?? [];

  return studies.map((s: Record<string, unknown>) => {
    const proto = (s.protocolSection || {}) as Record<string, Record<string, unknown>>;
    const ident = proto.identificationModule || {};
    const status = proto.statusModule || {};
    const design = proto.designModule || {};
    const desc = proto.descriptionModule || {};
    const sponsor = proto.sponsorCollaboratorsModule || {};
    const arms = proto.armsInterventionsModule || {};
    const nctId = ident.nctId as string;
    if (!nctId) return null;

    const phases = Array.isArray(design.phases) ? (design.phases as string[]).join(", ") : "";
    const enroll = (design.enrollmentInfo as Record<string, unknown>)?.count;
    const interventions = Array.isArray(arms.interventions)
      ? (arms.interventions as Record<string, string>[]).map((i) => i.name).filter(Boolean).join(", ") : "";
    const lead = ((sponsor.leadSponsor as Record<string, string>) || {}).name || "";

    return {
      ext_id: nctId,
      source: "trial",
      title: (ident.briefTitle as string) || "",
      journal: lead,
      pub_date: (status.lastUpdatePostDateStruct as Record<string, string>)?.date
        || (status.startDateStruct as Record<string, string>)?.date || "",
      authors: "",
      pub_type: [status.overallStatus, phases, enroll ? `n=${enroll}` : ""].filter(Boolean).join(" \u00b7 "),
      abstract: [(desc.briefSummary as string) || "", interventions ? `Interventions: ${interventions}` : ""]
        .filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 4000),
      url: `https://clinicaltrials.gov/study/${nctId}`,
    };
  }).filter(Boolean);
}

// ══════════════ SOURCE 3: Europe PMC ══════════════
async function fetchEuropePMC(compounds: string[]) {
  const q = compounds.map((c) => `"${c}"`).join(" OR ");
  const url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + new URLSearchParams({
    query: `(${q}) AND (FIRST_PDATE:[NOW-60DAYS TO NOW])`,
    format: "json",
    pageSize: String(EPMC_LIMIT),
    resultType: "core",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const results = data?.resultList?.result ?? [];

  return results.map((r: Record<string, unknown>) => {
    const pmid = r.pmid as string | undefined;
    const id = (r.id as string) || pmid;
    if (!id) return null;
    const pubType = ((r.pubType as string) || "").toLowerCase();
    const isPreprint = pubType.includes("preprint");
    return {
      // Use the raw PMID when present so it dedupes against the PubMed pass
      ext_id: pmid || `epmc:${id}`,
      source: isPreprint ? "preprint" : "europepmc",
      title: ((r.title as string) || "").replace(/<\/?[^>]+>/g, "").trim(),
      journal: (r.journalTitle as string) || "Europe PMC",
      pub_date: (r.firstPublicationDate as string) || "",
      authors: ((r.authorString as string) || "").split(",").slice(0, 3).join(",").trim(),
      pub_type: isPreprint ? "Preprint \u2014 not peer reviewed" : ((r.pubType as string) || ""),
      abstract: ((r.abstractText as string) || "").replace(/<\/?[^>]+>/g, "").replace(/\s+/g, " ").slice(0, 4000),
      url: pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        : `https://europepmc.org/article/${(r.source as string) || "PPR"}/${id}`,
    };
  }).filter(Boolean);
}

// ── Summary of the real abstract ──────────────────────────────
async function summarize(title: string, abstract: string, isTrial: boolean): Promise<string | null> {
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 260,
        system: isTrial
          ? "You summarise clinical trial registrations for an educated general audience. Use ONLY what is in the description. Say what is being tested, in whom, and what the trial measures. Make clear this is a trial in progress, not a result. Two to three sentences. No preamble."
          : "You summarise biomedical abstracts for an educated general audience. Use ONLY information present in the abstract. Never add findings, numbers, or context that is not there. State the study type (in vitro, animal, human trial) when the abstract makes it clear, since that determines how much weight the finding carries. Two to three sentences. No preamble.",
        messages: [{ role: "user", content: `Title: ${title}\n\n${abstract}\n\nSummarise in 2-3 plain sentences.` }],
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

// ── Supabase ──────────────────────────────────────────────────
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

async function getExistingIds(): Promise<Set<string>> {
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
  const only = url.searchParams.get("source");

  const existing = await getExistingIds();
  const seen = new Set<string>();
  const collected: Record<string, unknown>[] = [];
  const stats = { pubmed: 0, trials: 0, europepmc: 0, filtered_out: 0 };
  const names = WATCHLIST.map((c) => c.name);

  // Only keeps a record if it genuinely names one of our compounds
  const accept = (rec: Record<string, unknown>, abstract: string): boolean => {
    const id = rec.ext_id as string;
    if (!id || existing.has(id) || seen.has(id)) return false;
    const hits = matchedCompounds(`${rec.title} ${abstract}`);
    if (!hits.length) { stats.filtered_out++; return false; }
    seen.add(id);
    collected.push({
      pmid: id,
      source: rec.source,
      title: rec.title,
      journal: rec.journal,
      pub_date: rec.pub_date,
      authors: rec.authors,
      pub_type: rec.pub_type,
      abstract,
      compounds: hits.join(", "),  // real matches, not the search batch
      url: rec.url,
      plain_summary: null,
    });
    return true;
  };

  // ── PubMed ──
  if (!only || only === "pubmed") {
    for (let i = 0; i < names.length; i += BATCH_SIZE) {
      const batch = names.slice(i, i + BATCH_SIZE);
      try {
        const pmids = (await pubmedSearch(batch)).filter((p) => !existing.has(p) && !seen.has(p));
        if (!pmids.length) { await sleep(400); continue; }
        const sums = await pubmedSummaries(pmids);
        await sleep(400);
        const abs = await pubmedAbstracts(pmids);
        for (const s of sums) {
          const rec = s as Record<string, unknown>;
          if (accept(rec, abs[rec.ext_id as string] || "")) stats.pubmed++;
        }
        await sleep(400);
      } catch (e) { console.error("PubMed batch failed:", batch, e); }
    }
  }

  // ── ClinicalTrials.gov ──
  if (!only || only === "trials") {
    for (let i = 0; i < names.length; i += BATCH_SIZE) {
      const batch = names.slice(i, i + BATCH_SIZE);
      try {
        for (const t of await fetchTrials(batch)) {
          const rec = t as Record<string, unknown>;
          if (accept(rec, (rec.abstract as string) || "")) stats.trials++;
        }
        await sleep(500);
      } catch (e) { console.error("Trials batch failed:", batch, e); }
    }
  }

  // ── Europe PMC ──
  if (!only || only === "europepmc") {
    for (let i = 0; i < names.length; i += BATCH_SIZE) {
      const batch = names.slice(i, i + BATCH_SIZE);
      try {
        for (const p of await fetchEuropePMC(batch)) {
          const rec = p as Record<string, unknown>;
          if (accept(rec, (rec.abstract as string) || "")) stats.europepmc++;
        }
        await sleep(400);
      } catch (e) { console.error("EuropePMC batch failed:", batch, e); }
    }
  }

  // ── Summaries ──
  if (withSummaries && ANTHROPIC_API_KEY) {
    const cap = Math.min(collected.length, SUMMARY_CAP);
    for (let i = 0; i < cap; i++) {
      const item = collected[i] as Record<string, unknown>;
      if (item.abstract) {
        item.plain_summary = await summarize(
          item.title as string, item.abstract as string, item.source === "trial");
      }
    }
  }

  if (!collected.length) {
    return json({ ok: true, inserted: 0, ...stats, message: "No new relevant records found." });
  }

  const ins = await sbRequest("research_feed", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(collected),
  });
  if (!ins.ok) return json({ error: "Insert failed", detail: await ins.text() }, 500);

  return json({
    ok: true,
    inserted: collected.length,
    ...stats,
    summarised: collected.filter((c) => c.plain_summary).length,
  });
});
