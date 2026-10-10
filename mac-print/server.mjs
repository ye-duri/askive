import {startPrinterRelay} from './relay.mjs';
import http from 'node:http';
import {printPDF} from './print-pdf.mjs';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync,unlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),root=dirname(fileURLToPath(import.meta.url));
const command=async(file,args)=> (await exec(file,args,{timeout:15000,maxBuffer:1024*1024,env:{...process.env,LC_ALL:'C'}})).stdout;
export function createPrintServer({directory=join(homedir(),'Library/Application Support/YonseiStudioPrint'),run=command,hostName='localhost',port=4178}={}){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const configPath=join(directory,'connection.json');
 const token=existsSync(configPath)?JSON.parse(readFileSync(configPath)).token:randomBytes(24).toString('hex');
 writeFileSync(configPath,JSON.stringify({token}),{mode:0o600});
 const jobs=new Map(),pairings=new Map();
 const cloudPath=join(directory,'cloud.json');
 let cloudConfig=existsSync(cloudPath)?JSON.parse(readFileSync(cloudPath)):null,cloudBusy=false;
 let cloudStatus=cloudConfig?'클라우드 연결 확인 중':'운영 코드로 클라우드 인쇄를 연결해 주세요.';
 const cloudRequest=async(path,method='GET',config=cloudConfig)=>{
  const response=await fetch('https://askive.pages.dev/api/gallery/print-jobs'+path,{method,headers:{Authorization:'Bearer '+config.code,'X-Print-Client':config.client},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('클라우드 응답 '+response.status);return response;
 };
 async function receiveCloud(){
  if(!cloudConfig||existsSync(join(directory,'relay.json'))||cloudBusy)return;cloudBusy=true;
  try{const {jobs:pending}=await (await cloudRequest('')).json();
   for(const remote of pending){if(!/^[a-f0-9]{48}$/.test(remote.id))continue;
    const known=[...jobs.values()].find(j=>j.cloudId===remote.id);
    await cloudRequest('/'+remote.id+'/claim','POST');
    if(!known){
     if(jobs.size>=100||[...jobs.values()].reduce((n,j)=>n+j.bytes,0)>290000000)throw new Error('인쇄 대기 목록이 가득 찼습니다.');
     const response=await cloudRequest('/'+remote.id+'/image');const reader=response.body.getReader();let total=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>8500000){await reader.cancel();throw new Error('인쇄 사진이 너무 큽니다.');}chunks.push(Buffer.from(value));}const data=Buffer.concat(chunks);
     printPDF(data,94); // Validate a complete JPEG before accepting it into the local queue.
     const id=createHash('sha256').update(data).digest('hex');
     if(!jobs.has(id)){const j={id,cloudId:remote.id,createdAt:remote.createdAt,bytes:data.length,state:'waiting',copies:1};writeFileSync(join(directory,id+'.jpg'),data,{mode:0o600});save(j);jobs.set(id,j);}
    }
    await cloudRequest('/'+remote.id+'/received','POST');
   }
   cloudStatus='클라우드 연결됨 · 인쇄 사진 자동 수신 중';
  }catch{cloudStatus='클라우드 수신 실패 · 인터넷과 운영 코드를 확인해 주세요.';}
  finally{cloudBusy=false;}
 }
 const cloudTimer=setInterval(()=>void receiveCloud(),5000);cloudTimer.unref();void receiveCloud();

 const prunePairings=()=>{for(const [id,p] of pairings)if(p.expiresAt<Date.now())pairings.delete(id);};
 const save=j=>{const path=join(directory,j.id+'.json');writeFileSync(path+'.tmp',JSON.stringify(j),{mode:0o600});renameSync(path+'.tmp',path);};
 for(const name of readdirSync(directory).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){try{const j=JSON.parse(readFileSync(join(directory,name)));if(j.state==='sending'){j.state='uncertain';j.error='재시작 전 인쇄 전송 결과를 확인해 주세요.';save(j);}jobs.set(j.id,j);}catch{}}
 function cleanup(){for(const [id,j] of jobs)if(Date.now()-j.createdAt>=86400000&&j.state!=='sending'){for(const suffix of ['.jpg','.json','.pdf'])try{unlinkSync(join(directory,id+suffix));}catch{}jobs.delete(id);}}
 cleanup();const cleanupTimer=setInterval(cleanup,60000);cleanupTimer.unref();
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 function auth(req){const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+token);return a.length===b.length&&timingSafeEqual(a,b);}
 async function body(req,max){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('요청 크기가 너무 큽니다.');chunks.push(chunk);}return Buffer.concat(chunks);}
 async function printers(){const out=await run('/usr/bin/lpstat',['-v']);return out.split('\n').flatMap(l=>{const m=(l.match(/^device for ([^:]+): (.+)$/)||l.match(/^(.+?)에 대한 기기: (.+)$/));return m?[{name:m[1],uri:m[2]}]:[];});}

 async function dashboardSession(req,res){
    const {ticket}=JSON.parse((await body(req,1024)).toString());if(typeof ticket!=='string'||ticket.length>256)return json(res,401,{error:'로그인을 다시 확인해 주세요.'});
    try{const verified=await fetch('https://askive.pages.dev/api/gallery/print-ticket/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket}),signal:AbortSignal.timeout(15000)});if(!verified.ok||(await verified.json()).ok!==true)return json(res,401,{error:'인쇄관리 로그인이 필요합니다.'});}catch{return json(res,503,{error:'인쇄 연결 인증을 확인하지 못했습니다. 인터넷을 확인해 주세요.'});}
    return json(res,200,{token});
 }
 const server=http.createServer(async(req,res)=>{try{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/pair'||path.startsWith('/pair/')){
   if(req.headers.origin)return json(res,403,{error:'앱 연결만 허용합니다.'});
   prunePairings();
   if(path==='/pair'&&req.method==='POST'){
    if(pairings.size>=10)return json(res,429,{error:'연결 요청이 많아요. 잠시 후 다시 시도해 주세요.'});
    const input=JSON.parse((await body(req,512)).toString());
    const id=randomBytes(16).toString('hex'),secret=randomBytes(24).toString('hex');
    const p={id,secret,name:String(input.name||'iPad').replace(/[\x00-\x1f]/g,'').slice(0,60),code:String(randomBytes(4).readUInt32BE()%1000000).padStart(6,'0'),state:'pending',expiresAt:Date.now()+120000};
    pairings.set(id,p);return json(res,201,{id,secret,code:p.code});
   }
   const id=path.slice(6),p=pairings.get(id);
   if(!p||req.headers.authorization!=='Bearer '+p.secret)return json(res,404,{error:'연결 요청이 만료됐어요. 다시 선택해 주세요.'});
   if(req.method!=='GET')return json(res,405,{error:'지원하지 않는 요청'});
   return json(res,200,{state:p.state,...(p.state==='approved'?{token}:{})});
  }
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
  const cloudOrigin='https://askive.pages.dev';
  const cloud=req.headers.origin===cloudOrigin;
  if(local&&req.headers.host===expected&&cloud&&path.startsWith('/admin/')){
   res.setHeader('Access-Control-Allow-Origin',cloudOrigin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Yonsei-Admin');res.setHeader('Access-Control-Allow-Private-Network','true');res.writeHead(204);return res.end();}
   if(path==='/admin/session'&&req.method==='POST')return dashboardSession(req,res);
   if(!auth(req))return json(res,401,{error:'Mac 연결 코드를 다시 입력해 주세요.'});
  }
  if(!local||req.headers.host!==expected)return json(res,403,{error:'관리 화면은 Mac에서만 열 수 있습니다.'});
  if(req.method!=='GET'&&!cloud&&(req.headers.origin!=='http://'+expected||(req.headers['x-yonsei-admin']!=='1'&&!path.startsWith('/api/gallery/'))))return json(res,403,{error:'관리 요청을 확인할 수 없습니다.'});
  if(path==='/admin/session'&&req.method==='POST')return dashboardSession(req,res);
  if(path.startsWith('/api/gallery/')){
   const allowed=/^\/api\/gallery\/(?:config|print-login|print-logout|print-ticket|printer-relay\/(?:devices|submit)|web-print(?:\/[a-f0-9]{48}\/(?:image|state))?)$/;
   if(!allowed.test(path)||!['GET','POST'].includes(req.method))return json(res,404,{error:'지원하지 않는 요청입니다.'});
   const cookie=req.headers.cookie?.match(/(?:^|;\s*)ys_print=([^;]+)/)?.[1];
   const upstream=await fetch('https://askive.pages.dev'+path,{method:req.method,headers:{Origin:'https://askive.pages.dev','Content-Type':'application/json',...(cookie?{Cookie:'ys_print='+cookie}:{})},...(req.method==='POST'?{body:await body(req,2048)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
   res.statusCode=upstream.status;res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/json');const session=upstream.headers.get('set-cookie');if(session)res.setHeader('Set-Cookie',session.replace(/;\s*Secure/gi,''));
   const length=Number(upstream.headers.get('content-length')||0);if(length>8500000)return json(res,413,{error:'사진이 너무 큽니다.'});const reader=upstream.body?.getReader();let total=0;if(reader){while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>8500000){await reader.cancel();res.destroy();return;}res.write(value);}}return res.end();
  }
  if(req.method==='GET'&&['/dashboard/','/dashboard/index.html','/dashboard/admin.js','/dashboard/admin.css','/dashboard/ask-mascots-hd.png'].includes(path)){
   const name=path==='/dashboard/'?'index.html':path.split('/').at(-1);res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html; charset=utf-8');return res.end(readFileSync(join(root,'public/dashboard',name)));
  }
  prunePairings();
  const pairingMatch=path.match(/^\/admin\/pairings\/([a-f0-9]{32})$/);
  if(pairingMatch&&req.method==='POST'){
   const p=pairings.get(pairingMatch[1]);if(!p||p.state!=='pending')return json(res,404,{error:'연결 요청이 만료됐습니다.'});
   const {approve}=JSON.parse((await body(req,128)).toString());
   if(typeof approve!=='boolean')return json(res,400,{error:'승인 여부가 필요합니다.'});
   p.state=approve?'approved':'rejected';return json(res,200,{ok:true});
  }
  if(path==='/admin/cloud'&&req.method==='POST'){
   const {code}=JSON.parse((await body(req,1024)).toString());if(typeof code!=='string'||code.length<32||code.length>256)return json(res,400,{error:'행사 운영 코드를 입력해 주세요.'});
   if(cloudBusy)return json(res,409,{error:'사진 수신 중입니다. 잠시 후 다시 시도해 주세요.'});
   const config={code,client:cloudConfig?.client||randomBytes(24).toString('hex')};
   try{await cloudRequest('','GET',config);}catch{return json(res,400,{error:'클라우드 연결 실패. 인터넷과 운영 코드를 확인해 주세요.'});}
   writeFileSync(cloudPath,JSON.stringify(config),{mode:0o600});cloudConfig=config;void receiveCloud();return json(res,200,{ok:true});
  }
  if(path==='/admin/state'&&req.method==='GET')return json(res,200,{cloud:{configured:!!cloudConfig,status:cloudStatus},connection:`http://${hostName}:${server.address().port}/#${token}`,pairings:[...pairings.values()].filter(p=>p.state==='pending').map(({id,name,code})=>({id,name,code})),jobs:[...jobs.values()].sort((a,b)=>b.createdAt-a.createdAt),printers:await printers()});
  if(path==='/admin/import'&&req.method==='POST'){
   if(req.headers['content-type']!=='image/jpeg')return json(res,415,{error:'인쇄용 JPEG 사진이 필요합니다.'});
   const expiresAt=req.headers['x-photo-expires']?Number(req.headers['x-photo-expires']):Date.now()+86400000;if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()||expiresAt>Date.now()+86400000)return json(res,400,{error:'사진 보관 기간이 올바르지 않습니다.'});const data=await body(req,8500000);printPDF(data,94);const id=createHash('sha256').update(data).digest('hex');
   if(!jobs.has(id)){if(jobs.size>=100||[...jobs.values()].reduce((n,j)=>n+j.bytes,0)+data.length>300000000)return json(res,507,{error:'인쇄 대기 목록이 가득 찼습니다.'});const j={id,createdAt:expiresAt-86400000,bytes:data.length,state:'waiting',copies:1};writeFileSync(join(directory,id+'.jpg'),data,{mode:0o600});save(j);jobs.set(id,j);}
   const j=jobs.get(id);return json(res,200,{id,state:j.state,attempt:j.attempt||0});
  }
  const match=path.match(/^\/admin\/jobs\/([a-f0-9]{64})(?:\/(image|print))?$/);
  if(match){const j=jobs.get(match[1]);if(!j)return json(res,404,{error:'사진이 없거나 만료됐습니다.'});
   if(req.method==='GET'&&match[2]==='image'){res.writeHead(200,{'Content-Type':'image/jpeg'});return res.end(readFileSync(join(directory,j.id+'.jpg')));}
   if(req.method==='POST'&&match[2]==='print'){
    const {printer,copies,scale=94,rotation=0,reprint=false,expectedAttempt=0}=JSON.parse((await body(req,2048)).toString());
    if(![0,90].includes(rotation))return json(res,400,{error:'회전은 원본 또는 90도만 가능합니다.'});
    if(!Number.isInteger(scale)||scale<85||scale>100)return json(res,400,{error:'인쇄 배율은 85~100%입니다.'});
    if(!Number.isInteger(copies)||copies<1||copies>10)return json(res,400,{error:'매수는 1~10장입니다.'});
    if(!(await printers()).some(p=>p.name===printer))return json(res,400,{error:'등록된 프린터를 선택해 주세요.'});
    const options=await run('/usr/bin/lpoptions',['-p',printer,'-l']);
    if(!options.includes('Postcard.Fullbleed'))return json(res,400,{error:'엽서 무테 용지를 지원하는 CP1500을 선택해 주세요.'});
    if(jobs.get(j.id)!==j||j.state==='sending'||expectedAttempt!==(j.attempt||0)||!Number.isInteger(expectedAttempt))return json(res,409,{error:'작업 상태가 변경됐어요. 새로고침 후 다시 확인해 주세요.'});
    if(j.state!=='waiting'&&(!['submitted','uncertain'].includes(j.state)||reprint!==true))return json(res,409,{error:'다시 인쇄 버튼으로 요청해 주세요.'});
    const pdfPath=join(directory,j.id+'.pdf');writeFileSync(pdfPath,printPDF(readFileSync(join(directory,j.id+'.jpg')),scale,rotation),{mode:0o600});
    j.attempt=(j.attempt||0)+1;delete j.error;delete j.cupsJob;
    j.state='sending';j.copies=copies;j.scale=scale;j.rotation=rotation;j.printer=printer;save(j);
    try{const out=await run('/usr/bin/lp',['-d',printer,'-n',String(copies),'-t','Yonsei '+j.id.slice(0,8),'-o','media=Postcard.Fullbleed','-o','print-scaling=none','-o','job-sheets=none',pdfPath]);j.state='submitted';j.cupsJob=out.trim();}
    catch{j.state='uncertain';j.error='전송 결과를 확인하지 못했어요. 중복 인쇄를 막기 위해 Mac 인쇄 센터에서 먼저 확인해 주세요.';}
    j.history=[...(j.history||[]),{attempt:j.attempt,copies,scale,rotation,printer,state:j.state,at:Date.now(),cupsJob:j.cupsJob}];
    save(j);return json(res,200,j);
   }
   if(req.method==='DELETE'&&!match[2]){if(j.state==='sending')return json(res,409,{error:'전송 중에는 지울 수 없습니다.'});for(const suffix of ['.jpg','.json','.pdf'])try{unlinkSync(join(directory,j.id+suffix));}catch{}jobs.delete(j.id);return json(res,200,{deleted:true});}
  }
  if(req.method==='GET'&&['/','/admin.js','/admin.css'].includes(path)){res.setHeader('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'; base-uri 'none'");res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html; charset=utf-8');return res.end(readFileSync(join(root,'public',path==='/'?'index.html':path.slice(1))));}
  json(res,404,{error:'없는 경로'});
 }catch(e){json(res,400,{error:e.message||'요청 처리 실패'});}});
 let stopRelay=()=>{};server.on('listening',()=>{stopRelay=startPrinterRelay({directory,port:server.address().port,token,printers});});
 server.on('close',()=>{clearInterval(cleanupTimer);clearInterval(cloudTimer);stopRelay();});return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const hostName=(await command('/usr/sbin/scutil',['--get','LocalHostName'])).trim()+'.local';
 const server=createPrintServer({hostName});let advertisement;
 server.listen(4178,'0.0.0.0',()=>{
  console.log('관리 화면: http://127.0.0.1:4178');
  advertisement=spawn('/usr/bin/dns-sd',['-R','연세스튜디오 '+hostName.replace('.local',''),'_yonsei-print._tcp','local.','4178'],{stdio:'ignore'});
  advertisement.on('error',()=>console.error('Mac 자동 검색 등록 실패. 기존 연결 코드는 사용할 수 있습니다.'));
 });
 const stopAdvertisement=()=>advertisement?.kill();
 server.on('close',stopAdvertisement);process.on('exit',stopAdvertisement);
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopAdvertisement();server.close(()=>process.exit(0));});
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'이미 실행 중입니다. http://127.0.0.1:4178 을 여세요.':e.message);process.exitCode=1;});
}
