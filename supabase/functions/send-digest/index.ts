// ══════════════════════════════════════════════════════════════
//  GROUNDED — Research Digest Emails
// ══════════════════════════════════════════════════════════════
// Emails people when new research lands on compounds they track.
//
// Two shapes of email:
//   Personalised — they track compounds, so they get papers on those.
//   General      — they asked for alerts but track nothing yet, so they get
//                  the week's most notable research plus a nudge to pick
//                  compounds. Without this, anyone who signs up and never
//                  bookmarks gets silence forever and assumes the site is dead.
//
// Either way it only sends when there is something genuinely new for that
// person — an empty digest is worse than no digest, because it trains people
// to ignore the sender.
//
// Resend's free tier caps at 100 emails/day, so DAILY_CAP guards against
// silently dropping sends. Raise it if the plan changes.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Grounded <research@groundedpeptides.com>";
const SITE_URL = Deno.env.get("SITE_URL") || "https://groundedpeptides.com";

const DAILY_CAP = 95;        // stay under Resend's free 100/day
const LOOKBACK_DAYS = 7;     // how far back counts as "new"
const MAX_PAPERS_PER_EMAIL = 6;
const MAX_PAPERS_GENERAL = 4;   // a general digest is an invitation, not a firehose

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

const norm = (s: string) => (s || "").toLowerCase().replace(/[\s\-\u2013\u2014_]/g, "");
const esc = (s: string) => String(s || "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The compounds most people arrive looking for. Used only to rank a general
// digest, so someone who tracks nothing still opens on something recognisable
// rather than whichever obscure paper happened to land last.
const HEADLINE_COMPOUNDS = [
  "BPC-157", "TB-500", "Semaglutide", "Tirzepatide", "Retatrutide",
  "Tesamorelin", "CJC-1295", "Ipamorelin", "Sermorelin", "MOTS-c",
  "GHK-Cu", "Epitalon", "Semax", "DSIP", "KPV", "AOD-9604",
  "Thymosin alpha-1", "Kisspeptin",
].map((c) => norm(c));

async function sb(path: string, options: RequestInit = {}) {
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

// ── Email template ────────────────────────────────────────────
function buildEmail(
  firstName: string,
  papers: Record<string, string>[],
  token: string,
  personalized = true,
) {
  const greeting = firstName ? `Hi ${esc(firstName)},` : "Hi,";
  const count = papers.length;
  const unsubUrl = `${SITE_URL}/?unsubscribe=${encodeURIComponent(token)}`;
  const logoUrl = `${SITE_URL}/email-logo.png`;

  const items = papers.map((p) => {
    const compounds = p.compounds ? esc(p.compounds) : "";
    const summary = (p.plain_summary || p.abstract || "").slice(0, 200);
    const isTrial = p.source === "trial";
    const isPreprint = p.source === "preprint";
    const badge = isTrial ? "Clinical trial" : isPreprint ? "Preprint" : "Published paper";
    const badgeBg = isTrial ? "#ECFDF5" : isPreprint ? "#FFFBEB" : "#EFF6FF";
    const badgeFg = isTrial ? "#047857" : isPreprint ? "#B45309" : "#1D4ED8";
    const link = p.url || `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`;
    const journal = p.journal ? esc(p.journal) : "";
    // Deep links land in the AI with this study already loaded
    const aiSimple = `${SITE_URL}/?paper=${encodeURIComponent(p.pmid)}&ask=simple`;
    const aiEvidence = `${SITE_URL}/?paper=${encodeURIComponent(p.pmid)}&ask=evidence`;

    return `
    <tr><td style="padding:0 0 14px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1px solid #E2E8F0;border-radius:12px;background:#FFFFFF;border-collapse:separate">
        <tr><td style="padding:20px 22px">

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td><span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:${badgeFg};background:${badgeBg};padding:4px 10px;border-radius:20px">${badge}</span></td>
              <td align="right" style="font-size:11px;color:#94A3B8">${esc(p.pub_date || "")}</td>
            </tr>
          </table>

          <div style="font-size:16px;font-weight:600;color:#0F172A;line-height:1.45;margin:14px 0 0">${esc(p.title)}</div>
          ${journal ? `<div style="font-size:12px;color:#64748B;margin-top:6px">${journal}</div>` : ""}
          ${compounds ? `<div style="font-size:12px;font-weight:600;color:#2563EB;margin-top:10px">${compounds}</div>` : ""}
          ${summary ? `<div style="font-size:13.5px;color:#475569;line-height:1.7;margin-top:12px">${esc(summary)}\u2026</div>` : ""}

          ${isPreprint ? `<div style="font-size:12px;color:#92400E;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:4px;padding:10px 12px;margin-top:14px;line-height:1.5">Not yet peer reviewed \u2014 treat findings as provisional.</div>` : ""}
          ${isTrial ? `<div style="font-size:12px;color:#065F46;background:#ECFDF5;border-left:3px solid #10B981;border-radius:4px;padding:10px 12px;margin-top:14px;line-height:1.5">Registered trial in progress, not a published result.</div>` : ""}

          <div style="margin-top:16px;padding-top:15px;border-top:1px solid #F1F5F9">
            <div style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#94A3B8;margin-bottom:10px">Ask our AI about this</div>
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:8px">
                  <a href="${esc(aiSimple)}" style="display:inline-block;font-size:12.5px;font-weight:600;color:#1D4ED8;background:#EFF6FF;border:1px solid #BFDBFE;padding:8px 14px;border-radius:8px;text-decoration:none">Explain simply</a>
                </td>
                <td style="padding-right:8px">
                  <a href="${esc(aiEvidence)}" style="display:inline-block;font-size:12.5px;font-weight:600;color:#1D4ED8;background:#EFF6FF;border:1px solid #BFDBFE;padding:8px 14px;border-radius:8px;text-decoration:none">How strong is this?</a>
                </td>
              </tr>
            </table>
            <div style="margin-top:12px">
              <a href="${esc(link)}" style="font-size:12px;color:#94A3B8;text-decoration:underline">Or read the original study</a>
            </div>
          </div>

        </td></tr>
      </table>
    </td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${personalized ? "New research on compounds you track" : "New peptide research this week"}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    ${count === 1 ? "One new study" : count + " new studies"}${personalized ? " on compounds you track" : " in peptide research"} &mdash; ${esc(papers[0].title.slice(0, 80))}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F1F5F9;padding:36px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px">

        <tr><td align="center" style="padding-bottom:28px">
          <img src="${logoUrl}" width="52" height="52" alt="Grounded"
               style="display:block;border-radius:14px;margin:0 auto 12px">
          <div style="font-size:19px;font-weight:700;color:#0F172A;letter-spacing:-.3px">Grounded</div>
          <div style="font-size:12px;color:#94A3B8;margin-top:3px">${personalized ? "Research alert" : "This week in research"}</div>
        </td></tr>

        <tr><td style="padding:0 4px 24px">
          <div style="font-size:15px;color:#334155;line-height:1.75">
            ${greeting}<br><br>
            ${personalized
              ? (count === 1
                  ? "One new study was published on a compound you're tracking."
                  : `${count} new studies were published on compounds you're tracking.`)
              : `Here's some of the most notable peptide research to land recently. ` +
                `Track the compounds you care about and these emails will only cover those.`}
          </div>
        </td></tr>

        ${items}

        ${personalized ? "" : `
        <tr><td style="padding:6px 0 4px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="border:1px solid #BFDBFE;border-radius:12px;background:#EFF6FF;border-collapse:separate">
            <tr><td style="padding:20px 22px">
              <div style="font-size:15px;font-weight:600;color:#0F172A">Make this yours</div>
              <div style="font-size:13.5px;color:#475569;line-height:1.7;margin-top:8px">
                Bookmark any compound on Grounded and we'll email you the moment new
                research mentions it \u2014 nothing else.
              </div>
              <div style="margin-top:16px">
                <a href="${SITE_URL}/?p=database" style="display:inline-block;background:#1D4ED8;color:#FFFFFF;font-size:13px;font-weight:600;padding:11px 22px;border-radius:9px;text-decoration:none">Pick your compounds</a>
              </div>
            </td></tr>
          </table>
        </td></tr>`}

        ${!personalized ? "" : `
        <tr><td align="center" style="padding:14px 0 32px">
          <a href="${SITE_URL}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none">See all research</a>
        </td></tr>`}
        ${personalized ? "" : `<tr><td style="padding:0 0 18px"></td></tr>`}

        <tr><td style="border-top:1px solid #E2E8F0;padding-top:22px">
          <div style="font-size:12px;color:#94A3B8;line-height:1.75">
            Grounded provides educational information for research purposes only.
            This is not medical advice. Consult a licensed healthcare professional
            before using any compound.
          </div>
          <div style="font-size:12px;color:#94A3B8;line-height:1.75;margin-top:14px">
            ${personalized
              ? "You're receiving this because you asked for research alerts on compounds you track."
              : "You're receiving this because you turned on research alerts when you signed up."}<br>
            <a href="${SITE_URL}" style="color:#64748B;text-decoration:underline">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${esc(unsubUrl)}" style="color:#64748B;text-decoration:underline">Unsubscribe</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── General digest selection ──────────────────────────────────
// For someone who asked for alerts but hasn't tracked anything yet. Ranks the
// recent feed so the email opens on a compound they'll recognise, prefers
// peer-reviewed work over registry entries, and never repeats a compound —
// four papers on semaglutide reads like a glitch, not a digest.
function pickGeneralPapers(papers: Record<string, string>[], lastSent: number) {
  const fresh = papers.filter((p) => new Date(p.created_at).getTime() > lastSent);

  const scored = fresh.map((p) => {
    const hay = norm(`${p.compounds || ""} ${p.title}`);
    const headline = HEADLINE_COMPOUNDS.some((c) => hay.includes(c));
    const reviewed = p.source === "pubmed" || p.source === "europepmc";
    const summarised = Boolean(p.plain_summary);
    return { p, score: (headline ? 4 : 0) + (reviewed ? 2 : 0) + (summarised ? 1 : 0) };
  }).sort((a, b) => b.score - a.score);

  const picked: Record<string, string>[] = [];
  const usedCompounds = new Set<string>();
  for (const { p } of scored) {
    if (picked.length >= MAX_PAPERS_GENERAL) break;
    // `compounds` is comma-joined; the first one is the paper's headline subject
    const key = norm((p.compounds || "").split(",")[0] || p.pmid);
    if (usedCompounds.has(key)) continue;
    usedCompounds.add(key);
    picked.push(p);
  }
  return picked;
}

// ══════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Missing Supabase env" }, 500);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY secret is not set" }, 500);

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "true";

  // 1. Who wants research alerts
  const prefsRes = await sb("email_preferences?select=*&research_alerts=eq.true");
  if (!prefsRes.ok) {
    return json({ error: "Could not read email_preferences", detail: await prefsRes.text() }, 500);
  }
  const subscribers = await prefsRes.json();
  if (!subscribers.length) return json({ ok: true, sent: 0, message: "No subscribers." });

  // 2. Recent papers
  const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();
  const feedRes = await sb(
    `research_feed?select=pmid,title,journal,pub_date,plain_summary,abstract,compounds,source,url,created_at` +
    `&created_at=gte.${since}&order=created_at.desc&limit=200`
  );
  const papers = feedRes.ok ? await feedRes.json() : [];
  if (!papers.length) return json({ ok: true, sent: 0, message: "No new papers this period." });

  const results = {
    sent: 0, sent_personalized: 0, sent_general: 0,
    skipped_no_match: 0, skipped_nothing_to_send: 0, failed: 0, capped: 0,
  };
  const preview: Record<string, unknown>[] = [];

  for (const sub of subscribers) {
    if (results.sent >= DAILY_CAP) { results.capped++; continue; }

    const tracked: string[] = Array.isArray(sub.tracked_compounds) ? sub.tracked_compounds : [];
    const lastSent = sub.last_digest_at ? new Date(sub.last_digest_at).getTime() : 0;
    // Terms under 3 chars match everything, so they're dropped — which can leave
    // nothing usable. Treat that like tracking nothing rather than sending silence.
    const trackedNorm = tracked.map(norm).filter((t: string) => t.length >= 3);
    const personalized = trackedNorm.length > 0;

    let matches: Record<string, string>[];
    if (personalized) {
      // Papers that mention something they track AND arrived since their last digest
      matches = papers.filter((p: Record<string, string>) => {
        if (new Date(p.created_at).getTime() <= lastSent) return false;
        const hay = norm(`${p.title} ${p.compounds || ""} ${p.plain_summary || ""}`);
        return trackedNorm.some((t: string) => hay.includes(t));
      }).slice(0, MAX_PAPERS_PER_EMAIL);
      if (!matches.length) { results.skipped_no_match++; continue; }
    } else {
      matches = pickGeneralPapers(papers, lastSent);
      if (!matches.length) { results.skipped_nothing_to_send++; continue; }
    }

    if (dryRun) {
      preview.push({
        email: sub.email,
        kind: personalized ? "personalized" : "general",
        matches: matches.length,
        titles: matches.map((m: Record<string, string>) => m.title),
      });
      results.sent++;
      if (personalized) results.sent_personalized++; else results.sent_general++;
      continue;
    }

    try {
      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [sub.email],
          subject: personalized
            ? (matches.length === 1
                ? `New research: ${matches[0].title.slice(0, 60)}`
                : `${matches.length} new studies on compounds you track`)
            : `This week in peptide research: ${matches[0].title.slice(0, 55)}`,
          html: buildEmail(sub.first_name || "", matches, sub.unsubscribe_token, personalized),
        }),
      });

      if (send.ok) {
        results.sent++;
        if (personalized) results.sent_personalized++; else results.sent_general++;
        await sb(`email_preferences?id=eq.${sub.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ last_digest_at: new Date().toISOString() }),
        });
      } else {
        results.failed++;
        console.error("Resend failed for", sub.email, await send.text());
      }
    } catch (e) {
      results.failed++;
      console.error("Send threw for", sub.email, e);
    }
  }

  return json({ ok: true, ...results, subscribers: subscribers.length, ...(dryRun ? { dry_run: true, preview } : {}) });
});
