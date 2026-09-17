// ══════════════════════════════════════════════════════════════════════
//  GROUNDED — EMAIL PREFERENCES
// ══════════════════════════════════════════════════════════════════════
// Keeps the email_preferences row in sync with what the person tracks, so
// digests only ever mention compounds they actually care about.
//
// Also handles ?unsubscribe=<token> links, which have to work without the
// person being signed in — they're clicking from an email client.

let emailPrefs = null;

// ── Unsubscribe (runs before anything else, no auth required) ──────────
async function handleUnsubscribeLink() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('unsubscribe');
  if (!token) return false;

  // Clear it from the URL so a refresh doesn't re-trigger
  history.replaceState({}, '', window.location.pathname);

  if (typeof sb === 'undefined') return false;
  try {
    const { error } = await sb
      .from('email_preferences')
      .update({ research_alerts: false, product_updates: false })
      .eq('unsubscribe_token', token);

    showUnsubscribeResult(!error);
  } catch (e) {
    showUnsubscribeResult(false);
  }
  return true;
}

function showUnsubscribeResult(ok) {
  const el = document.getElementById('unsubBanner');
  if (!el) return;
  el.innerHTML = ok
    ? `<strong>You're unsubscribed.</strong> You won't get any more emails from us.
       You can turn them back on any time in your account settings.
       <button class="unsub-x" onclick="this.parentElement.style.display='none'">✕</button>`
    : `<strong>That link didn't work.</strong> It may have already been used.
       If you're still getting emails, let us know via the Community page.
       <button class="unsub-x" onclick="this.parentElement.style.display='none'">✕</button>`;
  el.style.display = 'block';
}

// ── Preferences ────────────────────────────────────────────────────────
async function loadEmailPrefs() {
  if (typeof currentUser === 'undefined' || !currentUser || typeof sb === 'undefined') return null;
  try {
    const { data, error } = await sb
      .from('email_preferences')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) return null;
    emailPrefs = data;
    return data;
  } catch (e) { return null; }
}

// Creates the row on first use, then keeps tracked_compounds current
async function syncEmailPrefs() {
  if (typeof currentUser === 'undefined' || !currentUser || typeof sb === 'undefined') return;
  const meta = currentUser.user_metadata || {};
  const tracked = (typeof getMyCompounds === 'function') ? getMyCompounds() : [];

  try {
    if (!emailPrefs) await loadEmailPrefs();

    if (!emailPrefs) {
      // First time — create with alerts on, since they signed up for the product
      const { data } = await sb.from('email_preferences').insert({
        user_id: currentUser.id,
        email: currentUser.email,
        first_name: meta.first_name || null,
        tracked_compounds: tracked,
      }).select().maybeSingle();
      emailPrefs = data;
      return;
    }

    // Write if tracked compounds changed, or if first_name is missing —
    // accounts created before the name field existed have a blank greeting
    const prev = (emailPrefs.tracked_compounds || []).slice().sort().join('|');
    const now = tracked.slice().sort().join('|');
    const nameMissing = !emailPrefs.first_name && meta.first_name;
    if (prev !== now || nameMissing) {
      await sb.from('email_preferences')
        .update({
          tracked_compounds: tracked,
          email: currentUser.email,
          first_name: meta.first_name || emailPrefs.first_name || null,
        })
        .eq('user_id', currentUser.id);
      emailPrefs.tracked_compounds = tracked;
      if (meta.first_name) emailPrefs.first_name = meta.first_name;
    }
  } catch (e) { /* table may not exist yet */ }
}

async function setEmailPref(field, value) {
  if (typeof currentUser === 'undefined' || !currentUser) {
    toast('Sign in to change email settings');
    return;
  }
  try {
    await sb.from('email_preferences')
      .update({ [field]: value })
      .eq('user_id', currentUser.id);
    if (emailPrefs) emailPrefs[field] = value;
    renderEmailPrefsUI();
    toast(value ? 'Turned on ✓' : 'Turned off');
    if (typeof trackEvent === 'function') trackEvent('email_pref', field + ':' + value);
  } catch (e) {
    toast('Could not save that — try again');
  }
}

function renderEmailPrefsUI() {
  const wrap = document.getElementById('emailPrefsBody');
  if (!wrap) return;

  if (typeof currentUser === 'undefined' || !currentUser) {
    wrap.innerHTML = `<div class="ep-signin">
      <p>Sign in to manage email alerts.</p>
      <button class="btn-hero bh1" onclick="closeEmailPrefs();openAuth('signin')">Sign in</button>
    </div>`;
    return;
  }

  const p = emailPrefs || {};
  const tracked = (typeof getMyCompounds === 'function') ? getMyCompounds() : [];
  const row = (field, title, desc, on) => `
    <div class="ep-row">
      <div class="ep-row-text">
        <div class="ep-row-title">${title}</div>
        <div class="ep-row-desc">${desc}</div>
      </div>
      <button class="ep-toggle${on ? ' on' : ''}" onclick="setEmailPref('${field}', ${!on})"
              role="switch" aria-checked="${on}" aria-label="${title}">
        <span class="ep-knob"></span>
      </button>
    </div>`;

  wrap.innerHTML =
    row('research_alerts', 'New research alerts',
        'A weekly email when studies are published on compounds you track. Nothing is sent if there is nothing new.',
        p.research_alerts !== false) +
    row('product_updates', 'Product updates',
        'Occasional notes about new features. Infrequent.',
        p.product_updates !== false) +
    `<div class="ep-tracked">
       <div class="ep-tracked-label">Alerts cover what you track</div>
       ${tracked.length
         ? `<div class="ep-chips">${tracked.map(t => `<span class="ep-chip">${esc(t)}</span>`).join('')}</div>`
         : `<div class="ep-empty">You're not tracking anything yet — add compounds to your Dose Tracker or bookmark them, and alerts will follow those.
            <button class="btn-hero bh2" style="margin-top:12px" onclick="closeEmailPrefs();show('tracker')">Open Dose Tracker</button></div>`}
     </div>
     <div class="ep-note">We only email about research on your compounds. No digests with nothing in them.</div>`;
}

function openEmailPrefs() {
  document.getElementById('emailPrefsOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  loadEmailPrefs().then(renderEmailPrefsUI);
}
function closeEmailPrefs() {
  const ov = document.getElementById('emailPrefsOverlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
}

// Run the unsubscribe check as soon as Supabase is available
if (document.readyState === 'complete') handleUnsubscribeLink();
else window.addEventListener('load', handleUnsubscribeLink);
