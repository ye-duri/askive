import {createPrintServer} from '../mac-print/server.mjs';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'yonsei-pair-'));const s=createPrintServer({directory:dir,run:async()=>'',hostName:'test.local'});await new Promise(r=>s.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${s.address().port}`;
const admin={Origin:base,'X-Yonsei-Admin':'1','Content-Type':'application/json'};
try{
 assert.equal((await fetch(base+'/pair',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'})).status,403);
 const p=await(await fetch(base+'/pair',{method:'POST',body:JSON.stringify({name:'Test iPad'})})).json();assert.match(p.code,/^\d{6}$/);assert.equal(p.token,undefined);
 const poll=()=>fetch(base+'/pair/'+p.id,{headers:{Authorization:'Bearer '+p.secret}});
 assert.equal((await(await poll()).json()).state,'pending');assert.equal((await fetch(base+'/pair/'+p.id)).status,404);
 const state=await(await fetch(base+'/admin/state')).json();assert.equal(state.pairings[0].code,p.code);assert.equal(state.pairings[0].secret,undefined);
 assert.equal((await fetch(base+'/admin/pairings/'+p.id,{method:'POST',body:'{"approve":true}'})).status,403);
 assert.equal((await fetch(base+'/admin/pairings/'+p.id,{method:'POST',headers:admin,body:'{"approve":true}'})).status,200);
 const approved=await(await poll()).json();assert.equal(approved.state,'approved');assert.equal((await fetch(base+'/health',{headers:{Authorization:'Bearer '+approved.token}})).status,200);
 const second=await(await fetch(base+'/pair',{method:'POST',body:'{}'})).json();await fetch(base+'/admin/pairings/'+second.id,{method:'POST',headers:admin,body:'{"approve":false}'});
 const rejected=await(await fetch(base+'/pair/'+second.id,{headers:{Authorization:'Bearer '+second.secret}})).json();assert.equal(rejected.state,'rejected');assert.equal(rejected.token,undefined);
 for(let i=0;i<8;i++)await fetch(base+'/pair',{method:'POST',body:'{}'});assert.equal((await fetch(base+'/pair',{method:'POST',body:'{}'})).status,429);
 console.log('PASS: origin guard, approval-only credential release, private poll, rejection, bounded requests, existing authenticated health');
}finally{await new Promise(r=>s.close(r));await rm(dir,{recursive:true,force:true});}
