import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueGameTicket,verifyGameTicket} from '../worker/src/game-ticket.js';
import {parseBotCommand} from '../worker/src/telegram-bot.js';
const token='12345:unit_test_secret';
test('game tickets verify user and message context',async()=>{
 const ticket=await issueGameTicket({id:208627,chatId:-100123,messageId:88},token,1000);
 const user=await verifyGameTicket(ticket,token,1010);
 assert.equal(user.id,'208627');assert.equal(user.gameContext.chat,'-100123');assert.equal(user.gameContext.message,88);
});
test('game tickets verify inline context',async()=>{
 const ticket=await issueGameTicket({id:128,inlineMessageId:'abc_def'},token,1000);
 assert.equal((await verifyGameTicket(ticket,token,1100)).gameContext.inline,'abc_def');
});
test('game ticket cannot be forged or reused indefinitely',async()=>{
 const t=await issueGameTicket({id:128,chatId:1,messageId:2},token,1000);
 await assert.rejects(()=>verifyGameTicket(t.slice(0,-1)+(t.endsWith('A')?'B':'A'),token,1010),/UNAUTHORIZED/);
 await assert.rejects(()=>verifyGameTicket(t,'different-secret',1010),/UNAUTHORIZED/);
 await assert.rejects(()=>verifyGameTicket(t,token,4601),/UNAUTHORIZED/);
});
test('game ticket does not accept invalid Telegram callback context',async()=>{
 await assert.rejects(()=>issueGameTicket({id:128,chatId:1},token,1000),/BAD_LAUNCH/);
 await assert.rejects(()=>issueGameTicket({id:'abc',inlineMessageId:'test'},token,1000),/BAD_LAUNCH/);
});
test('bot command parsing recognizes start, game and help',()=>{
 assert.deepEqual(parseBotCommand('/start ref_ab1234cd5678'),['start','ref_ab1234cd5678']);
 assert.deepEqual(parseBotCommand('/game@elementalgamebot'),['game',undefined]);
 assert.equal(parseBotCommand('/random'),null);
});
