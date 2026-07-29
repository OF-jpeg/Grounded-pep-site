// ══════════════════════════════════════════════
//  GROUNDED — AUTHENTICATION (Supabase)
// ══════════════════════════════════════════════
// Handles: email/password sign in + sign up, Google OAuth, GitHub OAuth,
// session persistence, and the nav bar sign-in / user-chip UI.

const SUPABASE_URL = 'https://wewrhhetpcalgkdhzxtt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qalpxULqaEoDneQBzVbvlA_cfqQV7is';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let authMode = 'signin'; // 'signin' | 'signup'
let currentUser = null;

// ── UI: open / close modal ──────────────────────────────────────────
function openAuth(mode) {
  if (mode === 'signup' && authMode !== 'signup') {
    toggleAuthMode();
  } else if (mode === 'signin' && authMode !== 'signin') {
    toggleAuthMode();
  }
  document.getElementById('authOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  clearAuthError();
}
function closeAuth() {
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
function handleAuthMO(e) {
  if (e.target.id === 'authOverlay') closeAuth();
}
function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  const title = document.getElementById('authTitle');
  const sub = document.getElementById('authSub');
  const btn = document.getElementById('authSubmitBtn');
  const switchEl = document.getElementById('authSwitch');
  const fields1 = document.getElementById('authSignupFields');
  const fields2 = document.getElementById('authSignupFields2');
  clearAuthError();
  if (authMode === 'signup') {
    title.textContent = 'Create your account';
    sub.textContent = 'Start saving bookmarks and chat history';
    btn.textContent = 'Sign up';
    switchEl.innerHTML = 'Already have an account? <a onclick="toggleAuthMode()">Sign in</a>';
    fields1.style.display = '';
    fields2.style.display = '';
    document.getElementById('authFirstName').required = true;
    document.getElementById('authLastName').required = true;
    document.getElementById('authDob').required = true;
  } else {
    title.textContent = 'Welcome back';
    sub.textContent = 'Sign in to save bookmarks and chat history';
    btn.textContent = 'Sign in';
    switchEl.innerHTML = "Don't have an account? <a onclick=\"toggleAuthMode()\">Sign up</a>";
    fields1.style.display = 'none';
    fields2.style.display = 'none';
    document.getElementById('authFirstName').required = false;
    document.getElementById('authLastName').required = false;
    document.getElementById('authDob').required = false;
  }
}
function calcAge(dobStr) {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = 'block';
}
function clearAuthError() {
  const el = document.getElementById('authError');
  el.style.display = 'none';
  el.textContent = '';
}

// ── Email / password auth ───────────────────────────────────────────
async function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthError();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');

  if (authMode === 'signup') {
    const firstName = document.getElementById('authFirstName').value.trim();
    const lastName = document.getElementById('authLastName').value.trim();
    const dob = document.getElementById('authDob').value;
    const phone = document.getElementById('authPhone').value.trim();

    if (!firstName || !lastName) {
      showAuthError('Please enter your first and last name.');
      return;
    }
    if (!dob) {
      showAuthError('Please enter your date of birth.');
      return;
    }
    const age = calcAge(dob);
    if (age === null) {
      showAuthError('Please enter a valid date of birth.');
      return;
    }
    if (age < 21) {
      showAuthError('You must be 21 or older to create a Grounded account.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing up…';
    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            date_of_birth: dob,
            phone: phone || null
          }
        }
      });
      if (error) throw error;
      if (data.user && !data.session) {
        showAuthError('Check your inbox to confirm your email, then sign in.');
        toggleAuthMode();
      } else {
        closeAuth();
        toast(`Welcome to Grounded, ${firstName}!`);
      }
    } catch (err) {
      showAuthError(err.message || 'Something went wrong. Please try again.');
    }
    btn.disabled = false;
    btn.textContent = 'Sign up';
  } else {
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuth();
      toast('Signed in ✓');
    } catch (err) {
      showAuthError(err.message || 'Something went wrong. Please try again.');
    }
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}

// ── OAuth (Google / GitHub) ──────────────────────────────────────────
async function signInWithProvider(provider) {
  clearAuthError();
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.href.split('#')[0].split('?')[0] }
  });
  if (error) showAuthError(error.message || 'Could not start sign-in. Please try again.');
}

// ── Sign out ─────────────────────────────────────────────────────────
async function signOutUser() {
  await sb.auth.signOut();
  toast('Signed out');
  updateAuthUI(null);
}

// ── User chip / menu ─────────────────────────────────────────────────
function toggleUserMenu() {
  document.getElementById('userMenu').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const chip = document.getElementById('navUserChip');
  const menu = document.getElementById('userMenu');
  if (chip && menu && !chip.contains(e.target)) menu.classList.remove('open');
});

// ── Avatar: OAuth profile photo if available, else initial ────────────
// Google/OAuth providers expose the photo as avatar_url or picture.
// The image is preloaded first so a broken/blocked URL falls back to the
// initial instead of rendering an empty circle.
function setUserAvatar(user, label) {
  const el = document.getElementById('userChipAvatar');
  if (!el) return;
  const meta = user.user_metadata || {};
  const photo = meta.avatar_url || meta.picture || null;
  const initial = (label || 'U').charAt(0).toUpperCase();

  // Default to the initial immediately, then upgrade to the photo if it loads
  el.textContent = initial;
  el.style.backgroundImage = '';
  el.classList.remove('has-photo');

  if (!photo) return;
  const img = new Image();
  img.onload = () => {
    el.textContent = '';
    el.style.backgroundImage = `url("${photo}")`;
    el.classList.add('has-photo');
  };
  img.onerror = () => { /* keep the initial fallback */ };
  img.src = photo;
}

// ── Update nav UI based on auth state ────────────────────────────────
function updateAuthUI(user) {
  currentUser = user;
  const signInBtn = document.getElementById('navSignInBtn');
  const signUpBtn = document.getElementById('navSignUpBtn');
  const userChip = document.getElementById('navUserChip');
  if (user) {
    signInBtn.style.display = 'none';
    signUpBtn.style.display = 'none';
    userChip.style.display = 'flex';
    const label = user.user_metadata?.first_name || user.user_metadata?.full_name || user.user_metadata?.user_name || user.email || 'User';
    document.getElementById('userChipName').textContent = label.split(' ')[0];
    document.getElementById('userMenuEmail').textContent = user.email || '';
    setUserAvatar(user, label);
  } else {
    signInBtn.style.display = '';
    signUpBtn.style.display = '';
    userChip.style.display = 'none';
  }
  // Refresh goal-based homepage recommendations for this user
  if (typeof renderRecommendations === 'function') renderRecommendations();
  // Reflect Pro/Free plan state across gated UI
  if (typeof applyPlanUI === 'function') applyPlanUI();
}

// ── Profile completion: DOB gap-fill + onboarding ────────────────────
function checkProfileCompletion(user) {
  if (!user) return;
  const meta = user.user_metadata || {};
  if (!meta.date_of_birth) {
    openDobGate();
    return;
  }
  if (!meta.onboarding_completed) {
    openOnboarding();
  }
}

function openDobGate() {
  document.getElementById('dobGateOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDobGate() {
  document.getElementById('dobGateOverlay').classList.remove('open');
}

async function submitDobGate() {
  const input = document.getElementById('dobGateInput');
  const dob = input.value;
  const errEl = document.getElementById('dobGateError');
  const btn = document.getElementById('dobGateBtn');
  errEl.style.display = 'none';

  if (!dob) {
    errEl.textContent = 'Please enter your date of birth.';
    errEl.style.display = 'block';
    return;
  }
  const age = calcAge(dob);
  if (age === null) {
    errEl.textContent = 'Please enter a valid date of birth.';
    errEl.style.display = 'block';
    return;
  }
  if (age < 21) {
    errEl.textContent = 'You must be 21 or older to use Grounded.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const { data, error } = await sb.auth.updateUser({ data: { date_of_birth: dob } });
    if (error) throw error;
    closeDobGate();
    currentUser = data.user;
    checkProfileCompletion(data.user);
  } catch (err) {
    errEl.textContent = err.message || 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Confirm and continue';
}

let selectedOnboardGoal = null;
let selectedOnboardExp = null;

function selOnboardGoal(el) {
  document.querySelectorAll('#onboardGoals .onboard-goal-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  selectedOnboardGoal = el.dataset.val;
}
function selOnboardExp(el) {
  document.querySelectorAll('#onboardExp .onboard-goal-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  selectedOnboardExp = el.dataset.val;
}

function openOnboarding() {
  document.getElementById('onboardOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeOnboarding() {
  document.getElementById('onboardOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function submitOnboarding() {
  try {
    const { data, error } = await sb.auth.updateUser({
      data: {
        research_goal: selectedOnboardGoal,
        experience_level: selectedOnboardExp,
        onboarding_completed: true
      }
    });
    // Refresh local user so personalization applies immediately
    if (!error && data?.user) currentUser = data.user;
  } catch (e) {}
  closeOnboarding();
  if (typeof renderRecommendations === 'function') renderRecommendations();
  toast('Preferences saved ✓');
}

async function skipOnboarding() {
  try {
    await sb.auth.updateUser({ data: { onboarding_completed: true } });
  } catch (e) {}
  closeOnboarding();
}

// ── Init: restore session + listen for changes ───────────────────────
(function setupDobBounds() {
  const today = new Date();
  const maxDate = today.toISOString().split('T')[0];
  const minYear = today.getFullYear() - 100;
  ['authDob', 'dobGateInput'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.max = maxDate;
    el.min = `${minYear}-01-01`;
  });
})();

// Auth init must wait for every script to load — updateAuthUI() calls into
// billing.js (applyPlanUI) and app.js (renderRecommendations), both of which
// load after this file. Running too early silently skipped those hooks, so
// Pro state only appeared after a tab-focus event re-fired onAuthStateChange.
function bootAuth() {
  (async function () {
    const { data: { session } } = await sb.auth.getSession();
    updateAuthUI(session?.user || null);
    checkProfileCompletion(session?.user || null);
  })();

  sb.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user || null);
    checkProfileCompletion(session?.user || null);
  });
}

if (document.readyState === 'complete') {
  bootAuth();
} else {
  window.addEventListener('load', bootAuth);
}
