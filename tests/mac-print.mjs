import http from 'node:http';
import {createPrintServer} from '../mac-print/server.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const directory=await mkdtemp(join(tmpdir(),'yonsei-test-'));const calls=[];
const run=async(cmd,args)=>{calls.push([cmd,args]);if(cmd.endsWith('lpstat'))return 'CP1500에 대한 기기: dnssd://test\n';if(cmd.endsWith('lpoptions'))return 'PageSize: Postcard Postcard.Fullbleed';if(cmd.endsWith('/lp')){await new Promise(r=>setTimeout(r,100));return 'request id is CP1500-42 (1 file(s))';}throw Error('Unexpected command');};
let server=createPrintServer({directory,run,hostName:'test.local'});const start=async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;};let base=await start();
try{
 const state=await(await fetch(base+'/admin/state')).json();const token=new URL(state.connection).hash.slice(1);const jpeg=Buffer.from([255,216,255,224,0,2,255,217]);const id=createHash('sha256').update(jpeg).digest('hex');const headers={Authorization:'Bearer '+token,'Content-Type':'image/jpeg','X-Job-ID':id};
 assert.equal((await fetch(base+'/jobs',{method:'POST',body:jpeg})).status,401);
 assert.equal(await new Promise(resolve=>{http.get(base+'/admin/state',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);});}),403);
 assert.equal((await fetch(base+'/jobs',{method:'POST',body:jpeg,headers:{...headers,Origin:'https://evil.example'}})).status,403);
 for(let i=0;i<2;i++)assert.equal((await(await fetch(base+'/jobs',{method:'POST',body:jpeg,headers})).json()).received,true);
 assert.equal((await(await fetch(base+'/admin/state')).json()).jobs.length,1);
 assert.equal(calls.filter(c=>c[0].endsWith('/lp')).length,0);
 assert.equal((await fetch(base+`/admin/jobs/${id}/print`,{method:'POST',body:'{}'})).status,403);
 const admin={'Content-Type':'application/json','X-Yonsei-Admin':'1',Origin:base};
 const print=copies=>fetch(base+`/admin/jobs/${id}/print`,{method:'POST',headers:admin,body:JSON.stringify({printer:'CP1500',copies})});
 assert.equal((await print(0)).status,400);assert.equal((await print(11)).status,400);
 const responses=await Promise.all([print(3),print(3)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const lp=calls.filter(c=>c[0].endsWith('/lp'));assert.equal(lp.length,1);assert.ok(lp[0][1].includes('3'));assert.ok(lp[0][1].includes('media=Postcard.Fullbleed'));
 await new Promise(r=>server.close(r));server=createPrintServer({directory,run,hostName:'test.local'});base=await start();
 const restored=await(await fetch(base+'/admin/state')).json();assert.equal(restored.jobs[0].state,'submitted');assert.equal(new URL(restored.connection).hash.slice(1),token);
 console.log('PASS authenticated receipt, deduplication, localhost-only admin, CSRF rejection, copy limits, concurrent print guard, persisted queue and token. No physical print sent.');
}finally{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
