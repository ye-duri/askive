import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function jpegSize(b){
 if(b[0]!==255||b[1]!==216)throw fail(400,'JPEG 사진만 발송할 수 있어요.');
 let p=2;while(p+8<b.length){if(b[p++]!==255)break;const m=b[p++];if(m===218||m===217)break;const n=b.readUInt16BE(p);if(n<2||p+n>b.length)break;if([192,193,194].includes(m))return {h:b.readUInt16BE(p+3),w:b.readUInt16BE(p+5)};p+=n;}
 throw fail(400,'사진 파일을 확인해 주세요.');
}
export function createApp(env=process.env,fetcher=fetch){
 const hourlyLimit=Number(env.MMS_HOURLY_LIMIT||100);
 if(!Number.isInteger(hourlyLimit)||hourlyLimit<1||hourlyLimit>1000)throw new Error('MMS_HOURLY_LIMIT must be an integer from 1 to 1000');
 let publicOrigin='';
 if(env.PUBLIC_ORIGIN){const u=new URL(env.PUBLIC_ORIGIN);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('PUBLIC_ORIGIN must be an HTTPS origin');publicOrigin=u.origin;}
 if((env.NODE_ENV==='production'||(env.HOST&&!['127.0.0.1','::1','localhost'].includes(env.HOST)))&&!publicOrigin)throw new Error('External hosting requires PUBLIC_ORIGIN and an HTTPS reverse proxy');
 const policy={version:'2026-09-21-v1',operator:env.PRIVACY_OPERATOR||'연세중앙교회',contact:env.PRIVACY_CONTACT||'',historyRetention:env.MMS_HISTORY_RETENTION||''};
 const ready=!!(env.ENABLE_SENS_MMS==='true'&&policy.operator&&policy.contact&&policy.historyRetention&&env.SENS_SERVICE_ID&&env.NCP_ACCESS_KEY&&env.NCP_SECRET_KEY&&/^\d{8,11}$/.test(env.SENS_FROM||'')&&(env.KIOSK_PASSWORD||'').length>=12);
 const sessions=new Map(), jobs=new Map();let authAttempts=[], sends=[];
 async function provider(endpoint,body){
  const uri=`/sms/v2/services/${encodeURIComponent(env.SENS_SERVICE_ID)}/${endpoint}`, timestamp=String(Date.now());
  const signature=createHmac('sha256',env.NCP_SECRET_KEY).update(`POST ${uri}\n${timestamp}\n${env.NCP_ACCESS_KEY}`).digest('base64');
  const r=await fetcher(`https://sens.apigw.ntruss.com${uri}`,{method:'POST',headers:{'Content-Type':'application/json','x-ncp-apigw-timestamp':timestamp,'x-ncp-iam-access-key':env.NCP_ACCESS_KEY,'x-ncp-apigw-signature-v2':signature},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw fail(502,'발송 서비스에서 요청을 처리하지 못했어요. 운영자에게 알려 주세요.');return r.json();
 }
 const server=http.createServer({maxHeaderSize:8192,requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if(publicOrigin)res.setHeader('Strict-Transport-Security','max-age=31536000');
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const allowedHosts=publicOrigin?[new URL(publicOrigin).host]:['127.0.0.1','localhost','[::1]'].map(h=>`${h}:${req.socket.localPort}`);
   if(!allowedHosts.includes(req.headers.host))throw fail(403,'허용되지 않은 호스트입니다.');
   const url=new URL(req.url,'http://localhost');
   if(url.pathname.startsWith('/api/')){
    const now=Date.now();for(const [k,v] of sessions)if(v<now)sessions.delete(k);
    for(const [k,v] of jobs)if(v.expires<now)jobs.delete(k);
    if(req.method==='GET'&&url.pathname==='/api/delivery/status')return reply(200,{configured:ready,policy});
    if(req.method!=='POST')throw fail(405,'지원하지 않는 요청입니다.');
    if(!ready)throw fail(503,'문자 발송 서비스가 아직 연결되지 않았어요. 운영자에게 알려 주세요.');
    if(!req.headers['content-type']?.startsWith('application/json'))throw fail(415,'JSON 요청이 필요합니다.');
    if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==(publicOrigin||`http://${req.headers.host}`)))throw fail(403,'요청 출처를 확인해 주세요.');
    const unlock=url.pathname==='/api/delivery/unlock';
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!unlock&&!sessions.has(token))throw fail(401,'운영자가 발송 기능을 활성화해 주세요.');
    if(!unlock&&url.pathname!=='/api/delivery/send')throw fail(404,'없는 요청입니다.');
    // Bound login attempts before consuming the body; never trust forwarded IP headers.
    if(unlock){authAttempts=authAttempts.filter(t=>now-t<600000);if(authAttempts.length>=10)throw fail(429,'10분 후 활성화를 다시 시도해 주세요.');authAttempts.push(now);}
    const maxBody=unlock?2048:420000;
    if(Number(req.headers['content-length'])>maxBody)throw fail(413,'요청 용량이 너무 커요.');
    req.setTimeout(10000,()=>req.destroy());
    let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>maxBody)throw fail(413,'사진 용량이 너무 커요.');chunks.push(c);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail(400,'요청을 확인해 주세요.');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'JSON 객체가 필요합니다.');
    if(unlock){
     if(typeof body.password!=='string'||body.password.length>256)throw fail(400,'비밀번호 형식을 확인해 주세요.');
     const a=Buffer.from(String(body.password||'')),b=Buffer.from(env.KIOSK_PASSWORD);
     if(a.length!==b.length||!timingSafeEqual(a,b))throw fail(403,'운영자 비밀번호가 맞지 않아요.');
     const token=randomBytes(32).toString('hex');sessions.set(token,now+12*3600000);return reply(200,{token});
    }
    const {phone,image,id,consent}=body;
    if(typeof phone!=='string'||typeof id!=='string'||!/^010\d{8}$/.test(phone||'')||consent!==true||body.policyVersion!==policy.version||!/^[-a-zA-Z0-9]{16,80}$/.test(id||''))throw fail(400,'휴대폰 번호와 전송 동의를 확인해 주세요.');
    const key=`${token}:${id}`;
    if(jobs.has(key)){const job=jobs.get(key);return reply(job.code,job.result);}
    if(typeof image!=='string'||image.length>400000||image.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))throw fail(400,'사진을 확인해 주세요.');
    const bytes=Buffer.from(image,'base64');if(bytes.length>300000)throw fail(413,'사진 용량이 너무 커요.');const dims=jpegSize(bytes);if(!dims.w||!dims.h||dims.w>1500||dims.h>1440)throw fail(400,'사진 크기가 너무 커요.');
    sends=sends.filter(t=>now-t<3600000);if(sends.filter(t=>now-t<60000).length>=10||sends.length>=hourlyLimit)throw fail(429,'발송 한도에 도달했어요. 잠시 후 시도해 주세요.');sends.push(now);
    const job={expires:now+24*3600000,code:409,result:{message:'이미 처리 중인 요청이에요. 잠시 후 확인해 주세요.'}};jobs.set(key,job);
    try{
     const file=await provider('files',{fileName:`${randomUUID().replaceAll('-','')}.jpg`,fileBody:image});if(!file.fileId)throw new Error('file');
     const sent=await provider('messages',{type:'MMS',contentType:'COMM',countryCode:'82',from:env.SENS_FROM,subject:'포토부스 사진',content:'행사에서 촬영한 사진을 보내드립니다.',messages:[{to:phone}],files:[{fileId:file.fileId}]});
     if(String(sent.statusCode)!=='202'||!sent.requestId)throw new Error('send');
     job.code=202;job.result={accepted:true,requestId:sent.requestId,message:'발송 요청이 접수됐어요. 문자 수신까지 잠시 기다려 주세요.'};
    }catch{job.code=502;job.result={message:'접수 여부를 확인하지 못했어요. 중복 발송을 막기 위해 재발송하지 말고 운영자에게 알려 주세요.'};}
    return reply(job.code,job.result);
   }
   if(!['GET','HEAD'].includes(req.method))throw fail(405,'지원하지 않는 요청입니다.');
   let pathname;try{pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);}catch{throw fail(400,'잘못된 경로입니다.');}
   // Only known public entry files and image assets are served, even if a secret is accidentally copied into dist.
   if(!['/index.html','/styles.css','/app.js','/delivery.js','/frames.json','/fonts/nanum-pen.ttf','/fonts/OFL.txt'].includes(pathname)&&!/^\/frames\/[a-zA-Z0-9_-]+\.(svg|png|webp|jpe?g)$/.test(pathname))throw fail(404,'파일이 없습니다.');
   const file=await realpath(path.resolve(root,'.'+pathname));if(!file.startsWith(root+path.sep))throw fail(404,'파일이 없습니다.');
   const data=await readFile(file);const mime={'.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){reply(e.code==='ENOENT'?404:e.code>=400&&e.code<600?e.code:500,{message:e.code==='ENOENT'?'파일이 없습니다.':e.code>=400?e.message:'요청 처리에 실패했어요.'});}
 });
 server.maxConnections=64;server.maxRequestsPerSocket=100;server.keepAliveTimeout=5000;
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url))createApp().listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('Photo booth server ready'));
