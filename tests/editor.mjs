import {chromium} from 'playwright';import {createApp} from '../server.mjs';import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});const page=await browser.newPage({permissions:['camera'],viewport:{width:1024,height:768}});
 await page.addInitScript(()=>{const timer=setTimeout;window.setTimeout=(fn,ms,...a)=>timer(fn,ms===1000?10:ms,...a);});
 await page.goto(`http://127.0.0.1:${app.address().port}`);await page.locator('#permission-start').click();await page.locator('#permission-next').click();await page.locator('#edition-basic').click();await page.locator('#cuts-6').click();await page.locator('#setup-done').click();await page.locator('.photo-choice').first().waitFor();
 for(let i=0;i<6;i++)await page.locator('.photo-choice').first().click();
 assert.equal(await page.locator('#selection-count').textContent(),'6 / 6 선택');assert.equal(await page.locator('.photo-choice b').first().textContent(),'6회');assert.equal(await page.locator('#finish-selection').isEnabled(),true);
 await page.locator('.photo-choice').nth(1).click();assert.equal(await page.locator('#selection-count').textContent(),'6 / 6 선택');
 await page.locator('.chosen-slot').nth(2).click();assert.equal(await page.locator('#selection-count').textContent(),'5 / 6 선택');assert.equal(await page.locator('#finish-selection').isEnabled(),false);
 await page.locator('.photo-choice').nth(1).click();assert.match(await page.locator('.chosen-slot').last().textContent(),/사진 2/);
 await page.locator('.editing-frame-card').nth(1).click();await page.waitForFunction(()=>!document.querySelector('#finish-selection').disabled);assert.equal(await page.locator('.photo-choice b').first().textContent(),'5회');
 for(const [name,width,height] of [['tablet',1024,768],['portrait',768,1024],['phone',390,844]]){
  await page.setViewportSize({width,height});await page.screenshot({path:`test-output/editor-${name}.png`});
  const box=await page.locator('#selection-panel').boundingBox();assert.ok(box.y<=12,'No empty masthead above editor');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width>=700){const preview=await page.locator('.selection-composite').boundingBox();assert.ok(preview.height>=height*.45,`Preview has room: ${preview.height}`);assert.ok(box.y+box.height<=height+1);}
  else assert.ok(await page.locator('#photo-grid').evaluate(e=>e.scrollWidth>e.clientWidth));
 }
 await page.locator('#finish-selection').click();await page.locator('#result').waitFor({state:'visible'});await page.locator('#retake').click();assert.equal(await page.locator('.chosen-slot').count(),0);
 console.log('PASS: duplicate selections, single-slot removal, cap, frame preservation, completion, reset and three responsive layouts');
}finally{await browser?.close();await new Promise(r=>app.close(r));}
