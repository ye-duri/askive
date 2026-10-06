import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createShootingMusic} from '../dist/shooting-music.js';
let a;class Fake{constructor(){a=this;this.currentTime=0;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}load(){this.currentTime=0;}getAttribute(){return this.src;}removeAttribute(){this.src='';}}
const m=createShootingMusic(Fake);const frames=JSON.parse(fs.readFileSync(new URL('../dist/frames.json',import.meta.url)));
let checked=0;for(const f of frames){let want='';if(f.edition==='special'){if(f.id.includes('musical'))want=/-(offset|six-landscape)$/.test(f.id)?'musical-time':'musical';else if(f.id.includes('festival'))want='festival';else if(f.id.includes('yugwansun'))want='yugwansun';else if(f.id.startsWith('hanmaeum-2026-together-'))want='family';}m.prepare(f);assert.equal(a.src,want?`audio/${want}.mp3`:'');m.start(f);assert.equal(a.paused,!want);m.stop();assert.equal(a.paused,true);assert.equal(a.currentTime,0);checked++;}console.log(`PASS ${checked} actual catalogue frames: track selection, playback, stop`);
