import http from 'node:http';
import assert from 'node:assert/strict';
import {createApp,assertRuntime} from '../server.mjs';
import {writeFile,unlink,symlink} from 'node:fs/promises';
assert.throws(()=>assertRuntime('24.19.0'));
assert.doesNotThrow(()=>assertRuntime('24.21.0'));
assert.throws(()=>createApp({HOST:'0.0.0.0'}));
assert.throws(()=>createApp({PUBLIC_ORIGIN:'http://example.com'}));
const app=createApp({ENABLE_SENS_MMS:'true',KIOSK_PASSWORD:'ignored-password',NCP_SECRET_KEY:'not-a-key'});
await new Promise(r=>app.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.address().port}`;
const secret=new URL('../dist/audit-secret.txt',import.meta.url),link=new URL('../dist/frames/audit-link.png',import.meta.url);
try{
 await writeFile(secret,'test-only');await symlink(secret,link);
 const index=await fetch(base);assert.equal(index.status,200);
 assert.match(index.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(index.headers.get('x-frame-options'),'DENY');
 assert.equal((await fetch(base+'/.env')).status,404);
 assert.equal((await fetch(base+'/server.mjs')).status,404);
 assert.equal((await fetch(base+'/audit-secret.txt')).status,404);
 assert.equal((await fetch(base+'/frames/audit-link.png')).status,404);
 assert.equal((await fetch(base+'/fonts/nanum-pen.ttf')).status,200);
 const hostStatus=await new Promise((resolve,reject)=>{http.get(base+'/app.js',{headers:{Host:'evil.invalid'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});assert.equal(hostStatus,403);
 const status=await (await fetch(base+'/api/delivery/status')).json();assert.equal(status.configured,false);
 for(const route of ['unlock','send']){
  for(const method of ['GET','POST'])assert.equal((await fetch(base+'/api/delivery/'+route,{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:'{}'}:{})})).status,410);
 }
 console.log('PASS: runtime floor, public-origin guard, response headers, static allowlist, Host check; retired MMS APIs return 410 even with legacy enable flag. No provider calls.');
}finally{await unlink(link).catch(()=>{});await unlink(secret).catch(()=>{});await new Promise(r=>app.close(r));}
