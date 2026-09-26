import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {mkdtemp,rm,mkdir,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(os.tmpdir(),'yonsei-test-'));const secret='test-only-qr-code-not-a-production-secret';
const app=createApp({KIOSK_SECRET:secret,GALLERY_DIR:dir});await new Promise(r=>app.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.address().port}`;
await mkdir('test-output',{recursive:true});
let browser;const errors=[];
try{
 browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const uploads=[];
 const page=await browser.newPage({permissions:['camera'],viewport:{width:1024,height:768}});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/gallery/albums')&&['POST','PUT'].includes(r.method()))uploads.push(r.url());});
 await page.addInitScript(()=>{const native=setTimeout;window.testTicks=0;window.setTimeout=(fn,ms,...args)=>{if(ms===1000)window.testTicks++;return native(fn,ms===1000?10:ms,...args);};});
 await page.goto(base);await page.locator('#permission-start').click();await page.locator('#kiosk-code').fill(secret);await page.locator('#kiosk-unlock').click();await page.locator('#kiosk-access').waitFor({state:'hidden'});await page.locator('#permission-next').click();
 assert.equal(await page.locator('#timer').count(),0);assert.equal(await page.locator('#send-open').count(),0);
 assert.equal(await page.locator('#operator-settings').count(),0);assert.equal(await page.locator('#cancel').count(),0);await page.screenshot({path:'test-output/edition-tablet.png'});
 for(const [edition,count] of [['basic',2],['basic',4],['basic',6],['special',4],['special',6]]){
  const uploadCount=uploads.length;
  await page.locator('#edition-'+edition).click();await page.locator('#cuts-'+count).click();await page.waitForFunction(()=>!document.querySelector('#setup-done').disabled);
  assert.equal(await page.locator('#qr-consent').isChecked(),false);assert.equal(await page.locator('#setup-done').textContent(),'촬영시작');
  if(edition==='special')assert.equal(await page.locator('#cuts-2').isVisible(),false);else assert.equal(await page.locator('#frames').isVisible(),false);
  if(edition==='basic'&&count===2)await page.locator('#qr-consent').check();
  const before=await page.evaluate(()=>window.testTicks);await page.locator('#setup-done').click();

  await page.locator('#selection-panel').waitFor({state:'visible'});assert.equal(await page.locator('.photo-choice').count(),8);assert.equal(await page.evaluate(()=>window.testTicks)-before,40);
  for(let i=0;i<count;i++)await page.locator('.photo-choice').nth(i).click();
  if(edition==='basic'){assert.equal(await page.locator('#frame-step').isVisible(),false);assert.equal(await page.locator('#editor-frames-panel').isVisible(),true);await page.locator('.editing-frame-card').nth(1).click();assert.equal(await page.locator('.photo-choice[aria-pressed=true]').count(),count);await page.screenshot({path:'test-output/combined-selection.png'});}
  await page.locator('#filter-mono').click();
  assert.equal(await page.locator('#filter-mono').getAttribute('aria-pressed'),'true');
  const pixels=await page.locator('.photo-choice canvas').first().evaluate(el=>Array.from(el.getContext('2d').getImageData(50,50,1,1).data));assert.equal(pixels[0],pixels[1]);assert.equal(pixels[1],pixels[2]);
  await page.locator('#finish-selection').click();await page.locator('#result').waitFor({state:'visible'});
  if(edition==='basic'&&count===2){
   assert.match(await page.locator('#qr-result').textContent(),/24|까지/);await page.screenshot({path:'test-output/qr-result.png'});
   const id=await page.evaluate(()=>document.querySelector('#result').src);assert.match(id,/^blob:/);
   // Validate gallery through its real API using authenticated cookie, then expiry deletion through UI.
   const files=await (await import('node:fs/promises')).readdir(dir);const albumId=files.find(f=>f.endsWith('_meta.json')).split('_')[0];
   const galleryPage=await browser.newPage();await galleryPage.goto(base+'/gallery.html#'+albumId);await galleryPage.locator('#gallery-photos img').last().waitFor();assert.equal(await galleryPage.locator('#gallery-photos img').count(),9);await galleryPage.close();
   await page.locator('#print-open').click();await page.emulateMedia({media:'print'});await page.pdf({path:'test-output/print.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});await page.locator('#print-close').click();
   assert.equal(await page.locator('#qr-delete').count(),0);assert.equal(await page.locator('#reselect').count(),0);await page.evaluate(async id=>fetch('/api/gallery/albums/'+id,{method:'DELETE'}),albumId);assert.equal((await fetch(base+'/api/gallery/albums/'+albumId)).status,404);
  }
  if(!(edition==='basic'&&count===2)){assert.equal(uploads.length,uploadCount,'Non-consenting sessions must never POST/PUT albums');assert.equal((await readdir(dir)).length,0,'No photos or metadata stored without consent');}
  await page.locator('#retake').click();assert.equal(await page.locator('#editing-frames img').count(),0);assert.equal(await page.locator('#edition-panel').isVisible(),true);assert.equal(await page.locator('#permission-panel').isVisible(),false);
 }
 await page.reload();await page.locator('#edition-panel').waitFor({state:'visible'});
 await page.locator('#edition-basic').click();await page.locator('#cuts-4').click();await page.locator('#setup-done').click();await page.locator('#selection-panel').waitFor({state:'visible'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-output/mobile-selection.png'});
 const scroll=await page.locator('#photo-grid').evaluate(e=>({x:e.scrollWidth>e.clientWidth,y:getComputedStyle(e).overflowY}));assert.equal(scroll.x,true);assert.equal(scroll.y,'hidden');
 assert.deepEqual(errors,[]);console.log('PASS: 5 edition/cut flows; 8 auto captures × 5 countdown ticks; photo-only mono; QR 9-photo viewer/delete; print PDF; permission reuse; mobile horizontal list.');
}finally{await browser?.close();await new Promise(r=>app.close(r));await rm(dir,{recursive:true,force:true});}
