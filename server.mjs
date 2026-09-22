import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function createApp(env=process.env){
 let publicOrigin='';
 if(env.PUBLIC_ORIGIN){const u=new URL(env.PUBLIC_ORIGIN);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('PUBLIC_ORIGIN must be an HTTPS origin');publicOrigin=u.origin;}
 if((env.NODE_ENV==='production'||(env.HOST&&!['127.0.0.1','::1','localhost'].includes(env.HOST)))&&!publicOrigin)throw new Error('External hosting requires PUBLIC_ORIGIN and an HTTPS reverse proxy');
 const policy={version:'2026-09-22-v2',operator:env.PRIVACY_OPERATOR||'예두리',contact:env.PRIVACY_CONTACT||'010-5602-5740'};
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
    if(req.method==='GET'&&url.pathname==='/api/delivery/status')return reply(200,{configured:false,policy});
    return reply(410,{message:'서버 문자 발송은 제거되었습니다. 기기의 공유 기능을 이용해 주세요.'});
   }
   if(!['GET','HEAD'].includes(req.method))throw fail(405,'지원하지 않는 요청입니다.');
   let pathname;try{pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);}catch{throw fail(400,'잘못된 경로입니다.');}
   // Only known public entry files and image assets are served, even if a secret is accidentally copied into dist.
   if(!['/index.html','/styles.css','/app.js','/delivery.js','/frames.json','/fonts/nanum-pen.ttf','/fonts/OFL.txt'].includes(pathname)&&!/^\/frames\/[a-zA-Z0-9_-]+\.(svg|png|webp|jpe?g)$/.test(pathname))throw fail(404,'파일이 없습니다.');
   const file=await realpath(path.resolve(root,'.'+pathname));if(!file.startsWith(root+path.sep)||file!==path.resolve(root,'.'+pathname))throw fail(404,'파일이 없습니다.');
   const data=await readFile(file);const mime={'.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){reply(e.code==='ENOENT'?404:e.code>=400&&e.code<600?e.code:500,{message:e.code==='ENOENT'?'파일이 없습니다.':e.code>=400?e.message:'요청 처리에 실패했어요.'});}
 });
 server.maxConnections=64;server.maxRequestsPerSocket=100;server.keepAliveTimeout=5000;
 return server;
}
export function assertRuntime(version=process.versions.node){const [major,minor]=version.split('.').map(Number);if(major!==24||minor<21)throw new Error('Use Node 24.21.0 or a newer patched Node 24 release.');}
if(process.argv[1]===fileURLToPath(import.meta.url)){assertRuntime();createApp().listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('Photo booth server ready'));}
