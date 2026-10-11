/** A short-lived, Telegram callback-bound Game ticket. Never accept user IDs from the browser. */
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function unb64(value){
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value)||value.length>4096||value.length%4===1)return null;
  const raw=value.replaceAll('-','+').replaceAll('_','/');
  try{
    const bytes=Uint8Array.from(atob(raw.padEnd(Math.ceil(raw.length/4)*4,'=')),c=>c.charCodeAt(0));
    // Disallow alternate, non-canonical base64url representations of the same MAC.
    // Otherwise changing only unused padding bits can leave a ticket valid.
    return b64(bytes)===value?bytes:null;
  }catch{return null;}
}
async function signature(content, secret){
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode('elemental-game-v1.'+content)));
}
function equals(a,b){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
const validID=id=>typeof id==='string'&&/^\d{1,16}$/.test(id)&&id!=='0';
export async function issueGameTicket({id,chatId,messageId,inlineMessageId},botToken,now=Math.floor(Date.now()/1000)){
  if(!botToken||!validID(String(id))||!((chatId!=null&&Number.isSafeInteger(messageId)&&messageId>0)||inlineMessageId))throw new Error('BAD_LAUNCH');
  const payload={v:1,sub:String(id),iat:now,exp:now+3600,nonce:crypto.randomUUID()};
  if(inlineMessageId){if(typeof inlineMessageId!=='string'||inlineMessageId.length>300)throw new Error('BAD_LAUNCH');payload.inline=inlineMessageId;}
  else{payload.chat=String(chatId);payload.message=messageId;}
  const part=b64(enc.encode(JSON.stringify(payload)));
  return part+'.'+b64(await signature(part,botToken));
}
export async function verifyGameTicket(token,botToken,now=Math.floor(Date.now()/1000)){
  if(!botToken||typeof token!=='string'||token.length>4096)throw new Error('UNAUTHORIZED');
  const parts=token.split('.');
  if(parts.length!==2)throw new Error('UNAUTHORIZED');
  const body=unb64(parts[0]),mac=unb64(parts[1]);
  if(!body||!mac||!equals(await signature(parts[0],botToken),mac))throw new Error('UNAUTHORIZED');
  let p;try{p=JSON.parse(new TextDecoder().decode(body));}catch{throw new Error('UNAUTHORIZED');}
  if(p?.v!==1||!validID(p.sub)||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>now+60||p.exp<now||p.exp-p.iat>3600||!p.nonce||
    !(typeof p.inline==='string'&&p.inline.length>0&&p.inline.length<=300 || typeof p.chat==='string'&&/^-?\d{1,17}$/.test(p.chat)&&Number.isSafeInteger(p.message)&&p.message>0))throw new Error('UNAUTHORIZED');
  return {id:p.sub, gameContext:p, mode:'game'};
}
