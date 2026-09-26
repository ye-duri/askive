import {chromium} from 'playwright';import {createApp} from '../server.mjs';import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});const page=await browser.newPage({permissions:['camera'],viewport:{width:1024,height:768}});
 await page.addInitScript(()=>{const timer=setTimeout;window.setTimeout=(fn,ms,...a)=>timer(fn,ms===1000?10:ms,...a);});
 await page.goto(`http://127.0.0.1:${app.address().port}`);await page.locator('#intro-start').click();await page.locator('#permission-start').click();await page.locator('#permission-next').click();await page.locator('#edition-basic').click();await page.locator('#cuts-6').click();await page.locator('#setup-done').click();await page.locator('.photo-choice').first().waitFor();
 for(let i=0;i<6;i++)await page.locator('.photo-choice').first().click();
 assert.equal(await page.locator('#selection-count').textContent(),'6 / 6 선택');assert.equal(await page.locator('.photo-choice b').count(),0);assert.equal(await page.locator('#chosen-slots').count(),0);assert.equal(await page.locator('#finish-selection').isEnabled(),true);
 await page.locator('.photo-choice').nth(1).click();assert.equal(await page.locator('#selection-count').textContent(),'6 / 6 선택');
 await page.locator('.preview-slot').nth(2).click();assert.equal(await page.locator('#selection-count').textContent(),'5 / 6 선택');assert.equal(await page.locator('#finish-selection').isEnabled(),false);
 await page.locator('.photo-choice').nth(1).click();assert.match(await page.locator('.preview-slot').nth(2).getAttribute('aria-label'),/사진 2/);
 await page.locator('.editing-frame-card').nth(1).click();await page.waitForFunction(()=>!document.querySelector('#finish-selection').disabled);assert.match(await page.locator('.preview-slot').nth(2).getAttribute('aria-label'),/사진 2/);
 assert.equal(await page.locator('#basic-layout-picker button').count(),3);assert.equal(await page.locator('.editing-frame-card').count(),9);
 for(let n=0;n<3;n++){await page.locator('#basic-layout-picker button').nth(n).click();await page.waitForFunction(()=>!document.querySelector('#finish-selection').disabled);assert.equal(await page.locator('.preview-slot').count(),6);assert.match(await page.locator('.preview-slot').nth(2).getAttribute('aria-label'),/사진 2/);assert.equal(await page.locator('.editing-frame-card').count(),9);}
 for(const [name,width,height] of [['tablet',1024,768],['portrait',768,1024],['phone',390,844]]){
  await page.setViewportSize({width,height});await page.screenshot({path:`test-output/editor-${name}.png`});
  await page.locator('.preview-slot').nth(3).click();assert.equal(await page.locator('#selection-count').textContent(),'5 / 6 선택');assert.match(await page.locator('.preview-slot').nth(2).getAttribute('aria-label'),/사진 2/);await page.locator('.photo-choice').first().click();assert.match(await page.locator('.preview-slot').nth(3).getAttribute('aria-label'),/사진 1/);await page.evaluate(()=>window.scrollTo(0,0));
  const box=await page.locator('#selection-panel').boundingBox();assert.ok(box.y<=12,'No empty masthead above editor');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width>=700){const preview=await page.locator('.selection-composite').boundingBox();assert.ok(preview.height>=height*.45,`Preview has room: ${preview.height}`);assert.ok(box.y+box.height<=height+1);}
  else assert.ok(await page.locator('#photo-grid').evaluate(e=>e.scrollWidth>e.clientWidth));
 }
 await page.locator('#finish-selection').click();await page.locator('#result').waitFor({state:'visible'});await page.evaluate(()=>{window.nativeCalls=[];window.webkit={messageHandlers:{yonseiPrint:{postMessage:msg=>window.nativeCalls.push(msg)}}};});await page.locator('#print-open').click();await page.waitForFunction(()=>window.nativeCalls.length===1);assert.equal(await page.locator('#print-open').isDisabled(),true);assert.ok(await page.evaluate(()=>window.nativeCalls[0].jpeg.startsWith('/9j/')));await page.evaluate(()=>window.dispatchEvent(new CustomEvent('yonsei-print-state',{detail:{state:'sent',message:'test sent'}})));assert.equal(await page.locator('#print-open').isEnabled(),true);await page.locator('#retake').click();await page.locator('#intro-start').click();assert.equal(await page.locator('.preview-slot').count(),0);
 console.log('PASS: duplicate selections, single-slot removal, cap, frame preservation, completion, reset and three responsive layouts');
}finally{await browser?.close();await new Promise(r=>app.close(r));}
