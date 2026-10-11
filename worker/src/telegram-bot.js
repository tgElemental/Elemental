import {issueGameTicket} from './game-ticket.js';

const standardGameURL='https://tgelemental.github.io/Elemental/';
function gameURL(env){const value=env.GAME_URL||standardGameURL;const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw new Error('SERVER_CONFIG');return u;}
export function parseBotCommand(text){return String(text||'').trim().match(/^\/(start|game|help)(?:@[\w_]+)?(?:\s+(.+))?$/i)?.slice(1)||null;}
export async function telegramAPI(env,method,params){
  if(!env.BOT_TOKEN)throw new Error('SERVER_CONFIG');
  const res=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(params)});
  let result;try{result=await res.json();}catch{throw new Error('TELEGRAM_API');}
  if(!res.ok||!result?.ok)throw new Error(`TELEGRAM_API_${result?.error_code||res.status}`);
  return result.result;
}
export async function processTelegramUpdate(update,env){
  const message=update?.message;
  if(message){
    const match=parseBotCommand(message.text);
    if(!match)return;
    if(match[0].toLowerCase()==='help'){
      await telegramAPI(env,'sendMessage',{chat_id:message.chat.id,text:'عناصر: آب بر آتش، آتش بر خاک، خاک بر باد و باد بر آب پیروز می‌شود. پنج کارت از هر نیرو هر روز هدیه می‌گیری. با /game بازی را آغاز کن.'});return;
    }
    if(match[0].toLowerCase()==='start'&&match[1]?.startsWith('ref_')&&/^ref_[0-9a-f]{12}$/i.test(match[1])&&message.chat.type==='private'){
      // Claiming a referral does not credit anyone until their first authenticated game session.
      await env.DB.prepare('INSERT INTO pending_invites(player_id,invite_code) VALUES (?,?) ON CONFLICT(player_id) DO NOTHING').bind(String(message.from.id),match[1].slice(4)).run();
    }
    await telegramAPI(env,'sendGame',{chat_id:message.chat.id,game_short_name:env.GAME_SHORT_NAME||'elemental'});
    return;
  }
  const query=update?.callback_query;
  if(!query?.game_short_name)return;
  if(query.game_short_name!==(env.GAME_SHORT_NAME||'elemental')){
    await telegramAPI(env,'answerCallbackQuery',{callback_query_id:query.id,text:'بازی درخواستی شناسایی نشد.',show_alert:true});return;
  }
  const context=query.inline_message_id?{id:query.from.id,inlineMessageId:query.inline_message_id}:
    {id:query.from.id,chatId:query.message?.chat?.id,messageId:query.message?.message_id};
  const ticket=await issueGameTicket(context,env.BOT_TOKEN);
  const url=gameURL(env);url.searchParams.set('game_ticket',ticket);
  await telegramAPI(env,'answerCallbackQuery',{callback_query_id:query.id,url:url.toString(),cache_time:0});
}
export async function postGameScore(env,who,score){
  const ctx=who.gameContext;
  if(!ctx||!Number.isSafeInteger(score)||score<0||score>2147483647)return;
  const args={user_id:Number(who.id),score};
  if(ctx.inline){args.inline_message_id=ctx.inline;}else{args.chat_id=ctx.chat;args.message_id=ctx.message;}
  try{await telegramAPI(env,'setGameScore',args);}catch(err){
    // Gameplay is already committed. Bot API outages must not reverse earned resources.
    console.error('Telegram score sync failed',String(err));
  }
}
