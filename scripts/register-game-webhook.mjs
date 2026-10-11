#!/usr/bin/env node
/** Manually enroll Telegram webhook with an owner-controlled bot token; no secrets in GitHub. */
const url=process.env.ELEMENTAL_API_BASE;
const token=process.env.BOT_TOKEN;
const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
if(!token||!secret||!/^[A-Za-z0-9_-]{1,256}$/.test(secret)||!url){
 console.error('Set BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and ELEMENTAL_API_BASE in your local shell.');process.exit(1);
}
const target=new URL(url);
if(target.protocol!=='https:'||target.pathname!=='/'||target.search||target.hash||target.username||target.password){console.error('ELEMENTAL_API_BASE must be an HTTPS origin');process.exit(1);}
const endpoint=`https://api.telegram.org/bot${token}/setWebhook`;
const resp=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:target.origin+'/telegram/webhook',secret_token:secret,drop_pending_updates:false,allowed_updates:['message','callback_query']})});
const data=await resp.json();if(!resp.ok||!data.ok){console.error('Telegram rejected setWebhook:',data.description||resp.status);process.exit(1);}console.log('Telegram Game webhook is registered:',target.origin+'/telegram/webhook');
