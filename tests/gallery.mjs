import assert from 'node:assert/strict';
import {gallery,cleanup} from '../lib/gallery.mjs';
const store=new Map();const env={CLEANUP_ENABLED:'1',KIOSK_SECRET:'test-only-secret-at-least-32-characters',PHOTOS:{async put(k,v,o){store.set(k,{v,o});},async get(k){const a=store.get(k);return a?{text:async()=>String(a.v),body:a.v,httpMetadata:a.o.httpMetadata}:null;},async delete(ks){for(const k of ks)store.delete(k);},async list(){return {objects:[...store].map(([key,a])=>({key,customMetadata:a.o.customMetadata})),truncated:false};}}};
const origin='https://test.invalid';let cookie='';const call=(path,method='GET',body,other={})=>gallery(new Request(origin+'/api/gallery/'+path,{method,headers:{origin,cookie,...other},body}),env);
assert.equal((await call('albums','POST')).status,401);assert.equal((await call('unlock','POST',JSON.stringify({code:'wrong'}))).status,403);
assert.equal((await call('unlock','POST',JSON.stringify({code:env.KIOSK_SECRET}),{origin:'https://evil.invalid'})).status,403);
const login=await call('unlock','POST',JSON.stringify({code:env.KIOSK_SECRET}));assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);cookie=login.headers.get('set-cookie').split(';')[0];
const consentBody=JSON.stringify({consent:true,policyVersion:'2026-09-26-qr-v1'});
assert.equal((await call('albums','POST')).status,400);assert.equal((await call('albums','POST',JSON.stringify({consent:false}))).status,400);assert.equal(store.size,0);
const album=await (await call('albums','POST',consentBody)).json();assert.match(album.id,/^[a-f0-9]{48}$/);assert.equal((await call('albums/'+album.id)).status,409);
function photos(bad=false){const f=new FormData();for(let i=0;i<9;i++)f.append(String(i),new Blob([new Uint8Array(bad?[1,2,3]:[255,216,255,217])],{type:'image/jpeg'}),'p.jpg');return f;}
assert.equal((await call('albums/'+album.id,'PUT',photos(true))).status,400);assert.equal(store.size,1);assert.equal((await call('albums/'+album.id,'PUT',photos())).status,200);
assert.equal((await call('albums/'+album.id,'PUT',new Uint8Array(13*1024*1024))).status,413);
const saved=cookie;cookie='';assert.equal((await call('albums/'+album.id)).status,200);const photo=await call('albums/'+album.id+'/8');assert.equal(photo.status,200);assert.match(photo.headers.get('cache-control'),/no-store/);assert.equal((await call('albums/'+album.id,'DELETE')).status,401);cookie=saved;
assert.equal((await call('albums/'+album.id,'DELETE')).status,200);assert.equal(store.size,0);
const expired=await (await call('albums','POST',consentBody)).json();store.get(expired.id+'/meta').v=JSON.stringify({expiresAt:Date.now()-1,ready:true});assert.equal((await call('albums/'+expired.id)).status,410);assert.equal(store.size,0);
await call('albums','POST',consentBody);await cleanup(env.PHOTOS,Date.now()+86401000);assert.equal(store.size,0);
console.log('PASS: QR auth, origin, private read tokens, upload validation, no-store, delete, 24-hour expiry, cleanup.');
