// ══════════════════════════════════════════════
//  GROUNDED — PLANS, LIMITS & PAYWALL
// ══════════════════════════════════════════════
// IMPORTANT: this is client-side gating only. It shapes the experience
// and drives upgrade prompts, but it is NOT security — a determined user
// can bypass it via devtools. Real enforcement requires server-side
// checks, which land alongside Stripe + Supabase Edge Functions.
//
// Until a payment processor is connected, isPro() is driven entirely by
// the `is_pro` flag on a user's Supabase metadata, which can be set
// manually from the Supabase dashboard to comp early users.

const MONTHLY_PRICE = 29;
const ANNUAL_MONTHLY_PRICE = 19; // billed annually at $228/yr

const FREE_LIMITS = {
  compounds: 15,     // most-popular compounds openable on the free plan
  aiPerDay: 10,      // AI Guide messages per rolling day
  protocolTotal: 1,  // lifetime free Protocol Builder generations
  bookmarks: 5,      // saved compounds
  regimenItems: 2,   // tracked doses in the Dose Tracker
  vials: 1,          // vials in inventory
  stacks: 2          // readable curated stacking guides
};

// ── Plan state ────────────────────────────────────────────────────────
function isPro() {
  if (typeof currentUser === 'undefined' || !currentUser) return false;
  return (currentUser.user_metadata || {}).is_pro === true;
}

// Compound IDs available on the free plan (top N by popularity)
function freeCompoundIds() {
  if (typeof PEPS === 'undefined') return [];
  return PEPS.slice()
    .sort(function (a, b) { return b.pop - a.pop; })
    .slice(0, FREE_LIMITS.compounds)
    .map(function (p) { return p.id; });
}
function canOpenCompound(id) {
  if (isPro()) return true;
  return freeCompoundIds().indexOf(id) !== -1;
}

// ── Daily AI message counter ──────────────────────────────────────────
function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function getAiUsedToday() {
  try {
    var raw = localStorage.getItem('grounded_ai_usage');
    if (!raw) return 0;
    var data = JSON.parse(raw);
    return data.date === todayKey() ? (data.count || 0) : 0;
  } catch (e) { return 0; }
}
function incrementAiUsage() {
  try {
    localStorage.setItem('grounded_ai_usage', JSON.stringify({ date: todayKey(), count: getAiUsedToday() + 1 }));
  } catch (e) {}
  updateAiQuotaUI();
}
function aiMessagesRemaining() {
  if (isPro()) return Infinity;
  return Math.max(0, FREE_LIMITS.aiPerDay - getAiUsedToday());
}
function canSendAiMessage() {
  return isPro() || aiMessagesRemaining() > 0;
}
function updateAiQuotaUI() {
  var el = document.getElementById('aiQuota');
  if (!el) return;
  if (isPro()) { el.style.display = 'none'; return; }
  var left = aiMessagesRemaining();
  el.style.display = '';
  el.innerHTML = left > 0
    ? left + ' of ' + FREE_LIMITS.aiPerDay + " free messages left today · <a onclick=\"show('pricing')\">Upgrade</a>"
    : "Daily limit reached · <a onclick=\"show('pricing')\">Upgrade for unlimited</a>";
}

// ── One-time free feature usage (Protocol Builder) ────────────────────
function canUseFreeFeature(feature) {
  if (isPro()) return true;
  var key = 'grounded_free_used_' + feature;
  if (localStorage.getItem(key) === 'true') return false;
  if (typeof currentUser !== 'undefined' && currentUser) {
    if ((currentUser.user_metadata || {})[key] === true) return false;
  }
  return true;
}
async function markFreeFeatureUsed(feature) {
  var key = 'grounded_free_used_' + feature;
  try { localStorage.setItem(key, 'true'); } catch (e) {}
  if (typeof currentUser !== 'undefined' && currentUser && typeof sb !== 'undefined') {
    try { await sb.auth.updateUser({ data: { [key]: true } }); } catch (e) {}
  }
}

// ── Pricing page monthly/annual toggle ────────────────────────────────
function setBilling(period) {
  var monthlyBtn = document.getElementById('btMonthly');
  var annualBtn = document.getElementById('btAnnual');
  var amt = document.getElementById('priceAmt');
  var per = document.getElementById('pricePer');
  if (!monthlyBtn || !annualBtn || !amt || !per) return;

  if (period === 'annual') {
    monthlyBtn.classList.remove('on');
    annualBtn.classList.add('on');
    amt.textContent = '$' + ANNUAL_MONTHLY_PRICE;
    per.textContent = '/month · billed $' + (ANNUAL_MONTHLY_PRICE * 12) + '/year';
  } else {
    annualBtn.classList.remove('on');
    monthlyBtn.classList.add('on');
    amt.textContent = '$' + MONTHLY_PRICE;
    per.textContent = '/month · cancel anytime';
  }
}

// ── Count-based limits (bookmarks, tracker) ───────────────────────────
// Each returns true when the user is still under their plan's limit.
function canAddBookmark(currentCount) {
  return isPro() || currentCount < FREE_LIMITS.bookmarks;
}
function canAddRegimenItem(currentCount) {
  return isPro() || currentCount < FREE_LIMITS.regimenItems;
}
function canAddVial(currentCount) {
  return isPro() || currentCount < FREE_LIMITS.vials;
}
function canViewStack(index) {
  return isPro() || index < FREE_LIMITS.stacks;
}

// ── Contextual paywall ────────────────────────────────────────────────
var PAYWALL_COPY = {
  compound: {
    title: 'This compound is Pro-only',
    sub: 'The free plan includes the ' + FREE_LIMITS.compounds + ' most-researched compounds. Upgrade to unlock the full database.'
  },
  ai: {
    title: "You've hit today's message limit",
    sub: 'Free accounts get ' + FREE_LIMITS.aiPerDay + ' AI messages per day. Upgrade for unlimited conversations.'
  },
  protocol: {
    title: "You've used your free generation",
    sub: 'Upgrade to Pro for unlimited access to the Protocol Builder and every other feature on Grounded.'
  },
  research: {
    title: 'Research Hub is Pro-only',
    sub: 'Get curated research summaries and plain-language breakdowns of the latest peptide science.'
  },
  bookmark: {
    title: 'Bookmark limit reached',
    sub: 'Free accounts can save ' + FREE_LIMITS.bookmarks + ' compounds. Upgrade for unlimited bookmarks.'
  },
  regimen: {
    title: 'Track more compounds with Pro',
    sub: 'Free accounts can track ' + FREE_LIMITS.regimenItems + ' doses at a time. Upgrade to build your full protocol.'
  },
  vial: {
    title: 'Vial limit reached',
    sub: 'Free accounts can track ' + FREE_LIMITS.vials + ' vial. Upgrade to manage your whole inventory with cost-per-dose tracking.'
  },
  stack: {
    title: 'This stack is Pro-only',
    sub: 'Free accounts get ' + FREE_LIMITS.stacks + ' curated stacking guides. Upgrade to unlock every protocol.'
  },
  export: {
    title: 'Conversation export is Pro-only',
    sub: 'Upgrade to download your AI conversations as Markdown or PDF, or copy them in full.'
  },
  tracker: {
    title: 'Cloud sync is Pro-only',
    sub: 'Your tracker works locally on the free plan. Upgrade to sync doses and vials across all your devices.'
  }
};

function openPaywall(context) {
  // Which limits people actually hit tells you where the value is
  if (typeof trackEvent === 'function') trackEvent('paywall_hit', context || 'unknown');
  var copy = PAYWALL_COPY[context] || PAYWALL_COPY.protocol;
  var t = document.getElementById('paywallTitle');
  var s = document.getElementById('paywallSub');
  if (t) t.textContent = copy.title;
  if (s) s.textContent = copy.sub;
  document.getElementById('paywallOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePaywall() {
  document.getElementById('paywallOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Reflect plan state across the UI ──────────────────────────────────
function applyPlanUI() {
  var pro = isPro();
  var badge = document.getElementById('proBadge');
  if (badge) badge.style.display = pro ? '' : 'none';
  var getProBtn = document.querySelector('.btn-pro');
  if (getProBtn) getProBtn.style.display = pro ? 'none' : '';
  updateAiQuotaUI();
  if (typeof renderDB === 'function' && document.getElementById('dbGrid')) renderDB();
  if (typeof renderResearch === 'function') renderResearch();
  if (typeof renderStacks === 'function') renderStacks();
  if (typeof updatePlanCounts === 'function') updatePlanCounts();
}
