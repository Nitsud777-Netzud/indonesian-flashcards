const KEY="indoFlashcards400";
const defaults={activeUnit:1,completed:[],mastered:[],words:{},queues:{},streak:{lastDay:"",count:0,today:0}};
let state=load(),introFlipped=false,mode="intro",current=null,testQueue=[],testIndex=0,testFails={},testDirection="indo";

const unitWords=u=>WORDS.filter(w=>w.rank>(u-1)*10&&w.rank<=u*10);
const sectionOfUnit=u=>Math.ceil(u/10);
const unitLabel=u=>`Unit ${u} · #${(u-1)*10+1}-${u*10}`;

function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||"null");
    if(!saved)return structuredClone(defaults);
    const loaded={activeUnit:saved.activeUnit||1,completed:Array.isArray(saved.completed)?saved.completed:[],mastered:Array.isArray(saved.mastered)?saved.mastered:[],words:saved.words||{},queues:saved.queues||{},streak:saved.streak||{lastDay:"",count:0,today:0}};
    [1,2,3,4].forEach(s=>{for(let u=(s-1)*10+1;u<=s*10;u++){
      const key=String(u);
      if(!Array.isArray(loaded.queues[key]))loaded.queues[key]=[];
      const queued=new Set(loaded.queues[key]);
      unitWords(u).forEach(w=>{
        if(!loaded.mastered.includes(w.rank)&&loaded.words[w.rank]?.introduced&&!queued.has(w.rank))loaded.queues[key].push(w.rank);
      });
      loaded.queues[key]=loaded.queues[key].filter(rank=>unitWords(u).some(w=>w.rank===rank)&&!loaded.mastered.includes(rank));
    }});
    refreshStreak(loaded);
    return loaded;
  }catch{return structuredClone(defaults)}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function getInfo(rank){return state.words[rank]||{introduced:false,cycles:0,direction:"indo"}}
function setInfo(rank,patch){state.words[rank]={...getInfo(rank),...patch};save()}
function isMastered(rank){return state.mastered.includes(rank)}
function masteredCount(u){return unitWords(u).filter(w=>isMastered(w.rank)).length}
function masteredWords(){return WORDS.filter(w=>isMastered(w.rank))}
function answersMatch(raw,expected){const input=raw.trim().toLocaleLowerCase();return expected.split("/").map(x=>x.trim().toLocaleLowerCase()).filter(Boolean).includes(input)}
function startTest(){const pool=masteredWords();if(!pool.length){alert("Master some words first to start a test.");return}testQueue=[...pool].sort(()=>Math.random()-.5).slice(0,25);testIndex=0;testFails={};testDirection="indo";mode="test";current=testQueue[0];show("study");render()}
function finishTest(){mode="intro";current=null;show("dictionary");renderDictionary();renderStreak()}
function failTestWord(rank){testFails[rank]=(testFails[rank]||0)+1;if(testFails[rank]>=3){const w=WORDS.find(x=>x.rank===rank);state.mastered=state.mastered.filter(r=>r!==rank);delete state.words[rank];enqueueWord(state.activeUnit,rank);setInfo(rank,{introduced:true,cycles:0,direction:"indo"});save();return true}return false}
function nextTestCard(){testIndex++;if(testIndex>=testQueue.length){finishTest();return}current=testQueue[testIndex];testDirection="indo";render()}
function queue(u){const key=String(u);if(!Array.isArray(state.queues[key]))state.queues[key]=[];return state.queues[key]}
function deck(u){return queue(u).map(rank=>WORDS.find(w=>w.rank===rank)).filter(Boolean).filter(w=>!isMastered(w.rank))}
function firstUnintroduced(u){return unitWords(u).find(w=>!isMastered(w.rank)&&!getInfo(w.rank).introduced)}
function enqueueWord(u,rank){const q=queue(u);if(!q.includes(rank)&&!isMastered(rank)){q.push(rank);save()}}
function moveCurrentToBottom(){
  if(!current)return;
  const q=queue(state.activeUnit);
  const index=q.indexOf(current.rank);
  if(index!==-1){q.splice(index,1);q.push(current.rank)}
  else if(!isMastered(current.rank))q.push(current.rank);
  save();
}
function removeCurrentFromQueue(){if(!current)return;const q=queue(state.activeUnit);const index=q.indexOf(current.rank);if(index!==-1)q.splice(index,1);save()}

function nextCard(){
  const fresh=firstUnintroduced(state.activeUnit);
  if(fresh){
    current=fresh;
    mode="intro";
    introFlipped=false;
    render();
    return;
  }

  const d=deck(state.activeUnit);
  if(d.length){
    current=d[0];
    mode="typing";
    introFlipped=false;
    render();
    return;
  }

  if(masteredCount(state.activeUnit)===10){completeUnit();return}
  current=null;
  render();
}

function completeUnit(){
  const finished=state.activeUnit;
  if(!state.completed.includes(finished))state.completed.push(finished);
  if(finished<40){
    state.activeUnit=finished+1;
    current=firstUnintroduced(state.activeUnit);
    mode=current?"intro":"typing";
  }else{
    current=null;
    mode="complete";
  }
  save();
  render();
}

function render(){
  const u=state.activeUnit;
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!=="study"));
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view==="study"));
  document.getElementById("unitTitle").textContent=`Section ${sectionOfUnit(u)} · ${unitLabel(u)}`;
  document.getElementById("progress").textContent=`${masteredCount(u)}/10 mastered`;
  const card=document.getElementById("card"),controls=document.getElementById("controls");

  if(mode==="test"){
    if(!current){finishTest();return}
    const prompt=testDirection==="indo"?current.indo:current.en;
    card.className="typing-card";
    card.innerHTML=`<small>Test · ${testIndex+1}/${testQueue.length} · #${current.rank}</small><strong>${escapeHtml(prompt)}</strong><button class="word-audio" id="audioTyping" type="button">🔊 Hear it</button><span>${testDirection==="indo"?"Indonesian → English":"English → Indonesian"} · Misses: ${testFails[current.rank]||0}/3</span>`;
    controls.innerHTML=`<div class="typing-direction">Test: type the ${testDirection==="indo"?"English":"Indonesian"} translation</div><form id="answer"><input id="input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Your answer" aria-label="Your answer"><button>Check</button></form><div id="feedback" aria-live="polite"></div>`;
    document.getElementById("audioTyping").onclick=()=>speak(current.indo);
    const input=document.getElementById("input");input.focus();
    document.getElementById("answer").onsubmit=e=>{e.preventDefault();answerTest(input.value)};
    return;
  }

  if(mode==="complete"){
    card.className="card";
    card.innerHTML=`<strong>All 400 words mastered!</strong><span>Every unit is complete. Review them from Units.</span>`;
    controls.innerHTML=`<button id="unitsBtn">Review Units</button>`;
    document.getElementById("unitsBtn").onclick=()=>show("units");
    return;
  }

  if(!current){nextCard();return}

  if(mode==="intro"){
    card.className=`card ${introFlipped?"flipped":""}`;
    card.innerHTML=`<div class="face front"><small>#${current.rank}</small><strong>${escapeHtml(current.indo)}</strong><span>Tap to flip</span></div><div class="face back"><small>#${current.rank} · English</small><strong>${escapeHtml(current.en)}</strong><span>Tap to flip back</span></div>`;
    controls.innerHTML=`<button id="flip">Flip</button>`;
    document.getElementById("flip").onclick=()=>{introFlipped=!introFlipped;render()};
    /* next is handled by tapping the flipped card */\n    document.getElementById("card").onclick=()=>{
      setInfo(current.rank,{introduced:true});
      enqueueWord(state.activeUnit,current.rank);
      current=null;
      nextCard();
    };
    return;
  }

  const info=getInfo(current.rank);
  const prompt=info.direction==="indo"?current.indo:current.en;
  card.className="typing-card";
  card.innerHTML=`<small>#${current.rank}</small><strong>${escapeHtml(prompt)}</strong><button class="word-audio" id="audioTyping" type="button">🔊 Hear it</button><span>Cycle ${info.cycles}/3 · ${info.direction==="indo"?"Indonesian → English":"English → Indonesian"}</span>`;
  const directionLabel=info.direction==="indo"?"Type the English":"Type the Indonesian";
  const wordLabel=info.direction==="indo"?current.indo:current.en;
  controls.innerHTML=`<div class="typing-direction">${directionLabel} for “${escapeHtml(wordLabel)}”</div><form id="answer"><input id="input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${directionLabel}" aria-label="${directionLabel}"><button>Check</button></form><div id="feedback" aria-live="polite"></div>`;
  document.getElementById("audioTyping").onclick=()=>speak(current.indo);
  const input=document.getElementById("input");
  input.focus();
  document.getElementById("answer").onsubmit=e=>{e.preventDefault();answer(input.value)};
}

function answerTest(raw){
  if(!current)return;
  const rank=current.rank;
  const expected=testDirection==="indo"?current.en:current.indo;
  const ok=answersMatch(raw,expected);
  const fb=document.getElementById("feedback"),form=document.getElementById("answer");
  if(!fb||!form)return;
  const button=form.querySelector("button"),input=form.querySelector("input");
  if(ok){
    testFails[rank]=0;
    fb.className="correct";fb.textContent="Correct! ✓";
    if(input)input.disabled=true;if(button)button.disabled=true;
    setTimeout(()=>nextTestCard(),600);
  }else{
    const returned=failTestWord(rank);
    if(!returned)testQueue.push(current);
    fb.className="wrong";
    fb.innerHTML=`Correct answer: <strong>${escapeHtml(expected)}</strong>${returned?"<br>Back to your current unit for more practice.":"<br>You’ll see this word again."}`;
    if(input)input.disabled=true;if(button)button.disabled=true;
    setTimeout(()=>nextTestCard(),returned?1400:1000);
  }
}
function answer(raw){
  if(!current)return;
  const rank=current.rank;
  markStudyDay();
  const info=getInfo(rank);
  const expected=info.direction==="indo"?current.en:current.indo;
  const ok=answersMatch(raw,expected);
  const fb=document.getElementById("feedback");
  const form=document.getElementById("answer");
  if(!fb||!form)return;
  const button=form.querySelector("button"),input=form.querySelector("input");

  if(ok){
    let cycles=info.cycles;
    const nextDirection=info.direction==="indo"?"en":"indo";
    if(info.direction==="en")cycles++;

    if(cycles>=3){
      if(!state.mastered.includes(rank))state.mastered.push(rank);
      removeCurrentFromQueue();
      delete state.words[rank];
      save();
      fb.className="correct";
      fb.textContent="Correct! Word mastered! 🎉";
      if(input)input.disabled=true;
      if(button)button.disabled=true;
      const masteredUnit=masteredCount(state.activeUnit);
      setTimeout(()=>{current=null;if(masteredUnit===10)completeUnit();else nextCard()},850);
      return;
    }

    setInfo(rank,{cycles,direction:nextDirection});
    moveCurrentToBottom();
    fb.className="correct";
    fb.textContent="Correct! ✓";
    if(input)input.disabled=true;
    if(button)button.disabled=true;
    current=null;
    setTimeout(()=>nextCard(),700);
  }else{
    setInfo(rank,{cycles:0,direction:"indo"});
    moveCurrentToBottom();
    fb.className="wrong";
    fb.innerHTML=`Correct answer: <strong>${escapeHtml(expected)}</strong>`;
    if(input)input.disabled=true;
    if(button)button.disabled=true;
    current=null;
    setTimeout(()=>nextCard(),1200);
  }
}

function pstDay(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function dayDiff(a,b){return Math.round((new Date(b+"T12:00:00Z")-new Date(a+"T12:00:00Z"))/86400000)}
function refreshStreak(s=state){const today=pstDay(),x=s.streak||{lastDay:"",count:0,today:0};if(x.lastDay&&x.lastDay!==today){if(dayDiff(x.lastDay,today)>1)x.count=0;x.today=0}s.streak=x;return s}
function markStudyDay(){const today=pstDay(),s=state.streak||{lastDay:"",count:0,today:0};if(s.lastDay===today)s.today++;else{s.count=s.lastDay&&dayDiff(s.lastDay,today)===1?s.count+1:1;s.lastDay=today;s.today=1}state.streak=s;save();renderStreak()}
function renderStreak(){const el=document.getElementById("streakBar");if(el){const s=state.streak||{count:0,today:0};el.innerHTML=`🔥 ${s.count} day streak · 📚 ${s.today} studied today`}}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="id-ID";u.rate=.88;speechSynthesis.speak(u)}
function renderUnits(){
  const el=document.getElementById("unitsList");if(!el)return;
  let html="";
  for(let s=1;s<=4;s++){html+=`<section class="section"><h3>Section ${s}</h3><p class="section-label">Words #${(s-1)*100+1}-${s*100}</p><div class="unit-path">`;
    for(let u=(s-1)*10+1;u<=s*10;u++){const done=state.completed.includes(u),available=u===1||state.completed.includes(u-1),pct=done?100:Math.round(masteredCount(u)/10*100);html+=`<div class="unit-wrap"><button class="unit-node ${done?"done":available?"available":""} ${state.activeUnit===u?"current":""}" data-u="${u}" aria-label="Unit ${u}">${done?"✓":u}</button><div class="unit-progress"><span style="width:${pct}%"></span></div><small>${pct}%</small></div>`}
    html+="</div></section>";
  }
  el.innerHTML=html;
  el.querySelectorAll(".unit-node").forEach(b=>b.onclick=()=>openUnit(+b.dataset.u));
}

function openUnit(u){
  state.activeUnit=u;
  const fresh=firstUnintroduced(u), d=deck(u);
  if(fresh){current=fresh;mode="intro";introFlipped=false;show("study");render();return}
  if(d.length){current=d[0];mode="typing";show("study");render();return}
  if(state.completed.includes(u)){renderReview(u);return}
  current=null;mode="complete";show("study");render();
}

function renderReview(u){
  const words=unitWords(u).filter(w=>isMastered(w.rank));
  let index=0,flipped=false;
  show("study");
  function paint(){
    const w=words[index];
    const card=document.getElementById("card");
    card.className=`card ${flipped?"flipped":""}`;
    card.innerHTML=`<div class="face front"><small>#${w.rank}</small><strong>${escapeHtml(w.indo)}</strong><span>Tap to flip</span></div><div class="face back"><small>#${w.rank} · English</small><strong>${escapeHtml(w.en)}</strong></div>`;
    document.getElementById("unitTitle").textContent=`Section ${sectionOfUnit(u)} · ${unitLabel(u)} · Review`;
    document.getElementById("progress").textContent=`${index+1}/${words.length} review`;
    document.getElementById("controls").innerHTML=`<button id="prev" ${index===0?"disabled":""}>Previous</button><button id="flip">Flip</button><button id="next" ${index===words.length-1?"disabled":""}>Next</button><button id="back">Back to Units</button>`;
    document.getElementById("flip").onclick=()=>{flipped=!flipped;paint()};
    document.getElementById("prev").onclick=()=>{if(index>0){index--;flipped=false;paint()}};
    document.getElementById("next").onclick=()=>{if(index<words.length-1){index++;flipped=false;paint()}};
    document.getElementById("back").onclick=()=>show("units");
  }
  paint();
}

function renderDictionary(){
  const q=(document.getElementById("search")?.value||"").trim().toLocaleLowerCase();
  const el=document.getElementById("dictionaryList");if(!el)return;
  const testButton=`<button class="test-button" id="startTest">🧠 Test 25 random mastered words</button>`;
  const arr=WORDS.filter(w=>isMastered(w.rank)&&(!q||w.indo.toLocaleLowerCase().includes(q)||w.en.toLocaleLowerCase().includes(q)));
  el.innerHTML=testButton+(arr.length?arr.map(w=>`<div class="entry"><b>#${w.rank} · ${escapeHtml(w.indo)}</b><span>${escapeHtml(w.en)}</span></div>`).join(""):"<p class='empty'>Your dictionary is empty. Master words to add them.</p>");
  document.getElementById("startTest").onclick=startTest;
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function show(v){
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("hidden",x.id!==v));
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
  if(v==="units")renderUnits();
  if(v==="dictionary")renderDictionary();
}

document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>show(b.dataset.view));
document.getElementById("card").onclick=e=>{if(mode==="intro"&&e.target.closest(".card")){if(introFlipped){setInfo(current.rank,{introduced:true});enqueueWord(state.activeUnit,current.rank);current=null;nextCard()}else{introFlipped=true;render()}}};
document.getElementById("search").oninput=renderDictionary;
document.getElementById("reset").onclick=()=>{if(confirm("Reset all progress?")){localStorage.removeItem(KEY);location.reload()}};

refreshStreak();renderStreak();renderUnits();renderDictionary();nextCard();
