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
function openAuth() {
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
  clearAuthError();
  if (authMode === 'signup') {
    title.textContent = 'Create your account';
    sub.textContent = 'Start saving bookmarks and chat history';
    btn.textContent = 'Sign up';
    switchEl.innerHTML = 'Already have an account? <a onclick="toggleAuthMode()">Sign in</a>';
  } else {
    title.textContent = 'Welcome back';
    sub.textContent = 'Sign in to save bookmarks and chat history';
    btn.textContent = 'Sign in';
    switchEl.innerHTML = "Don't have an account? <a onclick=\"toggleAuthMode()\">Sign up</a>";
  }
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
  btn.disabled = true;
  btn.textContent = authMode === 'signup' ? 'Signing up…' : 'Signing in…';

  try {
    if (authMode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user && !data.session) {
        showAuthError('Check your inbox to confirm your email, then sign in.');
        toggleAuthMode();
      } else {
        closeAuth();
        toast('Account created — welcome to Grounded!');
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuth();
      toast('Signed in ✓');
    }
  } catch (err) {
    showAuthError(err.message || 'Something went wrong. Please try again.');
  }
  btn.disabled = false;
  btn.textContent = authMode === 'signup' ? 'Sign up' : 'Sign in';
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

// ── Update nav UI based on auth state ────────────────────────────────
function updateAuthUI(user) {
  currentUser = user;
  const signInBtn = document.getElementById('navSignInBtn');
  const userChip = document.getElementById('navUserChip');
  if (user) {
    signInBtn.style.display = 'none';
    userChip.style.display = 'flex';
    const label = user.user_metadata?.full_name || user.user_metadata?.user_name || user.email || 'User';
    document.getElementById('userChipName').textContent = label.split(' ')[0];
    document.getElementById('userMenuEmail').textContent = user.email || '';
    document.getElementById('userChipAvatar').textContent = label.charAt(0).toUpperCase();
  } else {
    signInBtn.style.display = '';
    userChip.style.display = 'none';
  }
}

// ── Init: restore session + listen for changes ───────────────────────
(async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  updateAuthUI(session?.user || null);

  sb.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user || null);
  });
})();
