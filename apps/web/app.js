import {ELEMENTS, ELEMENT_LABELS, resolveRound, worldForDay, weekForDay} from './engine.js';
const $ = id => document.getElementById(id);
const f = n => new Intl.NumberFormat('fa-IR').format(n??0);
const tg = window.Telegram?.WebApp;
const cfg = window.ELEMENTAL_CONFIG || {};
const day = new Date().toISOString().slice(0,10);
const offline = !tg?.initData;
const weather = worldForDay(day);
const demoPlayer = {id:'demo',alias:'کاوشگر آزمایشی',invite_code:'',water:5,fire:5,earth:5,wind:5,tree:0,light:0,score:0,weekly_score:0,week_key:weekForDay(day),streak:0,rounds_played:0};
let player = {...demoPlayer};
let busy = false;
let rankings=[];
function note(message){const box=$('notice');box.textContent=message;box.hidden=!message;}
function haptic(type='light'){try{tg?.HapticFeedback?.impactOccurred(type);}catch{}}
async function request(path, payload){
  const response=await fetch(`${cfg.apiBase}${path}`,{
    method:'POST',headers:{'content-type':'application/json','x-telegram-init-data':tg.initData},
    body:JSON.stringify(payload)
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
  return result;
}
function render(){
  for(const name of ELEMENTS){
    $('stock-'+name).textContent=f(player[name]);
    document.querySelector(`[data-element="${name}"]`).disabled=busy || player[name]<=0;
  }
  $('treeCount').textContent=f(player.tree);$('lightCount').textContent=f(player.light);
  $('scoreCount').textContent=f(player.score);$('roundCount').textContent=f(player.rounds_played);
  $('weekScore').textContent=f(player.week_key===weekForDay(day)?player.weekly_score:0);
  $('weatherTitle').textContent=weather.title;$('weatherDescription').textContent=weather.text;
  $('atlasWeather').textContent=weather.title;$('atlasDetail').textContent=weather.text;
  $('atlasTrees').textContent=f(player.tree);$('atlasLights').textContent=f(player.light);
  $('treeMeter').style.width=Math.min(100,(player.tree%10)*10)+'%';
  $('lightMeter').style.width=Math.min(100,(player.light%10)*10)+'%';
  $('weekLabel').textContent=`چرخهٔ ${weekForDay(day)}`;
}
function showRound(result){
  const r=result.round;
  const descriptions={win:'تعادل به سمت تو تغییر کرد؛ این نبرد را بردی.',draw:'دو نیرو به تعادل رسیدند؛ یک امتیاز از آن تو.',loss:'این بار جهان از تو پیشی گرفت. چرخه هنوز ادامه دارد.'};
  const symbols={win:'✺',draw:'◎',loss:'◈'};
  $('resultSymbol').textContent=symbols[r.outcome];
  $('resultTitle').textContent=r.outcome==='win'?'پیروزی عنصر تو':r.outcome==='draw'?'تعادل نیروها':'جهان پیروز شد';
  $('resultDescription').textContent=descriptions[r.outcome];
  $('yourElement').textContent=ELEMENT_LABELS[r.picked];$('rivalElement').textContent=ELEMENT_LABELS[r.rival];
  const rewards=[`✧ ${f(r.points)} امتیاز`];
  if(r.tree_gain)rewards.push('♧ یک درخت جدید');
  if(r.light_gain)rewards.push('✺ یک نور جدید');
  $('resultRewards').replaceChildren(...rewards.map(t=>{const span=document.createElement('span');span.textContent=t;return span;}));
  $('resultModal').showModal();
}
async function play(element){
  if(busy || player[element]<=0)return;
  busy=true;note('');haptic('medium');render();
  try{
    let result;
    if(offline){
      // Visibly labelled local practice only — never persisted / ranked / rewarded.
      const opponent=ELEMENTS[crypto.getRandomValues(new Uint32Array(1))[0]%4];
      const r=resolveRound(element,opponent,weather);
      const points=r.basePoints+(r.outcome==='win'?Math.min(2,player.streak):0);
      player={...player,[element]:player[element]-1,score:player.score+points,
        weekly_score:player.weekly_score+points,tree:player.tree+r.tree,light:player.light+r.light,
        rounds_played:player.rounds_played+1,streak:r.outcome==='win'?Math.min(3,player.streak+1):0};
      result={round:{...r,picked:element,points,tree_gain:r.tree,light_gain:r.light}};
    }else{
      result=await request('/api/play',{actionId:crypto.randomUUID(),element});
      player=result.player;
    }
    showRound(result);haptic('heavy');
  }catch(error){note(error.message==='NO_ELEMENTS'?'این عنصر تمام شده است. فردا برگرد یا دوستی دعوت کن.':'ارتباط با جهان برقرار نشد. اتصال یا تنظیمات API را بررسی کن.');}
  finally{busy=false;render();}
}
function openTab(tab){
  for(const view of ['arena','world','ranking','guide'])$('view-'+view).classList.toggle('visible',view===tab);
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===tab));
  window.scrollTo({top:0,behavior:'instant'});
  if(tab==='ranking')void loadRanking();
}
async function loadRanking(){
  if(!offline){
    try{const response=await fetch(`${cfg.apiBase}/api/leaderboard`);if(!response.ok)throw new Error('ranking');rankings=(await response.json()).players||[];}
    catch{note('رتبه‌بندی در دسترس نیست.');return;}
  }
  const list=$('rankingList');list.replaceChildren();
  if(!rankings.length){const p=document.createElement('p');p.className='muted';p.textContent=offline?'در حالت تمرینی جدول واقعی نمایش داده نمی‌شود.':'هنوز نگهبانی در این هفته ثبت نشده است.';list.append(p);return;}
  rankings.forEach((item,i)=>{
    const row=document.createElement('div');row.className='ranking-row';
    const position=document.createElement('span');position.className='ranking-position';position.textContent=f(i+1);
    const name=document.createElement('b');name.textContent=item.alias;
    const score=document.createElement('span');score.className='ranking-value';score.textContent=f(item.score)+' ✧';
    row.append(position,name,score);list.append(row);
  });
}
async function share(){
  haptic();
  if(offline){note('برای دعوت و دریافت جایزه، بازی را از داخل تلگرام باز کن.');return;}
  const code=player.invite_code;
  if(!code)return;
  const username=cfg.botUsername||'elementalgamebot';
  const link=`https://t.me/${username}?startapp=ref_${code}`;
  const text='به جهان عناصر بیا؛ با هم تعادل را برگردانیم.';
  try{
    if(tg?.openTelegramLink){tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);return;}
  }catch{}
  try{await navigator.clipboard.writeText(link);note('لینک دعوت کپی شد.');}catch{note(link);}
}
async function init(){
  try{
    tg?.ready();tg?.expand();tg?.setHeaderColor?.('#07131d');tg?.setBackgroundColor?.('#07131d');
  }catch{}
  $('demoBanner').hidden=!offline;
  document.querySelectorAll('[data-element]').forEach(btn=>btn.addEventListener('click',()=>play(btn.dataset.element)));
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>openTab(btn.dataset.view)));
  for(const id of ['shareTop','shareRanking','shareGuide'])$(id).addEventListener('click',share);
  $('closeResult').addEventListener('click',()=>$('resultModal').close());
  if(!offline){
    note('در حال اتصال به جهان...');
    try{
      const result=await request('/api/session',{});
      player=result.player;note('');
    }catch(error){
      note(error.message==='EXPIRED_AUTH'?'نشست تلگرام منقضی شده؛ Mini App را دوباره باز کن.':'اتصال به API برقرار نیست. تا رفع مشکل، امکان بازی واقعی غیرفعال است.');
      busy=true;
    }
  }
  render();
}
init();
