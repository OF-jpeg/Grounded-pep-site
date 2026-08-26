// ══════════════════════════════════════════════════════════════════════
//  GROUNDED — RESEARCH NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════
// Alerts people when new research appears on compounds they actually
// track. Works off the same feed data — no extra requests.
//
// "Seen" state is stored locally by paper ID, so the badge reflects what
// this person has genuinely not looked at yet.

const SEEN_KEY = 'grounded_seen_papers';
const NOTIF_DISMISSED_KEY = 'grounded_notif_dismissed';

let notifItems = [];

function getSeenPapers() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) { return new Set(); }
}

function markPaperSeen(pmid) {
  try {
    const seen = getSeenPapers();
    seen.add(pmid);
    // Cap so this can't grow forever
    const arr = [...seen].slice(-500);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch (e) {}
  updateNotifBadge();
}

function markAllSeen() {
  try {
    const seen = getSeenPapers();
    notifItems.forEach(p => seen.add(p.pmid));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500)));
  } catch (e) {}
  renderNotifPanel();
  updateNotifBadge();
}

// Unseen papers that mention something this person tracks
function computeNotifications() {
  if (typeof feedCache === 'undefined' || !feedCache.length) return [];
  const mine = getMyCompounds();
  if (!mine.length) return [];
  const seen = getSeenPapers();
  return feedCache
    .filter(p => !seen.has(p.pmid) && paperMatchesMine(p, mine))
    .slice(0, 20);
}

function refreshNotifications() {
  notifItems = computeNotifications();
  updateNotifBadge();
}

function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  const btn = document.getElementById('notifBtn');
  if (!badge || !btn) return;
  const seen = getSeenPapers();
  const unseen = notifItems.filter(p => !seen.has(p.pmid)).length;
  if (unseen > 0) {
    badge.textContent = unseen > 9 ? '9+' : String(unseen);
    badge.style.display = '';
    btn.classList.add('has-new');
  } else {
    badge.style.display = 'none';
    btn.classList.remove('has-new');
  }
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  const open = panel.classList.contains('open');
  if (open) { panel.classList.remove('open'); return; }
  renderNotifPanel();
  panel.classList.add('open');
  if (typeof trackEvent === 'function') trackEvent('notif_open', String(notifItems.length));
}

function closeNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (panel) panel.classList.remove('open');
}

function renderNotifPanel() {
  const body = document.getElementById('notifBody');
  if (!body) return;
  const seen = getSeenPapers();
  const unseen = notifItems.filter(p => !seen.has(p.pmid));

  if (!getMyCompounds().length) {
    body.innerHTML = `<div class="notif-empty">
      <strong>Nothing tracked yet.</strong>
      <p>Add compounds to your Dose Tracker or bookmark them, and we'll tell you
      when new research on those specific compounds appears.</p>
      <button class="btn-hero bh2" onclick="closeNotifPanel();show('tracker')">Open Dose Tracker</button>
    </div>`;
    return;
  }

  if (!unseen.length) {
    body.innerHTML = `<div class="notif-empty">
      <strong>You're up to date.</strong>
      <p>No new research on your compounds since you last checked. We check daily.</p>
    </div>`;
    return;
  }

  body.innerHTML = unseen.map(p => {
    const compounds = (typeof detectCompounds === 'function' ? detectCompounds(p) : [])
      .map(c => c.n).slice(0, 3).join(', ');
    const src = (typeof FEED_SOURCES !== 'undefined' && FEED_SOURCES[p.source]) || { label: 'Research', color: '#60A5FA' };
    return `<div class="notif-item" onclick="openNotifPaper('${p.pmid}')">
      <div class="notif-item-top">
        <span class="notif-src" style="color:${src.color}">${src.label}</span>
        <span class="notif-time">${typeof timeAgo === 'function' ? timeAgo(p.created_at) : ''}</span>
      </div>
      <div class="notif-item-title">${esc(p.title)}</div>
      ${compounds ? `<div class="notif-item-compounds">${esc(compounds)}</div>` : ''}
    </div>`;
  }).join('') + `<button class="notif-mark-all" onclick="markAllSeen()">Mark all as read</button>`;
}

// Opening a notification jumps to that paper in the feed.
// Once LAUNCH_MODE ends, this becomes a Pro feature.
function openNotifPaper(pmid) {
  if (typeof isPro === 'function' && !isPro()) {
    closeNotifPanel();
    openPaywall('notification');
    return;
  }
  markPaperSeen(pmid);
  closeNotifPanel();
  show('research');
  setTimeout(() => {
    if (typeof showResTab === 'function') {
      const btn = document.querySelector('.res-tab');
      showResTab('feed', btn);
    }
    // Filter to this single paper so it's unmissable
    const inp = document.getElementById('feedSearch');
    const paper = feedCache.find(p => p.pmid === pmid);
    if (inp && paper) {
      inp.value = paper.title.slice(0, 40);
      if (typeof onFeedSearch === 'function') onFeedSearch();
    }
  }, 200);
  if (typeof trackEvent === 'function') trackEvent('notif_click', pmid);
}

// Close when clicking outside
document.addEventListener('click', e => {
  const wrap = document.getElementById('notifWrap');
  const panel = document.getElementById('notifPanel');
  if (wrap && panel && panel.classList.contains('open') && !wrap.contains(e.target)) {
    panel.classList.remove('open');
  }
});
