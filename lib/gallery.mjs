// Shared Node / Cloudflare API. Objects are private; only opaque album links can read them.
const TTL=86400000, MAX=12*1024*1024;
const enc=new TextEncoder();
const hex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(24)));
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;let v=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)v|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return v===0;};
async function sign(s,key){const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(s))));}
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json',...extra}});
async function limitedBody(req,max=MAX){const reader=req.body?.getReader();if(!reader)return new Uint8Array();const parts=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new Error('SIZE');}parts.push(value);}const b=new Uint8Array(total);let i=0;for(const p of parts){b.set(p,i);i+=p.length;}return b;}
async function authorized(req,key){const value=req.headers.get('cookie')?.match(/(?:^|;\s*)ys_kiosk=([^;]+)/)?.[1]||'';const [exp,signature]=value.split('.');return /^\d+$/.test(exp||'')&&Number(exp)>Date.now()&&Number(exp)<=Date.now()+TTL&&equal(signature,await sign(exp,key));}
export async function deleteAlbum(bucket,id){await bucket.delete([`${id}/meta`,...Array.from({length:9},(_,i)=>`${id}/${i}`)]);}
export async function cleanup(bucket,now=Date.now()){
 let cursor;do{const page=await bucket.list({limit:1000,cursor,include:['customMetadata']});const dead=page.objects.filter(o=>Number(o.customMetadata?.expiresAt)<=now).map(o=>o.key);if(dead.length)await bucket.delete(dead);cursor=page.truncated?page.cursor:undefined;}while(cursor);
}
export async function gallery(req,env){
 const url=new URL(req.url),path=url.pathname;
 const configured=env.CLEANUP_ENABLED==='1'&&!!env.PHOTOS&&typeof env.KIOSK_SECRET==='string'&&env.KIOSK_SECRET.length>=32;
 if(path==='/api/gallery/config'){
  let lastCleanupAt=null;
  if(env.CLEANUP_HEALTH==='1'&&env.PHOTOS){try{const health=await env.PHOTOS.get('_system/cleanup-health');if(health)lastCleanupAt=JSON.parse(await health.text()).lastSuccessAt;}catch{}}
  return reply({configured,authorized:configured&&await authorized(req,env.KIOSK_SECRET),retentionHours:24,lastCleanupAt});
 }
 if(!configured)return reply({error:'QR 저장소 연결 전입니다.'},503);
 if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==url.origin)return reply({error:'허용되지 않은 요청입니다.'},403);
 try{
  if(path==='/api/gallery/unlock'&&req.method==='POST'){
   const data=JSON.parse(new TextDecoder().decode(await limitedBody(req,1024)));if(!equal(data.code,env.KIOSK_SECRET))return reply({error:'운영 코드를 확인해 주세요.'},403);
   const exp=String(Date.now()+TTL),cookie=`ys_kiosk=${exp}.${await sign(exp,env.KIOSK_SECRET)}; HttpOnly; SameSite=Strict; Path=/api/gallery; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`;
   return reply({ok:true},200,{'Set-Cookie':cookie});
  }
  const admin=await authorized(req,env.KIOSK_SECRET);
  if(path==='/api/gallery/albums'&&req.method==='POST'){
   if(!admin)return reply({error:'행사 기기 연결이 필요합니다.'},401);
   const consent=JSON.parse(new TextDecoder().decode(await limitedBody(req,1024))||'{}');
   if(consent.consent!==true||consent.policyVersion!=='2026-09-26-qr-v1')return reply({error:'QR 사진 보관에 동의해 주세요.'},400);
   const id=random(),expiresAt=Date.now()+TTL;
   await env.PHOTOS.put(`${id}/meta`,JSON.stringify({expiresAt,ready:false,consent:true,policyVersion:consent.policyVersion,consentedAt:Date.now()}),{customMetadata:{expiresAt:String(expiresAt)}});
   return reply({id,expiresAt},201);
  }
  const m=path.match(/^\/api\/gallery\/albums\/([a-f0-9]{48})(?:\/([0-8]))?$/);
  if(!m)return reply({error:'없는 경로입니다.'},404);
  const [,id,index]=m,metaObject=await env.PHOTOS.get(`${id}/meta`);
  if(!metaObject)return reply({error:'만료되었거나 삭제된 앨범입니다.'},404);
  const meta=JSON.parse(await metaObject.text());
  if(Date.now()>=meta.expiresAt){await deleteAlbum(env.PHOTOS,id);return reply({error:'24시간이 지나 만료되었습니다.'},410);}
  if(req.method==='DELETE'&&!index){if(!admin)return reply({error:'행사 기기 연결이 필요합니다.'},401);await deleteAlbum(env.PHOTOS,id);return reply({ok:true});}
  if(req.method==='PUT'&&index===undefined){
   if(meta.consent!==true)return reply({error:'QR 사진 보관에 동의해 주세요.'},400);
   if(!admin)return reply({error:'행사 기기 연결이 필요합니다.'},401);
   const body=await limitedBody(req);const form=await new Response(body,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
   if([...form.keys()].length!==9)return reply({error:'사진은 8장과 완성본 1장이 필요합니다.'},400);
   const files=[];
   for(let i=0;i<9;i++){
    const file=form.get(String(i));if(!file||typeof file.arrayBuffer!=='function'||file.size>3*1024*1024||!['image/jpeg','image/png'].includes(file.type))return reply({error:'사진 형식이나 크기가 올바르지 않습니다.'},400);
    const bytes=new Uint8Array(await file.arrayBuffer());const png=[137,80,78,71,13,10,26,10].every((n,j)=>bytes[j]===n);const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if((file.type==='image/png'&&!png)||(file.type==='image/jpeg'&&!jpeg))return reply({error:'사진 파일을 확인해 주세요.'},400);files.push({bytes,type:file.type});
   }
   // Validate all files before any write. Hide partial updates until all writes succeed.
   await env.PHOTOS.put(`${id}/meta`,JSON.stringify({...meta,ready:false}),{customMetadata:{expiresAt:String(meta.expiresAt)}});
   for(let i=0;i<9;i++)await env.PHOTOS.put(`${id}/${i}`,files[i].bytes,{httpMetadata:{contentType:files[i].type},customMetadata:{expiresAt:String(meta.expiresAt)}});
   await env.PHOTOS.put(`${id}/meta`,JSON.stringify({...meta,ready:true}),{customMetadata:{expiresAt:String(meta.expiresAt)}});
   return reply({ok:true,expiresAt:meta.expiresAt});
  }
  if(req.method!=='GET')return reply({error:'지원하지 않는 요청입니다.'},405);
  if(!meta.ready)return reply({error:'사진을 준비하고 있습니다.'},409);
  if(index===undefined)return reply({expiresAt:meta.expiresAt,count:9});
  const obj=await env.PHOTOS.get(`${id}/${index}`);if(!obj)return reply({error:'사진이 없습니다.'},404);
  return new Response(obj.body,{headers:{...headers,'Content-Type':obj.httpMetadata.contentType,'Content-Disposition':`inline; filename="yonsei-${index}.${obj.httpMetadata.contentType==='image/png'?'png':'jpg'}"`}});
 }catch(e){return reply({error:e.message==='SIZE'?'사진 용량이 너무 큽니다.':'요청을 처리하지 못했어요. 다시 시도해 주세요.'},e.message==='SIZE'?413:400);}
}
