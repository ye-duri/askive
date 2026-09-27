import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const page=await browser.newPage({permissions:['camera'],viewport:{width:1180,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=setTimeout;window.setTimeout=(f,t,...args)=>original(f,t===1000?80:t,...args);});
 await page.goto(`http://127.0.0.1:${app.address().port}`);await page.locator('#intro-start').click();await page.locator('#permission-start').click();await page.locator('#permission-next').click();
 for(const count of [2,4,6]){
  await page.locator('#edition-basic').click();await page.locator('#cuts-'+count).click();await page.waitForFunction(()=>!document.querySelector('#setup-done').disabled);
  assert.equal(await page.locator('.capture-layout-card').count(),3);
  for(let i=0;i<3;i++){
   await page.locator('.capture-layout-card').nth(i).click();await page.waitForFunction(()=>!document.querySelector('#setup-done').disabled);
   const geometry=await page.evaluate(async()=>{const src=document.querySelector('.capture-layout-card[aria-pressed=true] img').getAttribute('src');const f=(await(await fetch('/frames.json')).json()).find(f=>f.src===src);const img=document.querySelector('.capture-layout-card[aria-pressed=true] img');await img.decode();return {actual:document.querySelector('#viewfinder').style.aspectRatio.split('/').map(Number),expected:[Math.round(f.slots[0][2]*img.naturalWidth),Math.round(f.slots[0][3]*img.naturalHeight)]};});
   assert.ok(Math.abs(geometry.actual[0]/geometry.actual[1]-geometry.expected[0]/geometry.expected[1])<.001);
  }
  await mkdir('test-output',{recursive:true});if(count===4)await page.screenshot({path:'test-output/basic-layout-setup.png'});
  await page.locator('#setup-done').click();await page.locator('#selection-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('.photo-choice').count(),8);assert.equal(await page.locator('.editing-frame-card:disabled').count(),0);
  await page.locator('.editing-frame-card').nth(1).click();await page.waitForFunction(()=>!document.querySelector('.editing-frame-card').disabled);
  assert.equal(await page.locator('#selection-count').textContent(),`0 / ${count} 선택`);
  await page.locator('#basic-layout-picker button').first().click();await page.waitForFunction(()=>!document.querySelector('.editing-frame-card').disabled);
  await page.locator('.photo-choice').first().click();await page.locator('.editing-frame-card').nth(2).click();await page.waitForFunction(()=>!document.querySelector('.editing-frame-card').disabled);
  assert.equal(await page.locator('#selection-count').textContent(),`1 / ${count} 선택`);assert.equal(await page.locator('#finish-selection').isDisabled(),true);
  for(let i=1;i<count;i++)await page.locator('.photo-choice').first().click();
  await page.locator('#basic-layout-picker button').last().click();await page.waitForFunction(()=>!document.querySelector('#finish-selection').disabled);
  assert.equal(await page.locator('#selection-count').textContent(),`${count} / ${count} 선택`);
  if(count===4)await page.screenshot({path:'test-output/basic-free-selection.png'});
  await page.locator('#finish-selection').click();await page.locator('#result').waitFor({state:'visible'});await page.locator('#retake').click();await page.locator('#intro-start').click();
 }
 assert.deepEqual(errors,[]);console.log('PASS: 2/4/6 cuts, all 9 layout preview ratios, 8 shots, frame changes with zero/partial/full photo selection, duplicate selection preserved, completed results');
}finally{await browser?.close();await new Promise(r=>app.close(r));}
