/** Telegram Mini App HMAC validation, not initDataUnsafe trust. */
const encoder = new TextEncoder();
function fromHex(s) {
  if (!/^[0-9a-f]{64}$/i.test(s)) return null;
  return Uint8Array.from(s.match(/../g).map(x => parseInt(x,16)));
}
function safeEqual(a,b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff=0;
  for(let i=0;i<a.length;i++) diff |= a[i]^b[i];
  return diff===0;
}
async function hmac(key, message) {
  const imported=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',imported,encoder.encode(message)));
}
export async function verifyInitData(raw, token, now=Math.floor(Date.now()/1000)) {
  if (!raw || typeof raw !== 'string' || raw.length>4096 || !token) throw new Error('UNAUTHORIZED');
  const p=new URLSearchParams(raw);
  const hash=p.get('hash');
  if(p.getAll('hash').length!==1 || !hash) throw new Error('UNAUTHORIZED');
  const expected=fromHex(hash);
  const authDate=Number(p.get('auth_date'));
  if(p.getAll('auth_date').length!==1 || !Number.isSafeInteger(authDate) || authDate>now+60 || now-authDate>3600) throw new Error('EXPIRED_AUTH');
  if([...p.keys()].some(k=>p.getAll(k).length!==1)) throw new Error('UNAUTHORIZED');
  const check=[...p.entries()].filter(([k])=>k!=='hash' && k!=='signature').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=await hmac(encoder.encode('WebAppData'),token);
  const signature=await hmac(secret,check);
  if(!safeEqual(signature,expected)) throw new Error('UNAUTHORIZED');
  let user;
  try{user=JSON.parse(p.get('user')||'');}catch{throw new Error('UNAUTHORIZED');}
  if(!Number.isSafeInteger(user?.id) || user.id<=0) throw new Error('UNAUTHORIZED');
  return {id:String(user.id),firstName:String(user.first_name??'').slice(0,70),startParam:p.get('start_param')||''};
}
