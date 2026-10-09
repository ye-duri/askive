import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();let release;const gate=new Promise(r=>release=r);let requested=false;
 await page.route('**/hanmaeum-2026-yugwansun-offset-print.png',async route=>{requested=true;await gate;await route.continue();});
 await page.route('**/app.js',async route=>{await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../dist/app.js',import.meta.url),'utf8')+`
 window.testPreview={ready:()=>!initializing,choose:async()=>{edition='special';cutCount=4;phase='setup';await chooseFrame('hanmaeum-2026-yugwansun-offset');return{loading:frameLoading,w:selected.width,h:selected.height,preview:$('overlay').getAttribute('src'),imgWidth:selected.img.naturalWidth};},finish:async()=>{const c=document.createElement('canvas');c.width=300;c.height=400;c.getContext('2d').fillRect(0,0,300,400);shotSession={photos:Array(8).fill(c)};chosen=[0,1,2,3];selecting=true;await $('finish-selection').onclick();return{blob:!!blob,width:$('result').naturalWidth,height:$('result').naturalHeight};}};`});});
 await page.goto(`http://127.0.0.1:${app.address().port}`);await page.waitForFunction(()=>window.testPreview?.ready());
 const chosen=await page.evaluate(()=>testPreview.choose());assert.equal(chosen.loading,false);assert.equal(chosen.w,1200);assert.equal(chosen.h,1776);assert.ok(chosen.preview.includes('-screen-'));assert.ok(chosen.imgWidth<1200);
 let finished=false;const result=page.evaluate(()=>testPreview.finish()).then(v=>{finished=true;return v;});
 await new Promise(r=>setTimeout(r,300));assert.ok(requested);assert.equal(finished,false);release();
 const output=await result;assert.equal(output.blob,true);assert.equal(output.width,1200);assert.equal(output.height,1776);console.log({chosen,output});
 console.log('PASS: delayed original does not block selection; export waits for full resolution.');
}finally{await browser.close();await new Promise(r=>app.close(r));}
