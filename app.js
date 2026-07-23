let actFilter='all', bookmarks=new Set(), chatSessions=[], curChat=0, protoGoal=null, curModal=null;

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
function show(pg){
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.nl').forEach(e=>e.classList.remove('on'));
  const el=document.getElementById('page-'+pg);
  if(el) el.classList.add('on');
  const keys=['home','db','ai','proto','stacks','research','pricing'];
  const idx=keys.indexOf(pg);
  const nls=document.querySelectorAll('.nl');
  if(idx>=0&&nls[idx]) nls[idx].classList.add('on');
  window.scrollTo(0,0);
  if(pg==='db') renderDB();
  if(pg==='stacks') renderStacks();
  if(pg==='research') renderResearch();
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
  if(!row||row.children.length) return;
  const cats=[{k:'all',l:'All compounds'},...Object.entries(CATS).map(([k,v])=>({k,l:v.l}))];
  row.innerHTML=cats.map(c=>'<span class="fch'+(c.k==='all'?' on':'')+ '" onclick="setFilter(\''+c.k+'\',this)">'+c.l+'</span>').join('');
}
function setFilter(cat,el){
  actFilter=cat;
  document.querySelectorAll('.fch').forEach(e=>e.classList.remove('on'));
  el.classList.add('on');
  renderDB();
}
function renderDB(){
  buildFilters();
  const q=(document.getElementById('dbSearch')||{}).value||'';
  const sq=q.toLowerCase();
  const sort=(document.getElementById('dbSort')||{}).value||'pop';
  let list=PEPS.filter(p=>{
    const catOk=actFilter==='all'||p.cat===actFilter;
    const qOk=!sq||p.n.toLowerCase().includes(sq)||p.fn.toLowerCase().includes(sq)||p.ov.toLowerCase().includes(sq)||(p.bens||[]).some(b=>b.toLowerCase().includes(sq));
    return catOk&&qOk;
  });
  if(sort==='az') list.sort((a,b)=>a.n.localeCompare(b.n));
  else if(sort==='hl') list.sort((a,b)=>a.hlh-b.hlh);
  else list.sort((a,b)=>b.pop-a.pop);
  const grid=document.getElementById('dbGrid');
  if(!grid) return;
  if(!list.length){grid.innerHTML='<div class="db-empty"><div style="font-size:48px;margin-bottom:16px">🔬</div><div style="font-family:var(--fd);font-size:22px;color:var(--t1);margin-bottom:8px">No compounds found</div><p>Try adjusting your search or filter.</p></div>';return}
  grid.innerHTML=list.map(p=>{
    const c=CATS[p.cat]||{l:p.cat,c:'#fff',bg:'rgba(255,255,255,.08)',b:'rgba(255,255,255,.2)'};
    const bm=bookmarks.has(p.id);
    return '<div class="pc" onclick="openM(\''+p.id+'\')">'
      +'<div class="pc-top"><span class="badge" style="background:'+c.bg+';border:1px solid '+c.b+';color:'+c.c+'">'+c.l+'</span>'
      +'<button class="bm'+(bm?' on':'')+ '" onclick="toggleBm(event,\''+p.id+'\')">'+(bm?'★':'☆')+'</button></div>'
      +'<div class="pc-name">'+p.n+'</div><div class="pc-fn">'+p.fn+'</div>'
      +'<div class="pc-desc">'+p.ov+'</div>'
      +'<div class="pc-meta">'
      +'<div class="pcm"><div class="pcm-l">Half-life</div><div class="pcm-v">'+p.hl+'</div></div>'
      +'<div class="pcm"><div class="pcm-l">Route</div><div class="pcm-v">'+p.admin.split(' · ')[0]+'</div></div>'
      +'<div class="pcm"><div class="pcm-l">Status</div><div class="pcm-v">'+p.status.split(' ')[0]+'</div></div>'
      +'</div></div>';
  }).join('');
}
function toggleBm(e,id){
  e.stopPropagation();
  bookmarks.has(id)?bookmarks.delete(id):bookmarks.add(id);
  renderDB();
  toast(bookmarks.has(id)?'Bookmarked ✓':'Removed bookmark');
}

// MODAL
function openM(id){
  const p=PEPS.find(x=>x.id===id);if(!p) return;
  curModal=id;
  const c=CATS[p.cat]||{l:p.cat,c:'#fff',bg:'rgba(255,255,255,.08)',b:'rgba(255,255,255,.2)'};
  document.getElementById('mBadge').innerHTML='<span style="background:'+c.bg+';border:1px solid '+c.b+';color:'+c.c+';font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;padding:3px 9px;border-radius:50px;display:inline-block;margin-bottom:14px">'+c.l+'</span>';
  document.getElementById('mName').textContent=p.n;
  document.getElementById('mSub').textContent=p.fn;
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
  if(!grid||grid.children.length) return;
  grid.innerHTML=STACKS_DATA.map(s=>'<div class="sk">'
    +'<div class="sk-goal">'+s.goal+'</div>'
    +'<div class="sk-name">'+s.name+'</div>'
    +'<div class="sk-peps">'+s.peps.map(p=>'<span class="sk-p">'+p+'</span>').join('')+'</div>'
    +'<div class="sk-rat">'+s.rationale+'</div>'
    +'<div class="sk-proto"><div class="sk-pt">Protocol</div>'+s.proto.split('\n').join('<br>')+'</div>'
    +'</div>').join('');
}

// RESEARCH HUB
function renderResearch(){
  const grid=document.getElementById('resGrid');
  if(!grid||grid.children.length) return;
  grid.innerHTML=RESEARCH_DATA.map(r=>'<div class="rc">'
    +'<div class="rc-m"><span class="rc-c" style="background:rgba(255,255,255,.05);border:1px solid var(--b1);color:'+r.catC+'">'+r.cat+'</span><span class="rc-d">'+r.date+'</span></div>'
    +'<div class="rc-t">'+r.title+'</div>'
    +'<div class="rc-a">'+r.abstract+'</div>'
    +'<div class="rc-f"><span class="rc-j">'+r.journal+'</span><span class="rc-link" onclick="askResearch(\''+r.title.replace(/'/g,"\\'") +'\')">Ask AI →</span></div>'
    +'</div>').join('');
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

You have comprehensive expertise in 80 research peptides across all major categories:

Growth Hormone: Ipamorelin, CJC-1295, Sermorelin, GHRP-2, GHRP-6, Hexarelin, MK-677, Tabimorelin, Alexamorelin, GRF 1-44, Somatropin (rhGH)
Healing & Recovery: BPC-157, TB-500, Thymosin Beta-4, GHK-Cu, LL-37, KPV, ARA-290 (Cibinetide), Larazotide Acetate, Argireline, SNAP-8, Matrixyl, AHK-Cu
Metabolic/GLP-1: Semaglutide, Tirzepatide, Liraglutide, Exenatide, Dulaglutide, Retatrutide, Cagrilintide, Survodutide, Pramlintide, Glucagon, Octreotide, Lanreotide
Fat Loss: AOD-9604, Tesamorelin, Adipotide (FTPP)
Muscle & Performance: IGF-1 LR3, MGF, PEG-MGF, IGF-1 DES, Follistatin 344, ACE-031
Longevity: Epithalon, Thymalin, SS-31/Elamipretide, Vilon, FOXO4-DRI, GDF11, Klotho, NAD+, Calcitonin, Teriparatide, Abaloparatide
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

function initAI(){
  if(!chatSessions.length){
    chatSessions=[{id:0,title:'New conversation',msgs:[]}];
    renderChatList();
  }
}
function renderChatList(){
  const list=document.getElementById('aiList');
  if(!list) return;
  list.innerHTML=chatSessions.map((s,i)=>'<div class="ai-li'+(i===curChat?' on':'')+'" onclick="switchChat('+i+')">'
    +'<div class="ai-li-t">'+(s.title||'New conversation')+'</div>'
    +'</div>').join('');
}
function switchChat(i){curChat=i;renderChatList();renderMsgs();}
function newChat(){
  chatSessions.unshift({id:Date.now(),title:'New conversation',msgs:[]});
  curChat=0;renderChatList();renderMsgs();
  toast('New chat started');
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
  const btn=document.getElementById('aiSend');
  const sugg=document.getElementById('aiSugg');
  if(!chatSessions[curChat]) chatSessions[curChat]={id:Date.now(),title:'New conversation',msgs:[]};
  chatSessions[curChat].msgs.push({role:'user',content:msg});
  if(chatSessions[curChat].title==='New conversation'){
    chatSessions[curChat].title=msg.slice(0,44)+(msg.length>44?'…':'');
    renderChatList();
  }
  addBub('user',msg,false);
  inp.value='';inp.style.height='24px';
  btn.disabled=true;
  if(sugg) sugg.style.display='none';
  document.getElementById('aiTyping').classList.add('show');
  document.getElementById('aiMsgs').scrollTop=9999;
  const history=chatSessions[curChat].msgs.slice(0,-1).concat({role:'user',content:msg})
    .map(m=>({role:m.role==='ai'?'assistant':m.role,content:m.content}));
  let fullText='';let innerEl=null;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:2048,stream:true,system:SYS,messages:history})
    });
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
  const ctx=document.getElementById('protoCtx')?.value||'';
  const res=document.getElementById('protoRes');
  const cont=document.getElementById('protoCont');
  res.classList.add('show');
  cont.innerHTML='<div style="color:var(--t2);font-style:italic">Building protocol with AI — this takes a few seconds...</div>';
  const goals={recovery:'Recovery and Healing',fatloss:'Fat Loss and Body Composition',gh:'Growth Hormone Optimization',cognitive:'Cognitive Enhancement',longevity:'Longevity and Anti-Aging',muscle:'Muscle Growth and Performance'};
  const prompt='Build a comprehensive educational research protocol for: '+goals[protoGoal]+(ctx?'. Context: '+ctx:'')+'.\n\nInclude:\n1. **Recommended compounds** with specific dosage ranges\n2. **Protocol timeline** week-by-week for the first 8 weeks\n3. **Mechanism of synergy** between chosen compounds\n4. **Key considerations** and safety notes\n5. **Suggested further reading**\n\nBe thorough, format with headers, and note this is for educational purposes only.';
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1500,system:SYS,messages:[{role:'user',content:prompt}]})});
    const d=await r.json();
    const txt=(d.content||[]).map(b=>b.type==='text'?b.text:'').join('');
    cont.innerHTML=rMD(txt);
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