import qrcode from './print/vendor/qrcode.mjs';
import {loadFrameImages} from './frame-images.mjs';
import {createShootingMusic} from './shooting-music.js';
const shootingMusic=createShootingMusic();
import {withTimeout, waitForVideo} from './media-ready.mjs';
const $ = id => document.getElementById(id);
const video = $('video');
let selected = null, stream = null, facing = 'user', busy = false, cameraBusy = false;
let countdownRun = 0, cameraRun = 0, blob = null, resultURL = null;
let sessionRun=0, lastActivity=Date.now(), idleWarning=false, printing=false, externalActionStarted=0;
let cameraDeviceId = '', cameraDevices = [], deviceListRun = 0;
let shotSession = null;
let advanceCapture = null;
let initializing=true;
let selectionDeadline=0, selectionClock=null;
let phase = new URLSearchParams(location.search).get('setup')==='1'?'permission':'intro';
let automatic=false, album=null;
let nativePrintBusy=false;

let cameraAccessGranted = false;
let selecting = false, chosen = [], activeSlot=-1;
const selectedCount=()=>chosen.filter(Number.isInteger).length;
const cutCount=4;
const FRAME_ID='time-capsule-four';
const frameCount=f=>f.count||f.slots?.length||4;
const CAPTURE_TOTAL = 6;
const qrPolicyVersion='2026-11-22-time-capsule-qr';
const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error);if(phase==='permission')$('permission-status').textContent=message;if(phase==='intro'){$('intro-status').hidden=!error;$('intro-status').textContent=error?message:'';} };
const loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('프레임 이미지를 열 수 없어요.')); img.src = src; });
const toBlob = (canvas, type = 'image/png', quality = .96) => new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요.')), type, quality));
function canCapture() {
 return phase==='shoot' && !!stream && video.readyState>=2 && video.videoWidth>0 && !busy && !cameraBusy && !blob && !selecting;
}
function controls() {
 const loading=initializing||cameraBusy||(busy&&!automatic&&selecting);
 $('transition-loading').hidden=!loading;
 $('transition-loading-text').textContent=busy&&!automatic&&selecting?'사진과 QR 사진함을 준비하고 있어요':'로딩 중이에요.';
 $('transition-loading').setAttribute('aria-busy',String(loading));
 for(const [cls,on] of Object.entries({'is-intro':phase==='intro','is-permission':phase==='permission','is-shooting':phase==='shoot'&&!blob&&!selecting,'is-selecting':selecting,'is-result':!!blob}))document.body.classList.toggle(cls,on);
 $('intro-panel').hidden=phase!=='intro';
 $('intro-start').disabled=initializing;
 $('permission-panel').hidden=phase!=='permission';
 $('permission-start').disabled=cameraBusy;
 $('permission-next').disabled=initializing||cameraBusy||!stream||!$('permission-video').videoWidth;
 const test=phase==='permission'&&cameraAccessGranted;
 $('permission-title').textContent=test?'카메라 화면을 확인해 주세요.':'먼저, 카메라를 허용해 주세요.';
 if(test)$('permission-next').textContent=new URLSearchParams(location.search).get('setup')==='1'?'카메라 설정 완료':'이 카메라로 촬영하기';
 for(const id of ['permission-camera-controls','camera-test','permission-next'])$(id).hidden=!test;
 $('permission-start').textContent=cameraBusy?'카메라 연결 중…':cameraAccessGranted?'다시 테스트':'카메라 허용';
 $('selection-panel').hidden=!selecting;
 $('capture-resume').hidden=!shotSession||!canCapture();
 $('capture-now').disabled=!automatic||phase!=='shoot'||!stream||cameraBusy;
 $('start').disabled=cameraBusy;
 for(const suffix of ['camera','camera-refresh'])$('permission-'+suffix).disabled=phase!=='permission'||busy||cameraBusy;
 $('retake').disabled=busy||nativePrintBusy;
 $('print-open').disabled=busy||!blob||!album||nativePrintBusy;

}
function prepareFrame(frame,img){
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('프레임 크기를 확인할 수 없어요.');
  const sourceWidth=frame.sourceWidth||img.naturalWidth, sourceHeight=frame.sourceHeight||img.naturalHeight;
  const ratio = sourceWidth / sourceHeight;
  if (ratio < .25 || ratio > 4) throw new Error('프레임의 가로세로 비율은 1:4~4:1이어야 해요.');
  const scale = Math.min(1, 2400 / Math.max(sourceWidth, sourceHeight));
  if (frame.slots && (!Array.isArray(frame.slots) || frame.slots.length !== frameCount(frame) || frame.slots.some(r => !Array.isArray(r) || r.length !== 4 || !r.every(Number.isFinite) || r[0]<0 || r[1]<0 || r[2]<=0 || r[3]<=0 || r[0]+r[2]>1 || r[1]+r[3]>1))) throw new Error('프레임의 사진 영역 설정이 올바르지 않아요.');
  return {...frame, img, width: Math.round(sourceWidth * scale), height: Math.round(sourceHeight * scale)};
}
function stopStream() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; $('permission-video').srcObject=null; }
function renderCameras() {
  for (const prefix of ['permission']) {
    const select = $(prefix+'-camera'); select.replaceChildren();
    for (const device of [{deviceId:'',label:'자동 선택'}, ...cameraDevices]) {
      const option = document.createElement('option'); option.value = device.deviceId;
      option.textContent = device.label; select.append(option);
    }
    if (cameraDeviceId && !cameraDevices.some(d=>d.deviceId===cameraDeviceId)) {
      const option=document.createElement('option');option.value=cameraDeviceId;option.textContent='선택한 카메라 · 연결 확인 필요';select.append(option);
    }
    select.value=cameraDeviceId;
  }
}
async function refreshCameras() {
  const run=++deviceListRun;
  try {
    if (!navigator.mediaDevices?.enumerateDevices) { renderCameras(); return; }
    const devices=await navigator.mediaDevices.enumerateDevices();
    if(run!==deviceListRun)return false;
    cameraDevices=devices.filter(d=>d.kind==='videoinput' && d.deviceId).map((d,i)=>({deviceId:d.deviceId,label:d.label||`카메라 ${i+1}`}));
    renderCameras();return true;
  } catch { status('카메라 목록을 읽지 못했어요. 연결을 확인한 뒤 새로고침해 주세요.',true); }
}
function cameraDisconnected(active) {
  if(stream!==active)return;
  cameraRun++;cameraBusy=false;stopStream();cancelCountdown();$('welcome').hidden=false;
  $('camera-state').textContent='카메라 연결 끊김';
  status('카메라 연결이 끊겼어요. 촬영한 사진은 유지됩니다. 같은 카메라를 다시 연결한 뒤 카메라 켜기를 눌러 주세요.',true);
  controls();void refreshCameras();
}
async function startCamera() {
  if (cameraBusy || busy) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { status('카메라는 HTTPS 또는 localhost에서 열어야 사용할 수 있어요. Safari나 Chrome에서 다시 열어 주세요.', true); return; }
  const run = ++cameraRun; cameraBusy = true; controls(); stopStream();
  $('camera-state').textContent = '카메라 연결 중';
  try {
    const source=cameraDeviceId ? {deviceId:{exact:cameraDeviceId}} : {facingMode:{ideal:'user'}};
    // Use the full 4:3 camera source for every shooting frame on iPad.
    // Frame apertures crop with cover in both live preview and final composition.
    const resolution=phase!=='permission'
      ? {width:{ideal:1440},height:{ideal:1080},aspectRatio:{ideal:4/3},resizeMode:{ideal:'crop-and-scale'}}
      : {width:{ideal:1920},height:{ideal:1080}};
    const next = await withTimeout(navigator.mediaDevices.getUserMedia({audio:false, video:{...source,...resolution,frameRate:{ideal:30}}}),20000,'카메라 연결 시간이 초과됐어요. 연결을 확인한 뒤 다시 시도해 주세요.',late=>late.getTracks().forEach(t=>t.stop()));
    if (run !== cameraRun) { next.getTracks().forEach(t => t.stop()); return; }
    stream = next;
    const track=next.getVideoTracks()[0];
    if(phase==='permission' && !cameraDeviceId)cameraDeviceId=track.getSettings().deviceId||'';
    // Mirror every camera consistently in preview and captured pixels, including USB/rear cameras.
    facing = track.getSettings().facingMode || '';
    track.addEventListener('ended',()=>cameraDisconnected(next));
    const targetVideo=phase==='permission'?$('permission-video'):video;
    if(phase==='permission'){cameraAccessGranted=true;controls();}
    targetVideo.srcObject = next;
    await withTimeout(targetVideo.play(),12000,'영상 재생이 시작되지 않았어요. 카메라를 사용하는 다른 앱을 닫고 다시 시도해 주세요.');
    await waitForVideo(targetVideo,()=>run!==cameraRun||stream!==next);
    if(run!==cameraRun || stream!==next)return;
    if(phase==='permission')cameraAccessGranted=true;
    video.style.transform = 'scaleX(-1)';
    $('permission-video').style.transform=video.style.transform;
    $('mirror-label').textContent = '좌우 반전';
    $('welcome').hidden = true; $('camera-state').textContent = track.label || '카메라 켜짐'; $('stage-label').textContent = '02 / 촬영';
    status(phase==='permission'?'카메라가 연결됐어요. 테스트 영상을 확인한 뒤 다음으로 넘어가 주세요.':'');
    void refreshCameras();
  } catch(e) {
    if(run!==cameraRun)return;
    stopStream(); $('welcome').hidden = false; $('camera-state').textContent = '카메라 꺼짐';
    const errors = {NotAllowedError:'카메라 권한이 꺼져 있어요. 브라우저의 사이트 설정에서 카메라를 허용한 뒤 다시 켜 주세요.',NotFoundError:'선택한 카메라를 찾지 못했어요. 연결을 확인하거나 다른 카메라를 선택해 주세요.',OverconstrainedError:'선택한 카메라에 연결할 수 없어요. 목록을 새로고침하고 다시 선택해 주세요.',NotReadableError:'다른 앱이 카메라를 사용 중일 수 있어요. 앱을 닫고 다시 시도해 주세요.'};
    status(phase==='shoot' && ['NotFoundError','OverconstrainedError'].includes(e.name) ? '처음 선택한 카메라를 찾지 못했어요. 같은 카메라를 다시 연결한 뒤 카메라 켜기를 눌러 주세요.' : errors[e.name] || (e.name==='TimeoutError'?e.message:'카메라를 켜지 못했어요. 연결을 확인하고 다시 시도해 주세요.'), true);
  } finally { if(run===cameraRun){cameraBusy = false; controls();} }
}
for(const prefix of ['permission']) {
  $(prefix+'-camera').onchange=async()=>{
    if(phase!=='permission'||busy||cameraBusy||blob||selecting)return;
    const wasConnected=!!stream;cameraDeviceId=$(prefix+'-camera').value;renderCameras();
    if(wasConnected||cameraAccessGranted)await startCamera();
  };
  $(prefix+'-camera-refresh').onclick=async()=>{
    if(phase!=='permission'||busy||cameraBusy||blob||selecting)return;
    void refreshCameras();
  };
}
navigator.mediaDevices?.addEventListener?.('devicechange',async()=>{
  const active=stream, id=active?.getVideoTracks()[0]?.getSettings().deviceId;
  const refreshed=await refreshCameras();
  if(refreshed && id && active===stream && !cameraDevices.some(d=>d.deviceId===id))cameraDisconnected(active);
});
renderCameras();
function outputSize(frame) {
  const width = frame.width, height = frame.height;
  return {width,height,slots:frame.slots.map(([x,y,w,h])=>({
    x:Math.round(x*width),y:Math.round(y*height),w:Math.round(w*width),h:Math.round(h*height)
  }))};
}
function showShotPreview() {
  if (!selected || blob) return;
  const size = outputSize(selected), index = (shotSession?.taken || 0) % size.slots.length, slot = size.slots[index];
  // Include a narrow border around the photo so overlapping artwork and frame edges remain visible.
  const pad = Math.round(Math.min(slot.w,slot.h)*.045);
  const left = Math.max(0,slot.x-pad), top = Math.max(0,slot.y-pad);
  const w = Math.min(size.width,slot.x+slot.w+pad)-left, h = Math.min(size.height,slot.y+slot.h+pad)-top;
  $('viewfinder').style.aspectRatio = `${w}/${h}`;
  $('viewfinder').style.setProperty('--preview-ratio',String(w/h));document.querySelector('.studio').style.setProperty('--shoot-ratio',String(w/h));
  Object.assign(video.style,{left:`${(slot.x-left)/w*100}%`,top:`${(slot.y-top)/h*100}%`,width:`${slot.w/w*100}%`,height:`${slot.h/h*100}%`});
  const overlay = $('overlay'); overlay.hidden = false;
  Object.assign(overlay.style,{left:`${-left/w*100}%`,top:`${-top/h*100}%`,width:`${size.width/w*100}%`,height:`${size.height/h*100}%`});
  $('map-image').src = selected.displaySrc||selected.src; $('frame-map').style.aspectRatio = `${size.width}/${size.height}`;
  $('map-slots').replaceChildren();
  size.slots.forEach((r,i)=>{const box=document.createElement('div'); box.className=`map-slot${i===index?' active':''}${i<index?' done':''}`;box.textContent=String(i+1);Object.assign(box.style,{left:`${r.x/size.width*100}%`,top:`${r.y/size.height*100}%`,width:`${r.w/size.width*100}%`,height:`${r.h/size.height*100}%`});$('map-slots').append(box);});
  $('preview-hint').textContent = `포즈 참고: ${index+1}번째 사진 자리 · 프레임 디자인에 맞춰 포즈를 잡아 주세요. 장식은 좌우 반전되지 않아요.`;
}
function updateShotMode() {
  $('shoot-instruction').textContent=`총 6장 촬영 후 원하는 ${cutCount}장을 선택해요.`;
  $('shot-progress').textContent = '0 / 6장 · 촬영 준비';
  $('shot-thumbs').replaceChildren();
  if (selected) { const size = outputSize(selected); $('size-label').textContent = `${size.width} × ${size.height} · PNG`; showShotPreview(); }
  controls();
}
function cancelCountdown() {
  shootingMusic.stop();
  countdownRun++; automatic=false; busy = false; $('countdown').hidden = true;
  $('shot-progress').textContent = `${shotSession?.taken || 0} / ${CAPTURE_TOTAL}장 완료 · 이번 촬영을 취소했어요.`; controls();
}
// Pixel-based filters work consistently without relying on CanvasRenderingContext2D.filter support.
function filterPixels(data, name) {
  for(let i=0;i<data.length;i+=4) {
    const r=data[i],g=data[i+1],b=data[i+2];
    if(name==='bright'){data[i]=Math.min(255,r*1.08+10);data[i+1]=Math.min(255,g*1.08+10);data[i+2]=Math.min(255,b*1.06+10);}
    else if(name==='mono'){const gray=Math.round(.2126*r+.7152*g+.0722*b);data[i]=data[i+1]=data[i+2]=gray;}
    else if(name==='vivid'){const l=.2126*r+.7152*g+.0722*b;for(let j=0;j<3;j++)data[i+j]=Math.max(0,Math.min(255,((data[i+j]-l)*1.2+l-128)*1.12+128));}
  }
}
function photoTile(photo, slot, filter='original') {
  const tile=document.createElement('canvas');tile.width=slot.w;tile.height=slot.h;
  const ctx=tile.getContext('2d'),scale=Math.max(tile.width/photo.width,tile.height/photo.height);
  const w=photo.width*scale,h=photo.height*scale;
  ctx.drawImage(photo,(tile.width-w)/2,(tile.height-h)/2,w,h);
  if(filter!=='original'){const pixels=ctx.getImageData(0,0,tile.width,tile.height);filterPixels(pixels.data,filter);ctx.putImageData(pixels,0,0);}
  return tile;
}
function composeSelection(canvas,frame=selected,includeFrame=true) {
  const size=outputSize(frame);canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#edf1f7';ctx.fillRect(0,0,canvas.width,canvas.height);
  const filter=$('photo-filter').value || 'original';
  chosen.forEach((index,i)=>{if(!Number.isInteger(index))return;const slot=size.slots[i];ctx.drawImage(photoTile(shotSession.photos[index],slot,filter),slot.x,slot.y);});
  if(includeFrame){ctx.save();ctx.filter='none';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(frame.img,0,0,canvas.width,canvas.height);ctx.restore();}
}
function renderSelection() {
  const photoScroll=$('photo-grid').scrollTop;
  const photoScrollLeft=$('photo-grid').scrollLeft;
  $('selection-title').textContent=`마음에 드는 ${cutCount}장을 골라 주세요.`;
  $('photo-grid').replaceChildren();
  const slot=outputSize(selected).slots[0], ratio=slot.h/slot.w;
  shotSession.photos.forEach((photo,index)=>{
    const button=document.createElement('button');button.className='photo-choice';button.disabled=busy;
    const uses=chosen.filter(i=>i===index).length;button.setAttribute('aria-pressed',String(uses>0));button.setAttribute('aria-label',`${index+1}번 사진 추가${uses?`, ${uses}칸에 사용 중`:''}`);
    const thumb=photoTile(photo,{w:420,h:Math.round(420*ratio)},$('photo-filter').value || 'original');
    const label=document.createElement('span');label.textContent=`사진 ${index+1}`;button.append(thumb,label);
    button.onclick=()=>{
      if(busy)return;
      if(activeSlot>=0){chosen[activeSlot]=index;activeSlot=-1;}
      else if(chosen.includes(null))chosen[chosen.indexOf(null)]=index;
      else if(chosen.length<cutCount)chosen.push(index);
      else{$('selection-status').textContent='모든 칸을 채웠어요. 미리보기에서 바꿀 컷을 누른 뒤 사진을 골라 주세요.';return;}
      $('selection-status').textContent=selectedCount()===cutCount?'미리보기에서 네 컷을 확인하고 완성해 주세요.':'선택한 순서대로 프레임에 들어갑니다.';
      renderSelection();controls();
    };
    $('photo-grid').append(button);
  });
  $('photo-grid').scrollTop=photoScroll;
  $('photo-grid').scrollLeft=photoScrollLeft;
  $('selection-count').textContent=`${selectedCount()} / ${cutCount} 선택`;
  $('finish-selection').disabled=selectedCount()!==cutCount || busy;
  $('finish-selection').textContent=selectedCount()===cutCount?`이 ${cutCount}장으로 완성하기`:`${cutCount-selectedCount()}장을 더 선택해 주세요`;
  for(const name of ['original','bright','vivid','mono']) { $('filter-'+name).disabled=busy; $('filter-'+name).setAttribute('aria-pressed',String(($('photo-filter').value || 'original')===name)); }
  $('photo-filter').disabled=busy;
  // Keep the original frame in an independent DOM layer. Only the photo canvas changes with filters.
  composeSelection($('selection-canvas'),selected,false);
  const displaySrc=selected.displaySrc||selected.src;
  if($('selection-frame-overlay').getAttribute('src')!==displaySrc)$('selection-frame-overlay').setAttribute('src',displaySrc);
  renderPreviewSlots();

}
function clearPreviewSlot(index){
 if(!selecting||busy)return;
 while(chosen.length<=index)chosen.push(null);
 chosen[index]=null;activeSlot=index;
 renderSelection();controls();
 $('selection-status').textContent=`${index+1}번째 칸에 넣을 사진을 골라 주세요.`;
}
function positionPreviewSlots(){
 if(!selecting||!selected)return;
 const canvas=$('selection-canvas'),box=canvas.getBoundingClientRect(),size=outputSize(selected);
 const scale=Math.min(box.width/size.width,box.height/size.height),w=size.width*scale,h=size.height*scale;
 const top=getComputedStyle(canvas).objectPosition.split(' ')[1]==='0%'?0:(box.height-h)/2;
 Object.assign($('preview-slot-controls').style,{left:`${(box.width-w)/2}px`,top:`${top}px`,width:`${w}px`,height:`${h}px`});
}
function renderPreviewSlots(){
 const layer=$('preview-slot-controls'),size=outputSize(selected);layer.replaceChildren();
 size.slots.forEach((slot,index)=>{
  const b=document.createElement('button');b.type='button';b.className='preview-slot';b.disabled=busy;
  b.setAttribute('aria-label',`${index+1}번째 컷 · ${Number.isInteger(chosen[index])?`사진 ${chosen[index]+1} · 취소하고 다시 선택`:'사진 선택'}`);
  b.classList.toggle('is-active',index===activeSlot);b.classList.toggle('is-empty',!Number.isInteger(chosen[index]));
  b.textContent=Number.isInteger(chosen[index])?'':`${index+1} · 사진 선택`;
  Object.assign(b.style,{left:`${slot.x/size.width*100}%`,top:`${slot.y/size.height*100}%`,width:`${slot.w/size.width*100}%`,height:`${slot.h/size.height*100}%`});
  b.onclick=()=>clearPreviewSlot(index);layer.append(b);
 });positionPreviewSlots();
}
new ResizeObserver(positionPreviewSlots).observe($('selection-canvas'));
window.addEventListener('resize',positionPreviewSlots);
function stopSelectionClock(){
 clearInterval(selectionClock);selectionClock=null;selectionDeadline=0;$('selection-timer').hidden=true;
}
function startSelectionClock(){
 stopSelectionClock();selectionDeadline=Date.now()+90000;
 selectionClock=setInterval(updateSelectionClock,250);updateSelectionClock();
}
function updateSelectionClock(){
 if(!selecting||!selectionDeadline)return;
 const remaining=Math.max(0,Math.ceil((selectionDeadline-Date.now())/1000));
 $('selection-timer').hidden=false;
 $('selection-timer-value').textContent=`${remaining}초`;
 $('selection-timer').classList.toggle('is-urgent',remaining<=10);
 if(remaining||busy)return;
 chosen=Array.from({length:cutCount},(_,index)=>Number.isInteger(chosen[index])?chosen[index]:index);
 activeSlot=-1;renderSelection();
 $('selection-status').textContent='선택 시간이 끝났어요. 사진을 자동 완성합니다.';
 $('finish-selection').onclick();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateSelectionClock();});
function openSelection() {
  phase='shoot';selecting=true; $('result').hidden=true; $('result-actions').hidden=true;
  $('stage-label').textContent='03 / 사진 선택';renderSelection();controls();window.scrollTo(0,0);startSelectionClock();
  // Prep is local. If it fails, finishing the selection can retry from that photo.
  void prepareOriginals(shotSession).catch(()=>{});
}
function waitCaptureTick(){
 return new Promise(resolve=>{
  const finish=manual=>{clearTimeout(timer);if(advanceCapture===skip)advanceCapture=null;resolve(manual);};
  const skip=()=>finish(true),timer=setTimeout(()=>finish(false),1000);advanceCapture=skip;
 });
}
$('capture-now').onclick=()=>{if(automatic&&phase==='shoot'&&stream&&!cameraBusy)advanceCapture?.();};
async function capture() {
 if(!canCapture()||automatic)return;
 status('');
 shootingMusic.start(selected);
 $('capture-admin').open=false;automatic=true;busy=true;const run=++countdownRun;const revision=sessionRun;
 if(!shotSession)shotSession={photos:[],taken:0,originalJpegs:[]};controls();
 try {
  while(shotSession.taken<CAPTURE_TOTAL){
   $('shot-progress').textContent=`${shotSession.taken+1} / ${CAPTURE_TOTAL}장 · 포즈를 준비해 주세요`;
   for(let n=5;n>0;n--){$('countdown').textContent=n;$('countdown').hidden=false;const manual=await waitCaptureTick();if(run!==countdownRun||revision!==sessionRun)return;if(manual)break;}
   if(!stream||video.readyState<2||!video.videoWidth)throw new Error('카메라 연결을 확인한 뒤 남은 촬영을 이어가 주세요.');
   const photo=document.createElement('canvas');const scale=Math.min(1,1440/Math.max(video.videoWidth,video.videoHeight));photo.width=Math.round(video.videoWidth*scale);photo.height=Math.round(video.videoHeight*scale);
   const ctx=photo.getContext('2d');ctx.save();ctx.translate(photo.width,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,photo.width,photo.height);ctx.restore();
   shotSession.photos.push(photo);shotSession.taken++;playShutterSound();$('countdown').hidden=true;
   $('shot-progress').textContent=`${shotSession.taken} / ${CAPTURE_TOTAL}장 촬영 완료`;
   $('flash').classList.remove('active');void $('flash').offsetWidth;$('flash').classList.add('active');showShotPreview();
  }
  $('flash').classList.remove('active');stopStream();shootingMusic.stop();
  $('camera-state').textContent='촬영 완료';
  chosen=[];activeSlot=-1;busy=false;automatic=false;
  openSelection();
 }catch(e){status(e.message||'촬영을 이어갈 수 없어요. 연결을 확인해 주세요.',true);}
 finally{if(run===countdownRun){shootingMusic.stop();busy=false;automatic=false;$('countdown').hidden=true;controls();}}
}
for(const name of ['original','bright','vivid','mono']) $('filter-'+name).onclick=()=>{if(!busy){$('photo-filter').value=name;renderSelection();}};
$('photo-filter').onchange=()=>{if(!busy)renderSelection();};
$('finish-selection').onclick=async()=>{
  if(!selecting||busy||selectedCount()!==cutCount||!shotSession||shotSession.photos.length!==CAPTURE_TOTAL)return;
  stopSelectionClock();busy=true;const revision=sessionRun;
  try{
    renderSelection();controls();
    await new Promise(resolve=>setTimeout(resolve,32));if(revision!==sessionRun)return;
    // Never export the reduced screen image, even when the original is still loading.
    const frame=selected;
    const original=frame.originalImage?await withTimeout(frame.originalImage(),12000,'프레임 원본을 불러오지 못했어요. 완성하기를 다시 눌러 주세요.'):frame.img;
    if(revision!==sessionRun)return;
    const canvas=document.createElement('canvas');composeSelection(canvas,{...frame,img:original});
    await ensureQrAlbum(revision);
    if(revision!==sessionRun)return;
    // The print renderer adds its own QR to this clean gallery image.
    const printImage=await withTimeout(toBlob(canvas,'image/jpeg',.94),15000,'인쇄용 사진을 준비하지 못했어요.');
    if(revision!==sessionRun)return;
    drawAlbumQR(canvas,album.id);
    await uploadAlbumPhotos(revision,printImage);
    if(revision!==sessionRun)return;
    const nextBlob=await withTimeout(toBlob(canvas),15000,'사진 처리 시간이 초과됐어요. 완성하기를 다시 눌러 주세요.');if(revision!==sessionRun)return;
    const nextURL=URL.createObjectURL(nextBlob);$('result').src=nextURL;
    try{await withTimeout($('result').decode(),10000,'완성 사진을 열지 못했어요. 다시 시도해 주세요.');}catch(e){URL.revokeObjectURL(nextURL);throw e;}
    if(revision!==sessionRun){URL.revokeObjectURL(nextURL);return;}if(resultURL)URL.revokeObjectURL(resultURL);blob=nextBlob;resultURL=nextURL;selecting=false;
    $('size-label').textContent=`${canvas.width} × ${canvas.height} · 프레임 원본 비율`;
    $('viewfinder').style.aspectRatio=`${canvas.width}/${canvas.height}`;$('viewfinder').style.setProperty('--preview-ratio',String(canvas.width/canvas.height));
    $('result-admin-tools').open=false;$('result').hidden=false;$('result-actions').hidden=false;
    $('shot-progress').textContent='소중한 사진이 완성되었습니다.';$('stage-label').textContent='04 / 사진 완성';
    status('');
  }catch(e){
    if(revision===sessionRun){
      if([401,404,410].includes(e.status))album=null;
      $('selection-status').textContent=(e.message||'사진함을 준비하지 못했어요.')+' 선택한 사진은 그대로예요. 완성하기를 다시 눌러 주세요.';
    }
  }
  finally{if(revision===sessionRun){busy=false;try{if(selecting)renderSelection();}finally{controls();}}}
};
function filename(ext) { return `moment-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`; }
function download(data, name) { const url=URL.createObjectURL(data); const a=document.createElement('a'); a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000); }
$('start').onclick = openShooting;
$('permission-start').onclick=()=>startCamera();
$('intro-start').onclick=async()=>{
 if(initializing||busy||phase!=='intro')return;
 if(!selected)await init();
 if(selected&&phase==='intro'&&!$('capture-prompt').open)$('capture-prompt').showModal();
};
$('capture-confirm').onclick=()=>{
 if(!$('capture-prompt').open||phase!=='intro')return;
 $('capture-prompt').close();
 void openShooting();
};
$('permission-video').addEventListener('loadeddata',controls);
$('permission-next').onclick=async()=>{
 if($('permission-next').disabled)return;
 if(!selected)await init();
 if(!selected)return;
 const fromSettings=new URLSearchParams(location.search).get('setup')==='1';
 stopStream();
 try{sessionStorage.setItem('yonsei-camera-id',cameraDeviceId);}catch{}
 if(fromSettings){
   history.replaceState(null,'',location.pathname);
   resetSession();
   return;
 }
 await openShooting();
};
async function openShooting(){
 if(cameraBusy||busy||selecting||blob)return;
 const revision=sessionRun;
 phase='shoot';
 updateShotMode();window.scrollTo(0,0);
 await startCamera();
 if(revision!==sessionRun||phase!=='shoot')return;
 if(!stream){
   phase='permission';cameraAccessGranted=false;cameraDeviceId='';
   renderCameras();controls();
   $('permission-status').textContent=$('status').textContent;
   $('permission-start').focus({preventScroll:true});
   return;
 }
 if(!document.hidden)void capture();
 else if(!shotSession)resetSession();
}
video.addEventListener('loadeddata',controls);
$('capture-resume').onclick = capture;

$('save').onclick = () => {if(blob) {download(blob,filename('png'));status('사진 저장을 요청했어요. 다운로드 또는 사진 앱을 확인해 주세요.');}};
function resetSession(message='이용이 종료됐어요. 사진을 지웠습니다.') {
  shootingMusic.stop();
  stopSelectionClock();
  sessionRun++;cameraRun++;countdownRun++;
  stopStream();busy=false;cameraBusy=false;
  for(const photo of shotSession?.photos||[]){photo.width=1;photo.height=1;}
  if(shotSession)shotSession.originalJpegs.length=0;
  $('print-receipt').close();
  if($('capture-prompt').open)$('capture-prompt').close();
  shotSession=null;chosen=[];activeSlot=-1;blob=null;selecting=false;nativePrintBusy=false;
  $('selection-canvas').width=1;$('selection-canvas').height=1;
  for(const id of ['result','selection-frame-overlay'])$(id).removeAttribute('src');
  for(const id of ['photo-grid','preview-slot-controls','shot-thumbs','map-slots'])$(id).replaceChildren();
  if(resultURL)URL.revokeObjectURL(resultURL);resultURL=null;
  $('photo-filter').value='original';$('selection-status').textContent='';
  $('result-admin-tools').open=false;$('result').hidden=true;$('result-actions').hidden=true;
  $('countdown').hidden=true;$('welcome').hidden=false;
  for(const id of ['idle-dialog'])if($(id).open)$(id).close();
  album=null;automatic=false;idleWarning=false;printing=false;externalActionStarted=0;lastActivity=Date.now();
  phase='intro';controls();status(message);
}
function hasPrivateSession(){return !!shotSession||!!blob;}
function touchSession(){if(!idleWarning)lastActivity=Date.now();}
function checkIdle(now=Date.now()){
  if(!hasPrivateSession()){lastActivity=now;return;}
  if(busy||cameraBusy){lastActivity=now;return;}
  // A missing native close event must not disable expiry forever.
  if(printing){
    if(now-externalActionStarted<300000){lastActivity=now;return;}
    printing=false;
  }
  const elapsed=now-lastActivity;
  if(elapsed>=150000){resetSession('오랫동안 조작이 없어 사진을 지웠어요.');return;}
  if(elapsed>=120000){idleWarning=true;$('idle-seconds').textContent=String(Math.max(1,Math.ceil((150000-elapsed)/1000)));if(!$('idle-dialog').open)$('idle-dialog').showModal();}
}
$('idle-continue').onclick=()=>{idleWarning=false;lastActivity=Date.now();$('idle-dialog').close();};
$('idle-end').onclick=()=>resetSession();
$('idle-dialog').addEventListener('cancel',e=>{e.preventDefault();$('idle-continue').onclick();});
for(const event of ['pointerdown','keydown','input','scroll'])document.addEventListener(event,touchSession,{capture:true,passive:true});
window.setInterval?.(()=>checkIdle(),1000);
$('retake').onclick=()=>resetSession();
let printCompletion=null;
function showPrintCompletion(revision){
 if(revision!==sessionRun)return Promise.resolve();
 if(printCompletion?.revision===revision)return printCompletion.promise;
 $('print-receipt').classList.add('is-complete');
 $('print-receipt-title').textContent='사진 전송이 완료되었습니다.';
 $('print-receipt-message').textContent='담당자를 통해 확인해주세요.';
 $('print-receipt-close').hidden=true;
 if(!$('print-receipt').open)$('print-receipt').showModal();
 const promise=new Promise(resolve=>setTimeout(resolve,5000)).then(()=>{
  if(revision===sessionRun)return resetSession();
 });
 printCompletion={revision,promise};return promise;
}
$('print-open').onclick=async()=>{
 if(busy||nativePrintBusy||!blob||!album)return;
 const revision=sessionRun;nativePrintBusy=true;printing=true;externalActionStarted=Date.now();controls();
 $('print-receipt').classList.remove('is-complete');
 $('print-receipt-title').textContent='인쇄 사진을 접수하고 있어요.';
 $('print-receipt-message').textContent='QR이 담긴 사진의 인쇄를 접수하고 있어요.';
 $('print-receipt-close').hidden=true;$('print-receipt').showModal();
 try{
  await apiJSON(`/api/gallery/albums/${album.id}/print`,{method:'POST'});if(revision!==sessionRun)return;
  await showPrintCompletion(revision);
 }catch(e){if(revision===sessionRun){$('print-receipt').close();status(`${e.message} 사진은 유지됩니다. 사진 인쇄를 눌러 다시 시도해 주세요.`,true);}}
 finally{if(revision===sessionRun){nativePrintBusy=false;printing=false;lastActivity=Date.now();controls();}}
};
$('print-receipt-close').onclick=()=>$('print-receipt').close();
$('print-receipt').addEventListener('cancel',e=>{if(nativePrintBusy)e.preventDefault();});
window.addEventListener('yonsei-print-state',e=>{
 if(!nativePrintBusy||printCompletion?.revision===sessionRun)return;
 const d=e.detail||{};
 if(d.state==='sent'){
  void showPrintCompletion(sessionRun);
  return;
 }
 if(d.state!=='busy'){
  $('print-receipt').close();nativePrintBusy=false;printing=false;lastActivity=Date.now();controls();
 }
 status(d.message||'프린터 상태를 확인해 주세요.',d.state==='error');
});
window.addEventListener('afterprint',()=>{printing=false;lastActivity=Date.now();});
window.addEventListener('focus',()=>{printing=false;checkIdle();});
window.addEventListener('pagehide',()=>{resetSession();});
window.addEventListener('pageshow',()=>{if(!stream){$('welcome').hidden=false;$('camera-state').textContent='카메라 꺼짐';controls();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkIdle();if(document.hidden && automatic){cancelCountdown();status('화면이 전환되어 촬영을 취소했어요.');}});
async function init(){
 initializing=true;controls();
 try{
  const response=await fetch('frames.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('프레임 목록을 읽지 못했어요.');
  const frame=(await response.json()).find(item=>item.id===FRAME_ID&&!item.hidden);
  if(!frame)throw new Error('타임캡슐 프레임을 찾지 못했어요.');
  const images=await loadFrameImages(frame,src=>withTimeout(loadImage(src),20000,'타임캡슐 프레임을 불러오지 못했어요. 다시 시도해 주세요.'));
  selected={...prepareFrame(frame,images.image),displaySrc:images.displaySrc,originalImage:images.original};
  $('overlay').src=images.displaySrc;
  updateShotMode();
 }catch(error){status(error.message,true);}
 finally{initializing=false;controls();}
}
try{if(phase==='intro')cameraDeviceId=sessionStorage.getItem('yonsei-camera-id')||'';}catch{}
await init();

async function apiJSON(url,options,timeoutMs=45000){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);try{const r=await fetch(url,{...options,signal:controller.signal});const d=await r.json();if(!r.ok){const error=new Error(d.error||'QR 저장 실패');error.status=r.status;throw error;}return d;}catch(e){if(e.name==='AbortError')throw new Error('QR 저장 응답이 늦어지고 있어요. 연결을 확인한 뒤 다시 시도해 주세요.');throw e;}finally{clearTimeout(timeout);}}
async function ensureQrAlbum(revision){
 if(album)return;
 await apiJSON('/api/gallery/capture/start',{method:'POST'});
 if(revision!==sessionRun)return;
 const current=await apiJSON('/api/gallery/albums',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({consent:true,policyVersion:qrPolicyVersion,captureCount:CAPTURE_TOTAL,printTheme:selected.printTheme})
 });
 if(revision!==sessionRun){void fetch('/api/gallery/albums/'+current.id,{method:'DELETE'}).catch(()=>{});return;}
 album=current;
}
function drawAlbumQR(canvas,id){
 const url=new URL('/gallery.html#'+id,location.href).href;
 const qr=qrcode(0,'M');qr.addData(url);qr.make();
 const count=qr.getModuleCount(),size=Math.round(Math.min(canvas.width,canvas.height)*.13),unit=size/(count+8),margin=Math.round(Math.min(canvas.width,canvas.height)*.01);
 const left=canvas.width-size-margin,top=canvas.height-size-margin,c=canvas.getContext('2d');
 c.fillStyle='#fff';c.fillRect(left,top,size,size);c.fillStyle='#000';
 for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))c.fillRect(left+(col+4)*unit,top+(row+4)*unit,unit,unit);
}
async function encodeOriginals(session){
 const {photos,originalJpegs}=session;
 for(let i=originalJpegs.length;i<photos.length;i++){
   const jpeg=await withTimeout(toBlob(photos[i],'image/jpeg',.85),45000,'촬영 원본 준비 시간이 초과됐어요.');
   if(session!==shotSession)return;
   originalJpegs.push(jpeg);
 }
 return originalJpegs;
}
function prepareOriginals(session){
 if(!session.originalPreparation){
   session.originalPreparation=encodeOriginals(session).catch(error=>{
     session.originalPreparation=null;
     throw error;
   });
 }
 return session.originalPreparation;
}
async function uploadAlbumPhotos(revision,printImage){
 const current=album;
 const deadline=Date.now()+45000,remaining=()=>{const ms=deadline-Date.now();if(ms<=0)throw new Error('QR 저장 시간 초과');return ms;};
 const originals=await withTimeout(prepareOriginals(shotSession),remaining(),'QR 사진 처리 시간 초과');
 if(revision!==sessionRun)return;
 const data=new FormData();
 originals.forEach((jpeg,i)=>data.append(String(i),jpeg,`${i}.jpg`));
 data.append('8',printImage,'result.jpg');
 await apiJSON(`/api/gallery/albums/${current.id}`,{method:'PUT',body:data},remaining());
 if(revision!==sessionRun)void fetch(`/api/gallery/albums/${current.id}`,{method:'DELETE'}).catch(()=>{});
}

// A short local feedback tone, unlocked by an actual button click.
let buttonAudio = null;
document.addEventListener('click',event=>{
 const button=event.target instanceof Element?event.target.closest('button'):null;
 if(!event.isTrusted||!button||button.disabled)return;
 try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
 try{
  if(!buttonAudio||buttonAudio.state==='closed')buttonAudio=new Audio({latencyHint:'interactive'});
  const context=buttonAudio;
  const sound=()=>{
   if(context.state!=='running')return;
   const source=context.createBufferSource(),gain=context.createGain(),tone=context.createBiquadFilter();
   const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.028),context.sampleRate),samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/samples.length*7);
   source.buffer=buffer;tone.type='lowpass';tone.frequency.value=2600;tone.Q.value=.6;gain.gain.value=.22;
   source.connect(tone);tone.connect(gain);gain.connect(context.destination);source.start();
   source.onended=()=>{source.disconnect();tone.disconnect();gain.disconnect();};
  };
  if(context.state==='running')sound();else context.resume().then(sound).catch(()=>{});
 }catch{}
},true);

function playShutterSound(){
 try{
  const context=buttonAudio;if(!context||context.state!=='running')return;
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.16),context.sampleRate),samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++){const t=i/context.sampleRate;const envelope=Math.exp(-t*90)+(t>.05?1.05*Math.exp(-(t-.05)*65):0);samples[i]=(Math.random()*2-1)*envelope;}
  const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
  source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.5;gain.gain.value=.32;
  const body=context.createOscillator(),bodyGain=context.createGain(),now=context.currentTime;
  body.type='sine';body.frequency.setValueAtTime(300,now+.05);body.frequency.exponentialRampToValueAtTime(190,now+.1);bodyGain.gain.setValueAtTime(0,now);bodyGain.gain.setValueAtTime(.055,now+.05);bodyGain.gain.exponentialRampToValueAtTime(.001,now+.11);body.connect(bodyGain);bodyGain.connect(context.destination);body.start(now+.05);body.stop(now+.12);body.onended=()=>{body.disconnect();bodyGain.disconnect();};
  source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.start();
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }catch{}
}

