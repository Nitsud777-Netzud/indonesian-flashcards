const state={unit:1};
function init(){document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.view));render();}
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!==view));}
function render(){const words=window.WORDS||[];document.getElementById('unitTitle').textContent='Unit 1 - Most frequent - #1-100';document.getElementById('progress').textContent=`0/100 mastered`;document.getElementById('card').textContent=words[0]?words[0].indo:'Loading words...';}
document.getElementById('reset').onclick=()=>{localStorage.clear();location.reload()};
init();