import {cleanup} from '../lib/gallery.mjs';
export default {
 async scheduled(event,env,ctx){
  ctx.waitUntil((async()=>{
   await cleanup(env.PHOTOS);
   await env.PHOTOS.put('_system/cleanup-health',JSON.stringify({lastSuccessAt:Date.now()}),{httpMetadata:{contentType:'application/json'}});
   console.log('Expired-photo cleanup completed.');
  })());
 }
};
