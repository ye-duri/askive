import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
const env={ENABLE_SENS_MMS:'true',SENS_SERVICE_ID:'ncp:sms:example',NCP_ACCESS_KEY:'test',NCP_SECRET_KEY:'test',SENS_FROM:'0212345678',KIOSK_PASSWORD:'test-password-123',PRIVACY_OPERATOR:'테스트 행사',PRIVACY_CONTACT:'test@example.invalid',MMS_HISTORY_RETENTION:'테스트 보관 기간'};
let calls=[];
const server=createApp(env,async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>url.endsWith('/files')?{fileId:'test-file'}:{statusCode:'202',requestId:'test-request'}};});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const post=async(route,data,token='')=>{const r=await fetch(base+'/api/delivery/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data)});return {code:r.status,...await r.json()};};
try{
 assert.equal((await fetch(base)).status,200);
 const state=await (await fetch(base+'/api/delivery/status')).json();assert.equal(state.configured,true);
 assert.equal((await post('unlock',{password:'wrong'})).code,403);
 const {token}=await post('unlock',{password:env.KIOSK_PASSWORD});assert.ok(token);
 const bytes=Buffer.from([255,216,255,192,0,17,8,0,10,0,10,3,1,17,0,2,17,0,3,17,0,255,217]);
 const payload={phone:'01012345678',image:bytes.toString('base64'),id:'test-id-0000000001',consent:true,policyVersion:state.policy.version};
 assert.equal((await post('send',payload)).code,401);
 assert.equal((await post('send',{...payload,consent:false},token)).code,400);
 assert.equal((await post('send',{...payload,policyVersion:'stale'},token)).code,400);
 assert.equal((await post('send',{...payload,phone:'123'},token)).code,400);
 assert.equal((await post('send',{...payload,image:'bad'},token)).code,400);assert.equal(calls.length,0);
 assert.equal((await post('send',payload,token)).code,202);assert.equal(calls.length,2);
 assert.equal(calls[1].body.type,'MMS');assert.equal(calls[1].body.messages[0].to,payload.phone);assert.ok(calls[1].body.files[0].fileId);
 assert.equal((await post('send',payload,token)).code,202);assert.equal(calls.length,2);
 console.log('PASS: auth, consent and policy version, number/image validation, MMS payload, duplicate prevention (mock provider; no real SMS sent).');
}finally{await new Promise(r=>server.close(r));}
