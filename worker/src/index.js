import {ELEMENTS, resolveRound, worldForDay, weekForDay} from '../../apps/web/engine.js';
import {verifyInitData} from './auth.js';
import {verifyGameTicket} from './game-ticket.js';
import {processTelegramUpdate, postGameScore} from './telegram-bot.js';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const encode = obj => JSON.stringify(obj);
const json = (obj,status=200,extra={})=>new Response(encode(obj),{status,headers:{...JSON_HEADERS,...extra}});
const playerFields='id, alias, invite_code, water, fire, earth, wind, score, weekly_score, week_key, tree, light, streak, rounds_played';
const today = () => new Date().toISOString().slice(0,10);
const safeAction = x => typeof x==='string' && /^[a-f0-9-]{36}$/i.test(x) && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const publicAlias = code => `کاوشگر ${code.slice(0,5).toUpperCase()}`;
function randCode(){return crypto.randomUUID().replaceAll('-','').slice(0,12);}
function randomElement(){const b = new Uint32Array(1);crypto.getRandomValues(b);return ELEMENTS[b[0]%ELEMENTS.length];}
function corsFor(req,env){
  const origin=req.headers.get('Origin');
  const allow=env.ALLOWED_ORIGIN;
  return origin && origin===allow ? {
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-allow-headers':'content-type,authorization,x-telegram-init-data',
    'access-control-max-age':'3600',
    'vary':'Origin'
  }:{};
}
async function bodyOf(req){
  if(Number(req.headers.get('content-length')||0)>4096) throw new Error('BAD_REQUEST');
  const raw=await req.text();
  if(raw.length>4096) throw new Error('BAD_REQUEST');
  try{return JSON.parse(raw||'{}');}catch{throw new Error('BAD_REQUEST');}
}
function currentView(player,day){
  return {player,world:worldForDay(day),weekKey:weekForDay(day),day,
    goals:[{title:'رویش جنگل',value:player.tree},{title:'بازگرداندن نور',value:player.light}]};
}
async function getPlayer(db,id){return db.prepare(`SELECT ${playerFields} FROM players WHERE id=?`).bind(id).first();}
async function session(env,who,data,day){
  const code=randCode();
  // For Game launches, referral comes from /start delivered via the authenticated bot webhook.
  // Legacy Mini App starts can still use Telegram-signed start_param.
  const pending=await env.DB.prepare('SELECT invite_code FROM pending_invites WHERE player_id=?').bind(who.id).first();
  const requested=String(who.startParam||pending?.invite_code||'').replace(/^ref_/,'');
  const inviter=/^[0-9a-f]{12}$/i.test(requested)?await env.DB.prepare('SELECT id FROM players WHERE invite_code=?').bind(requested).first():null;
  const referrer=inviter?.id===who.id?null:(inviter?.id??null);
  const p=env.DB.prepare('INSERT INTO players (id,alias,invite_code,referrer_id) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(who.id,publicAlias(code),code,referrer);
  const referralGrant=env.DB.prepare("INSERT INTO grants (event_key,beneficiary_id,kind) SELECT 'referral:' || id, referrer_id, 'referral' FROM players WHERE id=? AND referrer_id IS NOT NULL ON CONFLICT(event_key) DO NOTHING").bind(who.id);
  const dailyGrant=env.DB.prepare("INSERT INTO grants (event_key,beneficiary_id,kind) SELECT ?, id, 'daily' FROM players WHERE id=? ON CONFLICT(event_key) DO NOTHING").bind(`daily:${who.id}:${day}`,who.id);
  await env.DB.batch([p,referralGrant,dailyGrant]);
  return currentView(await getPlayer(env.DB,who.id),day);
}
async function play(env,who,data,day){
  const actionId=data?.actionId;
  const pick=data?.element;
  if(!safeAction(actionId)||!ELEMENTS.includes(pick)) throw new Error('BAD_REQUEST');
  const rival=randomElement();
  const world=worldForDay(day);
  const round=resolveRound(pick,rival,world);
  const week=weekForDay(day);
  // Single INSERT ... SELECT checks inventory + deduplicates action; a trigger does the
  // debit and credit in the same atomic statement. An extra win-streak bonus is
  // calculated from the fresh DB row, not a client-submitted value.
  const sql=`INSERT INTO rounds(action_id,player_id,picked,rival,outcome,points,tree_gain,light_gain,weather_key,week_key)
    SELECT ?,id,?,?,?,?+CASE WHEN ?='win' THEN MIN(streak,2) ELSE 0 END,?,?,?,?
    FROM players WHERE id=? AND ${pick}>0 ON CONFLICT(action_id) DO NOTHING`;
  const result=await env.DB.prepare(sql).bind(actionId,pick,rival,round.outcome,round.basePoints,round.outcome,round.tree,round.light,world.key,week,who.id).run();
  const recorded=await env.DB.prepare('SELECT action_id,picked,rival,outcome,points,tree_gain,light_gain,weather_key FROM rounds WHERE action_id=? AND player_id=?').bind(actionId,who.id).first();
  if(!recorded) throw new Error('NO_ELEMENTS');
  const player=await getPlayer(env.DB,who.id);
  if(result?.meta?.changes && recorded.points>0 && who.mode==='game')await postGameScore(env,who,player.score);
  return {...currentView(player,day),round:recorded,replay:result?.meta?.changes===0};
}
async function leaderboard(env,day){
  const week=weekForDay(day);
  const rows=await env.DB.prepare('SELECT alias, weekly_score AS score,tree,light,rounds_played FROM players WHERE week_key=? ORDER BY weekly_score DESC, rounds_played ASC LIMIT 20').bind(week).all();
  return {weekKey:week,players:rows.results||[]};
}

export default {
  async fetch(request,env){
    const cors=corsFor(request,env);
    const url=new URL(request.url);
    const respond=(obj,status=200)=>json(obj,status,cors);
    if(request.method==='OPTIONS'){
      return request.headers.get('Origin')===env.ALLOWED_ORIGIN
        ? new Response(null,{status:204,headers:cors})
        : respond({error:'FORBIDDEN'},403);
    }
    if(request.headers.get('Origin')&&request.headers.get('Origin')!==env.ALLOWED_ORIGIN) return respond({error:'FORBIDDEN'},403);
    if(url.pathname==='/health'&&request.method==='GET') return respond({ok:true,version:'0.2.0-game'});
    if(url.pathname==='/telegram/webhook'){
      if(request.method!=='POST'||!env.TELEGRAM_WEBHOOK_SECRET||!env.BOT_TOKEN||!env.DB)return respond({error:'NOT_CONFIGURED'},503);
      if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.TELEGRAM_WEBHOOK_SECRET)return respond({error:'FORBIDDEN'},403);
      try{
        if(Number(request.headers.get('content-length')||0)>65536)return respond({ok:true});
        const raw=await request.text();if(raw.length>65536)return respond({ok:true});
        const update=JSON.parse(raw);await processTelegramUpdate(update,env);return respond({ok:true});
      }
      catch(error){console.error('Telegram webhook failure',String(error));return respond({error:'INTERNAL'},500);}
    }
    try{
      const day=today();
      if(url.pathname==='/api/leaderboard'&&request.method==='GET')return respond(await leaderboard(env,day));
      if(request.method!=='POST'||!['/api/session','/api/play'].includes(url.pathname))return respond({error:'NOT_FOUND'},404);
      if(!env.BOT_TOKEN||!env.DB||!env.ALLOWED_ORIGIN)throw new Error('SERVER_CONFIG');
      const bearer=request.headers.get('authorization')?.match(/^Bearer ([a-zA-Z0-9_.-]+)$/)?.[1];
      const who=bearer?await verifyGameTicket(bearer,env.BOT_TOKEN):await verifyInitData(request.headers.get('x-telegram-init-data'),env.BOT_TOKEN);
      const data=await bodyOf(request);
      if(url.pathname==='/api/session')return respond(await session(env,who,data,day));
      return respond(await play(env,who,data,day));
    }catch(e){
      const code=String(e?.message||'INTERNAL');
      if(['UNAUTHORIZED','EXPIRED_AUTH'].includes(code)) return respond({error:code},401);
      if(code==='BAD_REQUEST')return respond({error:code},400);
      if(code==='NO_ELEMENTS')return respond({error:code},409);
      if(code==='SERVER_CONFIG')return respond({error:'NOT_CONFIGURED'},503);
      console.error('Elemental API operation failed',code);
      return respond({error:'INTERNAL'},500);
    }
  }
};
