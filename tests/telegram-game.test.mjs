import test from 'node:test';
import assert from 'node:assert/strict';
import {processTelegramUpdate} from '../worker/src/telegram-bot.js';
import {verifyGameTicket} from '../worker/src/game-ticket.js';
const env={BOT_TOKEN:'123:unit_test_secret',GAME_SHORT_NAME:'elemental',GAME_URL:'https://tgelemental.github.io/Elemental/'};
async function capture(update){
 const previous=globalThis.fetch;const sent=[];
 globalThis.fetch=async(_url,opts)=>{sent.push({path:new URL(_url).pathname.split('/').pop(),data:JSON.parse(opts.body)});return new Response(JSON.stringify({ok:true,result:true}),{status:200,headers:{'content-type':'application/json'}});};
 try{await processTelegramUpdate(update,env);}finally{globalThis.fetch=previous;}
 return sent;
}
test('the bot sends a native Game message rather than a Web App keyboard',async()=>{
 const sent=await capture({message:{text:'/game',chat:{id:887,type:'private'},from:{id:9}}});
 assert.equal(sent.length,1);assert.equal(sent[0].path,'sendGame');assert.deepEqual(sent[0].data,{chat_id:887,game_short_name:'elemental'});
});
test('Telegram callback receives a signed, per-user Game URL',async()=>{
 const sent=await capture({callback_query:{id:'callback42',game_short_name:'elemental',from:{id:729},message:{chat:{id:-10058},message_id:32}}});
 assert.equal(sent.length,1);assert.equal(sent[0].path,'answerCallbackQuery');
 const gameURL=new URL(sent[0].data.url);assert.equal(gameURL.origin,'https://tgelemental.github.io');
 const session=await verifyGameTicket(gameURL.searchParams.get('game_ticket'),env.BOT_TOKEN);
 assert.equal(session.id,'729');assert.equal(session.gameContext.chat,'-10058');assert.equal(session.gameContext.message,32);
 assert.equal(sent[0].data.cache_time,0);
});
test('Telegram inline games preserve their inline message identity',async()=>{
 const sent=await capture({callback_query:{id:'c',game_short_name:'elemental',from:{id:42},inline_message_id:'inline:abc'}});
 const session=await verifyGameTicket(new URL(sent[0].data.url).searchParams.get('game_ticket'),env.BOT_TOKEN);
 assert.equal(session.gameContext.inline,'inline:abc');
});
test('the bot refuses callbacks for unknown game short names',async()=>{
 const sent=await capture({callback_query:{id:'c',game_short_name:'other_game',from:{id:42}}});
 assert.equal(sent[0].path,'answerCallbackQuery');assert.equal(sent[0].data.url,undefined);assert.equal(sent[0].data.show_alert,true);
});
