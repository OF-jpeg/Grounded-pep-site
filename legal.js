// ══════════════════════════════════════════════
//  GROUNDED — AGE GATE + LEGAL DOCUMENTS
// ══════════════════════════════════════════════

const AGE_GATE_KEY = 'grounded_age_verified';

function validateAgeGate() {
  const c1 = document.getElementById('ageCheck1').checked;
  const c2 = document.getElementById('ageCheck2').checked;
  const btn = document.getElementById('ageEnterBtn');
  const ok = c1 && c2;
  btn.disabled = !ok;
  btn.style.opacity = ok ? '1' : '.4';
  btn.style.cursor = ok ? 'pointer' : 'not-allowed';
}

function enterSite() {
  const c1 = document.getElementById('ageCheck1').checked;
  const c2 = document.getElementById('ageCheck2').checked;
  if (!c1 || !c2) return;
  try { localStorage.setItem(AGE_GATE_KEY, Date.now().toString()); } catch (e) {}
  document.getElementById('ageGateOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function exitSite() {
  window.location.href = 'https://www.google.com';
}

// Skip the gate if verified within the last 30 days
(function checkAgeGate() {
  let verified = null;
  try { verified = localStorage.getItem(AGE_GATE_KEY); } catch (e) {}
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (verified && (Date.now() - parseInt(verified, 10)) < THIRTY_DAYS) {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('ageGateOverlay').classList.add('hidden');
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.style.overflow = 'hidden';
    });
  }
})();

// ── Legal document content ───────────────────────────────────────────
const LEGAL_DOCS = {
  about: {
    title: 'About Grounded',
    html: `
      <h3>Why this exists</h3>
      <p>Peptide information online is scattered across forum threads, vendor marketing, and dense research papers. Beginners get overwhelmed, and experienced researchers waste time re-deriving the same answers. Grounded pulls it into one place and explains it at whatever level you're at.</p>
      <h3>What's here</h3>
      <ul>
        <li><strong>81 compound profiles</strong> across 11 categories — mechanism, dosing, half-life, storage, reconstitution, benefits, risks, and research status for each</li>
        <li><strong>An AI research guide</strong> that adapts its depth to your experience level and answers follow-up questions conversationally</li>
        <li><strong>Protocol Builder</strong> that generates educational research protocols based on your goal</li>
        <li><strong>Dose Tracker</strong> with streak tracking, vial inventory, and a reconstitution calculator</li>
        <li><strong>Stacking guides</strong> explaining why specific combinations work together mechanistically</li>
      </ul>
      <h3>What Grounded is not</h3>
      <p>We don't sell peptides, recommend vendors, or provide medical advice. This is a reference and education tool. Every protocol decision should involve a licensed healthcare professional who knows your situation.</p>
      <h3>How it's built</h3>
      <p>Compound data is compiled from published research, clinical trial results, and regulatory documentation. Research status labels distinguish preclinical work from human trials from approved pharmaceuticals, so you can weigh the evidence behind any given compound.</p>
    `
  },
  faq: {
    title: 'Frequently Asked Questions',
    html: `
      <h3>Is using peptides legal?</h3>
      <p>It depends heavily on the compound and your jurisdiction. Some peptides on this platform are FDA-approved pharmaceuticals available by prescription. Many others are sold as "research chemicals" and are not approved for human consumption. Laws differ by country and state. Research the legal status where you live, and note that possession, import, and use can each be treated differently.</p>
      <h3>Are peptides safe?</h3>
      <p>Safety varies enormously between compounds. Some have decades of clinical data behind them; others have only animal studies. Each compound profile lists its research status and known side effects so you can judge for yourself. Purity is a separate risk — unregulated products may be underdosed, contaminated, or not contain what's claimed.</p>
      <h3>How do I know if a source is legitimate?</h3>
      <p>Look for third-party lab testing with published certificates of analysis (COAs) that match the specific batch you're buying, not a generic sample. Be wary of prices far below market, missing contact information, or vendors making explicit medical claims. We don't recommend or endorse any vendor.</p>
      <h3>What does reconstitution mean?</h3>
      <p>Most research peptides arrive as a freeze-dried (lyophilized) powder that must be mixed with bacteriostatic water before use. The Reconstitution Calculator in the Dose Tracker converts your vial size, water volume, and target dose into the exact number of units to draw on an insulin syringe.</p>
      <h3>What's a half-life and why does it matter?</h3>
      <p>Half-life is how long it takes for half the compound to clear your system. It largely determines dosing frequency — a compound with a 30-minute half-life needs far more frequent dosing than one lasting seven days. Each profile lists this.</p>
      <h3>Where should a beginner start?</h3>
      <p>Read the full profile of any compound you're considering, including the side effects and research status sections. Ask the AI Guide to explain anything unclear — set your experience level to "New to peptides" during onboarding and it'll adjust how it explains things. Then talk to a healthcare professional before acting on any of it.</p>
      <h3>Is my data private?</h3>
      <p>Your account details, tracker data, and conversations are tied to your account and not sold to third parties. See the Privacy Policy for specifics on what's collected and how it's used.</p>
      <h3>Do I need to pay to use Grounded?</h3>
      <p>No. The free plan includes 15 compound profiles, 10 AI messages per day, the reconstitution calculator, basic dose tracking, and two stacking guides. Pro unlocks the full database, unlimited AI, and the rest of the tools.</p>
    `
  },
  contact: {
    title: 'Contact',
    html: `
      <h3>Get in touch</h3>
      <p>The fastest way to reach us is the suggestion box on the <a onclick="closeLegal();show('community')">Community page</a>. It goes straight to us and is genuinely read.</p>
      <h3>What's most useful to send</h3>
      <ul>
        <li><strong>Found an error?</strong> If something in a compound profile looks wrong, tell us. Accuracy matters more than being fast.</li>
        <li><strong>Missing a compound?</strong> Suggest it and we'll look into adding it.</li>
        <li><strong>Bug or broken feature?</strong> Tell us what you clicked and what happened.</li>
        <li><strong>Confusing explanation?</strong> Tell us where you got lost — that's a content problem worth fixing.</li>
      </ul>
      <h3>What we can't help with</h3>
      <p>We can't give medical advice, recommend vendors or sources, or advise on the legality of any compound in your jurisdiction. Those questions need a licensed professional who knows your situation.</p>
    `
  },
  privacy: {
    title: 'Privacy Policy',
    html: `
      <h3>What we collect</h3>
      <p>When you create an account with email and password, we collect your first name, last name, email address, date of birth, and — if provided — your phone number. Date of birth is used solely to verify you meet our 21+ age requirement.</p>
      <p>If you sign in with Google, we receive your name, email address, and profile picture as provided by Google. We do not collect payment information unless you subscribe to a paid plan.</p>
      <h3>How we use it</h3>
      <ul>
        <li>To authenticate your account and keep you signed in</li>
        <li>To verify you meet the 21+ age requirement to use this platform</li>
        <li>To sync bookmarks, chat history, and preferences across your devices</li>
        <li>To personalize recommendations (such as suggested compounds or stacks) based on your stated research goals</li>
        <li>To understand how the platform is used in aggregate — including which compounds, searches, and AI conversations are most common — so we can improve the database and AI Guide</li>
        <li>To send essential account-related communications, and optional research updates if you opt in</li>
      </ul>
      <h3>AI conversations</h3>
      <p>Messages sent to the AI Guide are processed by Anthropic's Claude API to generate responses. Conversation history is stored, and if signed in, associated with your account for continuity across sessions and devices.</p>
      <h3>Usage data</h3>
      <p>We track interactions such as which compound profiles are viewed or bookmarked, which stacks are explored, and search queries entered on the platform. This behavioral data is used in aggregate to improve the product and is not sold to advertisers or third parties.</p>
      <h3>Third parties</h3>
      <p>We use Supabase for authentication and data storage, and Anthropic's API for AI responses. We do not sell your personal data to third parties.</p>
      <h3>Your rights</h3>
      <p>You may request deletion of your account and associated data at any time by contacting support.</p>
    `
  },
  terms: {
    title: 'Terms of Service',
    html: `
      <h3>Acceptance of terms</h3>
      <p>By accessing Grounded, you agree to these Terms of Service and confirm you meet the age requirement stated on the entry screen.</p>
      <h3>Educational purpose only</h3>
      <p>Grounded is an educational research reference tool. It does not sell, distribute, or facilitate the purchase of any compound. All content — including AI-generated responses — is for informational purposes only.</p>
      <h3>No medical advice</h3>
      <p>Nothing on this platform constitutes medical advice, diagnosis, or treatment. Always consult a licensed healthcare professional before making decisions about your health.</p>
      <h3>Account responsibility</h3>
      <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.</p>
      <h3>Limitation of liability</h3>
      <p>Grounded and its operators are not liable for any decisions made based on information presented on this platform.</p>
    `
  },
  disclaimer: {
    title: 'Medical Disclaimer',
    html: `
      <h3>Not medical advice</h3>
      <p>The information provided on Grounded — including compound profiles, dosing ranges, AI-generated responses, protocols, and stacking guidance — is intended strictly for educational and research purposes. It is not medical advice and should never be treated as a substitute for professional medical consultation, diagnosis, or treatment.</p>
      <h3>Consult a professional</h3>
      <p>Always seek the advice of a physician or other qualified healthcare provider before starting, stopping, or changing any treatment or regimen, including the use of any peptide or research compound discussed on this platform.</p>
      <h3>Research chemical status</h3>
      <p>Many compounds referenced on this platform are classified as research chemicals and are not approved by the FDA for human consumption unless explicitly noted (e.g., FDA-approved pharmaceuticals). Use of unapproved compounds carries inherent risk.</p>
      <h3>No liability</h3>
      <p>Grounded, its operators, and contributors assume no responsibility or liability for any adverse effects, injury, or damage resulting from the use or misuse of information presented on this platform.</p>
      <h3>Age restriction</h3>
      <p>This platform is intended for adults aged 21 and over. It is not intended for use by minors.</p>
    `
  }
};

function openLegal(key) {
  const doc = LEGAL_DOCS[key];
  if (!doc) return;
  document.getElementById('legalTitle').textContent = doc.title;
  document.getElementById('legalContent').innerHTML = doc.html;
  document.getElementById('legalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLegal() {
  document.getElementById('legalOverlay').classList.remove('open');
  // Restore scroll lock if age gate is still showing
  const gate = document.getElementById('ageGateOverlay');
  if (!gate.classList.contains('hidden')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}
