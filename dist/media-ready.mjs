// Bound browser media promises; stop streams that arrive after a timed-out request.
export function withTimeout(promise,ms,message,onLate=()=>{}) {
 return new Promise((resolve,reject)=>{
  let expired=false;
  const timer=setTimeout(()=>{expired=true;const e=new Error(message);e.name='TimeoutError';reject(e);},ms);
  Promise.resolve(promise).then(value=>{if(expired){onLate(value);return;}clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
 });
}
export function waitForVideo(video,cancelled,ms=12000){
 return new Promise((resolve,reject)=>{
  const started=Date.now();
  const check=()=>{
   if(cancelled()){reject(new DOMException('Camera request cancelled','AbortError'));return;}
   if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0){resolve();return;}
   if(Date.now()-started>=ms){const e=new Error('카메라 영상이 들어오지 않아요. 연결을 확인하고 다시 시도해 주세요.');e.name='TimeoutError';reject(e);return;}
   setTimeout(check,50);
  };check();
 });
}
