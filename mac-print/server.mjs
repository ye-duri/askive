import http from 'node:http';
import {printPDF} from './print-pdf.mjs';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync,unlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),root=dirname(fileURLToPath(import.meta.url));
const command=async(file,args)=> (await exec(file,args,{timeout:15000,maxBuffer:1024*1024,env:{...process.env,LC_ALL:'C'}})).stdout;
export function createPrintServer({directory=join(homedir(),'Library/Application Support/YonseiStudioPrint'),run=command,hostName='localhost',port=4178}={}){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const configPath=join(directory,'connection.json');
 const token=existsSync(configPath)?JSON.parse(readFileSync(configPath)).token:randomBytes(24).toString('hex');
 writeFileSync(configPath,JSON.stringify({token}),{mode:0o600});
 const jobs=new Map();
 const save=j=>{const path=join(directory,j.id+'.json');writeFileSync(path+'.tmp',JSON.stringify(j),{mode:0o600});renameSync(path+'.tmp',path);};
 for(const name of readdirSync(directory).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){try{const j=JSON.parse(readFileSync(join(directory,name)));if(j.state==='sending'){j.state='uncertain';j.error='재시작 전 인쇄 전송 결과를 확인해 주세요.';save(j);}jobs.set(j.id,j);}catch{}}
 function cleanup(){for(const [id,j] of jobs)if(Date.now()-j.createdAt>=86400000&&j.state!=='sending'){for(const suffix of ['.jpg','.json','.pdf'])try{unlinkSync(join(directory,id+suffix));}catch{}jobs.delete(id);}}
 cleanup();const cleanupTimer=setInterval(cleanup,60000);cleanupTimer.unref();
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 function auth(req){const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+token);return a.length===b.length&&timingSafeEqual(a,b);}
 async function body(req,max){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('요청 크기가 너무 큽니다.');chunks.push(chunk);}return Buffer.concat(chunks);}
 async function printers(){const out=await run('/usr/bin/lpstat',['-v']);return out.split('\n').flatMap(l=>{const m=(l.match(/^device for ([^:]+): (.+)$/)||l.match(/^(.+?)에 대한 기기: (.+)$/));return m?[{name:m[1],uri:m[2]}]:[];});}
 const server=http.createServer(async(req,res)=>{try{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/health'||path==='/jobs'){
   if(!auth(req))return json(res,401,{error:'Mac 연결 코드를 확인해 주세요.'});
   if(req.headers.origin)return json(res,403,{error:'앱 연결만 허용합니다.'});
   if(path==='/health'&&req.method==='GET')return json(res,200,{name:'연세스튜디오 Mac',version:1});
   if(path!=='/jobs'||req.method!=='POST')return json(res,405,{error:'지원하지 않는 요청'});
   cleanup();const id=req.headers['x-job-id'];if(!/^[a-f0-9]{64}$/.test(id||''))return json(res,400,{error:'사진 식별자가 없습니다.'});
   if(req.headers['content-type']!=='image/jpeg')return json(res,415,{error:'JPEG만 전송할 수 있습니다.'});
   const data=await body(req,8500000);
   if(data[0]!==255||data[1]!==216||data[2]!==255||data.at(-2)!==255||data.at(-1)!==217)return json(res,400,{error:'올바른 JPEG 사진이 아닙니다.'});
   if(createHash('sha256').update(data).digest('hex')!==id)return json(res,400,{error:'사진 전송 무결성 오류'});
   if(jobs.has(id))return json(res,200,{id,state:jobs.get(id).state,received:true});
   if(jobs.size>=100||[...jobs.values()].reduce((n,j)=>n+j.bytes,0)+data.length>300000000)return json(res,507,{error:'Mac 대기 목록이 가득 찼어요. 매니저에게 문의해 주세요.'});
   const j={id,createdAt:Date.now(),bytes:data.length,state:'waiting',copies:1};
   writeFileSync(join(directory,id+'.jpg'),data,{mode:0o600});save(j);jobs.set(id,j);
   return json(res,201,{id,state:j.state,received:true});
  }
  const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const expected='127.0.0.1:'+server.address().port;
  if(!local||req.headers.host!==expected)return json(res,403,{error:'관리 화면은 Mac에서만 열 수 있습니다.'});
  if(req.method!=='GET'&&(req.headers.origin!=='http://'+expected||req.headers['x-yonsei-admin']!=='1'))return json(res,403,{error:'관리 요청을 확인할 수 없습니다.'});
  if(path==='/admin/state'&&req.method==='GET')return json(res,200,{connection:`http://${hostName}:${server.address().port}/#${token}`,jobs:[...jobs.values()].sort((a,b)=>b.createdAt-a.createdAt),printers:await printers()});
  const match=path.match(/^\/admin\/jobs\/([a-f0-9]{64})(?:\/(image|print))?$/);
  if(match){const j=jobs.get(match[1]);if(!j)return json(res,404,{error:'사진이 없거나 만료됐습니다.'});
   if(req.method==='GET'&&match[2]==='image'){res.writeHead(200,{'Content-Type':'image/jpeg'});return res.end(readFileSync(join(directory,j.id+'.jpg')));}
   if(req.method==='POST'&&match[2]==='print'){
    const {printer,copies,scale=95}=JSON.parse((await body(req,2048)).toString());
    if(!Number.isInteger(scale)||scale<85||scale>100)return json(res,400,{error:'인쇄 배율은 85~100%입니다.'});
    if(!Number.isInteger(copies)||copies<1||copies>10)return json(res,400,{error:'매수는 1~10장입니다.'});
    if(!(await printers()).some(p=>p.name===printer))return json(res,400,{error:'등록된 프린터를 선택해 주세요.'});
    const options=await run('/usr/bin/lpoptions',['-p',printer,'-l']);
    if(!options.includes('Postcard.Fullbleed'))return json(res,400,{error:'엽서 무테 용지를 지원하는 CP1500을 선택해 주세요.'});
    if(j.state!=='waiting')return json(res,409,{error:'이미 전송한 작업입니다. Mac 인쇄 센터에서 확인해 주세요.'});
    const pdfPath=join(directory,j.id+'.pdf');writeFileSync(pdfPath,printPDF(readFileSync(join(directory,j.id+'.jpg')),scale),{mode:0o600});
    j.state='sending';j.copies=copies;j.scale=scale;j.printer=printer;save(j);
    try{const out=await run('/usr/bin/lp',['-d',printer,'-n',String(copies),'-t','Yonsei '+j.id.slice(0,8),'-o','media=Postcard.Fullbleed','-o','print-scaling=none','-o','job-sheets=none',pdfPath]);j.state='submitted';j.cupsJob=out.trim();}
    catch{j.state='uncertain';j.error='전송 결과를 확인하지 못했어요. 중복 인쇄를 막기 위해 Mac 인쇄 센터에서 먼저 확인해 주세요.';}
    save(j);return json(res,200,j);
   }
   if(req.method==='DELETE'&&!match[2]){if(j.state==='sending')return json(res,409,{error:'전송 중에는 지울 수 없습니다.'});for(const suffix of ['.jpg','.json','.pdf'])try{unlinkSync(join(directory,j.id+suffix));}catch{}jobs.delete(j.id);return json(res,200,{deleted:true});}
  }
  if(req.method==='GET'&&['/','/admin.js','/admin.css'].includes(path)){res.setHeader('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'; base-uri 'none'");res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html; charset=utf-8');return res.end(readFileSync(join(root,'public',path==='/'?'index.html':path.slice(1))));}
  json(res,404,{error:'없는 경로'});
 }catch(e){json(res,400,{error:e.message||'요청 처리 실패'});}});
 server.on('close',()=>clearInterval(cleanupTimer));return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const hostName=(await command('/usr/sbin/scutil',['--get','LocalHostName'])).trim()+'.local';
 const server=createPrintServer({hostName});server.listen(4178,'0.0.0.0',()=>console.log('관리 화면: http://127.0.0.1:4178'));
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'이미 실행 중입니다. http://127.0.0.1:4178 을 여세요.':e.message);process.exitCode=1;});
}
