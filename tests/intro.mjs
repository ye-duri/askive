import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createApp} from '../server.mjs';

const server = createApp({});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;

try {
  browser = await chromium.launch({channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']});
  const context = await browser.newContext({hasTouch: true, permissions: ['camera'], viewport: {width: 1180, height: 820}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.cameraRequests = 0;
    const getCamera = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.cameraRequests++;
      if (window.simulateCameraDenial) throw new DOMException('Test permission denial', 'NotAllowedError');
      return getCamera(constraints);
    };
  });

  await page.goto(base);
  const intro = page.locator('#intro-start');
  const prompt = page.locator('#capture-prompt');
  const countdown = page.locator('#countdown');
  await page.locator('#privacy-open').tap();
  assert.equal(await prompt.isVisible(), false);
  await page.locator('#privacy-close').tap();
  await page.waitForFunction(() => !document.querySelector('#intro-start').disabled);

  for (const [width, height] of [[1180,820], [820,1180], [390,844], [320,568], [844,390]]) {
    await page.setViewportSize({width, height});
    // The intro's outer margin and both the sign and backdrop of the modal accept taps.
    await page.touchscreen.tap(4, 80);
    await prompt.waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#capture-prompt-title').innerText(), '촬영이 준비되면 화면을 터치해주세요!');
    assert.equal(await page.locator('#capture-prompt-note').innerText(), '바로 촬영이 시작됩니다!');
    assert.deepEqual(await page.locator('#capture-prompt-details > span').allTextContents(), ['타이머 5초', '6장 촬영']);
    assert.ok(await prompt.evaluate(el => el.scrollWidth <= innerWidth && el.scrollHeight <= innerHeight + 1));
    assert.equal(await page.evaluate(() => window.cameraRequests), 0);
    assert.equal(await countdown.isVisible(), false);
    await page.keyboard.press('Escape');
    await prompt.waitFor({state: 'hidden'});
  }

  await page.setViewportSize({width: 1180, height: 820});
  await intro.focus();
  await page.keyboard.press('Enter');
  await prompt.waitFor();
  await page.touchscreen.tap(10, 10);
  await countdown.waitFor();
  assert.equal(await countdown.textContent(), '5');
  assert.equal(await page.locator('.studio').getByRole('button', {name: '촬영 시작', exact: true}).count(), 0);
  assert.equal(await page.locator('#capture-resume').isVisible(), false);
  assert.equal(await page.evaluate(() => window.cameraRequests), 1);

  // The operator shortcut skips each current five-second wait without creating a new run.
  await page.locator('#capture-admin summary').tap();
  for (let n=1; n<=6; n++) {
    await page.waitForFunction(n => document.querySelector('#shot-progress').textContent.startsWith(n+' / 6장 · 포즈'), n);
    await page.locator('#capture-now').tap();
  }
  await page.locator('#selection-panel').waitFor();
  assert.equal(await page.locator('.photo-choice').count(), 6);

  await page.goto(base);
  await page.evaluate(() => { window.simulateCameraDenial = true; });
  await intro.tap();
  await page.locator('#capture-prompt-title').tap();
  await page.locator('#permission-panel').waitFor();
  assert.match(await page.locator('#permission-status').innerText(), /카메라 권한/);
  assert.equal(await countdown.isVisible(), false);
  await page.evaluate(() => { window.simulateCameraDenial = false; });
  await page.locator('#permission-start').tap();
  await page.locator('#permission-next').tap();
  await countdown.waitFor();

  // Operator camera setup should return to the postcard for the next visitor.
  await page.goto(base + '/?setup=1');
  await page.locator('#permission-start').tap();
  await page.getByRole('button', {name: '카메라 설정 완료'}).tap();
  await intro.waitFor();
  assert.equal(await countdown.isVisible(), false);
  await intro.tap();
  await page.keyboard.press('Space');
  await countdown.waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: postcard, readiness prompt, two-tap capture, 6 photos, permission retry and operator setup.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
