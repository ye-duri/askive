import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {calendarLayout} from '../dist/print/calendar-layout.mjs';
const dir=await mkdtemp(join(tmpdir(),'want-qr-')),code='want-qr-local-test-secret-32-characters';
const server=createApp({GALLERY_DIR:dir,KIOSK_SECRET:code});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const frame of ['want-four','want-six']){
 const page=await browser.newPage();await page.request.post(base+'/api/gallery/unlock',{headers:{Origin:base},data:{code}});
 await page.route('**/app.js',async r=>r.fulfill({contentType:'text/javascript',body:await readFile(process.env.QR_TEST_APP||'dist/app.js','utf8')+`
 window.qrTest={ready:()=>!initializing,start:async id=>{edition='special';cutCount=id==='want-six'?6:4;phase='setup';await chooseFrame(id);const c=document.createElement('canvas');c.width=600;c.height=400;c.getContext('2d').fillRect(0,0,600,400);shotSession={photos:Array(8).fill(c),taken:8};chosen=Array.from({length:cutCount},(_,i)=>i);selecting=true;qrEnabled=true;window.completion=$('finish-selection').onclick();},state:()=>({busy,qrConsent,album:album?.id}),qr:()=> $('result-qr-add').onclick(),print:()=> $('print-open').onclick()};`}));
 let release,entered;const gate=new Promise(r=>release=r),arrived=new Promise(r=>entered=r);let first=true;
 await page.route('**/api/gallery/albums/*',async r=>{if(first&&r.request().method()==='PUT'){first=false;entered();await gate;}await r.continue();});
 await page.goto(base);await page.waitForFunction(()=>window.qrTest?.ready());await page.evaluate(id=>qrTest.start(id),frame);await arrived;
 try{assert.equal(await page.locator('#result-qr-add').isDisabled(),true,'QR must wait for initial upload');assert.equal(await page.locator('#print-open').isDisabled(),true);await page.evaluate(()=>qrTest.qr());assert.equal(await page.evaluate(()=>qrTest.state().qrConsent),false);}finally{release();}
 await page.evaluate(()=>window.completion);await page.evaluate(()=>qrTest.qr());const state=await page.evaluate(()=>qrTest.state());assert.equal(state.qrConsent,true);await page.evaluate(()=>qrTest.print());
 await page.request.post(base+'/api/gallery/print-login',{headers:{Origin:base},data:{password:'0691'}});const jobs=await(await page.request.get(base+'/api/gallery/web-print')).json();const job=jobs.jobs.find(j=>j.id===state.album);assert.ok(job?.qrUrl);assert.equal(job.printTheme,'want');const layout=calendarLayout(600,1057,0,'#74151B',job.printTheme,job.qrUrl);assert.equal(layout.filter(c=>c.type==='qr').length,1);assert.ok(layout.find(c=>c.type==='brand').colored);console.log('PASS:',frame,'initial-save lock, QR consent, upload, print job and single footer QR');await page.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
