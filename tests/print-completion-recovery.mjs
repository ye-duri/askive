import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{
for(const scenario of ['success','upload-failure','print-failure','no-qr']){
 const p=await browser.newPage();let uploads=0,failUpload=scenario==='upload-failure';
 await p.addInitScript(()=>{window.nativeJobs=[];window.webkit={messageHandlers:{yonseiPrint:{postMessage:job=>window.nativeJobs.push(job)}}};});
 await p.route('**/api/gallery/albums**',async route=>{
  if(route.request().method()==='PUT'){uploads++;await new Promise(r=>setTimeout(r,100));if(failUpload){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'test unavailable'})});return;}}
  await route.fulfill({contentType:'application/json',body:JSON.stringify({id:'a'.repeat(48),ok:true})});
 });
 await p.route('**/app.js',async route=>route.fulfill({contentType:'text/javascript',body:await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8')+`
window.printCheck={ready:()=>!initializing,setup:async qr=>{
 edition='special';cutCount=4;phase='setup';await chooseFrame('hanmaeum-2026-together-four');await selected.originalImage();const photos=[];
 for(let k=0;k<8;k++){const c=document.createElement('canvas');c.width=1440;c.height=1080;const x=c.getContext('2d');x.fillStyle='#ac86b8';x.fillRect(0,0,1440,1080);await prepareNaturalPhoto(c);photos.push(c);}
 shotSession={photos,taken:8};chosen=[0,1,2,3];selecting=true;qrConsent=false;qrEnabled=true;await $('finish-selection').onclick();if(qr)await $('result-qr-add').onclick();
},print:()=>$('print-open').onclick(),state:()=>({phase,photos:shotSession?.photos.length||0,ready:printReady,qrConsent,albumUploaded,locked:$('print-open').disabled,hasBlob:!!blob})};`}));
 await p.goto(`http://127.0.0.1:${app.address().port}`);await p.waitForFunction(()=>window.printCheck?.ready());await p.evaluate(q=>printCheck.setup(q),scenario!=='no-qr');assert.equal(uploads,0,'QR selection must not upload photos');
 await p.evaluate(()=>Promise.all([printCheck.print(),printCheck.print()]));
 if(scenario==='upload-failure'){
  assert.equal(await p.evaluate(()=>nativeJobs.length),0);let s=await p.evaluate(()=>printCheck.state());assert.ok(s.ready&&s.hasBlob&&!s.locked);failUpload=false;await p.evaluate(()=>printCheck.print());assert.equal(uploads,2);
 }
 assert.equal(await p.evaluate(()=>nativeJobs.length),1,'double click must send only once');assert.ok((await p.evaluate(()=>printCheck.state())).locked);
 if(scenario==='print-failure'){
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('yonsei-print-state',{detail:{state:'error',message:'test print failure'}})));
  const s=await p.evaluate(()=>printCheck.state());assert.ok(s.ready&&s.hasBlob&&!s.locked);const before=uploads;await p.evaluate(()=>printCheck.print());assert.equal(uploads,before,'print retry must reuse uploaded album');assert.equal(await p.evaluate(()=>nativeJobs.length),2);
 }
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('yonsei-print-state',{detail:{state:'sent'}})));
 const s=await p.evaluate(()=>printCheck.state());assert.equal(s.phase,'intro');assert.equal(s.photos,0);assert.equal(s.hasBlob,false);assert.equal(s.ready,false);
 if(scenario==='no-qr')assert.equal(uploads,0);
 console.log('PASS:',scenario,'QR upload deferred; duplicate click guarded; success resets session');await p.close();
}
}finally{await browser.close();await new Promise(r=>app.close(r));}
