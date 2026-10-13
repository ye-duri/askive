import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const id of ['hanmaeum-2026-daecheong-paper-four','sheep-friends-wide','hanmaeum-2026-daecheong-paper-six-portrait']){
 const page=await browser.newPage();await page.route('**/app.js',async route=>route.fulfill({contentType:'text/javascript',body:await readFile('dist/app.js','utf8')+`
 window.checkFinish=async id=>{const f=frames.find(f=>f.id===id);edition=f.edition;cutCount=f.count;phase='setup';await chooseFrame(id);const photos=[];for(let i=0;i<CAPTURE_TOTAL;i++){const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='#ac86b8';x.fillRect(0,0,640,480);photos.push(c);}shotSession={photos,taken:CAPTURE_TOTAL};chosen=Array.from({length:cutCount},(_,i)=>i);selecting=true;qrConsent=false;qrEnabled=false;await $('finish-selection').onclick();if(!printShareFile)throw Error($('status').textContent);const im=await createImageBitmap(printShareFile);return {expected:[f.sourceWidth,f.sourceHeight],result:[$('result').naturalWidth,$('result').naturalHeight],print:[im.width,im.height]};};window.readyForFinish=()=>!initializing;`}));
 await page.goto(`http://127.0.0.1:${app.address().port}`);await page.waitForFunction(()=>window.readyForFinish?.());const result=await page.evaluate(id=>checkFinish(id),id);assert.deepEqual(result.result,result.expected);assert.deepEqual(result.print,result.expected);console.log('PASS completed PNG and print JPEG preserve ratio:',id,result.print);await page.close();
}}finally{await browser.close();await new Promise(r=>app.close(r));}
