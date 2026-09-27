const KEY="indoFlashcards400";
const defaults={activeUnit:1,completed:[],mastered:[],words:{}};
let state=load(),introFlipped=false,mode="intro",current=null;

const unitWords=u=>WORDS.filter(w=>w.rank>(u-1)*100&&w.rank<=u*100);
const unitLabel=u=>u===1?"Most frequent":`Ranks ${(u-1)*100+1}-${u*100}`;

function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||"null");
    if(!saved)return structuredClone(defaults);
    return {activeUnit:saved.activeUnit||1,completed:Array.isArray(saved.completed)?saved.completed:[],mastered:Array.isArray(saved.mastered)?saved.mastered:[],words:saved.words||{}};
  }catch{return structuredClone(defaults)}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function getInfo(rank){return state.words[rank]||{introduced:false,cycles:0,direction:"indo"}}
function setInfo(rank,patch){state.words[rank]={...getInfo(rank),...patch};save()}
function isMastered(rank){return state.mastered.includes(rank)}
function masteredCount(u){return unitWords(u).filter(w=>isMastered(w.rank)).length}
function deck(u){return unitWords(u).filter(w=>!isMastered(w.rank)&&getInfo(w.rank).introduced)}
function firstUnintroduced(u){return unitWords(u).find(w=>!isMastered(w.rank)&&!getInfo(w.rank).introduced)}

function nextCard(){
  const d=deck(state.activeUnit);
  if(d.length){current=d[0];mode="typing";introFlipped=false;render();return}
  const fresh=firstUnintroduced(state.activeUnit);
  if(fresh){current=fresh;mode="intro";introFlipped=false;render();return}
  if(masteredCount(state.activeUnit)===100){completeUnit();return}
  current=null;render();
}

function completeUnit(){
  const finished=state.activeUnit;
  if(!state.completed.includes(finished))state.completed.push(finished);
  if(finished<4){
    state.activeUnit=finished+1;
    current=firstUnintroduced(state.activeUnit);
    mode=current?"intro":"typing";
  }else{
    current=null;mode="complete";
  }
  save();render();
}

function render(){
  const u=state.activeUnit;
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!=="study"));
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view==="study"));
  document.getElementById("unitTitle").textContent=`Unit ${u} - ${unitLabel(u)} - #${(u-1)*100+1}-${u*100}`;
  document.getElementById("progress").textContent=`${masteredCount(u)}/100 mastered`;
  const card=document.getElementById("card"),controls=document.getElementById("controls");
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
    controls.innerHTML=`<button id="flip">Flip</button><button id="next">Next</button>`;
    document.getElementById("flip").onclick=()=>{introFlipped=!introFlipped;render()};
    document.getElementById("next").onclick=()=>{setInfo(current.rank,{introduced:true});mode="typing";introFlipped=false;render()};
    return;
  }

  const info=getInfo(current.rank);
  const prompt=info.direction==="indo"?current.indo:current.en;
  card.className="card";
  card.innerHTML=`<small>#${current.rank}</small><strong>${escapeHtml(prompt)}</strong><span>Cycle ${info.cycles}/3 · ${info.direction==="indo"?"Indonesian → English":"English → Indonesian"}</span>`;
  controls.innerHTML=`<form id="answer"><input id="input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Type your answer"><button>Check</button></form><div id="feedback"></div>`;
  const input=document.getElementById("input");
  input.focus();
  document.getElementById("answer").onsubmit=e=>{e.preventDefault();answer(input.value)};
}

function answer(raw){
  if(!current)return;
  const info=getInfo(current.rank);
  const expected=info.direction==="indo"?current.en:current.indo;
  const ok=raw.trim().toLocaleLowerCase()===expected.trim().toLocaleLowerCase();
  const fb=document.getElementById("feedback");
  if(ok){
    let cycles=info.cycles;
    const nextDirection=info.direction==="indo"?"en":"indo";
    if(info.direction==="en")cycles++;
    if(cycles>=3){
      if(!state.mastered.includes(current.rank))state.mastered.push(current.rank);
      delete state.words[current.rank];
      save();
      fb.className="correct";fb.textContent="Correct — mastered!";
      const masteredUnit=masteredCount(state.activeUnit);
      setTimeout(()=>{current=null;if(masteredUnit===100)completeUnit();else nextCard()},500);
      return;
    }
    setInfo(current.rank,{cycles,direction:nextDirection});
    fb.className="correct";fb.textContent="Correct!";
    current=null;
    setTimeout(()=>{current=deck(state.activeUnit)[0]||null;render()},450);
  }else{
    fb.className="wrong";fb.innerHTML=`Correct answer: <strong>${escapeHtml(expected)}</strong>`;
    setInfo(current.rank,{cycles:0,direction:"indo"});
    current=null;
    setTimeout(()=>{current=deck(state.activeUnit)[0]||null;render()},900);
  }
}

function renderUnits(){
  const el=document.getElementById("unitsList");if(!el)return;
  el.innerHTML=[1,2,3,4].map(u=>{
    const done=state.completed.includes(u);
    const count=masteredCount(u);
    return `<div class="unit ${done?"complete":""}"><div><b>Unit ${u}</b><span>${u===1?"Most frequent · ":""}#${(u-1)*100+1}-${u*100} · ${count}/100 mastered</span></div><button data-u="${u}">${done?"Review":"Study"}</button></div>`;
  }).join("");
  el.querySelectorAll("button").forEach(b=>b.onclick=()=>openUnit(+b.dataset.u));
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
    document.getElementById("unitTitle").textContent=`Unit ${u} - ${unitLabel(u)} - Review`;
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
  const arr=WORDS.filter(w=>isMastered(w.rank)&&(!q||w.indo.toLocaleLowerCase().includes(q)||w.en.toLocaleLowerCase().includes(q)));
  el.innerHTML=arr.length?arr.map(w=>`<div class="entry"><b>#${w.rank} · ${escapeHtml(w.indo)}</b><span>${escapeHtml(w.en)}</span></div>`).join(""):"<p class='empty'>Your dictionary is empty. Master words to add them.</p>";
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
document.getElementById("card").onclick=e=>{if(mode==="intro"&&e.target.closest(".card")){introFlipped=!introFlipped;render()}};
document.getElementById("search").oninput=renderDictionary;
document.getElementById("reset").onclick=()=>{if(confirm("Reset all progress?")){localStorage.removeItem(KEY);location.reload()}};

renderUnits();renderDictionary();nextCard();
