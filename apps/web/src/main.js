import '../config.js';
import {Application, Container, Graphics, Text} from 'pixi.js';
import {gsap} from 'gsap';
import {ELEMENTS, ELEMENT_LABELS, resolveRound, worldForDay, weekForDay} from '../engine.js';
import {stackLayers, isArenaDrop} from './card-stack.js';

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

const descriptions={win:'نیروی تو بر میدان غلبه کرد.',draw:'دو نیرو به تعادل رسیدند.',loss:'میدان این بار از تو پیشی گرفت.'};
const resultGlyph={win:'✺',draw:'◎',loss:'◇'};

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
 el('score').textContent=fmt(player.score);
 el('rounds').textContent=fmt(player.rounds_played);
 el('trees').textContent=fmt(player.tree);
 el('lights').textContent=fmt(player.light);
 el('streak').textContent=fmt(player.streak);
 for(const name of ELEMENTS){
   const count=player[name]||0;
   const btn=document.querySelector(`[data-force="${name}"]`);
   btn.disabled=busy||count<=0;
   btn.dataset.stockState=count<=0?'empty':count===1?'critical':'ok';
   btn.setAttribute('aria-label',`${ELEMENT_LABELS[name]}، ${fmt(count)} کارت`);
   const target=btn.querySelector('.stack-layers');
   // Avoid rewriting live card piles unnecessarily while animations are running.
   if(target.dataset.count!==String(count)){
     const cardLayers=stackLayers(count);
     const frag=document.createDocumentFragment();
     for(const card of cardLayers){
       const node=document.createElement('span');
       node.className='stack-card';
       node.style.transform=`translate(${-card.shift*.14}px, ${-card.shift}px) rotate(${card.rotate}deg)`;
       node.style.zIndex=String(card.index);
       frag.append(node);
     }
     target.replaceChildren(frag);
     target.dataset.count=String(count);
     // The top face sits above every individual card layer.
     btn.querySelector('.stack-face').style.zIndex=String(cardLayers.length+1);
   }
 }
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
 const position=()=>layer.position.set(host.clientWidth/2,host.clientHeight*.45);
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
function elementalSplash(type,outcome){
 if(!layer)return;
 const palette=colors[type];
 const amount=reduced?7:22;
 if(type==='water'){
   for(let i=0;i<3;i++){
     const g=new Graphics().circle(0,0,30).stroke({color:palette,alpha:.75,width:3});
     registerFx(g,650+i*130,(item,p)=>{item.view.scale.set(.35+p*(3+i*.6));item.view.alpha=(1-p)*.75;});
   }
   burst(type,amount,{x:0,y:0});
 } else if(type==='fire'){
   for(let i=0;i<amount;i++){
     const g=new Graphics().star(0,0,5,4+Math.random()*7,2).fill({color:i%4===0?0xffe4a0:palette,alpha:.95});
     const x=(Math.random()-.5)*65;const y=(Math.random()-.5)*25;
     g.position.set(x,y);
     registerFx(g,650+Math.random()*360,(item,p)=>{item.view.x=x+Math.sin(p*9+i)*24;item.view.y=y-p*(55+Math.random()*3);item.view.rotation=p*2;item.view.alpha=1-p;});
   }
 } else if(type==='earth'){
   for(let i=0;i<amount;i++){
     const size=3+Math.random()*11;
     const g=new Graphics().poly([0,-size,size*.8,-size*.18,size*.5,size, -size*.65,size*.5]).fill({color:i%5===0?0xf0d6ab:palette});
     const angle=Math.random()*Math.PI*2,dist=65+Math.random()*115;
     registerFx(g,700+Math.random()*160,(item,p)=>{item.view.x=Math.cos(angle)*dist*p;item.view.y=Math.sin(angle)*dist*p+p*p*34;item.view.rotation=p*5;item.view.alpha=1-p;});
   }
 } else if(type==='wind'){
   for(let i=0;i<12;i++){
     const g=new Graphics().arc(0,0,22+i*5,i*.7,i*.7+Math.PI*.58).stroke({color:palette,alpha:.85,width:2.6});
     registerFx(g,550+i*32,(item,p)=>{item.view.rotation=p*3.5;item.view.scale.set(.6+p*.8);item.view.alpha=1-p;});
   }
 }
 flashOutcome(outcome);
}
function synthesisEffect(round){
 if(round.tree_gain){
  floatingLabel('♧ رویش',0xb8dc94,23,1200,-95);
  for(let i=0;i<11;i++){
   const a=i*Math.PI*2/11;
   const leaf=new Graphics().ellipse(0,0,4,8).fill({color:i%2===0?0xa8d77f:0x79b884});
   registerFx(leaf,850,(item,p)=>{item.view.x=Math.cos(a)*(18+p*88);item.view.y=Math.sin(a)*(18+p*65)-p*24;item.view.rotation=a+p*2;item.view.alpha=1-p;});
  }
 }
 if(round.light_gain){
  floatingLabel('✺ روشنایی',0xffdfab,23,1200,-110);
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   const ray=new Graphics().rect(-2,-6,4,28).fill({color:0xffe6b6});
   registerFx(ray,880,(item,p)=>{item.view.position.set(Math.cos(a)*75*p,Math.sin(a)*75*p);item.view.rotation=a+Math.PI/2;item.view.alpha=1-p;});
  }
 }
}
function combatCard(type,foe=false){
 const item=new Container();
 const c=colors[type];
 item.addChild(new Graphics().roundRect(-43,-60,86,120,12).fill({color:foe?0x211b32:0x0c2b37,alpha:.98}).stroke({color:c,width:2.8,alpha:.92}));
 item.addChild(new Graphics().roundRect(-35,-52,70,104,8).stroke({color:c,width:1,alpha:.35}));
 const glyph=glyphText(signs[type],c,55);item.addChild(glyph);
 const label=glyphText(ELEMENT_LABELS[type],0xe9f5ed,17);label.position.y=43;item.addChild(label);
 item.scale.set(.74);item.alpha=0;
 layer.addChild(item);
 return item;
}
function clashSequence(round){
 return new Promise(resolve=>{
  if(!layer){resolve();return;}
  const left=combatCard(round.picked),right=combatCard(round.rival,true);
  left.position.set(-155,120);right.position.set(155,-120);
  const inTime=reduced?.16:.43,impactTime=reduced?.10:.16;
  const timeline=gsap.timeline({onComplete:resolve});
  timeline.to(left,{x:-44,y:19,alpha:1,duration:inTime,ease:'power3.out'},0)
    .to(right,{x:44,y:-19,alpha:1,duration:inTime,ease:'power3.out'},0)
    .to(left.scale,{x:1,y:1,duration:inTime},0)
    .to(right.scale,{x:1,y:1,duration:inTime},0)
    .to(left,{x:0,y:0,duration:impactTime,ease:'power4.in'},inTime)
    .to(right,{x:0,y:0,duration:impactTime,ease:'power4.in'},inTime)
    .call(()=>{
      const impact=round.outcome==='win'?round.picked:round.rival;
      elementalSplash(impact,round.outcome);
      burst(round.picked,reduced?9:26);
      synthesisEffect(round);
      if(!reduced){
        const arena=el('arena');arena.classList.remove('shake');void arena.offsetWidth;arena.classList.add('shake');
        window.setTimeout(()=>arena.classList.remove('shake'),300);
      }
      navigator.vibrate?.(round.outcome==='win'?[25,35,60]:round.outcome==='loss'?[65,40,45]:[20,25,20]);
      floatingLabel(round.outcome==='win'?'✺':round.outcome==='draw'?'◎':'◇',round.outcome==='win'?0xf5d58b:0xcbd8ed,33,650,-82);
    },[],inTime+impactTime)
    .to([left,right],{alpha:0,duration:reduced?.09:.2},inTime+impactTime+.05)
    .call(()=>{layer.removeChild(left,right);left.destroy({children:true});right.destroy({children:true});});
 });
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
 return {x:(x-(rect.left+rect.width/2)),y:(y-(rect.top+rect.height*.45))};
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
let resultTimer=0;
function showOutcome(round){
 const box=el('battle-outcome');
 window.clearTimeout(resultTimer);
 box.hidden=false;box.dataset.outcome=round.outcome;
 el('outcome-eyebrow').textContent=round.outcome==='win'?'VICTORY':round.outcome==='loss'?'DEFEAT':'DRAW';
 el('outcome-title').textContent=round.outcome==='win'?'پیروزی!':round.outcome==='draw'?'تعادل':'شکست';
 el('outcome-matchup').textContent=`${ELEMENT_LABELS[round.picked]}  ×  ${ELEMENT_LABELS[round.rival]}`;
 el('outcome-reward').textContent=`✧ ${fmt(round.points)} امتیاز${round.tree_gain?'  •  ♧ رویش':''}${round.light_gain?'  •  ✺ روشنایی':''}`;
 gsap.killTweensOf(box);gsap.fromTo(box,{autoAlpha:0,scale:.8,y:25},{autoAlpha:1,scale:1,y:0,duration:reduced?.08:.32,ease:'back.out(1.8)'});
 resultTimer=window.setTimeout(()=>{
   gsap.to(box,{autoAlpha:0,y:-20,duration:reduced?.08:.25,onComplete:()=>{box.hidden=true;box.style.removeProperty('opacity');box.style.removeProperty('visibility');box.style.removeProperty('transform');}});
 },reduced?950:1350);
}
function setArenaState(state,force=''){
 const arena=el('arena');
 arena.dataset.state=state;
 if(force)arena.dataset.force=force;
}
async function play(name,launch={center:{x:0,y:0},launched:false}){
 if(busy||player[name]<=0)return;
 busy=true;notice('');update();buzz();tone(220);
 const zone=el('arena');zone.classList.remove('hot');setArenaState('resolving',name);
 zone.dataset.force=name;
 el('arena-phase').textContent='THE ELEMENT IS CAST';
 arenaPulse(name);
 burst(name,reduced?6:14,launch.center);
 if(launch.launched)launchTrail(name,launch.center);
 setHint(`${ELEMENT_LABELS[name]} به میدان پرتاب شد`, 'نیروی مقابل آشکار می‌شود…');
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
  // Server owns rival, points, rewards. All cinematic effects use this response.
  update();
  el('arena-phase').textContent='ELEMENTAL CLASH';
  await clashSequence(res.round);
  tone(res.round.outcome==='win'?560:res.round.outcome==='draw'?340:175);
  gsap.fromTo('#score',{scale:1.18},{scale:1,duration:.48,ease:'elastic.out(1,.5)'});
  showOutcome(res.round);
  setHint('نبرد پایان یافت', 'کارت بعدی را آماده کن');
  await new Promise(resolve=>window.setTimeout(resolve,reduced?250:440));
 }catch(err){
  notice(err.message==='UNAUTHORIZED'?'بلیت ورود منقضی شده؛ بازی را دوباره از پیام تلگرام اجرا کن.':err.message==='NO_ELEMENTS'?'این عنصر تمام شده است. فردا دوباره امتحان کن.':'اتصال به سرور بازی برقرار نشد. از وضعیت Worker مطمئن شو.');
 }finally{
  busy=false;setArenaState('idle');el('arena-phase').textContent='AWAITING ELEMENT';
  setHint('یک کارت را به قلب شکاف پرتاب کن', 'کارت را بکش و رها کن، یا ضربه بزن');
  update();
 }
}
function createDragAvatar(type){
 const avatar=document.createElement('div');
 avatar.className=`force-avatar ${type}`;
 const index=document.createElement('span');index.className='force-avatar-index';index.textContent='ELEMENTAL';
 const symbol=document.createElement('span');symbol.className='force-avatar-glyph';symbol.textContent=signs[type];
 const label=document.createElement('span');label.className='force-avatar-name';label.textContent=ELEMENT_LABELS[type];
 avatar.append(index,symbol,label);document.body.append(avatar);return avatar;
}
function positionDragAvatar(avatar,x,y){
 avatar.style.left=`${x-43}px`;
 avatar.style.top=`${y-64}px`;
 avatar.style.transform=`rotate(${Math.max(-13,Math.min(13,(x-window.innerWidth*.5)*.05))}deg)`;
}
function clearDrag(){
 if(dragState?.avatar)dragState.avatar.remove();
 if(dragState?.button)dragState.button.classList.remove('dragging');
 dragState=null;
 el('arena').classList.remove('hot');
 setHint('یک کارت را به قلب شکاف پرتاب کن','کارت را بکش و رها کن، یا ضربه بزن');
}
function bindForce(button){
 const type=button.dataset.force;
 let suppressClick=false;
 button.addEventListener('pointerdown',e=>{
   if(button.disabled||busy||dragState)return;
   if(e.pointerType==='mouse'&&e.button!==0)return;
   button.setPointerCapture(e.pointerId);
   dragState={type,button,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false,avatar:null};
 });
 button.addEventListener('pointermove',e=>{
   const state=dragState;
   if(!state||state.button!==button||state.pointerId!==e.pointerId)return;
   const distance=Math.hypot(e.clientX-state.startX,e.clientY-state.startY);
   if(distance>12&&!state.moved){
     state.moved=true;state.avatar=createDragAvatar(type);button.classList.add('dragging');
   }
   if(!state.moved)return;
   positionDragAvatar(state.avatar,e.clientX,e.clientY);
   const over=isArenaDrop(e.clientX,e.clientY,el('arena').getBoundingClientRect());
   el('arena').classList.toggle('hot',over);
   setArenaState(over?'targeted':'idle',type);
   setHint(over?'رها کن تا کارت وارد نبرد شود':'کارت را به مرکز میدان ببر',ELEMENT_LABELS[type]);
 });
 button.addEventListener('pointerup',e=>{
   const state=dragState;
   if(!state||state.button!==button||state.pointerId!==e.pointerId)return;
   if(button.hasPointerCapture?.(e.pointerId))button.releasePointerCapture(e.pointerId);
   const valid=state.moved&&isArenaDrop(e.clientX,e.clientY,el('arena').getBoundingClientRect());
   if(state.moved){suppressClick=true;window.setTimeout(()=>{suppressClick=false;},360);}
   if(valid){
     const avatar=state.avatar;
     const rect=el('arena').getBoundingClientRect();
     const center={x:e.clientX-rect.left-rect.width/2,y:e.clientY-rect.top-rect.height*.45};
     const left=rect.left+rect.width/2-43,top=rect.top+rect.height*.45-64;
     gsap.to(avatar,{left,top,rotation:0,scale:.18,opacity:0,duration:reduced?.08:.28,ease:'power3.in',onComplete:()=>avatar.remove()});
     dragState=null;button.classList.remove('dragging');el('arena').classList.remove('hot');
     void play(type,{center,launched:true});
   }else clearDrag();
 });
 button.addEventListener('pointercancel',clearDrag);
 button.addEventListener('lostpointercapture',()=>{if(dragState?.button===button)clearDrag();});
 button.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}if(!busy&&player[type]>0)void play(type);});
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
 for(const btn of document.querySelectorAll('[data-force]')){
  const name=btn.dataset.force;
  btn.setAttribute('title',`پرتاب ${ELEMENT_LABELS[name]}`);
 }
}
async function start(){
 el('demo').hidden=!practice;
 el('weather').textContent=`رویداد امروز: ${world.title} • ${world.text}`;
 decorateCards();
 document.querySelectorAll('[data-force]').forEach(bindForce);
 el('share').addEventListener('click',share);
 el('ranking').addEventListener('click',showRanking);
 el('close-ranking').addEventListener('click',()=>toggleDialog(el('leaderboard'),false));
 el('sound').addEventListener('click',()=>{sounds=!sounds;el('sound').textContent=sounds?'♫':'♪';if(sounds)tone(440);});
 setHint('یک کارت را به قلب شکاف پرتاب کن','کارت را بکش و رها کن، یا ضربه بزن');
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
