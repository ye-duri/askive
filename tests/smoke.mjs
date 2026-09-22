import vm from 'node:vm';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const elements=new Map(), draws=[], tools=[];
class Element {
 constructor(id=''){this.id=id;this.hidden=false;this.disabled=false;this.style={setProperty(k,v){this[k]=v;}};this.dataset={};this.children=[];this.value='';const classes=new Set();this.classList={toggle(k,v){if(v)classes.add(k);else classes.delete(k);},add(k){classes.add(k);},remove(k){classes.delete(k);},contains(k){return classes.has(k);}};this.naturalWidth=1080;this.naturalHeight=1440;this.videoWidth=1920;this.videoHeight=1080;this.readyState=4;}
 setAttribute(k,v){this[k]=v;}getAttribute(k){return this[k]??null;}removeAttribute(){}append(...v){this.children.push(...v);}replaceChildren(){this.children=[];}addEventListener(){}remove(){}click(){}showModal(){this.open=true;}close(){this.open=false;}
 async decode(){}async play(){}getContext(){return {save(){},restore(){},translate(){},scale(){},fillRect(){},getImageData(){return {data:new Uint8ClampedArray([80,120,160,255])};},putImageData(){},drawImage(...a){draws.push(a);}};}toBlob(fn,type){fn(new Blob(['test'],{type}));}toDataURL(){return 'data:image/jpeg;base64,dGVzdA==';}
}
const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
class Image extends Element {set src(v){this._src=v;queueMicrotask(()=>this.onload?.());}get src(){return this._src;}}
const context=vm.createContext({console,Image,Blob,File,URL,queueMicrotask,setTimeout:(fn,ms)=>ms>=60000?0:setTimeout(fn,ms),document:{getElementById:el,querySelectorAll:()=>el('frames').children,createElement:()=>new Element(),body:new Element(),addEventListener(){},modelContext:{registerTool:async t=>tools.push(t)}},window:{isSecureContext:true,addEventListener(){},print(){context.didPrint=true;}},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}],getVideoTracks:()=>[{getSettings:()=>({facingMode:'user'}),addEventListener(){}}]})}},fetch:async()=>({ok:true,json:async()=>JSON.parse(await fs.readFile(new URL('../dist/frames.json',import.meta.url),'utf8'))})});
let source=await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8');
await vm.runInContext(`(async()=>{${source}\nglobalThis.readSession=()=>shotSession;globalThis.filterUnderTest=filterPixels;})()`,context);
assert.equal(el('frames').children.length,6);
await tools[0].execute({id:'club-grid'});assert.equal(el('overlay').src,'frames/club-grid.svg');
await assert.rejects(()=>tools[0].execute({id:'missing'}));
await assert.rejects(()=>tools[0].execute({id:'classic'}));
await assert.rejects(()=>tools[0].execute({id:'lime'}));
await assert.rejects(()=>tools[0].execute({id:'midnight'}));
el('photo-filter').value='original';
assert.equal(context.document.body.classList.contains('is-permission'),true);assert.equal(el('capture').disabled,true);
const cameraMock=context.navigator.mediaDevices.getUserMedia;
context.navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});};
await el('permission-start').onclick();assert.equal(context.document.body.classList.contains('is-permission'),true);assert.match(el('permission-status').textContent,/권한/);
context.navigator.mediaDevices.getUserMedia=cameraMock;
await el('permission-start').onclick();assert.equal(context.document.body.classList.contains('is-setup'),true);assert.equal(context.document.body.classList.contains('is-shooting'),false);assert.equal(el('capture').disabled,true);
await el('setup-done').onclick();assert.equal(context.document.body.classList.contains('is-shooting'),true);
el('edit-settings').onclick();assert.equal(context.document.body.classList.contains('is-setup'),true);await el('setup-done').onclick();

// Shooting timer stays in sync and is locked only during the active countdown.
assert.equal(el('capture-timer-row').hidden,false);
el('capture-timer').value='5';el('capture-timer').onchange();assert.equal(el('timer').value,'5');
el('timer').value='0';el('timer').onchange();assert.equal(el('capture-timer').value,'0');
// Cancel a pending shot without losing completed photos.
el('timer').value='0';await el('capture').onclick();assert.equal(context.readSession().taken,1);
el('timer').value='3';const pending=el('capture').onclick();assert.equal(el('capture-timer').disabled,true);el('capture-timer').value='10';el('capture-timer').onchange();assert.equal(el('timer').value,'3');el('cancel').onclick();assert.equal(el('capture-timer').disabled,false);await pending;assert.equal(context.readSession().taken,1);
el('timer').value='0';
for(let i=1;i<10;i++){await el('capture').onclick();assert.equal(context.readSession().taken,i+1);assert.equal(context.document.body.classList.contains('is-result'),false);}
assert.equal(context.document.body.classList.contains('is-selecting'),true);
assert.equal(context.document.body.classList.contains('is-shooting'),false);
assert.equal(el('photo-grid').children.length,10);assert.equal(el('finish-selection').disabled,true);assert.equal(el('capture').disabled,true);
await el('capture').onclick();assert.equal(context.readSession().taken,10);
const photos=context.readSession().photos;
el('photo-grid').scrollTop=320;
for(const index of [7,2,9])el('photo-grid').children[index].onclick();
assert.equal(el('photo-grid').scrollTop,320);
await el('finish-selection').onclick();assert.equal(context.document.body.classList.contains('is-selecting'),true);
el('photo-grid').children[0].onclick();assert.equal(el('selection-count').textContent,'4 / 4 선택');
el('photo-grid').children[5].onclick();assert.equal(el('selection-count').textContent,'4 / 4 선택');assert.equal(el('photo-grid').children[5]['aria-pressed'],'false');
// Unselect and choose again; numbering and composition follow selection order.
el('photo-grid').children[2].onclick();assert.equal(el('finish-selection').disabled,true);el('photo-grid').children[2].onclick();
const preservedFrame=el('selection-frame-overlay').getAttribute('src');
for(const name of ['bright','vivid','original']){el('filter-'+name).onclick();assert.equal(el('photo-filter').value,name);assert.equal(el('filter-'+name)['aria-pressed'],'true');assert.equal(el('selection-frame-overlay').getAttribute('src'),preservedFrame);assert.equal(el('selection-count').textContent,'4 / 4 선택');}
const pixels=new Uint8ClampedArray([80,120,160,77]);context.filterUnderTest(pixels,'bright');assert.deepEqual([...pixels],[96,140,180,77]);
const vivid=new Uint8ClampedArray([80,120,160,77]);context.filterUnderTest(vivid,'vivid');assert.deepEqual([...vivid],[67,120,174,77]);
const original=new Uint8ClampedArray([80,120,160,77]);context.filterUnderTest(original,'original');assert.deepEqual([...original],[80,120,160,77]);
draws.length=0;await el('finish-selection').onclick();
assert.equal(context.document.body.classList.contains('is-result'),true);assert.equal(el('result').hidden,false);
// Crop sources in order [7,9,0,2], then final overlay; repeated UI render draws are before final composition.
const photoDraws=draws.filter(d=>photos.includes(d[0]));assert.deepEqual(photoDraws.slice(-4).map(d=>photos.indexOf(d[0])),[7,9,0,2]);
assert.deepEqual(draws.filter(d=>d.length===3).slice(-4).map(d=>d.slice(1)),[[42,42],[552,42],[42,642],[552,642]]);
assert.equal(draws.at(-1)[0].src,'frames/club-grid.svg');
// Frame choices now live beside filters. Original photos and order survive a design change.
el('reselect').onclick();assert.equal(el('editing-frames').children.length,6);
el('photo-filter').value='bright';await el('editing-frames').children[1].onclick();
assert.equal(el('overlay').src,'frames/with-you-grid-askive.svg');assert.equal(context.readSession().photos,photos);assert.equal(el('selection-count').textContent,'4 / 4 선택');assert.equal(el('photo-filter').value,'bright');
await el('editing-frames').children[1].onclick();el('photo-filter').value='original';await el('finish-selection').onclick();
// Native file sharing only after explicit consent; no network upload or false delivery confirmation.
let shared=[];context.navigator.canShare=()=>true;context.navigator.share=async data=>{shared.push(data);};
el('send-open').onclick();await el('send-submit').onclick();assert.equal(shared.length,0);
el('send-consent').checked=true;el('send-consent').onchange();await el('send-submit').onclick();
assert.equal(shared.length,1);assert.equal(shared[0].files[0].type,'image/png');assert.ok(shared[0].files[0].size>0);assert.match(el('send-status').textContent,/전송 여부/);assert.equal(el('send-consent').checked,false);
context.navigator.share=async()=>{throw Object.assign(new Error(),{name:'AbortError'});};el('send-consent').checked=true;await el('send-submit').onclick();assert.match(el('send-status').textContent,/취소/);
context.navigator.canShare=()=>false;el('send-open').onclick();assert.match(el('send-status').textContent,/지원하지/);assert.equal(el('send-submit').disabled,true);
// Printing uses the finalized image and remains usable when the host ignores or throws on print.
el('paper').value='postcard';el('print-fit').value='contain';await el('print-open').onclick();assert.equal(el('print-canvas').width,1181);assert.equal(el('print-canvas').height,1748);
el('print').onclick();assert.equal(context.didPrint,true);assert.equal(el('print-dialog').open,true);
context.window.print=()=>{throw new Error('unsupported')};el('print').onclick();assert.match(el('print-status').textContent,/열지 못했어요/);el('print-file').onclick();assert.match(el('print-status').textContent,/HTML/);
el('reselect').onclick();assert.equal(el('photo-grid').children.length,10);assert.equal(el('selection-count').textContent,'4 / 4 선택');el('photo-filter').value='bright';el('photo-filter').onchange();await el('finish-selection').onclick();assert.equal(el('result').hidden,false);
el('retake').onclick();assert.equal(context.readSession(),null);assert.equal(context.document.body.classList.contains('is-setup'),true);assert.equal(el('permission-panel').hidden,true);assert.equal(el('photo-grid').children.length,0);assert.equal(el('photo-filter').value,'original');assert.equal(el('welcome').hidden,false);
await tools[0].execute({id:'club-strip'});assert.equal(el('overlay').hidden,false);
console.log('PASS: ten manual shots, cancellation preserves photos, limit 10, choose exactly 4, ordered placement, selection cap, filters/alpha, reselect without recapture, final print/export, reset, custom portrait frame. Mock camera/DOM; pixel formulas tested directly.');

for(const count of [1,2,6]){
 await el('cuts-'+count).onclick();assert.equal(el('frames').children.length,3);assert.equal(el('cuts-'+count)['aria-pressed'],'true');
 await el('setup-done').onclick();el('timer').value='0';for(let i=0;i<10;i++)await el('capture').onclick();
 assert.equal(el('editing-frames').children.length,3);assert.equal(el('finish-selection').disabled,true);
 for(let i=0;i<count;i++)el('photo-grid').children[i].onclick();
 el('photo-grid').children[9].onclick();assert.equal(el('selection-count').textContent,`${count} / ${count} 선택`);
 const shots=context.readSession().photos;await el('editing-frames').children[2].onclick();assert.equal(context.readSession().photos,shots);
 await el('finish-selection').onclick();assert.equal(el('result').hidden,false);assert.match(el('shot-progress').textContent,new RegExp(`${count}장`));
 el('reselect').onclick();assert.equal(el('selection-count').textContent,`${count} / ${count} 선택`);await el('finish-selection').onclick();el('retake').onclick();
}
console.log('PASS: 1/2/4/6-cut selection limits, compatible frame lists, inline frame changes, source preservation and re-edit.');
