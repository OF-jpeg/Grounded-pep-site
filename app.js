let actFilter='all', bookmarks=new Set(), chatSessions=[], curChat=0, curModal=null;

// ── Bookmark persistence ──────────────────────────────────────────────
// Bookmarks were previously in-memory only and lost on every refresh.
const BOOKMARKS_KEY='grounded_bookmarks';
function loadBookmarks(){
  try{
    const raw=localStorage.getItem(BOOKMARKS_KEY);
    if(raw) bookmarks=new Set(JSON.parse(raw));
  }catch(e){}
}
function saveBookmarks(){
  try{ localStorage.setItem(BOOKMARKS_KEY,JSON.stringify([...bookmarks])); }catch(e){}
}
loadBookmarks();

// CANVAS PARTICLE SYSTEM
(function(){
  const cv=document.getElementById('bgCanvas');
  if(!cv) return;
  const ctx=cv.getContext('2d');
  let pts=[],W,H;
  function resize(){W=cv.width=innerWidth;H=cv.height=innerHeight}
  resize();
  window.addEventListener('resize',resize);
  for(let i=0;i<80;i++) pts.push({x:Math.random()*2000,y:Math.random()*1200,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22,r:Math.random()*1.3+.4,a:Math.random()*.45+.07,h:Math.random()<.5?190:260});
  function draw(){
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=W;if(p.x>W)p.x=0;
      if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);
      ctx.fillStyle='hsla('+p.h+',40%,82%,'+p.a+')';ctx.fill();
    });
    pts.forEach((p,i)=>pts.slice(i+1).forEach(q=>{
      const d=Math.hypot(p.x-q.x,p.y-q.y);
      if(d<110){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle='rgba(200,220,255,'+(1-d/110)*.04+')';ctx.stroke()}
    }));
    requestAnimationFrame(draw);
  }
  draw();
})();

// NAVIGATION
let currentPage='home';
function show(pg){
  currentPage=pg;
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.nl').forEach(e=>e.classList.remove('on'));
  const el=document.getElementById('page-'+pg);
  if(el) el.classList.add('on');
  const keys=['home','db','ai','proto','stacks','tracker','research','community','pricing'];
  const idx=keys.indexOf(pg);
  const nls=document.querySelectorAll('.nl');
  if(idx>=0&&nls[idx]) nls[idx].classList.add('on');
  window.scrollTo(0,0);
  if(pg==='db'){renderDB();renderRecent();}
  if(pg==='stacks') renderStacks();
  if(pg==='research'){ renderResearch(); if(!feedLoaded) loadResearchFeed(); }
  if(pg==='community'&&typeof renderCommFaq==='function'){ renderCommFaq(); renderRoadmap(); }
  if(pg==='tracker') renderTracker();
  if(pg==='home') renderRecommendations();
  if(pg==='ai'){
    if(typeof updateAiQuotaUI==='function') updateAiQuotaUI();
    renderComplexityUI();
  }
}
window.addEventListener('scroll',()=>document.getElementById('mainNav').classList.toggle('scrolled',scrollY>30));

// HERO DEMO TYPEWRITER
(function(){
  const el=document.getElementById('hero-demo');
  if(!el) return;
  const text='BPC-157 is the gold standard for tendon healing. It activates local growth factor receptors, promotes angiogenesis via VEGF, and accelerates collagen deposition — typically showing results within 2–4 weeks at 250–500 mcg/day.';
  let i=0;
  function type(){if(i<text.length){el.textContent=text.slice(0,++i)+'|';setTimeout(type,24)}else{el.textContent=text;setTimeout(()=>{i=0;el.textContent='';setTimeout(type,2000)},5000)}}
  setTimeout(type,800);
})();

// DATABASE
function buildFilters(){
  const row=document.getElementById('dbFilters');
  if(!row) return;
  const cats=[{k:'all',l:'All compounds'},...Object.entries(CATS).map(([k,v])=>({k,l:v.l}))];
  let html='<span class="fch fch-popular'+(actFilter==='popular'?' on':'')+ '" onclick="setFilter(\'popular\',this)">★ Popular</span>';
  html+=cats.map(c=>'<span class="fch'+(c.k===actFilter?' on':'')+ '" onclick="setFilter(\''+c.k+'\',this)">'+c.l+'</span>').join('');
  // Saved filter sits at the end with a live count
  html+='<span class="fch fch-saved'+(actFilter==='saved'?' on':'')+ '" onclick="setFilter(\'saved\',this)">★ Saved'
    +(bookmarks.size?' ('+bookmarks.size+')':'')+'</span>';
  row.innerHTML=html;
}
function setFilter(cat,el){
  actFilter=cat;
  document.querySelectorAll('.fch').forEach(e=>e.classList.remove('on'));
  if(el) el.classList.add('on');
  renderDB(); // buildFilters re-applies the active chip from actFilter
}
function renderDB(){
  buildFilters();
  const q=(document.getElementById('dbSearch')||{}).value||'';
  const sq=q.toLowerCase();
  const sort=(document.getElementById('dbSort')||{}).value||'pop';
  let list=PEPS.filter(p=>{
    const catOk=actFilter==='all'
      ||(actFilter==='saved'?bookmarks.has(p.id)
      :actFilter==='popular'?(typeof POPULAR_IDS!=='undefined'&&POPULAR_IDS.includes(p.id))
      :p.cat===actFilter);
    const qOk=!sq||p.n.toLowerCase().includes(sq)||p.fn.toLowerCase().includes(sq)||(p.known||'').toLowerCase().includes(sq)||(p.alias||'').toLowerCase().includes(sq)||p.ov.toLowerCase().includes(sq)||(p.bens||[]).some(b=>b.toLowerCase().includes(sq));
    return catOk&&qOk;
  });
  if(actFilter==='popular'&&sort==='pop'&&typeof POPULAR_IDS!=='undefined'){
    // Keep the curated ordering so related compounds stay grouped
    list.sort((a,b)=>POPULAR_IDS.indexOf(a.id)-POPULAR_IDS.indexOf(b.id));
  }
  else if(sort==='az') list.sort((a,b)=>a.n.localeCompare(b.n));
  else if(sort==='hl') list.sort((a,b)=>a.hlh-b.hlh);
  else list.sort((a,b)=>b.pop-a.pop);
  const grid=document.getElementById('dbGrid');
  if(!grid) return;
  if(!list.length){
    if(sq&&typeof trackEvent==='function') trackEvent('search_no_results',sq);
    const savedEmpty=actFilter==='saved'&&!bookmarks.size;
    grid.innerHTML=savedEmpty
      ? '<div class="db-empty"><div style="font-size:48px;margin-bottom:16px">☆</div>'
        +'<div style="font-family:var(--fd);font-size:22px;color:var(--t1);margin-bottom:8px">No saved compounds yet</div>'
        +'<p>Tap the ☆ on any compound to save it here for quick access.</p>'
        +'<button class="btn-hero bh2" style="margin-top:18px" onclick="setFilter(\'all\',null)">Browse all compounds</button></div>'
      : '<div class="db-empty"><div style="font-size:48px;margin-bottom:16px">🔬</div><div style="font-family:var(--fd);font-size:22px;color:var(--t1);margin-bottom:8px">No compounds found</div><p>Try adjusting your search or filter.</p></div>';
    return;
  }
  grid.innerHTML=list.map(pepCardHTML).join('');
}

// Shared peptide card markup, used by both the database grid and recommendations
function pepCardHTML(p){
  const c=CATS[p.cat]||{l:p.cat,c:'#fff',bg:'rgba(255,255,255,.08)',b:'rgba(255,255,255,.2)'};
  const bm=bookmarks.has(p.id);
  const locked=(typeof canOpenCompound==='function')&&!canOpenCompound(p.id);
  if(locked){
    return '<div class="pc pc-locked" onclick="openPaywall(\'compound\')">'
      +'<div class="pc-lock-badge">🔒 Pro</div>'
      +'<div class="pc-top"><span class="badge" style="background:'+c.bg+';border:1px solid '+c.b+';color:'+c.c+'">'+c.l+'</span></div>'
      +'<div class="pc-name">'+p.n+'</div>'
      +'<div class="pc-fn">'+(p.known?'<span class="pc-known">'+p.known+'</span>':p.fn)+'</div>'
      +'<div class="pc-desc pc-blur">'+p.ov+'</div>'
      +'<div class="pc-meta">'
      +'<div class="pcm"><div class="pcm-l">Half-life</div><div class="pcm-v pc-blur">'+p.hl+'</div></div>'
      +'<div class="pcm"><div class="pcm-l">Route</div><div class="pcm-v pc-blur">'+p.admin.split(' · ')[0]+'</div></div>'
      +'<div class="pcm"><div class="pcm-l">Status</div><div class="pcm-v pc-blur">'+p.status.split(' ')[0]+'</div></div>'
      +'</div></div>';
  }
  const isPop=(typeof POPULAR_IDS!=='undefined')&&POPULAR_IDS.includes(p.id);
  return '<div class="pc" onclick="openM(\''+p.id+'\')">'
    +'<div class="pc-top"><span class="badge" style="background:'+c.bg+';border:1px solid '+c.b+';color:'+c.c+'">'+c.l+'</span>'
    +(isPop?'<span class="pop-star" title="Commonly discussed">★</span>':'')
    +'<button class="bm'+(bm?' on':'')+ '" onclick="toggleBm(event,\''+p.id+'\')">'+(bm?'★':'☆')+'</button></div>'
    +'<div class="pc-name">'+p.n+'</div>'
    +'<div class="pc-fn">'+(p.known?'<span class="pc-known">'+p.known+'</span>':p.fn)+'</div>'
    +'<div class="pc-desc">'+p.ov+'</div>'
    +'<div class="pc-meta">'
    +'<div class="pcm"><div class="pcm-l">Half-life</div><div class="pcm-v">'+p.hl+'</div></div>'
    +'<div class="pcm"><div class="pcm-l">Route</div><div class="pcm-v">'+p.admin.split(' · ')[0]+'</div></div>'
    +'<div class="pcm"><div class="pcm-l">Status</div><div class="pcm-v">'+p.status.split(' ')[0]+'</div></div>'
    +'</div></div>';
}

// ── Personalized homepage recommendations ────────────────────────────
function renderRecommendations(){
  const sec=document.getElementById('recSection');
  if(!sec) return;
  const meta=(typeof currentUser!=='undefined'&&currentUser)?(currentUser.user_metadata||{}):{};
  const goal=meta.research_goal;
  const cats=GOAL_TO_CATS[goal];
  if(!goal||!cats){sec.style.display='none';return;}

  const matches=PEPS.filter(p=>cats.includes(p.cat)).sort((a,b)=>b.pop-a.pop).slice(0,4);
  if(!matches.length){sec.style.display='none';return;}

  const firstName=meta.first_name?(', '+meta.first_name):'';
  document.getElementById('recEyebrow').textContent='Recommended for you';
  document.getElementById('recTitle').textContent=GOAL_LABELS[goal];
  document.getElementById('recSub').textContent='The most-researched compounds matching your goal'+firstName+'.';
  document.getElementById('recGrid').innerHTML=matches.map(pepCardHTML).join('');
  sec.style.display='block';
}


// Jump to the database pre-filtered to the user's goal category
function viewGoalCategory(){
  const meta=(typeof currentUser!=='undefined'&&currentUser)?(currentUser.user_metadata||{}):{};
  const cats=GOAL_TO_CATS[meta.research_goal];
  show('db');
  if(!cats||!cats.length) return;
  setTimeout(()=>{
    const chips=document.querySelectorAll('.fch');
    const targetLabel=(CATS[cats[0]]||{}).l;
    chips.forEach(chip=>{
      if(chip.textContent.trim()===targetLabel) chip.click();
    });
  },60);
}
function toggleBm(e,id){
  e.stopPropagation();
  const removing=bookmarks.has(id);
  // Removing is always allowed; adding is capped on the free plan
  if(!removing&&typeof canAddBookmark==='function'&&!canAddBookmark(bookmarks.size)){
    openPaywall('bookmark');
    return;
  }
  removing?bookmarks.delete(id):bookmarks.add(id);
  saveBookmarks();
  renderDB();
  toast(removing?'Removed bookmark':'Bookmarked ✓');
}

// MODAL
function openM(id){
  const p=PEPS.find(x=>x.id===id);if(!p) return;
  // Gate Pro-only compounds (also reachable via related-compound links)
  if(typeof canOpenCompound==='function'&&!canOpenCompound(id)){
    closeM();
    openPaywall('compound');
    return;
  }
  curModal=id;
  pushRecent(id);
  if(typeof trackEvent==='function') trackEvent('compound_view',p.n);
  const c=CATS[p.cat]||{l:p.cat,c:'#fff',bg:'rgba(255,255,255,.08)',b:'rgba(255,255,255,.2)'};
  document.getElementById('mBadge').innerHTML='<span style="background:'+c.bg+';border:1px solid '+c.b+';color:'+c.c+';font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;padding:3px 9px;border-radius:50px;display:inline-block;margin-bottom:14px">'+c.l+'</span>';
  document.getElementById('mName').textContent=p.n;
  document.getElementById('mSub').innerHTML=p.known
    ? '<span class="m-known">Also known as '+p.known+'</span><br>'+p.fn
    : p.fn;
  document.getElementById('mOv').textContent=p.ov;
  document.getElementById('mMech').textContent=p.mech;
  document.getElementById('mBens').innerHTML=(p.bens||[]).map(b=>'<span class="tag tg">'+b+'</span>').join('');
  document.getElementById('mSides').innerHTML=(p.sides||[]).map(s=>'<span class="tag tr">'+s+'</span>').join('');
  document.getElementById('mDose').textContent=p.dose;
  document.getElementById('mFreq').textContent=p.freq;
  document.getElementById('mHL').textContent=p.hl;
  document.getElementById('mAdmin').textContent=p.admin;
  document.getElementById('mStore').textContent=p.store;
  document.getElementById('mRecon').textContent=p.recon;
  document.getElementById('mStatus').textContent=p.status;
  const rels=PEPS.filter(x=>p.rel&&p.rel.includes(x.id));
  document.getElementById('mRel').innerHTML=rels.length?rels.map(r=>{const rc=CATS[r.cat]||{c:'#fff',l:r.cat};return'<div class="rel-c" onclick="openM(\''+r.id+'\')"><div style="font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);margin-bottom:3px">'+r.n+'</div><div style="font-size:11px;color:'+rc.c+'">'+rc.l+'</div><div style="font-size:11px;color:var(--t3);margin-top:4px">'+r.hl+'</div></div>'}).join(''):'<p style="font-size:13px;color:var(--t3)">No related compounds listed.</p>';
  setTimeout(()=>{const bar=document.getElementById('mHLbar');if(bar)bar.style.width='50%';},100);
  renderResearchLinks(p);
  renderCitations(p);
  populateCompareSelect(id);
  mTab('ov',document.querySelector('.mt'));
  document.getElementById('mOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeM(){document.getElementById('mOverlay').classList.remove('open');document.body.style.overflow='';}
function handleMO(e){if(e.target.id==='mOverlay')closeM();}
function mTab(tab,btn){
  document.querySelectorAll('.mtc').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.mt').forEach(e=>e.classList.remove('on'));
  const el=document.getElementById('m-'+tab);
  if(el) el.classList.add('on');
  if(btn) btn.classList.add('on');
}
function askAboutModal(){
  if(!curModal) return;
  const p=PEPS.find(x=>x.id===curModal);
  if(!p) return;
  closeM();
  show('ai');
  setTimeout(()=>{
    document.getElementById('aiInp').value='Tell me everything about '+p.n+' — mechanism, dosing, benefits, and what makes it unique.';
    sendAI();
  },300);
}

// STACKS
function renderStacks(){
  const grid=document.getElementById('stkGrid');
  if(!grid) return;
  grid.innerHTML=STACKS_DATA.map((s,i)=>{
    const locked=(typeof canViewStack==='function')&&!canViewStack(i);
    if(locked){
      // Show how many compounds are in the stack, but blur which ones.
      // Seeing the shape of what's behind the paywall converts better than hiding it entirely.
      const blurredPills=s.peps.map(p=>'<span class="sk-p sk-p-blur">'+p+'</span>').join('');
      return '<div class="sk sk-locked" onclick="openPaywall(\'stack\')">'
        +'<div class="pc-lock-badge">🔒 Pro</div>'
        +'<div class="sk-goal">'+s.goal+'</div>'
        +'<div class="sk-name">'+s.name+'</div>'
        +'<div class="sk-count">'+s.peps.length+' compounds</div>'
        +'<div class="sk-peps">'+blurredPills+'</div>'
        +'<div class="sk-rat pc-blur">'+s.rationale+'</div>'
        +'<div class="sk-proto pc-blur"><div class="sk-pt">Protocol</div>'+s.proto.split('\n').join('<br>')+'</div>'
        +'<div class="sk-unlock">Unlock with Pro →</div>'
        +'</div>';
    }
    return '<div class="sk">'
      +'<div class="sk-goal">'+s.goal+'</div>'
      +'<div class="sk-name">'+s.name+'</div>'
      +'<div class="sk-peps">'+s.peps.map(p=>'<span class="sk-p">'+p+'</span>').join('')+'</div>'
      +'<div class="sk-rat">'+s.rationale+'</div>'
      +'<div class="sk-proto"><div class="sk-pt">Protocol</div>'+s.proto.split('\n').join('<br>')+'</div>'
      +'</div>';
  }).join('');
}

// RESEARCH HUB
function renderResearch(){
  const grid=document.getElementById('resGrid');
  if(!grid) return;
  const pro=(typeof isPro==='function')?isPro():false;
  grid.innerHTML=ARTICLES.map((a,i)=>{
    // First article is a free preview; the rest are Pro
    const locked=!pro&&i>0;
    if(locked){
      return '<div class="rc rc-locked" onclick="openPaywall(\'research\')">'
        +'<div class="pc-lock-badge">🔒 Pro</div>'
        +'<div class="rc-m"><span class="rc-c" style="background:rgba(255,255,255,.05);border:1px solid var(--b1);color:'+a.catC+'">'+a.cat+'</span><span class="rc-d">'+a.readTime+'</span></div>'
        +'<div class="rc-t">'+a.title+'</div>'
        +'<div class="rc-a pc-blur">'+a.subtitle+'</div>'
        +'<div class="rc-f"><span class="rc-j">Updated '+a.updated+'</span><span class="rc-link">Unlock →</span></div>'
        +'</div>';
    }
    return '<div class="rc" onclick="openArticle(\''+a.id+'\')">'
      +'<div class="rc-m"><span class="rc-c" style="background:rgba(255,255,255,.05);border:1px solid var(--b1);color:'+a.catC+'">'+a.cat+'</span><span class="rc-d">'+a.readTime+'</span></div>'
      +'<div class="rc-t">'+a.title+'</div>'
      +'<div class="rc-a">'+a.subtitle+'</div>'
      +'<div class="rc-f"><span class="rc-j">Updated '+a.updated+'</span><span class="rc-link">Read →</span></div>'
      +'</div>';
  }).join('');
}

// Where a feed item came from, and how much weight it carries
const FEED_SOURCES={
  pubmed:{label:'PubMed',color:'#60A5FA',note:''},
  trial:{label:'Clinical Trial',color:'#34D399',note:'In progress'},
  europepmc:{label:'Europe PMC',color:'#C4B5FD',note:''},
  preprint:{label:'Preprint',color:'#FCD34D',note:'Not peer reviewed'}
};

// ── Detect which compounds a paper is actually about ──────────────────
// The stored `compounds` field holds the whole search batch, not the real
// match, so we detect from the paper's own text instead. Punctuation is
// stripped both sides so "TB-500" matches "TB500".
function detectCompounds(paper){
  const norm=s=>String(s||'').toLowerCase().replace(/[\s\-–_]/g,'');
  const hay=norm((paper.title||'')+' '+(paper.abstract||'')+' '+(paper.plain_summary||''));
  const found=[];
  PEPS.forEach(p=>{
    // Check the display name, the formal name, and any known aliases
    const candidates=[p.n,p.known,p.alias].filter(Boolean);
    const hit=candidates.some(c=>{
      const n=norm(c);
      return n.length>=4 && hay.includes(n);
    });
    if(hit) found.push(p);
  });
  return found.slice(0,4); // keep the card readable
}

// ── AI actions on a paper ─────────────────────────────────────────────
const PAPER_PROMPTS={
  simple:{
    label:'Explain simply',
    build:p=>`Explain this study in plain language, as if to someone with no science background.\n\nTitle: ${p.title}\nJournal: ${p.journal||'unknown'}\n\n${p.abstract?'Abstract: '+p.abstract:''}\n\nWhat did they do, what did they find, and what does it actually mean? Keep it short.`
  },
  evidence:{
    label:'How strong is this?',
    build:p=>`Assess the evidence quality of this study.\n\nTitle: ${p.title}\nJournal: ${p.journal||'unknown'}\nType: ${p.pub_type||'unknown'}\n\n${p.abstract?'Abstract: '+p.abstract:''}\n\nCover: was this in vitro, animal, or human? Sample size? Was there a control group? How much weight does this finding actually deserve, and what are its limitations? Be honest if the evidence is weak.`
  },
  meaning:{
    label:'What does this mean for me?',
    build:p=>{
      const mine=getMyCompounds();
      const ctx=mine.length?`\n\nFor context, I currently track: ${mine.join(', ')}.`:'';
      return `I came across this study and want to understand its practical relevance.\n\nTitle: ${p.title}\n\n${p.abstract?'Abstract: '+p.abstract:''}${ctx}\n\nWhat, if anything, does this change in practice? Be clear about whether it's actionable or just interesting, and don't overstate it.`;
    }
  }
};

function askAboutPaper(pmid,mode){
  const paper=feedCache.find(p=>p.pmid===pmid);
  if(!paper) return;
  const spec=PAPER_PROMPTS[mode];
  if(!spec) return;
  if(typeof trackEvent==='function') trackEvent('paper_ai_action',mode);
  show('ai');
  setTimeout(()=>{
    const inp=document.getElementById('aiInp');
    if(inp){
      inp.value=spec.build(paper);
      sendAI();
    }
  },300);
}

// ── Live PubMed feed ──────────────────────────────────────────────────
// Reads the research_feed table populated by the research-feed Edge
// Function. Every field originates from NCBI, not from us.
let feedLoaded=false;
let feedCache=[];
let feedFilterMine=false;
let feedSourceFilter='all';
let feedCompoundFilter='';
let feedSearchQuery='';

// Compounds this person actually cares about — what they track, plus bookmarks
function getMyCompounds(){
  const names=new Set();
  try{
    (getRegimen()||[]).forEach(r=>{ if(r.peptide) names.add(r.peptide.toLowerCase().trim()); });
    (getVials()||[]).forEach(v=>{ if(v.peptide) names.add(v.peptide.toLowerCase().trim()); });
  }catch(e){}
  bookmarks.forEach(id=>{
    const p=PEPS.find(x=>x.id===id);
    if(p) names.add(p.n.toLowerCase().trim());
  });
  return [...names].filter(Boolean);
}

// Does a paper mention any compound this person follows?
function paperMatchesMine(paper,mine){
  if(!mine.length) return false;
  // Strip hyphens and spaces from both sides so "TB-500" matches "TB500"
  const norm=s=>String(s||'').toLowerCase().replace(/[\s\-–_]/g,'');
  const hay=norm((paper.title||'')+' '+(paper.compounds||'')+' '+(paper.plain_summary||''));
  return mine.some(name=>{
    const n=norm(name);
    return n.length>=3 && hay.includes(n);
  });
}

function showResTab(tab,btn){
  document.querySelectorAll('.res-panel').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.res-tab').forEach(e=>e.classList.remove('on'));
  document.getElementById('res-'+tab).classList.add('on');
  if(btn) btn.classList.add('on');
  if(tab==='feed'&&!feedLoaded) loadResearchFeed();
}

// Builds the compound dropdown from what's actually in the feed, with counts,
// so people aren't offered filters that return nothing.
function populateFeedCompounds(){
  const sel=document.getElementById('feedCompoundSelect');
  if(!sel) return;
  const counts={};
  feedCache.forEach(p=>{
    detectCompounds(p).forEach(c=>{ counts[c.id]=(counts[c.id]||0)+1; });
  });
  const entries=Object.entries(counts)
    .map(([id,n])=>({p:PEPS.find(x=>x.id===id),n}))
    .filter(e=>e.p)
    .sort((a,b)=>b.n-a.n||a.p.n.localeCompare(b.p.n));
  const prev=sel.value;
  sel.innerHTML='<option value="">All compounds ('+feedCache.length+')</option>'
    +entries.map(e=>'<option value="'+e.p.id+'">'+e.p.n+' ('+e.n+')</option>').join('');
  if(prev) sel.value=prev;
}

function filterFeedByCompound(id){
  const sel=document.getElementById('feedCompoundSelect');
  if(sel) sel.value=id;
  setFeedCompound(id);
  const el=document.getElementById('feedSrcFilters');
  if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function setFeedCompound(id){
  feedCompoundFilter=id;
  renderFeedList();
  renderActiveFilters();
  if(typeof trackEvent==='function'&&id){
    const p=PEPS.find(x=>x.id===id);
    if(p) trackEvent('feed_compound_filter',p.n);
  }
}

let feedSearchTimer=null;
function onFeedSearch(){
  const inp=document.getElementById('feedSearch');
  const clear=document.getElementById('feedSearchClear');
  if(!inp) return;
  if(clear) clear.style.display=inp.value?'':'none';
  clearTimeout(feedSearchTimer);
  feedSearchTimer=setTimeout(()=>{
    feedSearchQuery=inp.value.trim().toLowerCase();
    renderFeedList();
    renderActiveFilters();
    if(feedSearchQuery.length>2&&typeof trackEvent==='function'){
      trackEvent('feed_search',feedSearchQuery);
    }
  },200);
}

function clearFeedSearch(){
  const inp=document.getElementById('feedSearch');
  if(inp) inp.value='';
  feedSearchQuery='';
  const clear=document.getElementById('feedSearchClear');
  if(clear) clear.style.display='none';
  renderFeedList();
  renderActiveFilters();
}

function clearAllFeedFilters(){
  feedCompoundFilter='';
  feedSearchQuery='';
  feedFilterMine=false;
  feedSourceFilter='all';
  const sel=document.getElementById('feedCompoundSelect'); if(sel) sel.value='';
  const inp=document.getElementById('feedSearch'); if(inp) inp.value='';
  const clr=document.getElementById('feedSearchClear'); if(clr) clr.style.display='none';
  document.querySelectorAll('.feed-filter-btn').forEach(b=>b.classList.toggle('on',b.dataset.mode==='all'));
  document.querySelectorAll('.feed-src-btn').forEach(b=>b.classList.toggle('on',b.dataset.src==='all'));
  renderFeedList();
  renderActiveFilters();
}

// Shows what's currently narrowing the list, each removable
function renderActiveFilters(){
  const el=document.getElementById('feedActiveFilters');
  if(!el) return;
  const chips=[];
  if(feedCompoundFilter){
    const p=PEPS.find(x=>x.id===feedCompoundFilter);
    if(p) chips.push('<button class="faf-chip" onclick="document.getElementById(\'feedCompoundSelect\').value=\'\';setFeedCompound(\'\')">'+esc(p.n)+' ✕</button>');
  }
  if(feedSearchQuery) chips.push('<button class="faf-chip" onclick="clearFeedSearch()">“'+esc(feedSearchQuery)+'” ✕</button>');
  if(feedFilterMine) chips.push('<button class="faf-chip" onclick="toggleFeedFilter(false)">My compounds ✕</button>');
  if(feedSourceFilter!=='all'){
    const s=FEED_SOURCES[feedSourceFilter];
    chips.push('<button class="faf-chip" onclick="setFeedSource(\'all\')">'+(s?s.label:feedSourceFilter)+' ✕</button>');
  }
  if(!chips.length){ el.style.display='none'; return; }
  el.style.display='flex';
  el.innerHTML='<span class="faf-label">Filtered by</span>'+chips.join('')
    +'<button class="faf-clear" onclick="clearAllFeedFilters()">Clear all</button>';
}

function setFeedSource(src){
  feedSourceFilter=src;
  document.querySelectorAll('.feed-src-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.src===src);
  });
  renderFeedList();
  if(typeof trackEvent==='function') trackEvent('feed_source',src);
}

function toggleFeedFilter(mine){
  feedFilterMine=mine;
  document.querySelectorAll('.feed-filter-btn').forEach(b=>{
    b.classList.toggle('on',(b.dataset.mode==='mine')===mine);
  });
  renderFeedList();
  if(typeof trackEvent==='function') trackEvent('feed_filter',mine?'mine':'all');
}

function timeAgo(iso){
  const d=new Date(iso);
  if(isNaN(d)) return '';
  const days=Math.floor((Date.now()-d.getTime())/86400000);
  if(days<1) return 'today';
  if(days===1) return 'yesterday';
  if(days<30) return days+' days ago';
  const months=Math.floor(days/30);
  return months===1?'1 month ago':months+' months ago';
}

function renderFeedList(){
  const wrap=document.getElementById('feedList');
  if(!wrap) return;
  const mine=getMyCompounds();
  let list=feedFilterMine?feedCache.filter(p=>paperMatchesMine(p,mine)):feedCache;
  if(feedSourceFilter!=='all'){
    // europepmc rows are published papers too, so group them with pubmed
    list=list.filter(p=>feedSourceFilter==='pubmed'
      ? (p.source==='pubmed'||p.source==='europepmc'||!p.source)
      : p.source===feedSourceFilter);
  }
  if(feedCompoundFilter){
    list=list.filter(p=>detectCompounds(p).some(c=>c.id===feedCompoundFilter));
  }
  if(feedSearchQuery){
    const q=feedSearchQuery;
    list=list.filter(p=>{
      const hay=((p.title||'')+' '+(p.journal||'')+' '+(p.compounds||'')+' '
        +(p.plain_summary||'')+' '+(p.abstract||'')+' '+(p.authors||'')).toLowerCase();
      return hay.includes(q);
    });
  }

  if(feedFilterMine&&!mine.length){
    wrap.innerHTML='<div class="feed-empty">'
      +'<strong>Nothing tracked yet.</strong><br>'
      +'Add compounds to your Dose Tracker or bookmark them, and new research on '
      +'those specific compounds will show up here.'
      +'<div style="margin-top:16px"><button class="btn-hero bh2" onclick="show(\'tracker\')">Open Dose Tracker</button></div>'
      +'</div>';
    return;
  }
  if(!list.length){
    const filtering=feedCompoundFilter||feedSearchQuery||feedSourceFilter!=='all';
    wrap.innerHTML='<div class="feed-empty">'
      +(filtering
        ? '<strong>No results for those filters.</strong><br>Try widening your search.'
          +'<div style="margin-top:16px"><button class="btn-hero bh2" onclick="clearAllFeedFilters()">Clear filters</button></div>'
        : feedFilterMine
          ? '<strong>No new papers on your compounds yet.</strong><br>We check for new research daily — this fills in as it is published.'
          : '<strong>No papers yet.</strong><br>The feed populates once the research-feed function has run.')
      +'</div>';
    return;
  }

  const countEl=document.getElementById('feedResultCount');
  if(countEl) countEl.textContent=list.length+(list.length===1?' result':' results');

  wrap.innerHTML=list.map(p=>{
    const summary=p.plain_summary||p.abstract||'';
    const short=summary.length>320?summary.slice(0,320)+'…':summary;
    const isAI=!!p.plain_summary;
    const relevant=mine.length&&paperMatchesMine(p,mine);
    const detected=detectCompounds(p);
    const chips=detected.length
      ? '<div class="feed-compounds">'+detected.map(c=>{
          const cc=CATS[c.cat]||{c:'#93C5FD'};
          const isMine=mine.some(m=>m.replace(/[\s\-–_]/g,'').toLowerCase()===c.n.replace(/[\s\-–_]/g,'').toLowerCase());
          return '<span class="feed-chip-group">'
            +'<button class="feed-chip'+(isMine?' feed-chip-mine':'')+'" style="color:'+cc.c+'" '
            +'onclick="event.stopPropagation();filterFeedByCompound(\''+c.id+'\')" '
            +'title="Show only '+esc(c.n)+' research">'+esc(c.n)+'</button>'
            +'<button class="feed-chip-open" onclick="event.stopPropagation();openM(\''+c.id+'\')" '
            +'title="Open '+esc(c.n)+' profile">↗</button></span>';
        }).join('')+'</div>'
      : '';

    const src=FEED_SOURCES[p.source]||FEED_SOURCES.pubmed;
    const isTrial=p.source==='trial';
    const isPreprint=p.source==='preprint';
    // Fall back to a PubMed link for rows stored before urls were saved
    const link=p.url||('https://pubmed.ncbi.nlm.nih.gov/'+encodeURIComponent(p.pmid)+'/');
    const linkLabel=isTrial?'View trial ↗':'Read full paper ↗';

    return '<div class="feed-item'+(relevant?' feed-relevant':'')+'">'
      +(relevant&&!feedFilterMine?'<div class="feed-tag-mine">Tracks your compounds</div>':'')
      +'<div class="feed-meta">'
      +'<span class="feed-src" style="color:'+src.color+';border-color:'+src.color+'40">'+src.label+'</span>'
      +(p.journal?'<span class="feed-journal">'+esc(p.journal)+'</span>':'')
      +'<span class="feed-date">'+esc(p.pub_date||'')+'</span>'
      +'<span class="feed-added">added '+timeAgo(p.created_at)+'</span></div>'
      +'<div class="feed-title">'+esc(p.title)+'</div>'
      +(isTrial&&p.pub_type?'<div class="feed-trial-meta">'+esc(p.pub_type)+'</div>':'')
      +(isPreprint?'<div class="feed-warn">Preprint — not yet peer reviewed. Treat findings as provisional.</div>':'')
      +(isTrial?'<div class="feed-warn feed-warn-trial">Registered trial in progress, not a published result.</div>':'')
      +chips
      +(p.authors?'<div class="feed-authors">'+esc(p.authors)+'</div>':'')
      +(short?'<div class="feed-sum">'+esc(short)+(isAI?'<span class="feed-ai-tag">plain-language summary</span>':'')+'</div>':'')
      +'<div class="feed-actions">'
      +'<button class="feed-ai-btn" onclick="askAboutPaper(\''+esc(p.pmid)+'\',\'simple\')">Explain simply</button>'
      +'<button class="feed-ai-btn" onclick="askAboutPaper(\''+esc(p.pmid)+'\',\'evidence\')">How strong is this?</button>'
      +'<button class="feed-ai-btn" onclick="askAboutPaper(\''+esc(p.pmid)+'\',\'meaning\')">What does this mean for me?</button>'
      +'</div>'
      +'<div class="feed-foot">'
      +'<a class="feed-link" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+linkLabel+'</a>'
      +'<span class="feed-pmid">'+esc(p.pmid)+'</span>'
      +'</div></div>';
  }).join('');
}

async function loadResearchFeed(){
  const wrap=document.getElementById('feedList');
  if(!wrap) return;
  wrap.innerHTML='<div class="feed-loading">Loading latest research…</div>';

  if(typeof sb==='undefined'){
    wrap.innerHTML='<div class="feed-empty">Feed unavailable — not connected.</div>';
    return;
  }

  try{
    const {data,error}=await sb
      .from('research_feed')
      .select('pmid,title,journal,pub_date,authors,pub_type,plain_summary,abstract,compounds,source,url,created_at')
      .order('created_at',{ascending:false})
      .limit(60);
    if(error) throw error;
    feedLoaded=true;
    feedCache=data||[];
    updateFeedCounts();
    populateFeedCompounds();
    renderFeedList();
    renderActiveFilters();
    if(typeof refreshNotifications==='function') refreshNotifications();
  }catch(e){
    wrap.innerHTML='<div class="feed-empty">'
      +'<strong>Feed not set up yet.</strong><br>'
      +'The <code>research_feed</code> table doesn\'t exist. '
      +'See <code>supabase/functions/research-feed/DEPLOY.md</code>.'
      +'</div>';
  }
}

// Shows how many of the loaded papers touch the person's own compounds
function updateFeedCounts(){
  const el=document.getElementById('feedMineCount');
  if(!el) return;
  const mine=getMyCompounds();
  const n=mine.length?feedCache.filter(p=>paperMatchesMine(p,mine)).length:0;
  el.textContent=n?' ('+n+')':'';
}

// ── Article reading view ──────────────────────────────────────────────
// Renders the markdown subset used by articles.js into readable prose.
function articleToHTML(md){
  const e=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inl=s=>s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  const lines=md.trim().split('\n');
  let html='',inList=false;
  const closeList=()=>{ if(inList){ html+='</ul>'; inList=false; } };
  lines.forEach(raw=>{
    const line=raw.trim();
    if(!line){ closeList(); return; }
    if(line.startsWith('### ')){ closeList(); html+='<h4>'+inl(e(line.slice(4)))+'</h4>'; return; }
    if(line.startsWith('## ')){ closeList(); html+='<h3>'+inl(e(line.slice(3)))+'</h3>'; return; }
    if(line.startsWith('- ')){
      if(!inList){ html+='<ul>'; inList=true; }
      html+='<li>'+inl(e(line.slice(2)))+'</li>'; return;
    }
    if(/^\d+\.\s/.test(line)){ closeList(); html+='<p class="art-step">'+inl(e(line))+'</p>'; return; }
    closeList();
    html+='<p>'+inl(e(line))+'</p>';
  });
  closeList();
  return html;
}

function openArticle(id){
  const a=ARTICLES.find(x=>x.id===id);
  if(!a) return;
  const idx=ARTICLES.indexOf(a);
  const pro=(typeof isPro==='function')?isPro():false;
  if(!pro&&idx>0){ openPaywall('research'); return; }
  const cat=document.getElementById('artCat');
  cat.textContent=a.cat;
  cat.style.color=a.catC;
  document.getElementById('artMeta').textContent=a.readTime+' · Updated '+a.updated;
  document.getElementById('artTitle').textContent=a.title;
  document.getElementById('artSub').textContent=a.subtitle;
  document.getElementById('artBody').innerHTML=articleToHTML(a.body);
  document.getElementById('artOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  const m=document.querySelector('#artOverlay .modal');
  if(m) m.scrollTop=0;
  if(typeof trackEvent==='function') trackEvent('article_read',a.title);
}
function closeArticle(){
  document.getElementById('artOverlay').classList.remove('open');
  document.body.style.overflow='';
}

// MARKDOWN RENDERER
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function rMD(raw){
  if(!raw) return '';
  let s=raw;
  s=s.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,l,c)=>'<pre><code>'+esc(c.trim())+'</code></pre>');
  s=s.replace(/^#### (.+)$/gm,'<h4>$1</h4>');
  s=s.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  s=s.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  s=s.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  s=s.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/\*(.+?)\*/g,'<em>$1</em>');
  s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
  const tRx=/^(\|.+\|\n)(\|[-| :]+\|\n)((?:\|.+\|\n?)+)/gm;
  s=s.replace(tRx,(m,h,sep,body)=>{
    const hc=h.trim().split('|').filter(Boolean).map(c=>'<th>'+c.trim()+'</th>').join('');
    const rows=body.trim().split('\n').map(r=>{const cells=r.split('|').filter(Boolean).map(c=>'<td>'+c.trim()+'</td>').join('');return'<tr>'+cells+'</tr>';}).join('');
    return'<table><thead><tr>'+hc+'</tr></thead><tbody>'+rows+'</tbody></table>';
  });
  s=s.replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>');
  s=s.replace(/^---+$/gm,'<hr>');
  s=s.replace(/((?:^[-*] .+\n?)+)/gm,m=>'<ul>'+m.trim().split('\n').map(l=>'<li>'+l.replace(/^[-*] /,'')+'</li>').join('')+'</ul>');
  s=s.replace(/((?:^\d+\. .+\n?)+)/gm,m=>'<ol>'+m.trim().split('\n').map(l=>'<li>'+l.replace(/^\d+\. /,'')+'</li>').join('')+'</ol>');
  s=s.replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank">$1</a>');
  s=s.split(/\n{2,}/).map(p=>{
    p=p.trim();
    if(!p||/^<[hH1-6]|^<ul|^<ol|^<pre|^<table|^<blockquote|^<hr/.test(p)) return p;
    return'<p>'+p.replace(/\n/g,'<br>')+'</p>';
  }).join('\n');
  return s;
}

// AI CHAT
const SYS=`You are Grounded's expert AI research guide — calm, authoritative, and highly knowledgeable about peptide science.

You have comprehensive expertise in 81 research peptides across all major categories:

Growth Hormone: Ipamorelin, CJC-1295, Sermorelin, GHRP-2, GHRP-6, Hexarelin, MK-677, Tabimorelin, Alexamorelin, GRF 1-44, Somatropin (rhGH)
Healing & Recovery: BPC-157, TB-500, Thymosin Beta-4, GHK-Cu, LL-37, KPV, ARA-290 (Cibinetide), Larazotide Acetate, Argireline, SNAP-8, Matrixyl, AHK-Cu
Metabolic/GLP-1: Semaglutide, Tirzepatide, Liraglutide, Exenatide, Dulaglutide, Retatrutide, Cagrilintide, Survodutide, Pramlintide, Glucagon, Octreotide, Lanreotide
Fat Loss: AOD-9604, Tesamorelin, Adipotide (FTPP)
Muscle & Performance: IGF-1 LR3, MGF, PEG-MGF, IGF-1 DES, Follistatin 344, ACE-031
Longevity: Epithalon, Thymalin, SS-31/Elamipretide, MOTS-c, Humanin, Vilon, FOXO4-DRI, GDF11, Klotho, NAD+, Calcitonin, Teriparatide, Abaloparatide
Sleep: DSIP
Cognitive: Semax, Selank, Dihexa, Noopept, Cerebrolysin, Cortexin, Pinealon
Immune Support: Thymosin Alpha-1, Thymogen, Imunofan
Reproductive Health: Oxytocin, Kisspeptin-10, Gonadorelin, Triptorelin, Leuprolide, hCG
Research/Other: PT-141 (Bremelanotide), Melanotan II, Melanotan I, Setmelanotide, Secretin, Sincalide, Corticorelin, Desmopressin

Communication principles:
- Lead with the most important information
- Use plain language with analogies for complex mechanisms
- Be precise about research status: distinguish preclinical from clinical evidence
- Format longer responses with ## headers, bullet points, and tables when helpful
- For comparisons: create structured tables with clear criteria
- For stacking questions: explain the mechanism of synergy specifically
- Include a brief disclaimer for dosing/administration questions
- Respond naturally and conversationally, never scripted
- Adapt depth to the complexity of the question`;

// Maps onboarding goal values -> database category keys
const GOAL_TO_CATS={
  recovery:['healing'],
  fatloss:['fatloss','metabolic'],
  gh:['gh'],
  cognitive:['cognitive'],
  longevity:['longevity'],
  muscle:['muscle']
};
const GOAL_LABELS={
  recovery:'Recovery & Healing',
  fatloss:'Fat Loss',
  gh:'Growth Hormone Optimization',
  cognitive:'Cognitive Enhancement',
  longevity:'Longevity & Anti-Aging',
  muscle:'Muscle & Performance'
};
const EXP_GUIDANCE={
  new:`This person is NEW to peptides. Assume no prior background knowledge.
- Define technical terms the first time you use them (e.g. "subcutaneous (just under the skin)")
- Lead with plain-language analogies before mechanism detail
- Keep responses shorter and focused on the practical takeaway
- Proactively mention safety basics and the value of professional guidance
- Never assume they know what reconstitution, half-life, or a secretagogue is`,
  some:`This person has SOME experience with peptides. Assume working familiarity with basics.
- You can use common terms (subQ, half-life, reconstitution) without defining them
- Go one level deeper into mechanism than you would for a beginner
- Still explain less common pathways and receptor names when introduced`,
  experienced:`This person is EXPERIENCED with peptides. Assume strong background knowledge.
- Skip basic definitions entirely — get straight to substance
- Use precise pharmacological terminology freely
- Go deep on mechanism, receptor selectivity, pharmacokinetics, and nuance
- Prioritize signal over hand-holding; they want depth, not reassurance
- Still flag genuine safety concerns, but without over-caveating`
};

// ── Claude API access ─────────────────────────────────────────────────
// All AI calls go through our Supabase Edge Function, which holds the
// Anthropic API key server-side. Never call api.anthropic.com directly
// from the browser — the key would be visible in page source.
const CLAUDE_MODEL='claude-sonnet-5';
const CLAUDE_ENDPOINT=SUPABASE_URL+'/functions/v1/claude';

async function callClaude(payload){
  // Prefer the signed-in user's token; fall back to the public anon key
  let token=SUPABASE_ANON_KEY;
  try{
    const {data}=await sb.auth.getSession();
    if(data?.session?.access_token) token=data.session.access_token;
  }catch(e){}
  return fetch(CLAUDE_ENDPOINT,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+token,
      'apikey':SUPABASE_ANON_KEY
    },
    body:JSON.stringify(payload)
  });
}

// ── Mobile navigation ─────────────────────────────────────────────────
// The desktop nav links are hidden under 900px, so this drawer is the only
// way to navigate on phones.
function toggleMobileNav(){
  const open=document.getElementById('mobileNav').classList.contains('open');
  open?closeMobileNav():openMobileNav();
}
function openMobileNav(){
  document.getElementById('mobileNav').classList.add('open');
  document.getElementById('mnavBackdrop').classList.add('open');
  document.getElementById('navBurger').classList.add('open');
  document.getElementById('navBurger').setAttribute('aria-expanded','true');
  document.body.style.overflow='hidden';
  renderMobileAuth();
  syncMobileNavActive();
}
function closeMobileNav(){
  document.getElementById('mobileNav').classList.remove('open');
  document.getElementById('mnavBackdrop').classList.remove('open');
  document.getElementById('navBurger').classList.remove('open');
  document.getElementById('navBurger').setAttribute('aria-expanded','false');
  document.body.style.overflow='';
}
function mobileGo(pg){
  closeMobileNav();
  show(pg);
}
function syncMobileNavActive(){
  // Matches on data-page rather than index, so adding non-page links
  // (like external links) can't break the highlighting
  document.querySelectorAll('.mnav-link[data-page]').forEach(l=>{
    l.classList.toggle('on',l.dataset.page===currentPage);
  });
}
// Mirrors sign-in state into the drawer footer
function renderMobileAuth(){
  const el=document.getElementById('mnavAuth');
  if(!el) return;
  const user=(typeof currentUser!=='undefined')?currentUser:null;
  if(user){
    const meta=user.user_metadata||{};
    const name=meta.first_name||meta.full_name||user.email||'User';
    const pro=(typeof isPro==='function')&&isPro();
    el.innerHTML='<div class="mnav-user">'
      +'<div class="user-chip-avatar">'+String(name).charAt(0).toUpperCase()+'</div>'
      +'<div><div class="mnav-user-name">'+name+(pro?' <span class="pro-badge">PRO</span>':'')+'</div>'
      +'<div class="mnav-user-email">'+(user.email||'')+'</div></div></div>'
      +(pro?'':'<button class="btn-hero bh1" onclick="mobileGo(\'pricing\')">Free access ✦</button>')
      +'<button class="btn-hero bh2" onclick="signOutUser();closeMobileNav()">Sign out</button>';
  } else {
    el.innerHTML='<button class="btn-hero bh1" onclick="closeMobileNav();openAuth(\'signup\')">Sign up</button>'
      +'<button class="btn-hero bh2" onclick="closeMobileNav();openAuth(\'signin\')">Sign in</button>';
  }
}

// ── Recently viewed compounds ─────────────────────────────────────────
const RECENT_KEY='grounded_recent';
const MAX_RECENT=6;
function getRecent(){
  try{ return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]'); }catch(e){ return []; }
}
function pushRecent(id){
  try{
    let list=getRecent().filter(x=>x!==id);
    list.unshift(id);
    list=list.slice(0,MAX_RECENT);
    localStorage.setItem(RECENT_KEY,JSON.stringify(list));
  }catch(e){}
}
function renderRecent(){
  const sec=document.getElementById('recentSection');
  const row=document.getElementById('recentRow');
  if(!sec||!row) return;
  const ids=getRecent();
  const items=ids.map(id=>PEPS.find(p=>p.id===id)).filter(Boolean);
  if(items.length<2){ sec.style.display='none'; return; }
  row.innerHTML=items.map(p=>{
    const c=CATS[p.cat]||{c:'#fff',l:p.cat};
    return '<div class="recent-chip" onclick="openM(\''+p.id+'\')">'
      +'<div class="recent-name">'+p.n+'</div>'
      +'<div class="recent-cat" style="color:'+c.c+'">'+c.l+'</div></div>';
  }).join('');
  sec.style.display='block';
}

// ── Side-by-side compound comparison ──────────────────────────────────
function populateCompareSelect(currentId){
  const sel=document.getElementById('cmpSelect');
  if(!sel) return;
  const others=PEPS.filter(p=>p.id!==currentId).sort((a,b)=>a.n.localeCompare(b.n));
  sel.innerHTML='<option value="">Choose a compound…</option>'
    +others.map(p=>'<option value="'+p.id+'">'+p.n+'</option>').join('');
  document.getElementById('cmpResult').innerHTML='';
}

function renderCompare(){
  const sel=document.getElementById('cmpSelect');
  const out=document.getElementById('cmpResult');
  if(!sel||!out) return;
  const otherId=sel.value;
  if(!otherId){ out.innerHTML=''; return; }

  // Comparing against a locked compound requires Pro
  if(typeof canOpenCompound==='function'&&!canOpenCompound(otherId)){
    out.innerHTML='<div class="cmp-locked"><div class="pc-lock-badge" style="position:static;display:inline-block;margin-bottom:10px">🔒 Pro</div>'
      +'<p style="font-size:13px;color:var(--t2);line-height:1.6">This compound is Pro-only. Upgrade to compare it.</p>'
      +'<button class="btn-hero bh1" style="margin-top:14px" onclick="closeM();show(\'pricing\')">See Pro plans</button></div>';
    return;
  }

  const a=PEPS.find(p=>p.id===curModal);
  const b=PEPS.find(p=>p.id===otherId);
  if(!a||!b){ out.innerHTML=''; return; }

  const ca=CATS[a.cat]||{l:a.cat,c:'#fff'};
  const cb=CATS[b.cat]||{l:b.cat,c:'#fff'};
  const rows=[
    ['Category','<span style="color:'+ca.c+'">'+ca.l+'</span>','<span style="color:'+cb.c+'">'+cb.l+'</span>'],
    ['Typical dose',a.dose,b.dose],
    ['Frequency',a.freq,b.freq],
    ['Half-life',a.hl,b.hl],
    ['Route',a.admin,b.admin],
    ['Research status',a.status,b.status],
  ];

  out.innerHTML='<div class="cmp-head"><div class="cmp-name">'+a.n+'</div><div class="cmp-vs">vs</div><div class="cmp-name">'+b.n+'</div></div>'
    +'<div class="cmp-table">'
    +rows.map(r=>'<div class="cmp-row"><div class="cmp-lbl">'+r[0]+'</div>'
      +'<div class="cmp-val">'+r[1]+'</div><div class="cmp-val">'+r[2]+'</div></div>').join('')
    +'</div>'
    +'<div class="cmp-mechs">'
    +'<div class="cmp-mech"><div class="cmp-mech-title">'+a.n+' — mechanism</div><p>'+a.mech+'</p></div>'
    +'<div class="cmp-mech"><div class="cmp-mech-title">'+b.n+' — mechanism</div><p>'+b.mech+'</p></div>'
    +'</div>'
    +'<button class="ba" style="margin-top:16px" onclick="askCompare(\''+a.n.replace(/'/g,"\\'")+'\',\''+b.n.replace(/'/g,"\\'")+'\')">Ask the AI to compare these</button>';
}

function askCompare(nameA,nameB){
  closeM();
  show('ai');
  setTimeout(()=>{
    const inp=document.getElementById('aiInp');
    if(inp){
      inp.value='Compare '+nameA+' and '+nameB+'. Cover mechanism differences, which goals each suits better, and whether they can be stacked.';
      sendAI();
    }
  },300);
}

// ── Research database links ───────────────────────────────────────────
// Builds live search URLs rather than hardcoding specific paper IDs, so
// nothing can go stale or point at a paper that doesn't exist. Results
// stay current as new studies are published.
function buildResearchLinks(p){
  // Prefer the formal/full name for search accuracy, fall back to the short name
  const primary=(p.fn||p.n).replace(/\s*\([^)]*\)\s*/g,' ').trim();
  const q=encodeURIComponent(primary);
  const qShort=encodeURIComponent(p.n);
  return [
    {
      name:'PubMed',
      desc:'Peer-reviewed studies and abstracts',
      url:'https://pubmed.ncbi.nlm.nih.gov/?term='+q,
      color:'#60A5FA'
    },
    {
      name:'ClinicalTrials.gov',
      desc:'Registered human trials, past and ongoing',
      url:'https://clinicaltrials.gov/search?intr='+qShort,
      color:'#34D399'
    },
    {
      name:'Europe PMC',
      desc:'Open-access full-text papers',
      url:'https://europepmc.org/search?query='+q,
      color:'#C4B5FD'
    },
    {
      name:'Google Scholar',
      desc:'Broad academic search including citations',
      url:'https://scholar.google.com/scholar?q='+q,
      color:'#FCD34D'
    }
  ];
}

function renderResearchLinks(p){
  const wrap=document.getElementById('mResearchLinks');
  if(!wrap) return;
  wrap.innerHTML=buildResearchLinks(p).map(l=>
    '<a class="res-link" href="'+l.url+'" target="_blank" rel="noopener noreferrer">'
    +'<div class="res-link-dot" style="background:'+l.color+'"></div>'
    +'<div class="res-link-body"><div class="res-link-name">'+l.name+'</div>'
    +'<div class="res-link-desc">'+l.desc+'</div></div>'
    +'<div class="res-link-arrow">↗</div></a>'
  ).join('');
}

// Renders curated citations when a compound has them (see CITATIONS in data.js)
function renderCitations(p){
  const wrap=document.getElementById('mCitations');
  if(!wrap) return;
  const cites=(typeof CITATIONS!=='undefined')?CITATIONS[p.id]:null;
  if(!cites||!cites.length){ wrap.innerHTML=''; return; }
  wrap.innerHTML='<div class="sh2" style="margin-top:22px">Key papers</div>'
    +'<div class="cite-list">'
    +cites.map(c=>
      '<a class="cite" href="https://pubmed.ncbi.nlm.nih.gov/'+c.pmid+'/" target="_blank" rel="noopener noreferrer">'
      +'<div class="cite-title">'+c.title+'</div>'
      +'<div class="cite-meta">'+c.journal+' · '+c.year+' · PMID '+c.pmid+'</div>'
      +(c.note?'<div class="cite-note">'+c.note+'</div>':'')
      +'</a>'
    ).join('')
    +'</div>';
}

// ── Explanation complexity ────────────────────────────────────────────
// A manual override the person controls directly, separate from the
// experience level they set once at onboarding. Someone experienced can
// still want a simple answer, and a beginner may want to push deeper.
const COMPLEXITY_KEY='grounded_complexity';
let complexityLevel=null; // null = follow their onboarding experience level

const COMPLEXITY_GUIDANCE={
  easy:`EXPLANATION LEVEL: SIMPLE — write so a 9th grader could follow it.
- Assume no science background whatsoever
- Define every technical term the first time, in parentheses, e.g. "subcutaneous (just under the skin)"
- Lead with a plain-language analogy before any mechanism detail
- Use short sentences and short paragraphs
- Avoid receptor names, pathway names, and pharmacokinetic jargon unless the person asks
- Prefer "your body's own repair signal" over "endogenous growth factor upregulation"
- Keep answers brief — one clear idea at a time
- Never talk down to them; simple is not the same as condescending`,
  normal:`EXPLANATION LEVEL: STANDARD — write for an informed general reader.
- Assume familiarity with common terms (subQ, half-life, reconstitution, mcg vs mg)
- Explain less common mechanisms and receptor names when you introduce them
- Balance mechanism with practical takeaway
- Use analogies for genuinely complex processes, but don't over-simplify`,
  hard:`EXPLANATION LEVEL: TECHNICAL — write for someone with real background knowledge.
- Skip basic definitions entirely; assume fluency in pharmacology terminology
- Name specific receptors, signalling pathways, and binding affinities where relevant
- Discuss pharmacokinetics precisely: half-life, bioavailability, clearance, tissue distribution
- Reference study design and evidence quality — sample size, model organism, whether results replicated
- Distinguish clearly between in-vitro, animal, and human data
- Engage with mechanistic nuance and open questions rather than smoothing them over
- Do not pad with caveats they already understand`
};

const COMPLEXITY_LABELS={easy:'Simple',normal:'Standard',hard:'Technical'};

function loadComplexity(){
  try{
    const saved=localStorage.getItem(COMPLEXITY_KEY);
    if(saved&&COMPLEXITY_GUIDANCE[saved]) complexityLevel=saved;
  }catch(e){}
}

function setComplexity(level){
  complexityLevel=(complexityLevel===level)?null:level; // clicking again clears the override
  try{
    if(complexityLevel) localStorage.setItem(COMPLEXITY_KEY,complexityLevel);
    else localStorage.removeItem(COMPLEXITY_KEY);
  }catch(e){}
  renderComplexityUI();
  if(typeof trackEvent==='function') trackEvent('complexity_set',complexityLevel||'auto');
  toast(complexityLevel
    ? 'Explanations set to '+COMPLEXITY_LABELS[complexityLevel]
    : 'Following your profile setting');
}

function renderComplexityUI(){
  document.querySelectorAll('.cx-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.level===complexityLevel);
  });
}

// Builds the system prompt, layering in personalization when available
function getSYS(){
  let prompt=SYS;
  const meta=(typeof currentUser!=='undefined'&&currentUser)?(currentUser.user_metadata||{}):{};
  const exp=meta.experience_level;
  const goal=meta.research_goal;
  if(!exp&&!goal&&!complexityLevel) return prompt;

  prompt+='\n\n--- PERSONALIZATION FOR THIS USER ---';
  // An explicit complexity choice overrides the onboarding experience level
  if(complexityLevel&&COMPLEXITY_GUIDANCE[complexityLevel]){
    prompt+='\n\n'+COMPLEXITY_GUIDANCE[complexityLevel];
  } else if(exp&&EXP_GUIDANCE[exp]){
    prompt+='\n\n'+EXP_GUIDANCE[exp];
  }
  if(goal&&GOAL_LABELS[goal]){
    prompt+=`\n\nTheir stated primary research goal is: ${GOAL_LABELS[goal]}. When a question is open-ended or they ask for recommendations, weight your answer toward this goal — but never ignore or deflect questions about other areas.`;
  }
  prompt+='\n\nApply this naturally. Never announce that you are adjusting to their experience level or goal.';
  return prompt;
}

// ── Chat persistence ──────────────────────────────────────────────────
// Conversations were previously in-memory only and lost on refresh, which
// made the sidebar misleading and defeated the export feature.
const CHATS_KEY='grounded_chats';
const MAX_STORED_CHATS=25;
function saveChats(){
  try{
    // Cap stored history so localStorage can't grow without bound
    const trimmed=chatSessions.slice(0,MAX_STORED_CHATS);
    localStorage.setItem(CHATS_KEY,JSON.stringify({chats:trimmed,active:Math.min(curChat,trimmed.length-1)}));
  }catch(e){ /* quota exceeded — keep working in memory */ }
}
function loadChats(){
  try{
    const raw=localStorage.getItem(CHATS_KEY);
    if(!raw) return false;
    const data=JSON.parse(raw);
    if(Array.isArray(data.chats)&&data.chats.length){
      chatSessions=data.chats;
      curChat=Math.max(0,Math.min(data.active||0,chatSessions.length-1));
      return true;
    }
  }catch(e){}
  return false;
}

function initAI(){
  const restored=loadChats();
  if(!chatSessions.length){
    chatSessions=[{id:0,title:'New conversation',msgs:[]}];
    curChat=0;
  }
  renderChatList();
  if(restored) renderMsgs();
}
function renderChatList(){
  const list=document.getElementById('aiList');
  if(!list) return;
  list.innerHTML=chatSessions.map((s,i)=>'<div class="ai-li'+(i===curChat?' on':'')+'" onclick="switchChat('+i+')">'
    +'<div class="ai-li-t">'+(s.title||'New conversation')+'</div>'
    +'<button class="ai-li-del" onclick="deleteChat(event,'+i+')" aria-label="Delete conversation">✕</button>'
    +'</div>').join('');
}
function switchChat(i){curChat=i;renderChatList();renderMsgs();saveChats();}
function newChat(){
  chatSessions.unshift({id:Date.now(),title:'New conversation',msgs:[]});
  curChat=0;renderChatList();renderMsgs();saveChats();
  toast('New chat started');
}
function deleteChat(e,i){
  e.stopPropagation();
  chatSessions.splice(i,1);
  if(!chatSessions.length) chatSessions=[{id:Date.now(),title:'New conversation',msgs:[]}];
  if(curChat>=chatSessions.length) curChat=chatSessions.length-1;
  else if(curChat>i) curChat--;
  renderChatList();renderMsgs();saveChats();
  toast('Conversation deleted');
}
function renderMsgs(){
  const msgs=document.getElementById('aiMsgs');
  if(!msgs) return;
  const typing=document.getElementById('aiTyping');
  msgs.innerHTML='';
  (chatSessions[curChat]?.msgs||[]).forEach(m=>addBub(m.role,m.content,false));
  msgs.appendChild(typing);
  msgs.scrollTop=msgs.scrollHeight;
}
function addBub(role,content,streaming){
  const msgs=document.getElementById('aiMsgs');
  const typing=document.getElementById('aiTyping');
  const wrap=document.createElement('div');
  wrap.className='ai-msg '+role;
  const av=document.createElement('div');
  av.className='av '+role;
  av.textContent=role==='ai'?'G':'U';
  const bub=document.createElement('div');
  const inner=document.createElement('div');
  inner.className='ai-bi';
  if(role==='ai'){inner.innerHTML=rMD(content)+(streaming?'<span class="cur"></span>':'')}
  else{inner.textContent=content}
  bub.appendChild(inner);
  if(role==='ai'&&!streaming){
    const acts=document.createElement('div');
    acts.className='ai-acts';
    acts.innerHTML='<button class="ai-act" onclick="cpyMsg(this)">Copy</button><button class="ai-act" onclick="regenLast()">Regenerate</button>';
    bub.appendChild(acts);
  }
  wrap.appendChild(av);wrap.appendChild(bub);
  msgs.insertBefore(wrap,typing);
  msgs.scrollTop=msgs.scrollHeight;
  return inner;
}
function cpyMsg(btn){
  const t=btn.closest('.ai-bi').innerText;
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>toast('Copied!'));
}
async function sendAI(){
  const inp=document.getElementById('aiInp');
  const msg=inp.value.trim();
  if(!msg) return;
  // Enforce free-plan daily message limit
  if(typeof canSendAiMessage==='function'&&!canSendAiMessage()){
    openPaywall('ai');
    return;
  }
  const btn=document.getElementById('aiSend');
  const sugg=document.getElementById('aiSugg');
  if(typeof incrementAiUsage==='function') incrementAiUsage();
  if(!chatSessions[curChat]) chatSessions[curChat]={id:Date.now(),title:'New conversation',msgs:[]};
  chatSessions[curChat].msgs.push({role:'user',content:msg});
  if(chatSessions[curChat].title==='New conversation'){
    chatSessions[curChat].title=msg.slice(0,44)+(msg.length>44?'…':'');
    renderChatList();
  }
  addBub('user',msg,false);
  saveChats();
  inp.value='';inp.style.height='24px';
  btn.disabled=true;
  if(sugg) sugg.style.display='none';
  document.getElementById('aiTyping').classList.add('show');
  document.getElementById('aiMsgs').scrollTop=9999;
  const history=chatSessions[curChat].msgs.slice(0,-1).concat({role:'user',content:msg})
    .map(m=>({role:m.role==='ai'?'assistant':m.role,content:m.content}));
  let fullText='';let innerEl=null;
  try{
    const res=await callClaude({model:CLAUDE_MODEL,max_tokens:2048,stream:true,system:getSYS(),messages:history});
    document.getElementById('aiTyping').classList.remove('show');
    innerEl=addBub('ai','',true);
    const reader=res.body.getReader();
    const dec=new TextDecoder();
    let buf='';
    while(true){
      const{done,value}=await reader.read();if(done) break;
      buf+=dec.decode(value,{stream:true});
      const lines=buf.split('\n');buf=lines.pop()||'';
      for(const line of lines){
        if(!line.startsWith('data: ')) continue;
        const data=line.slice(6).trim();
        if(data==='[DONE]') break;
        try{const j=JSON.parse(data);if(j.type==='content_block_delta'&&j.delta?.text){fullText+=j.delta.text;innerEl.innerHTML=rMD(fullText)+'<span class="cur"></span>';document.getElementById('aiMsgs').scrollTop=9999;}}catch{}
      }
    }
    if(innerEl) innerEl.innerHTML=rMD(fullText);
    chatSessions[curChat].msgs.push({role:'ai',content:fullText});
    saveChats();
  }catch(e){
    document.getElementById('aiTyping').classList.remove('show');
    if(!innerEl) innerEl=addBub('ai','',false);
    innerEl.innerHTML='<em style="color:var(--t3)">Connection failed. Please check your connection and try again.</em>';
  }
  btn.disabled=false;
}
function askQ(el){document.getElementById('aiInp').value=el.textContent;sendAI();}
function aiKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();}}
function autoR(el){el.style.height='24px';el.style.height=Math.min(el.scrollHeight,150)+'px';}
// ── Conversation export (Pro feature) ─────────────────────────────────
function toggleExportMenu(){
  const menu=document.getElementById('exportMenu');
  if(!menu) return;
  menu.classList.toggle('open');
}
document.addEventListener('click',e=>{
  const wrap=document.querySelector('.export-wrap');
  const menu=document.getElementById('exportMenu');
  if(wrap&&menu&&!wrap.contains(e.target)) menu.classList.remove('open');
});

// Returns the active conversation, or null if there's nothing to export
function getExportableChat(){
  const sess=chatSessions[curChat];
  if(!sess||!sess.msgs||!sess.msgs.length){
    toast('Nothing to export yet');
    return null;
  }
  // Only the intro message present means no real conversation happened
  const hasUserMsg=sess.msgs.some(m=>m.role==='user');
  if(!hasUserMsg){
    toast('Ask something first, then export');
    return null;
  }
  return sess;
}

// Strips markdown to readable plain text for the clipboard/print versions
function stripMD(text){
  return String(text)
    .replace(/```[\w]*\n?([\s\S]*?)```/g,'$1')
    .replace(/\*\*\*(.+?)\*\*\*/g,'$1')
    .replace(/\*\*(.+?)\*\*/g,'$1')
    .replace(/\*(.+?)\*/g,'$1')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/^#{1,6}\s+/gm,'')
    .replace(/\[(.+?)\]\((.+?)\)/g,'$1 ($2)')
    .trim();
}

function chatToMarkdown(sess){
  const date=new Date().toLocaleString();
  let out='# '+(sess.title||'Grounded Conversation')+'\n\n';
  out+='_Exported from Grounded on '+date+'_\n\n';
  out+='---\n\n';
  sess.msgs.forEach(m=>{
    const who=m.role==='user'?'**You**':'**Grounded AI**';
    out+=who+'\n\n'+m.content.trim()+'\n\n';
  });
  out+='---\n\n';
  out+='_Grounded provides educational information for research purposes only. '
     +'This is not medical advice. Consult a licensed healthcare professional '
     +'before using any compound._\n';
  return out;
}

function safeFilename(title){
  return (title||'grounded-conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,60)||'grounded-conversation';
}

function exportChatMarkdown(){
  if(typeof isPro==='function'&&!isPro()){toggleExportMenu();openPaywall('export');return;}
  const sess=getExportableChat();
  if(!sess) return;
  const md=chatToMarkdown(sess);
  const blob=new Blob([md],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='grounded-'+safeFilename(sess.title)+'.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toggleExportMenu();
  toast('Downloaded ✓');
}

async function copyChatToClipboard(){
  if(typeof isPro==='function'&&!isPro()){toggleExportMenu();openPaywall('export');return;}
  const sess=getExportableChat();
  if(!sess) return;
  const text=sess.msgs.map(m=>(m.role==='user'?'You: ':'Grounded AI: ')+stripMD(m.content)).join('\n\n');
  try{
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard ✓');
  }catch(e){
    toast('Copy failed — try the Markdown download');
  }
  toggleExportMenu();
}

// Opens a clean printable view; the browser's print dialog offers "Save as PDF"
function printChat(){
  if(typeof isPro==='function'&&!isPro()){toggleExportMenu();openPaywall('export');return;}
  const sess=getExportableChat();
  if(!sess) return;
  toggleExportMenu();

  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const rows=sess.msgs.map(m=>{
    const who=m.role==='user'?'You':'Grounded AI';
    const cls=m.role==='user'?'q':'a';
    return '<div class="msg '+cls+'"><div class="who">'+who+'</div><div class="body">'
      +esc(stripMD(m.content)).replace(/\n/g,'<br>')+'</div></div>';
  }).join('');

  const html='<!DOCTYPE html><html><head><meta charset="utf-8">'
    +'<title>'+esc(sess.title||'Grounded Conversation')+'</title><style>'
    +'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}'
    +'h1{font-size:22px;margin-bottom:4px}'
    +'.meta{color:#666;font-size:12px;margin-bottom:28px}'
    +'.msg{margin-bottom:22px;page-break-inside:avoid}'
    +'.who{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#666;margin-bottom:6px}'
    +'.msg.q .body{background:#f4f6fa;border-left:3px solid #2563EB;padding:12px 14px;border-radius:4px}'
    +'.msg.a .body{padding:0 2px}'
    +'.disc{margin-top:36px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#666;font-style:italic}'
    +'@media print{body{margin:0}}'
    +'</style></head><body>'
    +'<h1>'+esc(sess.title||'Grounded Conversation')+'</h1>'
    +'<div class="meta">Exported from Grounded · '+new Date().toLocaleString()+'</div>'
    +rows
    +'<div class="disc">Grounded provides educational information for research purposes only. '
    +'This is not medical advice. Consult a licensed healthcare professional before using any compound.</div>'
    +'</body></html>';

  const w=window.open('','_blank');
  if(!w){toast('Allow pop-ups to use print export');return;}
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),350);
}

function regenLast(){
  const sess=chatSessions[curChat];
  if(!sess) return;
  const lastAI=sess.msgs.findLastIndex(m=>m.role==='ai');
  if(lastAI>0){sess.msgs.splice(lastAI,1);renderMsgs();setTimeout(sendAI,100);}
}

// PROTOCOL BUILDER
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeM();}
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();show('db');setTimeout(()=>document.getElementById('dbSearch')?.focus(),100);}
});

// INIT
// Preload the feed in the background so the notification badge is accurate
// on first paint, without the person needing to open the Research tab.
setTimeout(()=>{ if(typeof loadResearchFeed==='function'&&!feedLoaded) loadResearchFeed(); },1200);
loadComplexity();
renderComplexityUI();
renderDB();
initAI();