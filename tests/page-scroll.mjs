import {chromium} from 'playwright';import {createApp} from '../server.mjs';import assert from 'node:assert/strict';
const app=createApp({});await new Promise(r=>app.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});try{
for(const [edition,count,partial] of [['basic',4,false]]){
 const page=await browser.newPage({permissions:['camera'],viewport:{width:1024,height:700}});const check=async name=>{await page.evaluate(()=>window.scrollTo(0,10000));assert.equal(await page.evaluate(()=>window.scrollY),0,name+' page must not scroll');};await page.addInitScript(()=>{const now=Date.now;window.timeOffset=0;Date.now=()=>now()+window.timeOffset;const wait=setTimeout;window.setTimeout=(f,t,...args)=>wait(f,t===1000?5:t,...args);});await page.goto(`http://127.0.0.1:${app.address().port}`);await check('intro');await page.locator('#intro-start').click();await check('permission');await page.locator('#permission-start').click();await page.locator('#permission-next').click();await check('edition');await page.locator('#edition-'+edition).click();await check('setup');await page.locator('#cuts-'+count).click();await page.locator('#setup-done').click();await page.locator('#selection-panel').waitFor({state:'visible'});await check('selection');

 for(let i=0;i<4;i++)await page.locator('.photo-choice').nth(i).click();
 await page.locator('#finish-selection').click();await page.locator('#result').waitFor({state:'visible'});await check('result');await page.screenshot({path:'test-output/page-result.png'});
 await page.evaluate(()=>{window.nativeCalls=[];window.webkit={messageHandlers:{yonseiPrint:{postMessage:m=>window.nativeCalls.push(m)}}};});
 const event=state=>page.evaluate(state=>window.dispatchEvent(new CustomEvent('yonsei-print-state',{detail:{state,message:'test'}})),state);
 await page.locator('#print-open').click();await page.waitForFunction(()=>window.nativeCalls.length===1);
 assert.equal(await page.locator('#print-receipt').isVisible(),true);
 await event('error');assert.equal(await page.locator('#print-receipt').isVisible(),false);
 await page.locator('#print-open').click();await page.waitForFunction(()=>window.nativeCalls.length===2);
 await event('sent');assert.equal(await page.locator('#print-receipt').isVisible(),true);
 await page.locator('#print-receipt-close').click();await page.locator('#retake').click();assert.equal(await page.locator('#print-receipt').isVisible(),false);
 await event('sent');assert.equal(await page.locator('#print-receipt').isVisible(),false);await page.close();
}console.log('PASS sending dialog, success receipt, errors and reset close it');}finally{await browser.close();await new Promise(r=>app.close(r));}
