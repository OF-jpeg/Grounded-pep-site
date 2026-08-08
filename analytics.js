// ══════════════════════════════════════════════════════════════════════
//  GROUNDED — ANONYMOUS USAGE ANALYTICS
// ══════════════════════════════════════════════════════════════════════
// Tracks WHAT is popular, never WHO looked at it. No user IDs, no emails,
// no message contents — only counts of anonymous events.
//
// This is the data that makes the product better: which compounds people
// look for, what they search that returns nothing (content gaps), which
// paywalls get hit most. It is safe to summarise publicly and is the
// honest version of "monetising data" — it improves what you sell rather
// than selling the people using it.
//
// Stored locally by default. If the analytics_events table exists in
// Supabase (see SQL in ANALYTICS.md), events are also written there so
// you can query trends across all users.

const ANALYTICS_KEY = 'grounded_analytics';
const MAX_LOCAL_EVENTS = 500;

function trackEvent(type, value) {
  // Never accept anything that could identify a person
  if (!type) return;
  const event = {
    t: type,
    v: (value || '').toString().slice(0, 120),
    ts: Date.now()
  };

  // Local rolling log
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(event);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(list.slice(-MAX_LOCAL_EVENTS)));
  } catch (e) {}

  // Best-effort remote write; fails silently if the table doesn't exist
  sendEventToSupabase(event);
}

async function sendEventToSupabase(event) {
  if (typeof sb === 'undefined') return;
  try {
    await sb.from('analytics_events').insert({
      event_type: event.t,
      event_value: event.v
      // Deliberately no user_id — these are anonymous counts, not a profile
    });
  } catch (e) {}
}

// ── Local summary, useful for a quick read without querying Supabase ──
function getUsageSummary() {
  let list = [];
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    list = raw ? JSON.parse(raw) : [];
  } catch (e) { return {}; }

  const counts = {};
  list.forEach(e => {
    if (!counts[e.t]) counts[e.t] = {};
    counts[e.t][e.v] = (counts[e.t][e.v] || 0) + 1;
  });

  const summary = {};
  Object.keys(counts).forEach(type => {
    summary[type] = Object.entries(counts[type])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([value, count]) => ({ value, count }));
  });
  return summary;
}

// Handy in the browser console: copy(exportUsageSummary())
function exportUsageSummary() {
  return JSON.stringify(getUsageSummary(), null, 2);
}
