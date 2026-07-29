// ══════════════════════════════════════════════
//  GROUNDED — DOSE TRACKER
// ══════════════════════════════════════════════
// Works fully offline via localStorage. If the person is signed in AND
// the Supabase tables below exist, writes are also mirrored there for
// cross-device sync. Supabase calls are wrapped in try/catch and fail
// silently — localStorage remains the source of truth either way.
//
// Required Supabase tables (see setup SQL provided separately):
//   tracker_regimen, tracker_log, tracker_vials

let editingRegimenId = null;

// ── Local storage helpers ─────────────────────────────────────────────
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function getRegimen() { return lsGet('grounded_regimen', []); }
function getVials() { return lsGet('grounded_vials', []); }
function getLog() { return lsGet('grounded_tracker_log', {}); }

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dateStrOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ── Best-effort Supabase sync (silent failure if tables don't exist) ──
// Cloud sync is a Pro feature. Free users keep everything in localStorage,
// which still works fully — it just stays on one device.
function canCloudSync() {
  if (typeof currentUser === 'undefined' || !currentUser) return false;
  if (typeof sb === 'undefined') return false;
  if (typeof isPro === 'function' && !isPro()) return false;
  return true;
}
async function syncRegimenToSupabase(item) {
  if (!canCloudSync()) return;
  try {
    await sb.from('tracker_regimen').upsert({
      id: item.id, user_id: currentUser.id, peptide_name: item.peptide,
      dose_amount: item.dose, time_of_day: item.time, active: true
    });
  } catch (e) {}
}
async function syncLogToSupabase(regimenId, date, status) {
  if (!canCloudSync()) return;
  try {
    await sb.from('tracker_log').upsert({
      user_id: currentUser.id, regimen_id: regimenId, log_date: date, status
    }, { onConflict: 'regimen_id,log_date' });
  } catch (e) {}
}
async function syncVialToSupabase(vial) {
  if (!canCloudSync()) return;
  try {
    await sb.from('tracker_vials').upsert({
      id: vial.id, user_id: currentUser.id, peptide_name: vial.peptide,
      total_mg: vial.totalMg, water_ml: vial.waterMl, cost: vial.cost,
      expiration_date: vial.expirationDate || null
    });
  } catch (e) {}
}

// ── Main render entry point ────────────────────────────────────────────
function renderTracker() {
  populatePeptideDatalist();
  renderTodayList();
  renderWeekStrip();
  renderRegimenList();
  renderVialList();
  updateTrackerStats();
  updatePlanCounts();
}

// Shows "2 of 2 doses used" style counters so free limits are visible upfront
function updatePlanCounts() {
  const pro = (typeof isPro === 'function') ? isPro() : false;
  const regEl = document.getElementById('regimenCount');
  const vialEl = document.getElementById('vialCount');
  if (regEl) {
    if (pro) { regEl.textContent = ''; }
    else {
      const used = getRegimen().length;
      const max = FREE_LIMITS.regimenItems;
      regEl.innerHTML = used >= max
        ? `Limit reached (${used}/${max}) · <a onclick="show('pricing')">Upgrade</a>`
        : `${used} of ${max} on the free plan`;
    }
  }
  if (vialEl) {
    if (pro) { vialEl.textContent = ''; }
    else {
      const used = getVials().length;
      const max = FREE_LIMITS.vials;
      vialEl.innerHTML = used >= max
        ? `Limit reached (${used}/${max}) · <a onclick="show('pricing')">Upgrade</a>`
        : `${used} of ${max} on the free plan`;
    }
  }
}

function populatePeptideDatalist() {
  const dl = document.getElementById('regPeptideList');
  if (!dl || dl.children.length || typeof PEPS === 'undefined') return;
  dl.innerHTML = PEPS.map(p => `<option value="${p.n}">`).join('');
}

// ── Tab switching ───────────────────────────────────────────────────────
function showTrkTab(tab, btn) {
  document.querySelectorAll('.trk-panel').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.ttab').forEach(e => e.classList.remove('on'));
  document.getElementById('trk-' + tab).classList.add('on');
  if (btn) btn.classList.add('on');
}

// ── Today's checklist ───────────────────────────────────────────────────
function renderTodayList() {
  const regimen = getRegimen();
  const log = getLog();
  const today = todayStr();
  const todayLog = log[today] || {};
  const list = document.getElementById('todayList');
  if (!list) return;

  if (!regimen.length) {
    list.innerHTML = `<div class="trk-empty"><span class="trk-empty-icon">💊</span>No regimen set up yet.<br>Add a dose under "My Regimen" to start tracking.</div>`;
    return;
  }

  list.innerHTML = regimen.map(item => {
    const taken = todayLog[item.id] === 'taken';
    return `<div class="dose-item">
      <button class="dose-check${taken ? ' taken' : ''}" onclick="toggleDoseTaken('${item.id}')">${taken ? '✓' : ''}</button>
      <div>
        <div class="dose-name">${item.peptide}</div>
        <div class="dose-meta">${item.dose}${item.time ? ' · ' + formatTime(item.time) : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

async function toggleDoseTaken(regimenId) {
  const log = getLog();
  const today = todayStr();
  if (!log[today]) log[today] = {};
  const newStatus = log[today][regimenId] === 'taken' ? undefined : 'taken';
  if (newStatus) { log[today][regimenId] = newStatus; }
  else { delete log[today][regimenId]; }
  lsSet('grounded_tracker_log', log);
  renderTodayList();
  renderWeekStrip();
  updateTrackerStats();
  await syncLogToSupabase(regimenId, today, newStatus || 'untaken');
}

// ── Week strip ───────────────────────────────────────────────────────────
function renderWeekStrip() {
  const strip = document.getElementById('weekStrip');
  if (!strip) return;
  const regimen = getRegimen();
  const log = getLog();
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let html = '';
  for (let i = 6; i >= 0; i--) {
    const dateStr = dateStrOffset(i);
    const d = new Date(dateStr + 'T00:00:00');
    const dayLog = log[dateStr] || {};
    const matched = regimen.filter(r => dayLog[r.id] === 'taken').length;
    const total = regimen.length;
    let dotClass = 'none';
    if (total > 0) {
      if (matched === total) dotClass = 'full';
      else if (matched > 0) dotClass = 'partial';
    }
    const isToday = i === 0;
    html += `<div class="wd${isToday ? ' today' : ''}">
      <div class="wd-lbl">${dayLabels[d.getDay()]}</div>
      <div class="wd-dot ${dotClass}">${dotClass === 'full' ? '✓' : ''}</div>
    </div>`;
  }
  strip.innerHTML = html;
}

// ── Stats: streak, today count, week % ───────────────────────────────────
function calculateStreak() {
  const regimen = getRegimen();
  if (!regimen.length) return 0;
  const log = getLog();
  let streak = 0;
  let dayOffset = 0;
  // If today isn't fully complete yet, start checking from yesterday instead
  const todayLog = log[todayStr()] || {};
  const todayComplete = regimen.every(r => todayLog[r.id] === 'taken');
  if (!todayComplete) dayOffset = 1;
  while (true) {
    const dateStr = dateStrOffset(dayOffset);
    const dayLog = log[dateStr] || {};
    const complete = regimen.every(r => dayLog[r.id] === 'taken');
    if (!complete) break;
    streak++;
    dayOffset++;
    if (dayOffset > 3650) break; // safety cap
  }
  return streak;
}

function updateTrackerStats() {
  const regimen = getRegimen();
  const log = getLog();
  const today = todayStr();
  const todayLog = log[today] || {};
  const todayTaken = regimen.filter(r => todayLog[r.id] === 'taken').length;

  document.getElementById('streakVal').textContent = calculateStreak();
  document.getElementById('todayVal').textContent = `${todayTaken}/${regimen.length}`;

  let weekMatched = 0, weekTotal = 0;
  for (let i = 0; i < 7; i++) {
    const dateStr = dateStrOffset(i);
    const dayLog = log[dateStr] || {};
    weekTotal += regimen.length;
    weekMatched += regimen.filter(r => dayLog[r.id] === 'taken').length;
  }
  const weekPct = weekTotal > 0 ? Math.round((weekMatched / weekTotal) * 100) : 0;
  document.getElementById('weekVal').textContent = weekPct + '%';
}

// ── Regimen management ────────────────────────────────────────────────────
function openRegimenModal(id) {
  // Adding a new dose is capped on the free plan; editing existing is always allowed
  if (!id && typeof canAddRegimenItem === 'function' && !canAddRegimenItem(getRegimen().length)) {
    openPaywall('regimen');
    return;
  }
  editingRegimenId = id || null;
  const title = document.getElementById('regimenModalTitle');
  if (id) {
    const item = getRegimen().find(r => r.id === id);
    if (item) {
      title.textContent = 'Edit dose';
      document.getElementById('regPeptide').value = item.peptide;
      document.getElementById('regDose').value = item.dose;
      document.getElementById('regTime').value = item.time || '';
    }
  } else {
    title.textContent = 'Add a dose';
    document.getElementById('regPeptide').value = '';
    document.getElementById('regDose').value = '';
    document.getElementById('regTime').value = '';
  }
  document.getElementById('regimenModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeRegimenModal() {
  document.getElementById('regimenModal').classList.remove('open');
  document.body.style.overflow = '';
  editingRegimenId = null;
}
async function saveRegimenItem() {
  const peptide = document.getElementById('regPeptide').value.trim();
  const dose = document.getElementById('regDose').value.trim();
  const time = document.getElementById('regTime').value;
  if (!peptide || !dose) { toast('Enter a peptide and dose amount'); return; }

  const regimen = getRegimen();
  if (editingRegimenId) {
    const item = regimen.find(r => r.id === editingRegimenId);
    if (item) { item.peptide = peptide; item.dose = dose; item.time = time; }
  } else {
    // Backstop in case the modal was opened before a plan change
    if (typeof canAddRegimenItem === 'function' && !canAddRegimenItem(regimen.length)) {
      closeRegimenModal();
      openPaywall('regimen');
      return;
    }
    regimen.push({ id: 'r' + Date.now(), peptide, dose, time, createdAt: Date.now() });
  }
  lsSet('grounded_regimen', regimen);
  closeRegimenModal();
  renderRegimenList();
  renderTodayList();
  renderWeekStrip();
  updateTrackerStats();
  updatePlanCounts();
  toast('Dose saved ✓');
  const saved = regimen[regimen.length - 1];
  await syncRegimenToSupabase(editingRegimenId ? regimen.find(r => r.id === editingRegimenId) : saved);
}
function renderRegimenList() {
  const list = document.getElementById('regimenList');
  if (!list) return;
  const regimen = getRegimen();
  if (!regimen.length) {
    list.innerHTML = `<div class="trk-empty"><span class="trk-empty-icon">📋</span>No doses added yet.</div>`;
    return;
  }
  list.innerHTML = regimen.map(item => `
    <div class="regimen-card">
      <div style="flex:1">
        <div class="regimen-card-name">${item.peptide}</div>
        <div class="regimen-card-meta">${item.dose}${item.time ? ' · ' + formatTime(item.time) : ''}</div>
      </div>
      <button class="bm" onclick="openRegimenModal('${item.id}')" title="Edit">✎</button>
      <button class="dose-rm" onclick="deleteRegimenItem('${item.id}')">✕</button>
    </div>`).join('');
}
async function deleteRegimenItem(id) {
  let regimen = getRegimen();
  regimen = regimen.filter(r => r.id !== id);
  lsSet('grounded_regimen', regimen);
  renderRegimenList();
  renderTodayList();
  renderWeekStrip();
  updateTrackerStats();
  updatePlanCounts();
  toast('Removed from regimen');
  if (canCloudSync()) {
    try { await sb.from('tracker_regimen').delete().eq('id', id); } catch (e) {}
  }
}

// ── Vial inventory + cost calculator ──────────────────────────────────────
function calcVialCost() {
  const mg = parseFloat(document.getElementById('vialMg').value) || 0;
  const water = parseFloat(document.getElementById('vialWater').value) || 0;
  const cost = parseFloat(document.getElementById('vialCost').value) || 0;
  const doseMcg = parseFloat(document.getElementById('vialDose').value) || 0;
  const out = document.getElementById('vialCalcOut');
  if (!mg || !water || !doseMcg) { out.style.display = 'none'; return; }

  const totalMcg = mg * 1000;
  const dosesPerVial = totalMcg / doseMcg;
  out.style.display = 'flex';
  document.getElementById('vcDoses').textContent = dosesPerVial.toFixed(1);
  if (cost > 0) {
    const costPerDose = cost / dosesPerVial;
    document.getElementById('vcCost').textContent = '$' + costPerDose.toFixed(2);
  } else {
    document.getElementById('vcCost').textContent = 'Add cost above';
  }
}
function openVialModal() {
  // Vial inventory is capped on the free plan
  if (typeof canAddVial === 'function' && !canAddVial(getVials().length)) {
    openPaywall('vial');
    return;
  }
  document.getElementById('vialPeptide').value = '';
  document.getElementById('vialMg').value = '';
  document.getElementById('vialWater').value = '';
  document.getElementById('vialCost').value = '';
  document.getElementById('vialDose').value = '';
  document.getElementById('vialExp').value = '';
  document.getElementById('vialCalcOut').style.display = 'none';
  document.getElementById('vialModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeVialModal() {
  document.getElementById('vialModal').classList.remove('open');
  document.body.style.overflow = '';
}
async function saveVial() {
  const peptide = document.getElementById('vialPeptide').value.trim();
  const totalMg = parseFloat(document.getElementById('vialMg').value) || 0;
  const waterMl = parseFloat(document.getElementById('vialWater').value) || 0;
  const cost = parseFloat(document.getElementById('vialCost').value) || 0;
  const doseMcg = parseFloat(document.getElementById('vialDose').value) || 0;
  const expirationDate = document.getElementById('vialExp').value;
  if (!peptide || !totalMg || !waterMl) { toast('Enter peptide, total mg, and water volume'); return; }

  const vials = getVials();
  // Backstop in case the modal was opened before a plan change
  if (typeof canAddVial === 'function' && !canAddVial(vials.length)) {
    closeVialModal();
    openPaywall('vial');
    return;
  }
  const vial = {
    id: 'v' + Date.now(), peptide, totalMg, waterMl, cost, doseMcg,
    expirationDate: expirationDate || null, createdAt: Date.now()
  };
  vials.push(vial);
  lsSet('grounded_vials', vials);
  closeVialModal();
  renderVialList();
  updatePlanCounts();
  toast('Vial added ✓');
  await syncVialToSupabase(vial);
}
function renderVialList() {
  const list = document.getElementById('vialList');
  if (!list) return;
  const vials = getVials();
  if (!vials.length) {
    list.innerHTML = `<div class="trk-empty"><span class="trk-empty-icon">🧪</span>No vials tracked yet.</div>`;
    return;
  }
  const today = new Date();
  list.innerHTML = vials.map(v => {
    const dosesPerVial = v.doseMcg ? (v.totalMg * 1000 / v.doseMcg) : null;
    const costPerDose = (v.cost && dosesPerVial) ? (v.cost / dosesPerVial) : null;
    const isExpired = v.expirationDate && new Date(v.expirationDate) < today;
    return `<div class="vial-card">
      <div style="flex:1">
        <div class="vial-card-name">${v.peptide}</div>
        <div class="vial-card-meta">${v.totalMg}mg in ${v.waterMl}ml${v.expirationDate ? ' · <span class="' + (isExpired ? 'vial-expired' : '') + '">Exp ' + v.expirationDate + (isExpired ? ' (expired)' : '') + '</span>' : ''}</div>
      </div>
      ${dosesPerVial ? `<div class="vial-card-remaining">
        <div class="vial-remaining-val">${costPerDose ? '$' + costPerDose.toFixed(2) : dosesPerVial.toFixed(1)}</div>
        <div class="vial-remaining-lbl">${costPerDose ? 'per dose' : 'doses/vial'}</div>
      </div>` : ''}
      <button class="dose-rm" onclick="deleteVial('${v.id}')">✕</button>
    </div>`;
  }).join('');
}
async function deleteVial(id) {
  let vials = getVials();
  vials = vials.filter(v => v.id !== id);
  lsSet('grounded_vials', vials);
  renderVialList();
  updatePlanCounts();
  toast('Vial removed');
  if (canCloudSync()) {
    try { await sb.from('tracker_vials').delete().eq('id', id); } catch (e) {}
  }
}
