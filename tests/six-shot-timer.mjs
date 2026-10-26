import {chromium} from 'playwright';import {createApp} from '../server.mjs';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.route('**/app.js',async r=>r.fulfill({contentType:'text/javascript',body:await readFile(new URL('../dist/app.js',import.meta.url),'utf8')+`
window.captureTest={ready:()=>!initializing,run:async()=>{
 edition='basic';cutCount=6;phase='setup';await chooseFrame('basic-6-grid-beige');
 const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);stream=c.captureStream(30);video.srcObject=stream;await video.play();await new Promise(r=>setTimeout(r,100));phase='shoot';controls();$('capture').disabled=false;
 const ticks=[];waitCaptureTick=async()=>{ticks.push(Number($('countdown').textContent));return false;};await capture();
 return {ticks,total:shotSession.photos.length,selecting};
}};`}));await page.goto('http://127.0.0.1:'+app.address().port);await page.waitForFunction(()=>window.captureTest?.ready());const result=await page.evaluate(()=>captureTest.run());assert.equal(result.total,6);assert.equal(result.selecting,true);assert.deepEqual(result.ticks,Array.from({length:6},()=>[5,4,3,2,1]).flat());console.log('PASS: six actual canvas captures, five countdown ticks per shot and transition to selection');}finally{await browser.close();await new Promise(r=>app.close(r));}
