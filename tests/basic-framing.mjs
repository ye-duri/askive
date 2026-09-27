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
 for(const count of [4,6]){
  await page.locator('#edition-basic').click();await page.locator('#cuts-'+count).click();await page.waitForFunction(()=>!document.querySelector('#setup-done').disabled);
  assert.equal(await page.locator('#cuts-2').isVisible(),false);
  assert.equal(await page.locator('#capture-layout-panel').count(),0);
  const geometry=await page.evaluate(async()=>{const frames=(await(await fetch('/frames.json')).json()).filter(f=>f.edition==='basic'&&f.count===Number(document.querySelector('.cut-options [aria-pressed=true]').id.split('-')[1]));return {frames,ratio:document.querySelector('#viewfinder').style.aspectRatio.split('/').map(Number)};});
  assert.equal(geometry.frames.length,18);assert.deepEqual([...new Set(geometry.frames.map(f=>f.layout))],['grid','offset']);
  const slot=geometry.frames[0].slots[0];
  for(const f of geometry.frames)for(const r of f.slots){assert.equal(r[2],slot[2]);assert.equal(r[3],slot[3]);}
  assert.ok(Math.abs(geometry.ratio[0]/geometry.ratio[1]-(slot[2]*1200)/(slot[3]*1776))<.001);
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
 assert.deepEqual(errors,[]);console.log('PASS: 4/6 cuts only, no advance layout picker, equal grid/offset slot sizes and preview ratios, 8 shots, frame changes with zero/partial/full photo selection, duplicate selection preserved, completed results');
}finally{await browser?.close();await new Promise(r=>app.close(r));}
