import assert from 'node:assert/strict';import fs from 'node:fs';import {calendarLayout} from '../mac-print/public/calendar-layout.mjs';import {printPDF} from '../mac-print/print-pdf.mjs';
assert.equal(fs.readFileSync('dist/print/calendar-layout.mjs','utf8'),fs.readFileSync('mac-print/public/calendar-layout.mjs','utf8'));
const qrUrl='https://askive.pages.dev/gallery.html#'+'a'.repeat(48);
for(const [w,h]of [[1200,1776],[1536,1024],[1031,1526],[1200,2133]])for(const rotation of [0,90]){
 const plain=calendarLayout(w,h,rotation),layout=calendarLayout(w,h,rotation,'#000000','default',qrUrl);
 assert.equal(plain.length,1);const p=plain[0];assert.equal(p.type,'photo');assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=1200.001&&p.y+p.h<=1776.001);assert.ok(Math.abs(p.w/p.h-(rotation===90?h/w:w/h))<1e-8);assert.deepEqual(layout[0],p);
 const qr=layout[1];assert.equal(qr.type,'qr');assert.ok(qr.rects.length>100);assert.ok(qr.x>=0&&qr.y>=0&&qr.x+qr.w<=1200&&qr.y+qr.h<=1776);
 const jpeg=Buffer.from([255,216,255,192,0,17,8,h>>8,h&255,w>>8,w&255,3,1,17,0,2,17,0,3,17,0,255,217]);
 const pdf=printPDF(jpeg,94,rotation,'#000000','default',qrUrl).toString('latin1');assert.equal((pdf.match(/\/Photo Do/g)||[]).length,1);assert.ok(pdf.includes('0 0 0 rg'));
}
const full=calendarLayout(1200,1776)[0];assert.deepEqual([full.x,full.y,full.w,full.h],[0,0,1200,1776]);
assert.throws(()=>calendarLayout(1200,1776,0,'#000000','default','javascript:bad'));
const frames=JSON.parse(fs.readFileSync('dist/frames.json'));assert.equal(frames.filter(f=>!f.hidden).length,42);
for(const f of frames.filter(f=>!f.hidden)){assert.equal(f.layoutVersion,'single-frame-original-v1');assert.equal(f.dateVisible,false);assert.ok(Math.abs(Math.max(f.sourceWidth,f.sourceHeight)/Math.min(f.sourceWidth,f.sourceHeight)-1.48)<.021);for(const k of ['src','preview','thumbnail'])assert.ok(fs.existsSync('dist/'+f[k]));}
console.log('PASS: one centered undistorted frame, no calendar or duplicate logos, one consent QR, shared preview/PDF layout, 42 original-proportion date-free frames');
