import { NumberWriting } from './math-writing.js?v=20261030c';

const $=id=>document.getElementById(id);let limit=10,mode='add',questions=[],index=0,solved=false,hinted=false;
function makeQuestions(max,kind){let pool=[];for(let a=0;a<=max;a++)for(let b=0;b<=max;b++){if(kind!=='sub'&&a+b<=max)pool.push({a,b,op:'+',result:a+b});if(kind!=='add'&&a>=b)pool.push({a,b,op:'−',result:a-b});}for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,5)}
function apple(i,color,removed){return `<span class="apple ${removed?'removed':''}" aria-hidden="true"><svg viewBox="0 0 44 48"><path d="M23 12Q20 5 25 3" fill="none" stroke="#526543" stroke-width="3" stroke-linecap="round"/><path d="M25 9Q27 1 36 4Q33 13 25 9" fill="#80a563"/><path d="M22 15C5 4 0 24 8 38Q15 48 22 42Q32 49 39 34C47 15 33 7 22 15" fill="${color}"/>${hinted&&!removed?`<text x="22" y="32" text-anchor="middle" font-size="16" font-family="sans-serif" fill="white" font-weight="700">${i}</text>`:''}</svg></span>`}
function drawObjects(q){if(q.op==='+'){$('objects').innerHTML=`<div class="row"><div class="pile">${Array.from({length:q.a},(_,i)=>apple(i+1,'#41855f',false)).join('')||'0 个'}</div><span>+</span><div class="pile">${Array.from({length:q.b},(_,i)=>apple(q.a+i+1,'#b58142',false)).join('')||'0 个'}</div></div><p class="caption">原来 ${q.a} 个，又来 ${q.b} 个</p>`;}else{$('objects').innerHTML=`<div class="row"><div class="pile">${Array.from({length:q.a},(_,i)=>apple(i+1,'#41855f',i>=q.result)).join('')||'一个苹果也没有'}</div></div><p class="caption">原来 ${q.a} 个，拿走 ${q.b} 个（斜线标记）</p>`;}}
function render(){document.querySelector('.game').scrollTop=0;const q=questions[index];solved=false;hinted=false;$('play').hidden=false;$('finish').hidden=true;$('round').textContent=`第 ${index+1} / 5 题`;$('progress').innerHTML=Array.from({length:5},(_,i)=>`<i class="${i<index?'done':i===index?'current':''}"></i>`).join('');$('prompt').textContent=q.op==='+'?'合起来，有几个苹果？':'拿走后，还剩几个苹果？';$('equation').innerHTML=`<span>${q.a}</span><span>${q.op}</span><span>${q.b}</span><span>=</span><span class="blank">?</span>`;$('next').disabled=true;$('next').textContent=index===4?'完成这一轮 →':'下一题 →';$('feedback').textContent='';drawObjects(q);recognized=null;writing.lock(false);writing.clear();$('recognition').hidden=true;$('confirm-answer').disabled=true;$('read-writing').disabled=true;$('clear-writing').disabled=false;}
let recognized=null;
const writing=new NumberWriting([...document.querySelectorAll('.number-pad')],()=>{
  recognized=null;$('recognition').hidden=true;$('confirm-answer').disabled=true;
  $('read-writing').disabled=solved||!writing.hasInk()||writing.busy();
  if(!solved)$('feedback').textContent='';
});
$('clear-writing').onclick=()=>{if(!solved)writing.clear()};
$('read-writing').onclick=()=>{
  if(solved||writing.busy())return;
  recognized=writing.read();
  if(!recognized){$('feedback').textContent='还没看清，擦掉再写一次吧。';return;}
  $('recognized-number').textContent=recognized.text;$('recognition').hidden=false;$('confirm-answer').disabled=false;
  $('feedback').textContent='';
};
$('confirm-answer').onclick=()=>{
  if(solved||!recognized)return;
  const n=recognized.value,q=questions[index];
  if(n!==q.result){$('feedback').textContent='再数一数，擦掉重新写一写。';return;}
  solved=true;writing.lock(true);$('equation').querySelector('.blank').textContent=n;
  $('feedback').textContent='👍 答对啦！';$('next').disabled=false;
  $('read-writing').disabled=true;$('clear-writing').disabled=true;$('confirm-answer').disabled=true;
};

function start(){questions=makeQuestions(limit,mode);index=0;render();}
$('hint').onclick=()=>{hinted=true;drawObjects(questions[index]);const q=questions[index];$('feedback').textContent=q.op==='+'?'跟着苹果上的数字，从 1 开始数。':q.result===0?'苹果全部拿走了，一个也没有就是 0。':'只数没有斜线的苹果。';if(q.a===0&&q.b===0)$('feedback').textContent='一个苹果也没有，就是 0。';};
$('next').onclick=()=>{if(!solved)return;if(index===4){$('play').hidden=true;$('finish').hidden=false;$('again').focus();}else{index++;render();$('clear-writing').focus();}};$('again').onclick=start;
document.querySelectorAll('[data-limit]').forEach(b=>b.onclick=()=>{limit=Number(b.dataset.limit);document.querySelectorAll('[data-limit]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});start()});document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});start()});start();

document.querySelectorAll(".choice").forEach(button => button.setAttribute("aria-pressed", button.classList.contains("active")));
