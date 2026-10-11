import '../config.js';
import {Application, Container, Graphics, Text} from 'pixi.js';
import {gsap} from 'gsap';
import {stackBackCount,stackSpacing} from './card-stack.js';
import {ELEMENTS, ELEMENT_LABELS, resolveRound, worldForDay, weekForDay} from '../engine.js';

const el=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('fa-IR').format(n||0);
const cfg=window.ELEMENTAL_CONFIG||{};
const url=new URL(window.location.href);
const ticket=url.searchParams.get('game_ticket');
if(ticket){url.searchParams.delete('game_ticket');history.replaceState(null,'',url.pathname+url.search+url.hash);}
const practice=!ticket;
const today=new Date().toISOString().slice(0,10);
const world=worldForDay(today);
const blank={id:'demo',alias:'نگهبان آزمایشی',invite_code:'',water:5,fire:5,earth:5,wind:5,tree:0,light:0,score:0,weekly_score:0,week_key:weekForDay(today),streak:0,rounds_played:0};
let player={...blank};
let busy=false;
let sounds=false;
let renderer,layer,core,orbitA,orbitB,stars=[],particles=[],fx=[];
let dragState=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

const colors={water:0x78c9ff,fire:0xffa770,earth:0xc0d58f,wind:0xd6c2fa,neutral:0xeed5a3};
const signs={water:'◈',fire:'✦',earth:'⬡',wind:'≋'};
const forceTags={water:'موج و خاموشی',fire:'فروغ و یورش',earth:'پایداری و ریشه',wind:'شتاب و آشوب'};
const forceShots={water:'بکش و رها کن',fire:'با ضربه هم می‌شود',earth:'به قلب شکاف پرتاب کن',wind:'سریع‌ترین کارت تو'};
const forceStates=count=>count<=0?'تهی':count===1?'آخرین کارت':count===2?'دو کارت مانده':'آمادهٔ نبرد';
const descriptions={win:'نیروی تو بر میدان غلبه کرد.',draw:'دو نیرو به تعادل رسیدند.',loss:'میدان این بار از تو پیشی گرفت.'};
const resultGlyph={win:'✺',draw:'◎',loss:'◇'};
const reactionLabels={'earth-water':'رویش جنگل','fire-wind':'انفجار نور','fire-water':'بخار داغ','earth-wind':'توفان شن','earth-fire':'گدازهٔ سوزان','water-wind':'توفان آبی'};

function notice(text){el('notice').hidden=!text;el('notice').textContent=text;}
function setHint(text,sub=''){
  el('arenaHint').textContent=text;
  const meta=el('arenaMeta');
  if(meta)meta.textContent=sub;
}
function toggleDialog(dialog,open){
  if(open){dialog.showModal();document.body.classList.add('dialog-open');}
  else{dialog.close();if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');}
}
async function api(path,body){
 const base=String(cfg.apiBase||'').replace(/\/$/,'');
 if(!/^https:\/\//.test(base)||base.includes('YOUR_SUBDOMAIN'))throw new Error('NO_API');
 const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${ticket}`},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'API_ERROR');
 return data;
}
function update(){
 el('score').textContent=fmt(player.score);el('rounds').textContent=fmt(player.rounds_played);
 el('trees').textContent=fmt(player.tree);el('lights').textContent=fmt(player.light);el('streak').textContent=fmt(player.streak);
 for(const name of ELEMENTS){
   const count=player[name]||0;
   const btn=document.querySelector(`[data-force="${name}"]`);
   if(btn){
     btn.disabled=busy||count<=0;
     btn.dataset.stockState=count<=0?'empty':count===1?'critical':count<=2?'low':'ok';
     btn.dataset.count=String(count);
     btn.querySelector('.force-status').textContent=forceStates(count);
     renderStack(btn,count);
     const face=btn.querySelector('.stack-face');
     if(face) face.classList.toggle('empty',count<=0);
   }
 }
}
function renderStack(button,count){
 // Only touch DOM when an inventory count changes. Every owned card has a physical layer.
 const stack=button.querySelector('.force-stack');
 if(!stack||stack.dataset.renderedCount===String(count))return;
 stack.dataset.renderedCount=String(count);
 const face=stack.querySelector('.stack-face');
 stack.querySelectorAll('.stack-card').forEach(card=>card.remove());
 const backs=stackBackCount(count);
 const spacing=stackSpacing(count);
 const fragment=document.createDocumentFragment();
 for(let depth=backs;depth>=1;depth--){
   const back=document.createElement('span');
   back.className='stack-card layer';
   back.style.setProperty('--depth',String(depth));
   back.style.setProperty('--step',String(spacing));
   fragment.append(back);
 }
 stack.insertBefore(fragment,face);
 button.setAttribute('aria-label',`کارت ${ELEMENT_LABELS[button.dataset.force]}، ${fmt(count)} کارت در پشته`);
}
function ring(r,color,alpha,width=1){return new Graphics().circle(0,0,r).stroke({color,alpha,width});}
function dot(x,y,r,color,alpha){const g=new Graphics().circle(0,0,r).fill({color,alpha});g.position.set(x,y);return g;}
function glyphText(symbol,color,size=58){
  const t=new Text({text:symbol,style:{fill:color,fontSize:size,fontFamily:'sans-serif',fontWeight:'700',dropShadow:{color,alpha:.45,blur:16,angle:0,distance:0}}});
  t.anchor.set(.5);
  return t;
}
function registerFx(view,lifetime=680,step=()=>{}){fx.push({view,lifetime,age:0,step});layer.addChild(view);return view;}
async function initPixi(){
 const host=el('pixi-stage');renderer=new Application();
 await renderer.init({resizeTo:host,backgroundAlpha:0,antialias:true,resolution:Math.min(2,devicePixelRatio||1),preference:'webgl'});
 host.appendChild(renderer.canvas);
 layer=new Container();renderer.stage.addChild(layer);
 const halo=new Graphics().circle(0,0,130).fill({color:0x178aa0,alpha:.05}).circle(0,0,105).fill({color:0x36949e,alpha:.05});layer.addChild(halo);
 orbitA=ring(134,0x7aa1ae,.24);orbitB=ring(91,0xb8d7d0,.23);const outer=ring(166,0x5c96a8,.1);
 orbitA.scale.set(1,.72);orbitB.scale.set(1,.72);outer.scale.set(1,.72);layer.addChild(outer,orbitA,orbitB);
 for(let i=0;i<4;i++){
   const angle=i*Math.PI/2-Math.PI/4;const force=ELEMENTS[i];
   const point=new Container();point.position.set(Math.cos(angle)*114,Math.sin(angle)*83);
   point.addChild(new Graphics().circle(0,0,29).fill({color:colors[force],alpha:.11}).circle(0,0,21).stroke({color:colors[force],width:1,alpha:.6}));
   const symbol=new Text({text:signs[force],style:{fill:colors[force],fontSize:31,fontFamily:'sans-serif'}});symbol.anchor.set(.5);point.addChild(symbol);layer.addChild(point);
 }
 core=new Container();
 core.addChild(new Graphics().circle(0,0,55).fill({color:0x0b2634,alpha:.88}).circle(0,0,52).stroke({color:0xe9d19d,width:2,alpha:.65}).circle(0,0,43).stroke({color:0x4c9ba0,width:1,alpha:.35}));
 const glyph=glyphText('✥',0xeed5a3,55);core.addChild(glyph);layer.addChild(core);
 const seed=i=>{let a=i*2.39996,r=Math.sqrt((i+.5)/72)*174;return [Math.cos(a)*r,Math.sin(a)*r*.77];};
 for(let i=0;i<72;i++){const [x,y]=seed(i);const s=dot(x,y,i%4===0?1.8:1,i%6===0?0xe7c58b:0x87c2d7,.15+(i%7)/13);stars.push(s);layer.addChildAt(s,0);}
 renderer.ticker.add(ticker=>{
   const d=reduced?0:ticker.deltaTime;
   orbitA.rotation+=d*.0015;orbitB.rotation-=d*.001;core.rotation+=d*.0009;
   for(let i=0;i<stars.length;i++)stars[i].alpha=.4+Math.sin(performance.now()/850+i)*.24;
   for(let i=particles.length-1;i>=0;i--){
     const p=particles[i];p.age+=ticker.deltaMS;p.view.x+=p.vx*ticker.deltaMS/16;p.view.y+=p.vy*ticker.deltaMS/16;p.vx*=.985;p.vy*=.985;
     p.view.alpha=Math.max(0,1-p.age/p.life);p.view.scale.set(Math.max(.01,1-p.age/p.life));
     if(p.age>=p.life){layer.removeChild(p.view);p.view.destroy();particles.splice(i,1);}
   }
   for(let i=fx.length-1;i>=0;i--){
     const item=fx[i]; item.age+=ticker.deltaMS; item.step(item,item.age/item.lifetime,ticker.deltaMS);
     if(item.age>=item.lifetime){layer.removeChild(item.view);item.view.destroy({children:true});fx.splice(i,1);}
   }
 });
 const position=()=>layer.position.set(host.clientWidth/2,host.clientHeight*.49);
 position();new ResizeObserver(position).observe(host);
}
function burst(type,n=46,origin={x:0,y:0}){
 if(!layer)return;
 const color=colors[type]||colors.neutral;
 for(let i=0;i<n;i++){
   const a=Math.random()*Math.PI*2;const speed=2+Math.random()*4;
   const view=new Graphics().circle(0,0,1.5+Math.random()*2.7).fill({color:i%6===0?0xffefd0:color});
   view.position.set(origin.x,origin.y);layer.addChild(view);
   particles.push({view,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:450+Math.random()*520,age:0});
 }
}
function arenaPulse(type){
 const arena=el('arena');
 arena.dataset.force=type; arena.classList.add('charged');
 gsap.fromTo(arena,{ '--pulse-opacity': 0.08 },{'--pulse-opacity': .36,duration:.22,yoyo:true,repeat:1,onComplete:()=>arena.classList.remove('charged')});
}
function flashOutcome(outcome){
 const color={win:0xe8c67d,draw:0x8fd6de,loss:0xb190ff}[outcome]||colors.neutral;
 const ripple=new Graphics().circle(0,0,26).stroke({color,width:3,alpha:.85}).circle(0,0,12).fill({color,alpha:.16});
 ripple.alpha=1; ripple.scale.set(.3);
 registerFx(ripple,560,(item,p)=>{item.view.scale.set(.3+p*2.7);item.view.alpha=1-p;});
}
function floatingLabel(text,color=0xeed5a3,size=30,duration=920,offsetY=-82){
 const t=glyphText(text,color,size);
 t.position.set(0,offsetY); t.alpha=0; t.scale.set(.7);
 registerFx(t,duration,(item,p)=>{item.view.y=offsetY-p*44;item.view.alpha=p<.18?p/.18:1-p;item.view.scale.set(.7+Math.min(.5,p*.7));});
}
async function clashSequence(picked,rival,outcome){
  const arena=el('arena'),stage=el('battle-stage');
  if(!stage)return;
  stage.replaceChildren();
  const makeCard=(type,enemy)=>{
    const card=document.createElement('div');
    card.className=`combat-card ${type}${enemy?' opponent':''}`;
    const sig=document.createElement('b');sig.textContent=signs[type];
    const name=document.createElement('small');name.textContent=ELEMENT_LABELS[type];
    card.append(sig,name);
    stage.append(card);
    return card;
  };
  const mine=makeCard(picked,false),opponent=makeCard(rival,true);
  const fast=reduced;
  await new Promise(resolve=>{
    const timeline=gsap.timeline({onComplete:resolve});
    timeline.fromTo(mine,{x:-140,y:140,rotation:-28,scale:.68,autoAlpha:0},{x:-44,y:0,rotation:-9,scale:1,autoAlpha:1,duration:fast?.12:.4,ease:'power3.out'},0)
      .fromTo(opponent,{x:150,y:-150,rotation:28,scale:.68,autoAlpha:0},{x:44,y:0,rotation:8,scale:1,autoAlpha:1,duration:fast?.12:.45,ease:'power3.out'},0)
      .to(mine,{x:-8,rotation:-20,duration:fast?.1:.18,ease:'power3.in'},fast?.14:.48)
      .to(opponent,{x:8,rotation:20,duration:fast?.1:.18,ease:'power3.in'},fast?.14:.48)
      .call(()=>{
        flashOutcome(outcome);
        burst(picked,fast?8:26);
        burst(rival,fast?8:28);
        arena.classList.add('battle-impact');
        if(!fast)gsap.fromTo(arena,{x:0},{x:5,duration:.055,repeat:5,yoyo:true,ease:'none',clearProps:'x'});
        if(outcome==='win')try{navigator.vibrate?.([30,30,60]);}catch{}
      },[],fast?.24:.68)
      .to([mine,opponent],{scale:1.3,autoAlpha:0,duration:fast?.1:.24},fast?.24:.7);
  });
  arena.classList.remove('battle-impact');
  stage.replaceChildren();
}
function showBattleOutcome(round,streak){
 const toast=el('battle-toast');
 gsap.killTweensOf(toast);
 const pair=[round.picked,round.rival].sort().join('-');
 const reaction=round.tree_gain?'♧ درخت تازه رویید':round.light_gain?'✺ نور آزاد شد':reactionLabels[pair]||'نیروها برخورد کردند';
 toast.dataset.outcome=round.outcome;
 el('toast-title').textContent={win:'پیروزی!',draw:'تعادل',loss:'این بار شکست خوردی'}[round.outcome];
 el('toast-points').textContent=round.points>0?`+${fmt(round.points)} امتیاز`:'بدون امتیاز';
 el('toast-reaction').textContent=(round.outcome==='win'&&streak>=2?`زنجیرهٔ پیروزی ✦ ${fmt(streak)}   ·   `:'')+reaction;
 toast.hidden=false;
 gsap.fromTo(toast,{autoAlpha:0,y:20,scale:.84},{autoAlpha:1,y:0,scale:1,duration:reduced?.1:.24,ease:'back.out(1.8)'});
 gsap.to(toast,{autoAlpha:0,y:-20,delay:reduced?.9:1.65,duration:reduced?.1:.36,onComplete:()=>{toast.hidden=true;}});
}
function launchTrail(type,start){
 const trail=new Graphics();
 const target={x:0,y:0};
 const points=[start,{x:start.x*.48,y:start.y*.48},{x:start.x*.2,y:start.y*.2},target];
 registerFx(trail,480,(item,p)=>{
   trail.clear();
   const color=colors[type];
   const x=(1-p)*(1-p)*(1-p)*points[0].x+3*(1-p)*(1-p)*p*points[1].x+3*(1-p)*p*p*points[2].x+p*p*p*points[3].x;
   const y=(1-p)*(1-p)*(1-p)*points[0].y+3*(1-p)*(1-p)*p*points[1].y+3*(1-p)*p*p*points[2].y+p*p*p*points[3].y;
   trail.moveTo(points[0].x,points[0].y).quadraticCurveTo(points[1].x,points[1].y, x, y).stroke({color,alpha:Math.max(.08,.55-(p*.45)),width:5});
   trail.circle(x,y,8-(p*4)).fill({color,alpha:1-p*.3});
   if(p>.9)trail.circle(0,0,8).fill({color,alpha:.24});
 });
}
function arenaCenterFromPointer(x,y){
 const rect=el('arena').getBoundingClientRect();
 return {x:(x-(rect.left+rect.width/2)),y:(y-(rect.top+rect.height*.49))};
}
function buzz(){try{navigator.vibrate?.(30);}catch{}}
let audio;
function tone(freq=260){
 if(!sounds)return;
 try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();
  const osc=audio.createOscillator();const amp=audio.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(freq,audio.currentTime);
  amp.gain.setValueAtTime(.025,audio.currentTime);amp.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.18);
  osc.connect(amp).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.19);
 }catch{}
}
function setArenaState(state,force=''){
 const arena=el('arena');
 arena.dataset.state=state;
 if(force)arena.dataset.force=force;
}
async function play(name,launch={center:{x:0,y:0},launched:false}){
 if(busy||player[name]<=0)return;
 busy=true; notice(''); update(); buzz(); tone(220);
 setArenaState('resolving',name);
 arenaPulse(name); burst(name,reduced?8:18,launch.center); if(launch.launched)launchTrail(name,launch.center);
 setHint(`${ELEMENT_LABELS[name]} وارد میدان شد…`, 'نیروی رقیب در حال شکل‌گیری است');
 const before=new Promise(resolve=>setTimeout(resolve,reduced?260:760));
 try{
  let res;
  if(practice){
   const rival=ELEMENTS[crypto.getRandomValues(new Uint32Array(1))[0]%4];
   const r=resolveRound(name,rival,world);
   const points=r.basePoints+(r.outcome==='win'?Math.min(2,player.streak):0);
   player={...player,[name]:player[name]-1,score:player.score+points,weekly_score:player.weekly_score+points,tree:player.tree+r.tree,light:player.light+r.light,rounds_played:player.rounds_played+1,streak:r.outcome==='win'?Math.min(3,player.streak+1):0};
   res={round:{picked:name,rival,outcome:r.outcome,points,tree_gain:r.tree,light_gain:r.light}};
  }else{
   res=await api('/api/play',{actionId:crypto.randomUUID(),element:name});
   player=res.player;
  }
  setHint(`${ELEMENT_LABELS[name]} با ${ELEMENT_LABELS[res.round.rival]} برخورد کرد`, descriptions[res.round.outcome]);
  await before;
  await clashSequence(name,res.round.rival,res.round.outcome);
  showBattleOutcome(res.round,player.streak);
  tone(res.round.outcome==='win'?560:res.round.outcome==='draw'?340:175);
  gsap.fromTo('#score',{scale:1.16},{scale:1,duration:.45});
  gsap.fromTo('#rounds',{scale:1.14},{scale:1,duration:.38});
  update();
 }catch(err){
  notice(err.message==='UNAUTHORIZED'?'بلیت ورود منقضی شده؛ بازی را دوباره از پیام تلگرام اجرا کن.':err.message==='NO_ELEMENTS'?'این عنصر تمام شده است. فردا دوباره امتحان کن.':'اتصال به سرور بازی برقرار نشد. از وضعیت Worker مطمئن شو.');
 }finally{
  busy=false; setArenaState('idle');
  setHint('یک کارت را بکش و درون شکاف رها کن', 'یا فقط روی کارت ضربه بزن');
  update();
 }
}
function createDragAvatar(type){
 const avatar=document.createElement('div');
 avatar.className=`force-avatar ${type}`;
 avatar.innerHTML=`<span class="force-avatar-index">${ELEMENTS.indexOf(type)+1}</span><span class="force-avatar-glyph">${signs[type]}</span><span class="force-avatar-name">${ELEMENT_LABELS[type]}</span>`;
 document.body.append(avatar); return avatar;
}
function positionDragAvatar(avatar,x,y){avatar.style.transform=`translate(${x-48}px, ${y-64}px) rotate(${(x%18)-9}deg)`;}
function destroyDragAvatar(){if(dragState?.avatar){dragState.avatar.remove();} dragState=null; el('arena').classList.remove('hot'); setArenaState('idle'); setHint('یک کارت را بکش و درون شکاف رها کن','یا فقط روی کارت ضربه بزن');}
function pointerInsideArena(x,y){const rect=el('arena').getBoundingClientRect();return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;}
function bindForce(button){
 const type=button.dataset.force; let moved=false, downX=0, downY=0;
 button.addEventListener('pointerdown',e=>{
   if(button.disabled||busy)return;
   moved=false; downX=e.clientX; downY=e.clientY; button.setPointerCapture(e.pointerId);
   dragState={type,button,pointerId:e.pointerId,avatar:createDragAvatar(type)};
   positionDragAvatar(dragState.avatar,e.clientX,e.clientY);
 });
 button.addEventListener('pointermove',e=>{
   if(!dragState||dragState.pointerId!==e.pointerId)return;
   positionDragAvatar(dragState.avatar,e.clientX,e.clientY);
   if(Math.hypot(e.clientX-downX,e.clientY-downY)>14){moved=true;button.classList.add('dragging');}
   const over=pointerInsideArena(e.clientX,e.clientY);
   el('arena').classList.toggle('hot',over);
   if(over){setArenaState('targeted',type);setHint(`کارت ${ELEMENT_LABELS[type]} را رها کن`, forceTags[type]);}
   else{setArenaState('idle');setHint(`کارت ${ELEMENT_LABELS[type]} را بکش`, forceShots[type]);}
 });
 button.addEventListener('pointerup',e=>{
   const hadDrag=dragState&&dragState.pointerId===e.pointerId;
   const over=hadDrag&&pointerInsideArena(e.clientX,e.clientY);
   const avatar=dragState?.avatar;
   button.classList.remove('dragging');
   button.releasePointerCapture?.(e.pointerId);
   if(hadDrag&&moved&&over&&avatar){
     const rect=el('arena').getBoundingClientRect();
     const tx=rect.left+rect.width/2-48, ty=rect.top+rect.height*.49-64;
     gsap.to(avatar,{x:tx-(e.clientX-48),y:ty-(e.clientY-64),scale:.34,opacity:0,duration:reduced?.16:.28,ease:'power2.in',onComplete:()=>avatar.remove()});
     const center=arenaCenterFromPointer(e.clientX,e.clientY);
     dragState=null; el('arena').classList.remove('hot');
     void play(type,{center,launched:true});
     return;
   }
   destroyDragAvatar();
 });
 button.addEventListener('pointercancel',()=>{button.classList.remove('dragging');destroyDragAvatar();});
 button.addEventListener('click',()=>{if(!moved)void play(type,{center:{x:0,y:0},launched:false});});
}
async function showRanking(){
 const list=el('leader-list'); list.textContent='در حال دریافت…'; toggleDialog(el('leaderboard'),true);
 if(practice){list.textContent='رتبه‌بندی در حالت تمرینی نمایش داده نمی‌شود.';return;}
 try{
  const response=await fetch(String(cfg.apiBase).replace(/\/$/,'')+'/api/leaderboard');
  if(!response.ok)throw Error('ranking');
  const rows=(await response.json()).players||[];
  list.replaceChildren(); if(!rows.length){list.textContent='این هفته هنوز نگهبانی ثبت نشده.';return;}
  rows.forEach((p,i)=>{const row=document.createElement('div');row.className='leader-row';const n=document.createElement('span');n.textContent=`${fmt(i+1)} · ${p.alias}`;const s=document.createElement('strong');s.textContent=fmt(p.score);row.append(n,s);list.append(row);});
 }catch{list.textContent='دریافت جدول با خطا روبه‌رو شد.';}
}
function share(){
 if(window.TelegramGameProxy?.shareScore&&!practice){window.TelegramGameProxy.shareScore();return;}
 const code=player.invite_code;
 const link=code?`https://t.me/${cfg.botUsername||'elementalgamebot'}?start=ref_${code}`:`https://t.me/${cfg.botUsername||'elementalgamebot'}?game=${cfg.gameShortName||'elementals'}`;
 if(navigator.share)navigator.share({title:'عناصر',text:'به بازی عناصر بیا و تعادل را بازگردان.',url:link}).catch(()=>{});
 else if(navigator.clipboard)navigator.clipboard.writeText(link).then(()=>notice('لینک بازی کپی شد.'),()=>notice(link)); else notice(link);
}
function decorateCards(){
 document.querySelectorAll('[data-force]').forEach(btn=>{
   const type=btn.dataset.force;
   btn.setAttribute('aria-label',`کارت ${ELEMENT_LABELS[type]}`);
   const title=btn.querySelector('.force-name'); if(title) title.textContent=ELEMENT_LABELS[type];
   const flavor=btn.querySelector('.force-flavor'); if(flavor) flavor.textContent=forceTags[type];
   const usage=btn.querySelector('.force-usage'); if(usage) usage.textContent=forceShots[type];
   const status=btn.querySelector('.force-status'); if(status) status.textContent=forceStates(player[type]||5);
 });
}
async function start(){
 el('demo').hidden=!practice;
 el('weather').textContent=`${world.title} • ${world.text}`;
 el('arena-weather').textContent=world.title;
 decorateCards();
 document.querySelectorAll('[data-force]').forEach(bindForce);
 el('share').addEventListener('click',share);
 el('ranking').addEventListener('click',showRanking);
 el('close-ranking').addEventListener('click',()=>toggleDialog(el('leaderboard'),false));
 el('sound').addEventListener('click',()=>{sounds=!sounds;el('sound').textContent=sounds?'♫':'♪';if(sounds)tone(440);});
 setHint('یک کارت را بکش و درون شکاف رها کن','یا فقط روی کارت ضربه بزن');
 try{await initPixi();}
 catch(e){notice('رندر گرافیکی روی این دستگاه در دسترس نیست. برای بازی کامل WebGL را فعال کن.');console.error('Pixi failed',e);}
 if(!practice){busy=true;notice('در حال تأیید هویت بازی…');
  try{const r=await api('/api/session',{});player=r.player;notice('');}
  catch{notice('ورود معتبر نبود یا API هنوز آماده نیست. بازی را از دکمهٔ Play تلگرام دوباره باز کن.');busy=true;update();return;}
  busy=false;
 }
 update();
}
start();
