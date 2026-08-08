let actFilter='all', bookmarks=new Set(), chatSessions=[], curChat=0, protoGoal=null, curModal=null;

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
  const keys=['home','db','ai','proto','stacks','tracker','research','pricing'];
  const idx=keys.indexOf(pg);
  const nls=document.querySelectorAll('.nl');
  if(idx>=0&&nls[idx]) nls[idx].classList.add('on');
  window.scrollTo(0,0);
  if(pg==='db'){renderDB();renderRecent();}
  if(pg==='stacks') renderStacks();
  if(pg==='research') renderResearch();
  if(pg==='tracker') renderTracker();
  if(pg==='proto') prefillProtoGoal();
  if(pg==='home') renderRecommendations();
  if(pg==='ai'&&typeof updateAiQuotaUI==='function') updateAiQuotaUI();
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

// Pre-select the user's onboarding goal in the Protocol Builder (once per visit)
function prefillProtoGoal(){
  if(protoGoal) return; // don't override an active selection
  const meta=(typeof currentUser!=='undefined'&&currentUser)?(currentUser.user_metadata||{}):{};
  const goal=meta.research_goal;
  if(!goal) return;
  const chips=document.querySelectorAll('#protoGoals .gc2');
  chips.forEach(chip=>{
    const oc=chip.getAttribute('onclick')||'';
    if(oc.includes("'"+goal+"'")) chip.click();
  });
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
  grid.innerHTML=RESEARCH_DATA.map((r,i)=>{
    // Free plan gets the first article as a preview; the rest are locked
    const locked=!pro&&i>0;
    if(locked){
      return '<div class="rc rc-locked" onclick="openPaywall(\'research\')">'
        +'<div class="pc-lock-badge">🔒 Pro</div>'
        +'<div class="rc-m"><span class="rc-c" style="background:rgba(255,255,255,.05);border:1px solid var(--b1);color:'+r.catC+'">'+r.cat+'</span><span class="rc-d">'+r.date+'</span></div>'
        +'<div class="rc-t">'+r.title+'</div>'
        +'<div class="rc-a pc-blur">'+r.abstract+'</div>'
        +'<div class="rc-f"><span class="rc-j">'+r.journal+'</span><span class="rc-link">Unlock →</span></div>'
        +'</div>';
    }
    return '<div class="rc">'
      +'<div class="rc-m"><span class="rc-c" style="background:rgba(255,255,255,.05);border:1px solid var(--b1);color:'+r.catC+'">'+r.cat+'</span><span class="rc-d">'+r.date+'</span></div>'
      +'<div class="rc-t">'+r.title+'</div>'
      +'<div class="rc-a">'+r.abstract+'</div>'
      +'<div class="rc-f"><span class="rc-j">'+r.journal+'</span><span class="rc-link" onclick="askResearch(\''+r.title.replace(/'/g,"\\'") +'\')">Ask AI →</span></div>'
      +'</div>';
  }).join('');
}
function askResearch(title){
  show('ai');
  setTimeout(()=>{document.getElementById('aiInp').value='Explain this research in plain language: "'+title+'"';sendAI();},300);
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
  // (like the Discord invite) can't break the highlighting
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
      +(pro?'':'<button class="btn-hero bh1" onclick="mobileGo(\'pricing\')">Get Pro ✦</button>')
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

// Builds the system prompt, layering in personalization when available
function getSYS(){
  let prompt=SYS;
  const meta=(typeof currentUser!=='undefined'&&currentUser)?(currentUser.user_metadata||{}):{};
  const exp=meta.experience_level;
  const goal=meta.research_goal;
  if(!exp&&!goal) return prompt;

  prompt+='\n\n--- PERSONALIZATION FOR THIS USER ---';
  if(exp&&EXP_GUIDANCE[exp]) prompt+='\n\n'+EXP_GUIDANCE[exp];
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
function selGoal(el,goal){
  protoGoal=goal;
  document.querySelectorAll('.gc2').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  const btn=document.getElementById('protoBuild');
  btn.textContent='Build AI protocol →';btn.style.opacity='1';btn.style.cursor='pointer';
}
async function buildProto(){
  if(!protoGoal){toast('Select a goal first');return;}
  if(!canUseFreeFeature('protocol')){openPaywall('protocol');return;}
  const ctx=document.getElementById('protoCtx')?.value||'';
  const res=document.getElementById('protoRes');
  const cont=document.getElementById('protoCont');
  res.classList.add('show');
  cont.innerHTML='<div style="color:var(--t2);font-style:italic">Building protocol with AI — this takes a few seconds...</div>';
  const goals={recovery:'Recovery and Healing',fatloss:'Fat Loss and Body Composition',gh:'Growth Hormone Optimization',cognitive:'Cognitive Enhancement',longevity:'Longevity and Anti-Aging',muscle:'Muscle Growth and Performance'};
  const prompt='Build a comprehensive educational research protocol for: '+goals[protoGoal]+(ctx?'. Context: '+ctx:'')+'.\n\nInclude:\n1. **Recommended compounds** with specific dosage ranges\n2. **Protocol timeline** week-by-week for the first 8 weeks\n3. **Mechanism of synergy** between chosen compounds\n4. **Key considerations** and safety notes\n5. **Suggested further reading**\n\nBe thorough, format with headers, and note this is for educational purposes only.';
  try{
    const r=await callClaude({model:CLAUDE_MODEL,max_tokens:1500,system:getSYS(),messages:[{role:'user',content:prompt}]});
    const d=await r.json();
    const txt=(d.content||[]).map(b=>b.type==='text'?b.text:'').join('');
    cont.innerHTML=rMD(txt);
    markFreeFeatureUsed('protocol');
  }catch{cont.innerHTML='<em style="color:var(--t3)">Failed to generate protocol. Please try again.</em>';}
}

// SCROLL REVEAL
const ro=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');}),{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));

// UTILS
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeM();}
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();show('db');setTimeout(()=>document.getElementById('dbSearch')?.focus(),100);}
});

// INIT
renderDB();
initAI();