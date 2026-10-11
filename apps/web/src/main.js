import '../config.js';
import {Application, Container, Graphics, Text} from 'pixi.js';
import {gsap} from 'gsap';
import {ELEMENTS, ELEMENT_LABELS, resolveRound, worldForDay, weekForDay} from '../engine.js';

const el=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('fa-IR').format(n||0);
const cfg=window.ELEMENTAL_CONFIG||{};
const url=new URL(window.location.href);
const ticket=url.searchParams.get('game_ticket');
// Signed launch URLs are short-lived capabilities. Remove from browser history immediately.
if(ticket){url.searchParams.delete('game_ticket');history.replaceState(null,'',url.pathname+url.search+url.hash);}
const practice=!ticket;
const today=new Date().toISOString().slice(0,10);
const world=worldForDay(today);
const blank={id:'demo',alias:'نگهبان آزمایشی',invite_code:'',water:5,fire:5,earth:5,wind:5,tree:0,light:0,score:0,weekly_score:0,week_key:weekForDay(today),streak:0,rounds_played:0};
let player={...blank};let busy=false;let sounds=false;let effect=0;
const colors={water:0x78c9ff,fire:0xffa770,earth:0xc0d58f,wind:0xd6c2fa};
const signs={water:'◈',fire:'✦',earth:'⬡',wind:'≋'};
const descriptions={win:'نیروی تو بر میدان غلبه کرد.',draw:'دو نیرو به تعادل رسیدند.',loss:'میدان این بار از تو پیشی گرفت.'};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function notice(text){el('notice').hidden=!text;el('notice').textContent=text;}
async function api(path,body){
 const base=String(cfg.apiBase||'').replace(/\/$/,'');
 if(!/^https:\/\//.test(base)||base.includes('YOUR_SUBDOMAIN'))throw new Error('NO_API');
 const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${ticket}`},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'API_ERROR');return data;
}
function update(){
 el('score').textContent=fmt(player.score);el('rounds').textContent=fmt(player.rounds_played);
 el('trees').textContent=fmt(player.tree);el('lights').textContent=fmt(player.light);el('streak').textContent=fmt(player.streak);
 for(const name of ELEMENTS){el('stock-'+name).textContent=fmt(player[name]);const btn=document.querySelector(`[data-force="${name}"]`);btn.disabled=busy||player[name]<=0;}
}
let renderer,layer,core,orbitA,orbitB,stars=[],particles=[];
function ring(r,color,alpha,width=1){const g=new Graphics().circle(0,0,r).stroke({color,alpha,width});return g;}
function dot(x,y,r,color,alpha){const g=new Graphics().circle(0,0,r).fill({color,alpha});g.position.set(x,y);return g;}
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
 core=new Container();core.addChild(new Graphics().circle(0,0,55).fill({color:0x0b2634,alpha:.88}).circle(0,0,52).stroke({color:0xe9d19d,width:2,alpha:.65}).circle(0,0,43).stroke({color:0x4c9ba0,width:1,alpha:.35}));
 const glyph=new Text({text:'✥',style:{fill:0xeed5a3,fontSize:55,fontFamily:'sans-serif'}});glyph.anchor.set(.5);core.addChild(glyph);layer.addChild(core);
 const seed=(i)=>{let a=i*2.39996,r=Math.sqrt((i+.5)/72)*174;return [Math.cos(a)*r,Math.sin(a)*r*.77];};
 for(let i=0;i<72;i++){const [x,y]=seed(i);const s=dot(x,y,i%4===0?1.8:1,i%6===0?0xe7c58b:0x87c2d7,.15+(i%7)/13);stars.push(s);layer.addChildAt(s,0);}
 renderer.ticker.add(ticker=>{
   const d=reduced?0:ticker.deltaTime;
   orbitA.rotation+=d*.0015;orbitB.rotation-=d*.001;core.rotation+=d*.0009;
   for(let i=0;i<stars.length;i++)stars[i].alpha=.4+Math.sin(performance.now()/850+i)*.24;
   for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=ticker.deltaMS;p.view.x+=p.vx*ticker.deltaMS/16;p.view.y+=p.vy*ticker.deltaMS/16;p.vx*=.985;p.vy*=.985;p.view.alpha=Math.max(0,1-p.age/p.life);p.view.scale.set(Math.max(.01,1-p.age/p.life));if(p.age>=p.life){layer.removeChild(p.view);p.view.destroy();particles.splice(i,1);}}
 });
 const position=()=>layer.position.set(host.clientWidth/2,host.clientHeight*.49);
 position();new ResizeObserver(position).observe(host);
}
function burst(type,n=46){if(!layer)return;const color=colors[type]||0xeed5a3;effect++;for(let i=0;i<n;i++){
 const a=Math.random()*Math.PI*2;const speed=2+Math.random()*4;
 const view=new Graphics().circle(0,0,1.5+Math.random()*2.7).fill({color:i%6===0?0xffefd0:color});layer.addChild(view);
 particles.push({view,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:450+Math.random()*520,age:0});
 }}
function buzz(){try{navigator.vibrate?.(30)}catch{}}
let audio;
function tone(freq=260){if(!sounds)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator();const amp=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,audio.currentTime);amp.gain.setValueAtTime(.025,audio.currentTime);amp.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.18);osc.connect(amp).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.19)}catch{}}
function resultModal(round){const r=round;
 el('result-title').textContent={win:'پیروزی نیرو',draw:'هم‌آوایی جهان',loss:'چرخش تقدیر'}[r.outcome];
 el('result-desc').textContent=descriptions[r.outcome];
 el('result-glyph').textContent={win:'✺',draw:'◎',loss:'◇'}[r.outcome];
 el('versus').textContent=`${ELEMENT_LABELS[r.picked]}  ×  ${ELEMENT_LABELS[r.rival]}`;
 el('rewards').textContent=`✧ ${fmt(r.points)} امتیاز${r.tree_gain?'  ·  ♧ ۱ درخت':''}${r.light_gain?'  ·  ✺ ۱ نور':''}`;
 el('result').showModal();
}
async function play(name){
 if(busy||player[name]<=0)return;
 busy=true;notice('');update();buzz();tone(220);burst(name,reduced?8:30);
 el('arenaHint').textContent=`${ELEMENT_LABELS[name]} وارد میدان شد…`;
 const before=new Promise(resolve=>setTimeout(resolve,reduced?200:650));
 try{
  let res;
  if(practice){
   const rival=ELEMENTS[crypto.getRandomValues(new Uint32Array(1))[0]%4];const r=resolveRound(name,rival,world);
   const points=r.basePoints+(r.outcome==='win'?Math.min(2,player.streak):0);
   player={...player,[name]:player[name]-1,score:player.score+points,weekly_score:player.weekly_score+points,tree:player.tree+r.tree,light:player.light+r.light,rounds_played:player.rounds_played+1,streak:r.outcome==='win'?Math.min(3,player.streak+1):0};
   res={round:{picked:name,rival,outcome:r.outcome,points,tree_gain:r.tree,light_gain:r.light}};
  }else{res=await api('/api/play',{actionId:crypto.randomUUID(),element:name});player=res.player;}
  await before;burst(name,reduced?9:65);tone(res.round.outcome==='win'?560:175);
  gsap.fromTo('#score',{scale:1.15},{scale:1,duration:.45});update();resultModal(res.round);
 }catch(err){notice(err.message==='UNAUTHORIZED'?'بلیت ورود منقضی شده؛ بازی را دوباره از پیام تلگرام اجرا کن.':err.message==='NO_ELEMENTS'?'این عنصر تمام شده است. فردا دوباره امتحان کن.':'اتصال به سرور بازی برقرار نشد. از وضعیت Worker مطمئن شو.');}
 finally{busy=false;el('arenaHint').textContent='یک عنصر را لمس کن یا به درون حلقه بکش';update();}
}
function bindForce(button){const type=button.dataset.force;let moved=false,downX=0,downY=0;
 button.addEventListener('pointerdown',e=>{if(button.disabled)return;moved=false;downX=e.clientX;downY=e.clientY;button.setPointerCapture(e.pointerId);});
 button.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-downX,e.clientY-downY)>18){moved=true;button.classList.add('dragging');}});
 button.addEventListener('pointerup',e=>{button.classList.remove('dragging');if(moved){const rect=el('arena').getBoundingClientRect();if(e.clientY>=rect.top&&e.clientY<=rect.bottom&&e.clientX>=rect.left&&e.clientX<=rect.right)void play(type);}});
 button.addEventListener('pointercancel',()=>button.classList.remove('dragging'));
 button.addEventListener('click',()=>{if(!moved)void play(type);});
}
async function showRanking(){const list=el('leader-list');list.textContent='در حال دریافت…';el('leaderboard').showModal();
 if(practice){list.textContent='رتبه‌بندی در حالت تمرینی نمایش داده نمی‌شود.';return;}
 try{const response=await fetch(String(cfg.apiBase).replace(/\/$/,'')+'/api/leaderboard');if(!response.ok)throw Error('ranking');const rows=(await response.json()).players||[];
 list.replaceChildren();if(!rows.length){list.textContent='این هفته هنوز نگهبانی ثبت نشده.';return;}
 rows.forEach((p,i)=>{const row=document.createElement('div');row.className='leader-row';const n=document.createElement('span');n.textContent=`${fmt(i+1)} · ${p.alias}`;const s=document.createElement('strong');s.textContent=fmt(p.score);row.append(n,s);list.append(row);});
 }catch{list.textContent='دریافت جدول با خطا روبه‌رو شد.';}
}
function share(){if(window.TelegramGameProxy?.shareScore&&!practice){window.TelegramGameProxy.shareScore();return;}
 const code=player.invite_code;const link=code?`https://t.me/${cfg.botUsername||'elementalgamebot'}?start=ref_${code}`:`https://t.me/${cfg.botUsername||'elementalgamebot'}?game=${cfg.gameShortName||'elemental'}`;
 if(navigator.share)navigator.share({title:'عناصر',text:'به بازی عناصر بیا و تعادل را بازگردان.',url:link}).catch(()=>{});
 else if(navigator.clipboard)navigator.clipboard.writeText(link).then(()=>notice('لینک بازی کپی شد.'),()=>notice(link));else notice(link);
}
async function start(){el('demo').hidden=!practice;el('weather').textContent=`رویداد امروز: ${world.title} • ${world.text}`;
 document.querySelectorAll('[data-force]').forEach(bindForce);
 el('share').addEventListener('click',share);el('ranking').addEventListener('click',showRanking);
 el('close-ranking').addEventListener('click',()=>el('leaderboard').close());el('next').addEventListener('click',()=>el('result').close());
 el('sound').addEventListener('click',()=>{sounds=!sounds;el('sound').textContent=sounds?'♫':'♪';if(sounds)tone(440);});
 try{await initPixi();}catch(e){notice('رندر گرافیکی روی این دستگاه در دسترس نیست. برای بازی کامل WebGL را فعال کن.');console.error('Pixi failed',e);}
 if(!practice){busy=true;notice('در حال تأیید هویت بازی…');try{const r=await api('/api/session',{});player=r.player;notice('');}catch(e){notice('ورود معتبر نبود یا API هنوز آماده نیست. بازی را از دکمهٔ Play تلگرام دوباره باز کن.');busy=true;update();return;}busy=false;}
 update();
}
start();
