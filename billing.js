// ══════════════════════════════════════════════
//  GROUNDED — BILLING TOGGLE + FREE-FEATURE GATING
// ══════════════════════════════════════════════
// Note: no payment processor is wired up yet — "Start Pro" currently
// routes to the pricing page. This handles the monthly/annual price
// display and the soft paywall that gates free-tier feature usage.

const MONTHLY_PRICE = 29;
const ANNUAL_MONTHLY_PRICE = 19; // billed annually at $228/yr

function setBilling(period) {
  const monthlyBtn = document.getElementById('btMonthly');
  const annualBtn = document.getElementById('btAnnual');
  const amt = document.getElementById('priceAmt');
  const per = document.getElementById('pricePer');
  if (!monthlyBtn || !annualBtn) return;

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

// ── Free-feature usage tracking ──────────────────────────────────────
// Tracks a single free generation per feature (currently: 'protocol').
// Checks localStorage first for instant response; if signed in, also
// checks Supabase user_metadata so the limit follows the account
// across devices rather than just the browser.

function isPro() {
  // No billing processor connected yet — always false until Stripe is wired up.
  // Once connected, this should check currentUser?.user_metadata?.is_pro.
  return (typeof currentUser !== 'undefined' && currentUser?.user_metadata?.is_pro) === true;
}

function canUseFreeFeature(feature) {
  if (isPro()) return true;
  const key = 'grounded_free_used_' + feature;
  const usedLocally = localStorage.getItem(key) === 'true';
  if (usedLocally) return false;
  if (typeof currentUser !== 'undefined' && currentUser) {
    const meta = currentUser.user_metadata || {};
    if (meta[key] === true) return false;
  }
  return true;
}

async function markFreeFeatureUsed(feature) {
  const key = 'grounded_free_used_' + feature;
  try { localStorage.setItem(key, 'true'); } catch (e) {}
  if (typeof currentUser !== 'undefined' && currentUser && typeof sb !== 'undefined') {
    try {
      await sb.auth.updateUser({ data: { [key]: true } });
    } catch (e) {}
  }
}

// ── Paywall modal ─────────────────────────────────────────────────────
function openPaywall() {
  document.getElementById('paywallOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePaywall() {
  document.getElementById('paywallOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
