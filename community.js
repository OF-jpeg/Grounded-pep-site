// ══════════════════════════════════════════════════════════════════════
//  GROUNDED — COMMUNITY PAGE
// ══════════════════════════════════════════════════════════════════════
// Suggestions, FAQ, and a public roadmap. Replaces the Discord server —
// an empty server signals "nobody uses this", whereas an active
// suggestion box works from day one with a single user.
//
// Submissions go to the `suggestions` table in Supabase. If that table
// doesn't exist, they're queued in localStorage so nothing is lost.

let suggestType = 'feature';

const SUGGEST_PROMPTS = {
  feature:    'What would you like to see?',
  compound:   'Which compound is missing?',
  bug:        'What broke, and what were you doing?',
  correction: "What's wrong, and what should it say?",
};

const SUGGEST_PLACEHOLDERS = {
  feature:    "Be specific — the more detail, the more likely it gets built.",
  compound:   "Name the compound and, if you know it, where you've seen research on it.",
  bug:        "What you clicked, what you expected, and what actually happened.",
  correction: "Which compound, which field, and what the correct information is. A source helps.",
};

function showCommTab(tab, btn) {
  document.querySelectorAll('.comm-panel').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.comm-tab').forEach(e => e.classList.remove('on'));
  document.getElementById('comm-' + tab).classList.add('on');
  if (btn) btn.classList.add('on');
  if (tab === 'faq') renderCommFaq();
  if (tab === 'roadmap') renderRoadmap();
}

function setSuggestType(type) {
  suggestType = type;
  document.querySelectorAll('.comm-type').forEach(b => {
    b.classList.toggle('on', b.dataset.type === type);
  });
  const lbl = document.getElementById('suggestPromptLbl');
  const box = document.getElementById('suggestBody');
  if (lbl) lbl.textContent = SUGGEST_PROMPTS[type] || SUGGEST_PROMPTS.feature;
  if (box) box.placeholder = SUGGEST_PLACEHOLDERS[type] || '';
}

function updateSuggestCount() {
  const box = document.getElementById('suggestBody');
  const el = document.getElementById('suggestCount');
  if (box && el) el.textContent = box.value.length;
}

async function submitSuggestion() {
  const box = document.getElementById('suggestBody');
  const emailEl = document.getElementById('suggestEmail');
  const btn = document.getElementById('suggestSubmit');
  if (!box) return;

  const body = box.value.trim();
  if (body.length < 10) { toast('Add a bit more detail first'); return; }
  if (body.length > 1000) { toast('Please keep it under 1000 characters'); return; }

  const email = (emailEl?.value || '').trim();
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const record = {
    kind: suggestType,
    body,
    contact_email: email || null,
    page_context: typeof currentPage !== 'undefined' ? currentPage : null,
  };

  let saved = false;
  if (typeof sb !== 'undefined') {
    try {
      const { error } = await sb.from('suggestions').insert(record);
      if (!error) saved = true;
    } catch (e) { /* table may not exist yet */ }
  }

  // Queue locally if the table isn't set up, so nothing is lost
  if (!saved) {
    try {
      const q = JSON.parse(localStorage.getItem('grounded_suggestion_queue') || '[]');
      q.push({ ...record, queued_at: new Date().toISOString() });
      localStorage.setItem('grounded_suggestion_queue', JSON.stringify(q.slice(-50)));
    } catch (e) {}
  }

  if (typeof trackEvent === 'function') trackEvent('suggestion_sent', suggestType);

  box.value = '';
  if (emailEl) emailEl.value = '';
  updateSuggestCount();
  btn.disabled = false;
  btn.textContent = 'Send it';
  toast('Thanks — that actually gets read ✓');
}

// ── FAQ ───────────────────────────────────────────────────────────────
const COMM_FAQ = [
  {
    q: 'Is any of this medical advice?',
    a: "No. Grounded is a reference and education tool. It explains what research exists and what it says — it doesn't tell you what to take. Every protocol decision should involve a licensed healthcare professional who knows your situation and history."
  },
  {
    q: 'Are peptides legal?',
    a: "It depends entirely on the compound and where you live. Some on this platform are FDA-approved prescription drugs. Many others are sold as research chemicals and are not approved for human use. Laws differ by country and state, and possession, import, and use can each be treated differently. Research the status where you live."
  },
  {
    q: 'Do you sell peptides, or recommend where to buy?',
    a: "No, and we won't. We have no vendor affiliations and take no commission from anyone. Our guide on verifying a source teaches you how to evaluate a seller yourself rather than pointing you at one — because a recommendation from us would be worth less than your own scrutiny."
  },
  {
    q: 'Where does the research feed come from?',
    a: "PubMed, ClinicalTrials.gov, and Europe PMC — all public research databases. It updates automatically every day. Titles, journals, dates, and IDs come straight from those sources. Plain-language summaries are generated from each paper's real abstract, never invented."
  },
  {
    q: 'How accurate is the compound data?',
    a: "It's compiled from published research, clinical trial results, and regulatory documentation, and each profile lists its research status so you can weigh the evidence. That said, this is a fast-moving area and mistakes are possible. If you spot something wrong, send a correction — we'd rather fix it than be confidently incorrect."
  },
  {
    q: 'What does the AI actually know?',
    a: "It has the full 81-compound database plus general knowledge of peptide science. It adapts explanation depth to your setting — Simple, Standard, or Technical. It can be wrong, particularly on very recent or obscure compounds, so treat it as a knowledgeable starting point rather than a final authority."
  },
  {
    q: 'Is it free? Will it stay free?',
    a: "Everything is free right now except a daily cap on AI messages, which exists because each one costs real money to run. Paid tiers will come eventually, but pricing will be set based on what people actually use — and anyone using something today won't lose access to it."
  },
  {
    q: 'What happens to my data?',
    a: "Your account details and tracker data are tied to your account and not sold to anyone. Usage analytics are anonymous — we track which compounds are popular, not who looked at them. Full details are in the Privacy Policy."
  },
  {
    q: 'Why is there no Discord?',
    a: "Because an empty server is worse than no server. Once there are enough people using the site for a community to actually be a community, we'll open one. Until then, the suggestion box is the faster way to reach us."
  },
];

function renderCommFaq() {
  const el = document.getElementById('commFaqList');
  if (!el || el.children.length) return;
  el.innerHTML = COMM_FAQ.map((f, i) => `
    <div class="comm-faq-item" id="faq-${i}">
      <button class="comm-faq-q" onclick="toggleFaq(${i})">
        <span>${f.q}</span><span class="comm-faq-chev">+</span>
      </button>
      <div class="comm-faq-a"><p>${f.a}</p></div>
    </div>`).join('');
}

function toggleFaq(i) {
  const item = document.getElementById('faq-' + i);
  if (item) item.classList.toggle('open');
}

// ── Roadmap ───────────────────────────────────────────────────────────
// Honest about what's real vs planned vs speculative.
const ROADMAP = {
  live: {
    title: 'Live now',
    color: '#34D399',
    items: [
      '81-compound database with research links',
      'AI guide with adjustable explanation depth',
      'Daily research feed from PubMed, ClinicalTrials.gov and Europe PMC',
      'Stack Finder quiz',
      'Dose tracker with vial inventory and cost-per-dose',
      'Reconstitution calculator',
      'Alerts when new research lands on compounds you track',
      'Side-by-side compound comparison',
    ],
  },
  building: {
    title: 'Being built',
    color: '#60A5FA',
    items: [
      'Email alerts for new research on your compounds',
      'More original guides',
      'Verified citations on more compounds',
      'Custom domain',
    ],
  },
  considering: {
    title: 'Under consideration',
    color: '#C4B5FD',
    items: [
      'Paid tier (pricing not decided)',
      'Community features, once there are enough people to warrant them',
      'Protocol sharing between users',
      'Mobile app',
    ],
  },
};

function renderRoadmap() {
  const el = document.getElementById('roadmapCols');
  if (!el || el.children.length) return;
  el.innerHTML = Object.values(ROADMAP).map(col => `
    <div class="roadmap-col">
      <div class="roadmap-head" style="color:${col.color}">
        <span class="roadmap-dot" style="background:${col.color}"></span>${col.title}
      </div>
      <div class="roadmap-items">
        ${col.items.map(i => `<div class="roadmap-item">${i}</div>`).join('')}
      </div>
    </div>`).join('');
}
