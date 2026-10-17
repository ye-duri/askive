import assert from 'node:assert/strict';import fs from 'node:fs';import {calendarLayout} from '../mac-print/public/calendar-layout.mjs';
for(const name of ['calendar-layout.mjs','calendar-fonts.mjs'])assert.equal(fs.readFileSync('dist/print/'+name,'utf8'),fs.readFileSync('mac-print/public/'+name,'utf8'));
for(const [w,h] of [[1200,2133],[2133,1200],[1200,1776]])for(const rotation of [0,90]){
 const layout=calendarLayout(w,h,rotation),photos=layout.filter(p=>p.type==='photo');assert.equal(photos.length,4);
 for(const p of photos){assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=1200&&p.y+p.h<=1776);assert.ok(Math.abs(p.w/p.h-(rotation===90?h/w:w/h))<.0001);}
 const dates=layout.filter(p=>p.type==='text'&&p.size===36);assert.equal(dates.length,31);assert.equal(dates[0].value,'1');assert.equal(dates[30].value,'31');assert.ok(dates[0].x>300&&dates[30].x>dates[0].x&&dates[30].y>dates[0].y);
 for(const p of layout.filter(p=>p.type==='text')){assert.ok(p.paths.length>0);assert.ok(p.paths.every(cmd=>cmd.slice(1).every(Number.isFinite)));}
}
const full=calendarLayout(1200,2133),photos=full.filter(p=>p.type==='photo');assert.equal(photos[0].x,0);assert.equal(photos[0].y,0);assert.equal(photos[1].x+photos[1].w,1200);assert.equal(photos[0].x+photos[0].w,photos[1].x);assert.equal(photos[1].y+photos[1].h,photos[2].y);assert.equal(photos[2].x+photos[2].w,photos[3].x);
const logo=full.find(p=>p.type==='brand');assert.ok(logo.runs.length>500);assert.equal(logo.w/logo.h,1220/300);assert.equal(logo.color,'#000000');
for(const color of ['#794D32','#166B9A','#38664B','#765383'])assert.ok(calendarLayout(1200,2133,0,color).filter(c=>c.type==='text'||c.type==='brand').every(c=>c.color===color));assert.throws(()=>calendarLayout(1200,2133,0,'bad'));
console.log('PASS: shared vector lettering, October date positions, 4 touching undistorted photos, black default, palette colors and original logo');

const siwol=calendarLayout(600,1057,0,'#BF4022','siwol');assert.equal(siwol.find(p=>p.value==='OCT.').font,'siwol');assert.ok(siwol.find(p=>p.value==='OCT.').paths.length>1000);assert.equal(siwol.find(p=>p.type==='brand').color,'#BF4022');

const qrUrl='https://askive.pages.dev/gallery.html#'+'a'.repeat(48);
for(const [w,h] of [[1200,2133],[2133,1200],[600,1057],[1200,4000]])for(const rotation of [0,90]){
 const layout=calendarLayout(w,h,rotation,'#BF4022','siwol',qrUrl),qr=layout.filter(p=>p.type==='qr');
 assert.equal(qr.length,1);const box=qr[0],brand=layout.find(p=>p.type==='brand');
 assert.ok(box.x>=600&&box.x+box.w<=1200&&box.y+box.h<=1776);
 assert.ok(box.y>=Math.max(...layout.filter(p=>p.type==='photo').map(p=>p.y+p.h)));
 assert.ok(brand.x+brand.w<box.x);assert.ok(box.rects.length>100);
}
assert.equal(calendarLayout(1200,2133).filter(p=>p.type==='qr').length,0);
assert.throws(()=>calendarLayout(1200,2133,0,'#000000','default','javascript:bad'));
const catalog=JSON.parse(fs.readFileSync('dist/frames.json'));
assert.deepEqual(catalog.filter(f=>f.edition==='special'&&!f.hidden).map(f=>f.id),['siwol-market-four','siwol-market-peach-four','siwol-market-six','siwol-market-peach-six']);
for(const f of catalog)for(const key of ['src','preview','thumbnail'])if(f[key]&&!f[key].startsWith('data:'))assert.ok(fs.existsSync('dist/'+f[key]));
console.log('PASS: single footer QR, no overlap in either orientation, no QR without consent, Siwol-only visibility and all assets preserved');

const withQR=calendarLayout(600,1057,0,'#BF4022','siwol',qrUrl),withoutQR=calendarLayout(600,1057,0,'#BF4022','siwol');assert.deepEqual(withQR.filter(p=>p.type==='photo'),withoutQR.filter(p=>p.type==='photo'));assert.ok(withQR.find(p=>p.type==='qr').w>147);
