import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {printPDF} from '../mac-print/print-pdf.mjs';
import {compactGalleryUrl, readAlbumId} from '../dist/gallery-link.mjs';
import qrcode from '../dist/print/vendor/qrcode.mjs';

const dir = await mkdtemp(join(tmpdir(), 'event-qr-'));
const secret = randomBytes(32).toString('hex');
const server = createApp({GALLERY_DIR: dir, KIOSK_SECRET: secret});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']});
  const page = await browser.newPage({permissions: ['camera'], viewport: {width: 1180, height: 820}});
  // Hold the third original while the visitor selects photos and finishes early.
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    window.originalEncodes = 0;
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
      if (type === 'image/jpeg' && quality === .85) {
        window.originalEncodes++;
        if (window.originalEncodes === 3) {
          return toBlob.call(this, jpeg => { window.releaseOriginal = () => callback(jpeg); }, type, quality);
        }
      }
      return toBlob.call(this, callback, type, quality);
    };
  });
  const errors = [];
  const albums = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => {
    if (req.method() === 'POST' && req.url() === base + '/api/gallery/albums') albums.push(req.postDataJSON());
  });

  // Fail one upload and exercise the user-facing retry, retaining the original album.
  let failUpload = true;
  await page.route('**/api/gallery/albums/*', async route => {
    if (route.request().method() === 'PUT' && failUpload) {
      failUpload = false;
      return route.fulfill({status: 503, json: {error: '사진함 연결 실패'}});
    }
    return route.continue();
  });
  await page.goto(base);
  await page.locator('#intro-start').click();
  assert.match(await page.locator('#capture-storage-note').innerText(), /24시간/);
  await page.locator('#capture-confirm').click();
  await page.locator('#countdown').waitFor();
  await page.locator('#capture-admin summary').click();
  for (let n = 1; n <= 6; n++) {
    await page.waitForFunction(n => document.querySelector('#shot-progress').textContent.startsWith(n + ' / 6장 · 포즈'), n);
    await page.locator('#capture-now').click();
  }
  await page.waitForFunction(() => typeof window.releaseOriginal === 'function');
  await page.locator('#filter-vivid').click();
  for (let n = 0; n < 4; n++) await page.locator('.photo-choice').nth(n).click();
  assert.equal(await page.evaluate(() => window.originalEncodes), 3);
  assert.equal(albums.length, 0);
  const albumCreated = page.waitForResponse(r => r.url() === base + '/api/gallery/albums' && r.status() === 201);
  await page.locator('#finish-selection').click();
  const {id} = await (await albumCreated).json();
  await page.evaluate(() => window.releaseOriginal());
  await page.getByText(/사진함 연결 실패.*완성하기/).waitFor();
  assert.equal(await page.locator('#print-open').isVisible(), false);
  assert.equal(await page.locator('.photo-choice[aria-pressed=true]').count(), 4);
  await page.locator('#finish-selection').click();
  await page.locator('#print-open').waitFor();
  assert.equal(await page.evaluate(() => window.originalEncodes), 6, 'Upload retries reuse the six prepared originals');
  assert.equal(await page.locator('#result-actions input[type=checkbox]').count(), 0);
  assert.equal(albums.length, 1);
  assert.equal(albums[0].captureCount, 6);
  assert.equal(albums[0].consent, true);

  const url = compactGalleryUrl(id, base);
  assert.equal(url, base + '/g#' + Buffer.from(id,'hex').toString('base64url'));
  for (const sample of ['00'.repeat(24), 'ff'.repeat(24), id]) {
    assert.equal(readAlbumId(new URL(compactGalleryUrl(sample,base)).hash.slice(1)), sample);
    assert.equal(readAlbumId(sample), sample);
  }
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const expected = Array.from({length: count * count}, (_, i) => qr.isDark(Math.floor(i/count), i%count));
  assert.equal(count, 33);
  function readSymbol(img, count) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const width = (count + 8) * 4;
    const {data} = ctx.getImageData(canvas.width - 24 - width, canvas.height - 24 - width, width, width);
    return Array.from({length: count * count}, (_, i) => {
      const x = Math.floor((i % count + 4.5) * width / (count + 8));
      const y = Math.floor((Math.floor(i / count) + 4.5) * width / (count + 8));
      return data[4 * (y * width + x)] < 128;
    });
  }
  assert.deepEqual(await page.locator('#result').evaluate(readSymbol, count), expected);
  const phone = await browser.newPage();
  await phone.goto(url);
  await phone.locator('#gallery-photos a').nth(6).waitFor();
  assert.equal(await phone.locator('#gallery-photos a').count(), 7);
  for (const link of await phone.locator('#gallery-photos a').evaluateAll(links => links.map(a => a.href))) {
    assert.equal((await phone.request.get(link)).status(), 200);
  }

  await phone.goto(base+'/gallery.html#'+id);
  await phone.locator('#gallery-photos a').nth(6).waitFor();
  assert.equal((await phone.request.get(base+'/api/gallery/albums/'+id+'/9')).status(),403);
  await page.locator('#print-open').click();
  await page.locator('#print-receipt.is-complete').waitFor();
  const headers = {Authorization:'Bearer '+secret, 'X-Print-Client':'a'.repeat(48)};
  const queue = base + '/api/gallery/print-jobs';
  const {jobs} = await (await fetch(queue, {headers})).json();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].qrUrl, '', 'Installed helpers must not draw another QR');
  assert.ok((await fetch(queue+'/'+id+'/claim',{method:'POST',headers})).ok);
  const printResponse = await fetch(queue+'/'+id+'/image',{headers});
  assert.ok(printResponse.ok);
  const jpeg = Buffer.from(await printResponse.arrayBuffer());
  const galleryJpeg = await (await phone.request.get(base+'/api/gallery/albums/'+id+'/8')).body();
  assert.notDeepEqual(jpeg,galleryJpeg);
  const printImage = await page.evaluateHandle(async data => {
    const img = new Image();
    img.src='data:image/jpeg;base64,'+data;
    await img.decode();
    return img;
  },jpeg.toString('base64'));
  assert.deepEqual(await printImage.evaluate(readSymbol,count),expected);
  assert.equal((printPDF(jpeg,94,0,'#000000','default',jobs[0].qrUrl).toString('latin1').match(/\/Photo Do/g)||[]).length,1);
  assert.deepEqual(errors, []);
  console.log('PASS: mandatory QR, upload retry, preview QR pixels, seven accessible gallery images, one print QR.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(dir, {recursive:true, force:true});
}
