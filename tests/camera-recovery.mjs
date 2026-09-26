import {chromium} from 'playwright';import {createApp} from '../server.mjs';import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const page=await browser.newPage({permissions:['camera']});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const timer=setTimeout,play=HTMLMediaElement.prototype.play;
  window.setTimeout=(fn,ms,...args)=>timer(fn,ms===12000?100:ms===1000?10:ms,...args);
  window.stallVideo=false;window.hiddenPlay=false;
  HTMLMediaElement.prototype.play=function(){if(!this.getClientRects().length)window.hiddenPlay=true;if(this.id==='video'&&window.stallVideo)return new Promise(()=>{});return play.call(this);};
  navigator.canShare=()=>true;navigator.share=async data=>{window.sharedFile={name:data.files[0].name,type:data.files[0].type,size:data.files[0].size};};
 });
 await page.goto(`http://127.0.0.1:${app.address().port}`);await page.locator('#permission-start').click();await page.locator('#permission-next').click();
 await page.locator('#edition-basic').click();await page.evaluate(()=>window.stallVideo=true);await page.locator('#setup-done').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('재생이 시작되지'));
 assert.equal(await page.locator('#start').isEnabled(),true);
 await page.evaluate(()=>window.stallVideo=false);await page.locator('#start').click();await page.locator('#capture').click();await page.locator('.photo-choice').first().waitFor();
 for(let i=0;i<4;i++)await page.locator('.photo-choice').nth(i).click();await page.locator('#finish-selection').click();await page.locator('#print-open').click();
 assert.equal(await page.locator('#print-dialog').count(),0);
 await page.locator('#print-share').click();assert.equal(await page.evaluate(()=>window.sharedFile.type),'image/jpeg');assert.ok(await page.evaluate(()=>window.sharedFile.size>0));
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('#print-image').evaluate(e=>getComputedStyle(e).objectFit),'contain');await page.emulateMedia({media:'screen'});
 assert.equal(await page.evaluate(()=>window.hiddenPlay),false);assert.deepEqual(errors,[]);
 console.log('PASS: visible-before-play, stalled playback retry, shared JPG and proportion-preserving print');
}finally{await browser?.close();await new Promise(r=>app.close(r));}
