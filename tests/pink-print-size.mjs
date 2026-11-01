import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calendarLayout} from '../dist/print/calendar-layout.mjs';
const root=new URL('../dist/',import.meta.url),frames=JSON.parse(await readFile(new URL('frames.json',root))),basic=frames.find(f=>f.id==='basic-4-grid-black');
for(const id of ['ask-pink-heart-four','ask-pink-heart-six']){
 const f=frames.find(f=>f.id===id),png=await readFile(new URL(f.src,root));
 assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1776]);
 assert.deepEqual([f.sourceWidth,f.sourceHeight],[basic.sourceWidth,basic.sourceHeight]);
 const commands=calendarLayout(f.sourceWidth,f.sourceHeight);
 assert.deepEqual(commands,[{type:'photo',x:0,y:0,w:1200,h:1776,rotation:0}]);
 assert.deepEqual(commands,calendarLayout(basic.sourceWidth,basic.sourceHeight));
 console.log('PASS:',id,'same print aspect and page placement as basic; default 94% adds only the shared printer margin');
}
