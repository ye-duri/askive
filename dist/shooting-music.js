// One streaming audio element; no decoding or processing on the capture loop.
export function createShootingMusic(AudioClass=Audio){
 const audio=new AudioClass();audio.preload='none';audio.loop=true;
 let track='',revision=0;
 function stop(){revision++;audio.pause();audio.muted=true;try{audio.currentTime=0;}catch{}}
 function prepare(frame){
  stop();
  track=frame?.edition==='special'?(frame.id.includes('musical')?(/-(offset|six-landscape)$/.test(frame.id)?'musical-time':'musical'):frame.id.includes('yugwansun')?'yugwansun':frame.id.includes('festival')?'festival':''):'';
  if(!track){audio.removeAttribute('src');return;}
  const src=`audio/${track}.mp3`;if(audio.getAttribute('src')!==src)audio.src=src;
  // Called directly from the start-button gesture, before camera setup awaits.
  const run=revision;audio.muted=true;
  audio.play()?.catch(()=>{if(run===revision)audio.pause();});
 }
 function start(frame){
  if(!track)prepare(frame);if(!track)return;
  try{audio.currentTime=0;}catch{}
  audio.muted=false;const run=revision;
  audio.play()?.catch(()=>{if(run===revision)console.warn('촬영 배경음 재생이 차단됐습니다.');});
 }
 return {prepare,start,stop};
}
