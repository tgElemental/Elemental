import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyInitData} from '../worker/src/auth.js';
const encode=new TextEncoder();
async function hmac(key,msg){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,encode.encode(msg)));}
async function build(now){
  const fields=new URLSearchParams({auth_date:String(now),query_id:'test',user:JSON.stringify({id:456,first_name:'Ava'})});
  const key=await hmac(encode.encode('WebAppData'),'1234:test-secret');
  const data=[...fields.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const digest=await hmac(key,data);fields.set('hash',[...digest].map(x=>x.toString(16).padStart(2,'0')).join(''));
  return fields.toString();
}
test('Telegram initData accepted only with valid secret/HMAC/time',async()=>{
  const now=1_780_000_000;const data=await build(now);
  assert.deepEqual(await verifyInitData(data,'1234:test-secret',now),{id:'456',firstName:'Ava',startParam:''});
  await assert.rejects(verifyInitData(data,'wrong',now),/UNAUTHORIZED/);
  await assert.rejects(verifyInitData(data,'1234:test-secret',now+4000),/EXPIRED_AUTH/);
  await assert.rejects(verifyInitData(data.replace('Ava','Eve'),'1234:test-secret',now),/UNAUTHORIZED/);
});
