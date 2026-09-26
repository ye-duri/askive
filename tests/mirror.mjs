import {chromium} from 'playwright';import {createApp} from '../server.mjs';import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 const page=await browser.newPage();
 await page.addInitScript(()=>{
  window.testFacing='user';const native=setTimeout;window.setTimeout=(fn,ms,...args)=>native(fn,ms===1000?10:ms,...args);
  navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,320,480);x.fillStyle='#0000ff';x.fillRect(320,0,320,480);const s=c.captureStream(30);const t=s.getVideoTracks()[0];t.getSettings=()=>({width:640,height:480,facingMode:window.testFacing});return s;};
 });
 await page.goto(`http://127.0.0.1:${app.address().port}`);await page.locator('#permission-start').click();await page.locator('#permission-next').waitFor({state:'visible'});assert.equal(await page.locator('#permission-video').evaluate(e=>e.style.transform),'scaleX(-1)');await page.locator('#permission-next').click();
 for(const mode of ['user','environment','']){
  await page.evaluate(v=>window.testFacing=v,mode);await page.locator('#edition-basic').click();await page.locator('#setup-done').click();await page.locator('.photo-choice canvas').first().waitFor();
  const colors=await page.locator('.photo-choice canvas').first().evaluate(c=>{const x=c.getContext('2d');return [0.25,0.75].map(p=>Array.from(x.getImageData(Math.floor(c.width*p),Math.floor(c.height/2),1,1).data));});
  assert.ok(colors[0][2]>240&&colors[0][0]<10,'Left of captured image must be blue');assert.ok(colors[1][0]>240&&colors[1][2]<10,'Right must be red');
  assert.equal(await page.locator('#video').evaluate(e=>e.style.transform),'scaleX(-1)');
  for(let i=0;i<4;i++)await page.locator('.photo-choice').nth(i).click();await page.locator('#finish-selection').click();await page.locator('#retake').click();
 }
 console.log('PASS: front, rear and unspecified USB camera previews and captured pixels are always mirrored.');
}finally{await browser?.close();await new Promise(r=>app.close(r));}
