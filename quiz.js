// ══════════════════════════════════════════════════════════════════════
//  GROUNDED — STACK FINDER QUIZ
// ══════════════════════════════════════════════════════════════════════
// Narrows the database to a shortlist based on what someone is after,
// then has the AI explain the reasoning.
//
// DELIBERATE SCOPE LIMIT: this asks about goals and preferences only.
// It does NOT ask about medical conditions, medications, or health history.
// That keeps it an educational filtering tool rather than a medical
// assessment, and means no health data is collected or stored.

const QUIZ_QUESTIONS = [
  {
    id: 'goal',
    q: 'What are you mainly trying to work on?',
    sub: 'This does the most to narrow things down.',
    options: [
      { v: 'recovery',  label: 'Recovery & healing',    desc: 'Injuries, tendons, gut, tissue repair', cats: ['healing'] },
      { v: 'fatloss',   label: 'Fat loss',              desc: 'Body composition, appetite, metabolism', cats: ['fatloss','metabolic'] },
      { v: 'muscle',    label: 'Muscle & performance',  desc: 'Growth, strength, training output',      cats: ['muscle'] },
      { v: 'gh',        label: 'Growth hormone',        desc: 'GH optimisation, sleep quality, IGF-1',  cats: ['gh'] },
      { v: 'cognitive', label: 'Focus & cognition',     desc: 'Memory, clarity, neuroprotection',       cats: ['cognitive'] },
      { v: 'longevity', label: 'Longevity & ageing',    desc: 'Cellular health, mitochondria',          cats: ['longevity'] },
    ],
  },
  {
    id: 'experience',
    q: 'How much do you already know about peptides?',
    sub: 'Changes how much we explain, and how conservative the shortlist is.',
    options: [
      { v: 'new',         label: 'Completely new',   desc: "Haven't used anything before" },
      { v: 'some',        label: 'Some experience',  desc: 'Used one or two, know the basics' },
      { v: 'experienced', label: 'Experienced',      desc: 'Comfortable with protocols and dosing' },
    ],
  },
  {
    id: 'evidence',
    q: 'How much evidence do you want behind something?',
    sub: 'Some compounds have human trials. Many only have animal data.',
    options: [
      { v: 'strict',   label: 'Human trials only',        desc: 'Approved drugs and clinically studied compounds' },
      { v: 'balanced', label: 'Solid research is enough', desc: 'Good preclinical data is acceptable' },
      { v: 'open',     label: 'Open to experimental',     desc: 'Comfortable with early-stage compounds' },
    ],
  },
  {
    id: 'admin',
    q: 'Are you willing to inject?',
    sub: 'Most research peptides are injectable. A few are oral, nasal, or topical.',
    options: [
      { v: 'yes',      label: 'Yes, no problem',      desc: 'Subcutaneous injection is fine' },
      { v: 'prefer',   label: "I'd rather not",       desc: 'Prefer oral or nasal where possible' },
      { v: 'no',       label: 'No injections',        desc: 'Only non-injectable options' },
    ],
  },
  {
    id: 'commitment',
    q: 'How often are you realistically willing to dose?',
    sub: 'Half-lives vary enormously — some need daily dosing, some weekly.',
    options: [
      { v: 'daily',    label: 'Daily is fine',         desc: 'Happy with a daily routine' },
      { v: 'fewtimes', label: 'A few times a week',    desc: 'Prefer not to dose every day' },
      { v: 'weekly',   label: 'Weekly or less',        desc: 'Want the lowest-maintenance option' },
    ],
  },
  {
    id: 'priority',
    q: "What matters most to you?",
    sub: 'Used to rank the shortlist.',
    options: [
      { v: 'safety',    label: 'Safety profile',     desc: 'Lowest risk, best-understood side effects' },
      { v: 'evidence',  label: 'Strength of evidence', desc: 'Best-studied option available' },
      { v: 'results',   label: 'Effect size',        desc: 'Most likely to produce a noticeable change' },
      { v: 'cost',      label: 'Cost',               desc: 'Reasonable to sustain over time' },
    ],
  },
];

let quizStep = 0;
let quizAnswers = {};

// ── Flow control ──────────────────────────────────────────────────────
function startQuiz() {
  quizStep = 0;
  quizAnswers = {};
  document.getElementById('quizIntro').style.display = 'none';
  document.getElementById('quizResult').style.display = 'none';
  document.getElementById('quizLoading').style.display = 'none';
  document.getElementById('quizFlow').style.display = '';
  renderQuizStep();
  if (typeof trackEvent === 'function') trackEvent('quiz_start', 'stack_finder');
}

function renderQuizStep() {
  const q = QUIZ_QUESTIONS[quizStep];
  if (!q) return;
  document.getElementById('quizQuestion').textContent = q.q;
  document.getElementById('quizSub').textContent = q.sub || '';
  document.getElementById('quizStepLabel').textContent =
    `Question ${quizStep + 1} of ${QUIZ_QUESTIONS.length}`;
  document.getElementById('quizProgress').style.width =
    `${(quizStep / QUIZ_QUESTIONS.length) * 100}%`;

  const chosen = quizAnswers[q.id];
  document.getElementById('quizOptions').innerHTML = q.options.map(o =>
    `<button class="quiz-opt${chosen === o.v ? ' on' : ''}" onclick="answerQuiz('${q.id}','${o.v}')">
       <span class="quiz-opt-label">${o.label}</span>
       <span class="quiz-opt-desc">${o.desc}</span>
     </button>`
  ).join('');

  document.getElementById('quizBack').style.visibility = quizStep === 0 ? 'hidden' : 'visible';
}

function answerQuiz(qid, value) {
  quizAnswers[qid] = value;
  advanceQuiz();
}

function quizSkip() {
  const q = QUIZ_QUESTIONS[quizStep];
  if (q) delete quizAnswers[q.id];
  advanceQuiz();
}

function advanceQuiz() {
  if (quizStep < QUIZ_QUESTIONS.length - 1) {
    quizStep++;
    renderQuizStep();
  } else {
    finishQuiz();
  }
}

function quizBack() {
  if (quizStep > 0) { quizStep--; renderQuizStep(); }
}

function restartQuiz() {
  document.getElementById('quizResult').style.display = 'none';
  document.getElementById('quizIntro').style.display = '';
}

// ── Shortlisting ──────────────────────────────────────────────────────
// Filters and scores the database locally so the AI is reasoning about a
// relevant subset rather than all 81 compounds.
function shortlistCompounds() {
  const a = quizAnswers;
  const goalQ = QUIZ_QUESTIONS[0].options.find(o => o.v === a.goal);
  const cats = goalQ ? goalQ.cats : [];

  let pool = cats.length ? PEPS.filter(p => cats.includes(p.cat)) : PEPS.slice();

  // Evidence tolerance
  if (a.evidence === 'strict') {
    pool = pool.filter(p => /approved|phase ii|phase iii|clinical/i.test(p.status));
  } else if (a.evidence === 'balanced') {
    pool = pool.filter(p => !/discontinued/i.test(p.status));
  }

  // Administration route
  if (a.admin === 'no') {
    pool = pool.filter(p => /oral|intranasal|topical/i.test(p.admin));
  } else if (a.admin === 'prefer') {
    pool.sort((x, y) => {
      const nx = /oral|intranasal|topical/i.test(x.admin) ? 0 : 1;
      const ny = /oral|intranasal|topical/i.test(y.admin) ? 0 : 1;
      return nx - ny;
    });
  }

  // Dosing frequency — hlh is half-life in hours
  if (a.commitment === 'weekly') {
    pool = pool.filter(p => (p.hlh || 0) >= 24);
  } else if (a.commitment === 'fewtimes') {
    pool = pool.filter(p => (p.hlh || 0) >= 1);
  }

  // Beginners shouldn't be pointed at the most experimental end first
  if (a.experience === 'new') {
    pool = pool.filter(p => !/discontinued|contested/i.test(p.status));
    pool.sort((x, y) => y.pop - x.pop);
  }

  // Rank by stated priority
  if (a.priority === 'evidence') {
    const score = p => /fda approved/i.test(p.status) ? 3
      : /approved/i.test(p.status) ? 2
      : /phase/i.test(p.status) ? 1 : 0;
    pool.sort((x, y) => score(y) - score(x) || y.pop - x.pop);
  } else if (a.priority === 'safety') {
    pool.sort((x, y) => (x.sides?.length || 0) - (y.sides?.length || 0) || y.pop - x.pop);
  } else {
    pool.sort((x, y) => y.pop - x.pop);
  }

  // If filters were too aggressive, fall back to the goal category
  if (pool.length < 3 && cats.length) {
    pool = PEPS.filter(p => cats.includes(p.cat)).sort((x, y) => y.pop - x.pop);
  }
  return pool.slice(0, 6);
}

function answerLabel(qid, value) {
  const q = QUIZ_QUESTIONS.find(x => x.id === qid);
  const o = q?.options.find(x => x.v === value);
  return o ? o.label : value;
}

// ── Result ────────────────────────────────────────────────────────────
async function finishQuiz() {
  document.getElementById('quizFlow').style.display = 'none';
  document.getElementById('quizLoading').style.display = '';
  document.getElementById('quizProgress').style.width = '100%';
  if (typeof trackEvent === 'function') trackEvent('quiz_complete', quizAnswers.goal || 'unspecified');

  const shortlist = shortlistCompounds();

  // Recap of what they chose
  const recap = Object.entries(quizAnswers)
    .map(([k, v]) => `<span class="quiz-recap-chip">${answerLabel(k, v)}</span>`).join('');
  document.getElementById('quizRecap').innerHTML =
    recap ? `<span class="quiz-recap-label">Based on</span>${recap}` : '';

  const goalLabel = quizAnswers.goal ? answerLabel('goal', quizAnswers.goal) : 'your goal';
  document.getElementById('quizResultSub').textContent =
    `${shortlist.length} compounds from the database that fit what you described.`;

  // Compound cards render immediately, before the AI responds
  const cards = shortlist.map((p, i) => {
    const c = CATS[p.cat] || { l: p.cat, c: '#fff' };
    return `<div class="quiz-pick" onclick="openM('${p.id}')">
      <div class="quiz-pick-rank">${i + 1}</div>
      <div class="quiz-pick-body">
        <div class="quiz-pick-name">${p.n}${p.known ? `<span class="quiz-pick-known">${p.known}</span>` : ''}</div>
        <div class="quiz-pick-meta">
          <span style="color:${c.c}">${c.l}</span> ·
          <span>${p.hl}</span> ·
          <span>${p.admin.split(' · ')[0]}</span> ·
          <span>${p.status.split('(')[0].trim()}</span>
        </div>
        <div class="quiz-pick-ov">${p.ov.slice(0, 150)}…</div>
      </div>
      <div class="quiz-pick-arrow">→</div>
    </div>`;
  }).join('');

  document.getElementById('quizAiResult').innerHTML =
    `<div class="quiz-picks">${cards}</div>
     <div class="quiz-ai-block">
       <div class="quiz-ai-head">Why these, and how they fit together</div>
       <div id="quizAiText" class="quiz-ai-text"><em style="color:var(--t3)">Analysing…</em></div>
     </div>`;

  document.getElementById('quizLoading').style.display = 'none';
  document.getElementById('quizResult').style.display = '';

  // AI explanation of the shortlist
  const answerSummary = Object.entries(quizAnswers)
    .map(([k, v]) => `${k}: ${answerLabel(k, v)}`).join('; ');
  const compoundList = shortlist.map(p =>
    `${p.n} (${p.status}, half-life ${p.hl}, ${p.admin})`).join('\n');

  const prompt = `Someone completed a quiz on our peptide education platform. Their answers:
${answerSummary}

Our filtering produced this shortlist:
${compoundList}

Write a short educational explanation covering:
1. Why these compounds match what they described
2. Which two or three could reasonably be researched together, and the mechanistic reason they complement each other
3. Which single one a person in their situation would most sensibly look into first, and why
4. The most important caveat for this particular goal

Be direct and specific. This is educational information about what the research says — not a prescription, and not personalised medical advice. Do not invent dosing protocols. Remind them to consult a healthcare professional, but briefly and only once. Around 250 words.`;

  try {
    const res = await callClaude({
      model: CLAUDE_MODEL,
      max_tokens: 900,
      system: getSYS(),
      messages: [{ role: 'user', content: prompt }],
    });
    const data = await res.json();
    const txt = (data.content || []).map(b => b.type === 'text' ? b.text : '').join('');
    document.getElementById('quizAiText').innerHTML = txt
      ? rMD(txt)
      : '<em style="color:var(--t3)">Could not generate an explanation. The compounds above still match your answers.</em>';
  } catch (e) {
    document.getElementById('quizAiText').innerHTML =
      '<em style="color:var(--t3)">Could not reach the AI right now. The compounds above still match your answers.</em>';
  }
}
