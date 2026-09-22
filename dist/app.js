const $ = id => document.getElementById(id);
const video = $('video');
let frames = [], selected = null, stream = null, facing = 'user', busy = false, cameraBusy = false, frameLoading = false;
let countdownRun = 0, cameraRun = 0, blob = null, resultURL = null, frameRun = 0;
const localURLs = [];
let cameraDeviceId = '', cameraDevices = [], deviceListRun = 0;
let shotSession = null;
let settingsOpen = false;
let phase = 'permission';
let cameraConfirmed = false;
let selecting = false, chosen = [];
let cutCount=4;
const frameCount=f=>f.count||f.slots?.length||4;
const matchingFrames=()=>frames.filter(f=>frameCount(f)===cutCount);
const CAPTURE_TOTAL = 10;
const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error);if(phase==='permission')$('permission-status').textContent=message;if(phase==='setup')$('setup-status').textContent=message; };
const loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('프레임 이미지를 열 수 없어요.')); img.src = src; });
const toBlob = (canvas, type = 'image/png') => new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요.')), type, .96));
function controls() {
  for(const n of [1,2,4,6]){$('cuts-'+n).disabled=frameLoading||busy||!!shotSession;$('cuts-'+n).setAttribute('aria-pressed',String(n===cutCount));}
  document.body.classList.toggle('is-permission',phase==='permission');
  document.body.classList.toggle('is-setup',phase==='setup');
  $('permission-panel').hidden=phase!=='permission';
  $('setup-heading').hidden=phase!=='setup';
  $('setup-actions').hidden=phase!=='setup';
  $('permission-start').disabled=cameraBusy;
  $('permission-next').disabled=phase!=='permission'||cameraBusy||!stream||!$('permission-video').videoWidth;
  $('camera-test').hidden=phase!=='permission'||!stream;
  $('permission-start').textContent=cameraBusy?'카메라 연결을 확인하고 있어요…':(stream?'카메라 다시 테스트':'카메라 허용 · 연결 테스트');
  $('setup-done').disabled=!selected||frameLoading||cameraBusy;

  document.body.classList.toggle('is-shooting',phase==='shoot' && !blob && !selecting);
  document.body.classList.toggle('is-selecting',selecting);
  $('selection-panel').hidden = !selecting;
  document.body.classList.toggle('is-result',!!blob);
  $('edit-settings').hidden = phase!=='shoot' || !stream || !!blob;
  $('edit-settings').disabled = busy || !!shotSession;
  $('edit-settings').setAttribute('aria-expanded', String(settingsOpen));
  $('capture').disabled = phase!=='shoot' || !stream || !video.videoWidth || !selected || busy || cameraBusy || !!blob || frameLoading || selecting;
  $('timer').disabled = busy || !!blob || frameLoading || selecting;
  $('capture-timer-row').hidden=phase!=='shoot'||!!blob||selecting;
  $('capture-timer').disabled=busy||cameraBusy||!stream||frameLoading;
  $('capture-timer').value=$('timer').value;
  $('upload').disabled = busy || !!blob || frameLoading || !!shotSession;
  document.querySelectorAll('.frame-card').forEach(b => b.disabled = busy || !!blob || frameLoading || !!shotSession);
  $('start').disabled = cameraBusy;
  for (const prefix of ['permission']) {
    $(prefix+'-camera').disabled = phase!=='permission' || busy || cameraBusy || !!blob || selecting;
    $(prefix+'-camera-refresh').disabled = phase!=='permission' || busy || cameraBusy || !!blob || selecting;
  }
}
function renderFrames() {
  $('frames').replaceChildren();
  for (const frame of matchingFrames()) {
    const button = document.createElement('button'); button.className = 'frame-card'; button.dataset.id = frame.id;
    button.setAttribute('aria-pressed', String(selected?.id === frame.id));
    const img = document.createElement('img'); img.src = frame.src; img.className = 'frame-thumb'; img.alt = ''; img.loading = 'lazy';
    const label = document.createElement('span'); label.textContent = frame.name;
    button.append(img, label); button.onclick = () => chooseFrame(frame.id).catch(e => status(e.message, true));
    $('frames').append(button);
  }
  $('frame-count').textContent = `${matchingFrames().length}가지`; controls();
}
function prepareFrame(frame,img){
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('프레임 크기를 확인할 수 없어요.');
  const ratio = img.naturalWidth / img.naturalHeight;
  if (ratio < .25 || ratio > 4) throw new Error('프레임의 가로세로 비율은 1:4~4:1이어야 해요.');
  const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
  if (frame.slots && (!Array.isArray(frame.slots) || frame.slots.length !== frameCount(frame) || frame.slots.some(r => !Array.isArray(r) || r.length !== 4 || !r.every(Number.isFinite) || r[0]<0 || r[1]<0 || r[2]<=0 || r[3]<=0 || r[0]+r[2]>1 || r[1]+r[3]>1))) throw new Error('프레임의 사진 영역 설정이 올바르지 않아요.');
  return {...frame, img, width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale)};
}
async function chooseFrame(id) {
  if (busy || blob || (shotSession&&!selecting)) throw new Error('촬영을 마치거나 다시 촬영을 누른 뒤 프레임을 바꿔 주세요.');
  const frame = matchingFrames().find(f => f.id === id); if (!frame) throw new Error('없는 프레임입니다.');
  const run = ++frameRun; frameLoading = true; controls();if(selecting){renderEditingFrames();renderSelection();}
  try {
  const img = await loadImage(frame.src); if (run !== frameRun) return;
  selected = prepareFrame(frame,img);
  $('overlay').src = frame.src;
  $('viewfinder').style.aspectRatio = `${selected.width}/${selected.height}`;
  if(selecting){renderSelection();renderEditingFrames();}else updateShotMode();
  renderFrames(); return {id: selected.id, name: selected.name};
  } finally { if (run === frameRun) { frameLoading = false; controls(); } }
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
  cameraRun++;stopStream();cancelCountdown();$('welcome').hidden=false;
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
    const next = await navigator.mediaDevices.getUserMedia({audio:false, video:{...source,width:{ideal:1920},height:{ideal:1440}}});
    if (run !== cameraRun) { next.getTracks().forEach(t => t.stop()); return; }
    stream = next;
    const track=next.getVideoTracks()[0];
    if(phase==='permission' && !cameraDeviceId)cameraDeviceId=track.getSettings().deviceId||'';
    // External cameras may omit facingMode. Do not mirror them as if they were a front camera.
    facing = track.getSettings().facingMode || '';
    track.addEventListener('ended',()=>cameraDisconnected(next));
    const targetVideo=phase==='permission'?$('permission-video'):video;
    targetVideo.srcObject = next; await targetVideo.play();
    if(run!==cameraRun || stream!==next)return;
    video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
    $('permission-video').style.transform=video.style.transform;
    $('mirror-label').textContent = facing === 'user' ? '전면 카메라 · 좌우 반전' : '선택한 카메라 · 좌우 반전 없음';
    $('welcome').hidden = true; settingsOpen = false; document.body.classList.remove('config-open'); $('camera-state').textContent = track.label || '카메라 켜짐'; $('stage-label').textContent = '02 / 촬영';
    status(phase==='permission'?'카메라가 연결됐어요. 테스트 영상을 확인한 뒤 다음으로 넘어가 주세요.':phase==='setup'?'카메라·프레임·카운트다운을 고른 뒤 촬영하기를 눌러 주세요.':'준비되면 한 장씩 촬영해 주세요.');
    await refreshCameras();
  } catch(e) {
    if(run!==cameraRun)return;
    stopStream(); $('welcome').hidden = false; $('camera-state').textContent = '카메라 꺼짐';
    const errors = {NotAllowedError:'카메라 권한이 꺼져 있어요. 브라우저의 사이트 설정에서 카메라를 허용한 뒤 다시 켜 주세요.',NotFoundError:'선택한 카메라를 찾지 못했어요. 연결을 확인하거나 다른 카메라를 선택해 주세요.',OverconstrainedError:'선택한 카메라에 연결할 수 없어요. 목록을 새로고침하고 다시 선택해 주세요.',NotReadableError:'다른 앱이 카메라를 사용 중일 수 있어요. 앱을 닫고 다시 시도해 주세요.'};
    status(phase==='shoot' && ['NotFoundError','OverconstrainedError'].includes(e.name) ? '처음 선택한 카메라를 찾지 못했어요. 같은 카메라를 다시 연결한 뒤 카메라 켜기를 눌러 주세요.' : errors[e.name] || '카메라를 켜지 못했어요. 연결을 확인하고 다시 시도해 주세요.', true);
  } finally { cameraBusy = false; controls(); }
}
for(const prefix of ['permission']) {
  $(prefix+'-camera').onchange=async()=>{
    if(phase!=='permission'||busy||cameraBusy||blob||selecting)return;
    const wasConnected=!!stream;cameraDeviceId=$(prefix+'-camera').value;renderCameras();
    if(wasConnected)await startCamera();
  };
  $(prefix+'-camera-refresh').onclick=async()=>{
    if(phase!=='permission'||busy||cameraBusy||blob||selecting)return;
    await refreshCameras();
  };
}
navigator.mediaDevices?.addEventListener?.('devicechange',async()=>{
  const active=stream, id=active?.getVideoTracks()[0]?.getSettings().deviceId;
  const refreshed=await refreshCameras();
  if(refreshed && id && active===stream && !cameraDevices.some(d=>d.deviceId===id))cameraDisconnected(active);
});
renderCameras();
function shotCount() { return cutCount; }
function outputSize(frame, count) {
  const width = frame.width, height = frame.height;
  if (frame.slots) return {width,height,slots:frame.slots.map(([x,y,w,h])=>({x:Math.round(x*width),y:Math.round(y*height),w:Math.round(w*width),h:Math.round(h*height)}))};
  const x = Math.round(width*42/1080), y = Math.round(height*42/1440), gap = Math.round(width*24/1080);
  const cols = count>=4?2:1, rows = Math.ceil(count/cols);
  const w = Math.floor((width-2*x-(cols-1)*gap)/cols), h = Math.floor((height*1176/1440-(rows-1)*gap)/rows);
  return {width,height,slots:Array.from({length:count},(_,i)=>({x:x+(i%cols)*(w+gap),y:y+Math.floor(i/cols)*(h+gap),w,h}))};
}
function showShotPreview() {
  if (!selected || blob) return;
  const size = outputSize(selected,shotCount()), index = (shotSession?.taken || 0) % size.slots.length, slot = size.slots[index];
  // Include a narrow border around the photo so overlapping artwork and frame edges remain visible.
  const pad = shotCount() === 1 ? 0 : Math.round(Math.min(slot.w,slot.h)*.045);
  const left = Math.max(0,slot.x-pad), top = Math.max(0,slot.y-pad);
  const w = Math.min(size.width,slot.x+slot.w+pad)-left, h = Math.min(size.height,slot.y+slot.h+pad)-top;
  $('viewfinder').style.aspectRatio = `${w}/${h}`;
  $('viewfinder').style.setProperty('--preview-ratio',String(w/h));
  Object.assign(video.style,{left:`${(slot.x-left)/w*100}%`,top:`${(slot.y-top)/h*100}%`,width:`${slot.w/w*100}%`,height:`${slot.h/h*100}%`});
  const overlay = $('overlay'); overlay.hidden = false;
  Object.assign(overlay.style,{left:`${-left/w*100}%`,top:`${-top/h*100}%`,width:`${size.width/w*100}%`,height:`${size.height/h*100}%`});
  $('map-image').src = selected.src; $('frame-map').style.aspectRatio = `${size.width}/${size.height}`;
  $('map-slots').replaceChildren();
  size.slots.forEach((r,i)=>{const box=document.createElement('div'); box.className=`map-slot${i===index?' active':''}${i<index?' done':''}`;box.textContent=String(i+1);Object.assign(box.style,{left:`${r.x/size.width*100}%`,top:`${r.y/size.height*100}%`,width:`${r.w/size.width*100}%`,height:`${r.h/size.height*100}%`});$('map-slots').append(box);});
  $('preview-hint').textContent = `포즈 참고: ${index+1}번째 사진 자리 · 프레임 디자인에 맞춰 포즈를 잡아 주세요. 장식은 좌우 반전되지 않아요.`;
}
function updateShotMode() {
  const count = shotCount();
  $('shoot-instruction').textContent=`총 10장 촬영 후 원하는 ${cutCount}장을 선택해요.`;
  $('capture').textContent = count === 4 ? '◉ 첫 번째 사진 촬영' : '◉ 사진 촬영';
  $('shot-progress').textContent = '0 / 10장 · 한 장씩 촬영해 주세요';
  $('shot-thumbs').replaceChildren();
  if (selected) { const size = outputSize(selected, count); $('size-label').textContent = `${size.width} × ${size.height} · PNG`; showShotPreview(); }
  controls();
}
function cancelCountdown() {
  countdownRun++; busy = false; $('countdown').hidden = true; $('cancel').hidden = true;
  $('shot-progress').textContent = `${shotSession?.taken || 0} / ${CAPTURE_TOTAL}장 완료 · 이번 촬영을 취소했어요.`; controls();
}
// Pixel-based filters work consistently without relying on CanvasRenderingContext2D.filter support.
function filterPixels(data, name) {
  for(let i=0;i<data.length;i+=4) {
    const r=data[i],g=data[i+1],b=data[i+2];
    if(name==='bright'){data[i]=Math.min(255,r*1.08+10);data[i+1]=Math.min(255,g*1.08+10);data[i+2]=Math.min(255,b*1.06+10);}
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
  const size=outputSize(frame,cutCount);canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#edf1f7';ctx.fillRect(0,0,canvas.width,canvas.height);
  const filter=$('photo-filter').value || 'original';
  chosen.forEach((index,i)=>{const slot=size.slots[i];ctx.drawImage(photoTile(shotSession.photos[index],slot,filter),slot.x,slot.y);});
  if(includeFrame){ctx.save();ctx.filter='none';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(frame.img,0,0,canvas.width,canvas.height);ctx.restore();}
}
function renderSelection() {
  const photoScroll=$('photo-grid').scrollTop;
  const photoScrollLeft=$('photo-grid').scrollLeft;
  $('selection-title').textContent=`마음에 드는 ${cutCount}장을 골라 주세요.`;
  $('photo-grid').replaceChildren();
  const slot=outputSize(selected,cutCount).slots[0], ratio=slot.h/slot.w;
  shotSession.photos.forEach((photo,index)=>{
    const button=document.createElement('button');button.className='photo-choice';button.disabled=busy;
    const order=chosen.indexOf(index);button.setAttribute('aria-pressed',String(order>=0));button.setAttribute('aria-label',`${index+1}번 사진${order>=0?`, ${order+1}번째 선택`:''}`);
    const thumb=photoTile(photo,{w:420,h:Math.round(420*ratio)},$('photo-filter').value || 'original');
    const label=document.createElement('span');label.textContent=`사진 ${index+1}`;button.append(thumb,label);
    if(order>=0){const badge=document.createElement('b');badge.textContent=String(order+1);button.append(badge);}
    button.onclick=()=>{
      if(busy)return;
      const current=chosen.indexOf(index);
      if(current>=0)chosen.splice(current,1);
      else if(chosen.length<cutCount)chosen.push(index);
      else{$('selection-status').textContent=`${cutCount}장을 모두 골랐어요. 바꾸려면 선택한 사진을 먼저 눌러 해제해 주세요.`;return;}
      $('selection-status').textContent=chosen.length===cutCount?'오른쪽 전체 사진을 확인하고 완성해 주세요.':'선택한 순서대로 프레임에 들어갑니다.';
      renderSelection();
    };
    $('photo-grid').append(button);
  });
  $('photo-grid').scrollTop=photoScroll;
  $('photo-grid').scrollLeft=photoScrollLeft;
  $('selection-count').textContent=`${chosen.length} / ${cutCount} 선택`;
  $('finish-selection').disabled=chosen.length!==cutCount || busy || frameLoading;
  $('finish-selection').textContent=chosen.length===cutCount?`이 ${cutCount}장으로 완성하기`:`${cutCount-chosen.length}장을 더 선택해 주세요`;
  for(const name of ['original','bright','vivid']) { $('filter-'+name).disabled=busy||frameLoading; $('filter-'+name).setAttribute('aria-pressed',String(($('photo-filter').value || 'original')===name)); }
  $('photo-filter').disabled=busy||frameLoading;
  // Keep the original frame in an independent DOM layer. Only the photo canvas changes with filters.
  composeSelection($('selection-canvas'),selected,false);
  if($('selection-frame-overlay').getAttribute('src')!==selected.src)$('selection-frame-overlay').setAttribute('src',selected.src);

}
function openSelection() {
  selecting=true; $('result').hidden=true; $('result-actions').hidden=true;
  $('stage-label').textContent='04 / 사진 선택';renderSelection();renderEditingFrames();controls();
}
async function capture() {
  if ($('capture').disabled) return;
  settingsOpen=false;document.body.classList.remove('config-open');busy=true;const run=++countdownRun;controls();
  if(!shotSession)shotSession={photos:[],taken:0};
  if(shotSession.taken>=CAPTURE_TOTAL){busy=false;openSelection();return;}
  $('cancel').hidden=false;
  try {
    $('shot-progress').textContent=`${shotSession.taken+1} / 10장 · 포즈를 준비해 주세요`;
    for(let n=Number($('timer').value);n>0;n--){$('countdown').textContent=n;$('countdown').hidden=false;await new Promise(r=>setTimeout(r,1000));if(run!==countdownRun)return;}
    $('countdown').hidden=true;
    if(!stream||video.readyState<2||!video.videoWidth)throw new Error('카메라가 준비되지 않았어요. 다시 시도해 주세요.');
    // Keep an unfiltered, mirrored source so any shot can fit any of the four final slots.
    const photo=document.createElement('canvas');const scale=Math.min(1,1440/Math.max(video.videoWidth,video.videoHeight));
    photo.width=Math.round(video.videoWidth*scale);photo.height=Math.round(video.videoHeight*scale);
    const ctx=photo.getContext('2d');ctx.save();if(facing==='user'){ctx.translate(photo.width,0);ctx.scale(-1,1);}ctx.drawImage(video,0,0,photo.width,photo.height);ctx.restore();
    shotSession.photos.push(photo);shotSession.taken++;
    $('shot-progress').textContent=`${shotSession.taken} / 10장 촬영 완료`;
    $('flash').classList.remove('active');void $('flash').offsetWidth;$('flash').classList.add('active');
    if(shotSession.taken===CAPTURE_TOTAL){chosen=[];stopStream();$('camera-state').textContent='촬영 완료';busy=false;openSelection();}
    else{$('capture').textContent=`◉ ${shotSession.taken+1}번째 사진 촬영`;showShotPreview();status(`준비되면 다음 사진을 찍어 주세요. 10장을 찍은 뒤 ${cutCount}장을 골라요.`);}
  }catch(e){status(e.message||'촬영하지 못했어요. 다시 시도해 주세요.',true);}
  finally{if(run===countdownRun){busy=false;$('cancel').hidden=true;$('countdown').hidden=true;controls();}}
}
for(const name of ['original','bright','vivid']) $('filter-'+name).onclick=()=>{if(!busy&&!frameLoading){$('photo-filter').value=name;renderSelection();}};
$('photo-filter').onchange=()=>{if(!busy&&!frameLoading)renderSelection();};
$('finish-selection').onclick=async()=>{
  if(busy||frameLoading||chosen.length!==cutCount||!shotSession||shotSession.photos.length!==10)return;
  busy=true;renderSelection();controls();
  try{
    const canvas=document.createElement('canvas');composeSelection(canvas);const nextBlob=await toBlob(canvas);
    const nextURL=URL.createObjectURL(nextBlob);$('result').src=nextURL;
    try{await $('result').decode();}catch(e){URL.revokeObjectURL(nextURL);throw e;}
    if(resultURL)URL.revokeObjectURL(resultURL);blob=nextBlob;resultURL=nextURL;selecting=false;
    $('viewfinder').style.aspectRatio=`${canvas.width}/${canvas.height}`;$('viewfinder').style.setProperty('--preview-ratio',String(canvas.width/canvas.height));
    $('result').hidden=false;$('capture-actions').hidden=true;$('result-actions').hidden=false;
    $('shot-progress').textContent=`선택한 ${cutCount}장으로 완성한 전체 사진`;$('stage-label').textContent='05 / 나의 순간';
    status('선택한 사진과 필터가 적용됐어요. 저장하거나 인쇄해 주세요.');
  }catch(e){$('selection-status').textContent='합성하지 못했어요. 다시 완성하기를 눌러 주세요.';}
  finally{busy=false;if(selecting)renderSelection();controls();}
};
function renderEditingFrames(){
 $('editing-frames').replaceChildren();
 for(const frame of matchingFrames()){
  const b=document.createElement('button');b.className='editing-frame-card';b.disabled=busy||frameLoading;b.setAttribute('aria-pressed',String(selected?.id===frame.id));
  const img=document.createElement('img');img.src=frame.src;img.alt='';const label=document.createElement('span');label.textContent=frame.name;b.append(img,label);
  b.onclick=async()=>{if(busy||frameLoading)return;try{await chooseFrame(frame.id);$('selection-status').textContent='프레임을 바꿨어요. 사진 위치를 확인해 주세요.';}catch{$('selection-status').textContent='프레임을 불러오지 못했어요. 기존 프레임을 유지합니다.';}finally{renderEditingFrames();renderSelection();}};
  $('editing-frames').append(b);
 }
}
for(const n of [1,2,4,6])$('cuts-'+n).onclick=async()=>{
 if(busy||frameLoading||shotSession||n===cutCount)return;
 const previous=cutCount;cutCount=n;
 try{await chooseFrame(matchingFrames()[0].id);}catch(e){cutCount=previous;renderFrames();status('프레임을 불러오지 못했어요. 다시 선택해 주세요.',true);}
 controls();
};
$('reselect').onclick=()=>{blob=null;printReady=false;printRevision++;openSelection();};
$('edit-settings').onclick = () => {if(shotSession||busy)return;stopStream();phase='setup';controls();};
function filename(ext) { return `moment-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`; }
function download(data, name) { const url=URL.createObjectURL(data); const a=document.createElement('a'); a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000); }
function shareFile(){ return new File([blob],filename('png'),{type:'image/png'}); }
function canShare(){ try{return !!blob && typeof navigator.share==='function' && !!navigator.canShare?.({files:[shareFile()]});}catch{return false;} }
$('timer').onchange=()=>controls();
$('capture-timer').onchange=()=>{
 if(!busy&&!cameraBusy&&['0','3','5','10'].includes($('capture-timer').value))$('timer').value=$('capture-timer').value;
 controls();
};
$('start').onclick = () => startCamera();
$('permission-start').onclick=()=>startCamera();
$('permission-video').addEventListener('loadeddata',controls);
$('permission-next').onclick=()=>{
 if($('permission-next').disabled)return;
 cameraConfirmed=true;stopStream();phase='setup';controls();
 status('프레임과 카운트다운을 고른 뒤 촬영하기를 눌러 주세요.');
};
$('setup-done').onclick=async()=>{
 if($('setup-done').disabled)return;
 if(!stream)await startCamera();
 if(!stream)return;
 phase='shoot';settingsOpen=false;document.body.classList.remove('config-open');$('stage-label').textContent='03 / 촬영';controls();status('준비되면 한 장씩 촬영해 주세요.');
};
video.addEventListener('loadeddata',controls);
$('capture').onclick = capture;
$('cancel').onclick = () => {cancelCountdown();status('카운트다운을 취소했어요.');};
$('save').onclick = () => {if(blob) {download(blob,filename('png'));status('사진 저장을 요청했어요. 다운로드 또는 사진 앱을 확인해 주세요.');}};
let sharingPhoto=false;
$('send-open').onclick=()=>{
 if(!blob)return;
 $('send-consent').checked=false;$('send-submit').disabled=true;
 $('send-status').textContent=canShare()?'사진 전달에 동의한 뒤 메시지를 선택해 주세요.':'이 브라우저는 사진 첨부 공유를 지원하지 않아요. iPad Safari에서 열거나 사진을 저장한 뒤 메시지 앱에 첨부해 주세요.';
 $('send-dialog').showModal();
};
$('send-consent').onchange=()=>{$('send-submit').disabled=sharingPhoto||!$('send-consent').checked||!canShare();};
$('send-close').onclick=()=>{$('send-dialog').close();};
$('send-dialog').addEventListener('cancel',e=>{if(sharingPhoto)e.preventDefault();});
$('send-dialog').addEventListener('close',()=>{$('send-consent').checked=false;$('send-submit').disabled=true;});
$('send-submit').onclick=async()=>{
 if(sharingPhoto||!blob||!$('send-consent').checked||!canShare())return;
 sharingPhoto=true;$('send-submit').disabled=true;$('send-close').disabled=true;
 try{
  // Share immediately in the click gesture; no fetch/encoding delay that loses Safari activation.
  await navigator.share({files:[shareFile()]});
  $('send-status').textContent='공유창을 닫았어요. 메시지 앱에서 받는 사람과 전송 여부를 확인해 주세요.';
 }catch(e){$('send-status').textContent=e.name==='AbortError'?'사진 전달을 취소했어요.':'사진을 전달하지 못했어요. 사진을 저장한 뒤 메시지 앱에서 첨부해 주세요.';}
 finally{sharingPhoto=false;$('send-close').disabled=false;$('send-consent').checked=false;$('send-submit').disabled=true;}
};
$('retake').onclick = () => {cameraRun++;stopStream();phase=cameraConfirmed?'setup':'permission';selecting=false;chosen=[];shotSession=null;blob=null;$('photo-grid').replaceChildren();$('selection-canvas').width=1;$('selection-canvas').height=1;$('photo-filter').value='original';$('selection-status').textContent='';printReady=false;printRevision++;$('print-image').removeAttribute('src');$('print-canvas').width=1;$('print-canvas').height=1;$('welcome').hidden=!!stream; $('result').hidden=true; $('result').removeAttribute('src');if(resultURL)URL.revokeObjectURL(resultURL);resultURL=null;$('capture-actions').hidden=false;$('result-actions').hidden=true;$('stage-label').textContent='02 / 촬영';updateShotMode();status('다시 촬영할 준비가 됐어요.');controls();};
$('upload').onchange = async e => {
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(!['image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){status('10MB 이하의 투명 PNG 또는 WebP 파일을 선택해 주세요.',true);return;}
  const url=URL.createObjectURL(file);const id=`custom-${Date.now()}`;
  try{const img=await loadImage(url);if(img.naturalWidth*img.naturalHeight>24000000)throw new Error('프레임은 2,400만 화소 이하로 줄여 주세요.'); frames.push({id,count:cutCount,name:file.name.replace(/\.[^.]+$/,''),src:url});await chooseFrame(id);localURLs.push(url);status('내 프레임을 추가했어요. 투명한 부분에 카메라가 보여요.');}
  catch(e){frames=frames.filter(f=>f.id!==id);URL.revokeObjectURL(url);status(e.message,true);}
};
const papers={postcard:{w:100,h:148,label:'SELPHY 엽서'},'4x6':{w:101.6,h:152.4,label:'4 × 6인치'},a4:{w:210,h:297,label:'A4'}};
let printReady = false, printRevision = 0;
async function updatePrint(){
  printReady = false; $('print').disabled = true; $('print-file').disabled = true;
  const revision = ++printRevision;
  if(!blob)return;
  const p=papers[$('paper').value], canvas=$('print-canvas');
  canvas.width=Math.round(p.w/25.4*300);canvas.height=Math.round(p.h/25.4*300);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const img=$('result');
  const cover=$('print-fit').value==='cover';const scale=(cover?Math.max:Math.min)(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight);
  const w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  $('print-image').src=canvas.toDataURL('image/jpeg',.96);
  $('print-page-style').textContent=`@page {size:${p.w}mm ${p.h}mm;margin:0} @media print {html,body,#print-sheet{width:${p.w}mm!important;height:${p.h}mm!important;overflow:hidden!important;}}`;
  await $('print-image').decode();
  if (revision !== printRevision) return;
  printReady = true; $('print').disabled = false; $('print-file').disabled = false;
  $('print-info').textContent=`${p.label} · ${p.w} × ${p.h}mm · ${cover?'가장자리의 사진·프레임이 잘릴 수 있어요.':'전체 프레임을 유지하며 빈 부분은 흰색으로 인쇄해요.'}`;
}
$('print-open').onclick=async()=>{try{await updatePrint();$('print-dialog').showModal();}catch{status('인쇄 미리보기를 만들지 못했어요.',true);}};
$('print-close').onclick=()=>$('print-dialog').close();
$('paper').onchange=$('print-fit').onchange=()=>updatePrint().catch(()=>status('인쇄 미리보기 오류',true));
$('print').onclick=()=>{
  if (!printReady) { $('print-status').textContent = '인쇄 이미지를 준비 중이에요. 잠시 후 다시 눌러 주세요.'; return; }
  // Call synchronously from the user's click. Embedded browsers may still ignore print().
  $('print-status').textContent = '인쇄 창이 나타나지 않으면 아래의 외부 브라우저용 인쇄 파일을 저장하고 Safari·Chrome에서 열어 주세요. 사진은 파일에 포함됩니다.';
  try { window.print(); }
  catch { $('print-status').textContent = '이 브라우저에서는 인쇄 창을 열지 못했어요. 외부 브라우저용 인쇄 파일 또는 JPG를 저장해 주세요.'; }
};
$('print-file').onclick=()=>{
  if (!printReady) return;
  const p=papers[$('paper').value];
  const data=$('print-image').src;
  const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>순간 · 사진 인쇄</title><style>body{font-family:system-ui;background:#f3f6ff;color:#23304a;margin:24px}main{max-width:700px;margin:auto}button{padding:16px 24px;background:#3e62e8;color:white;border:0;border-radius:10px;font-size:18px;cursor:pointer}img{display:block;max-width:100%;width:360px;margin:24px auto}p{line-height:1.7}@page{size:${p.w}mm ${p.h}mm;margin:0}@media print{html,body,main{margin:0;padding:0;width:${p.w}mm;height:${p.h}mm;background:white}header{display:none}img{margin:0;width:${p.w}mm;height:${p.h}mm;max-width:none;display:block;print-color-adjust:exact}}</style><main><header><h1>사진이 준비됐어요.</h1><p>용지 ${p.w} × ${p.h}mm · 세로 방향 · 머리글/바닥글 끄기<br>프린터에서 Canon SELPHY CP1500을 선택해 주세요.</p><button onclick="window.print()">인쇄 창 열기</button><p>창이 열리지 않으면 브라우저 메뉴의 인쇄 또는 ⌘P / Ctrl+P를 사용하세요.<br>이 파일에는 촬영 사진이 포함되어 있습니다. 공용 기기에서는 사용 후 삭제해 주세요.</p></header><img src="${data}" alt="촬영한 사진"></main></html>`;
  download(new Blob([html],{type:'text/html;charset=utf-8'}),filename('html'));
  $('print-status').textContent = '인쇄 파일 저장을 요청했어요. 다운로드한 HTML 파일을 Safari 또는 Chrome으로 열고 인쇄해 주세요.';
};
$('print-download').onclick=async()=>{try{await updatePrint();download(await toBlob($('print-canvas'),'image/jpeg'),filename('jpg'));}catch{status('인쇄용 파일을 저장하지 못했어요.',true);}};
window.addEventListener('pagehide',()=>{cameraRun++;cancelCountdown();stopStream();});
window.addEventListener('pageshow',()=>{if(!stream){$('welcome').hidden=false;$('camera-state').textContent='카메라 꺼짐';controls();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden && busy){cancelCountdown();status('화면이 전환되어 촬영을 취소했어요.');}});
async function init(){try{const response=await fetch('frames.json');if(!response.ok)throw new Error('프레임 목록을 읽지 못했어요.');frames=await response.json();renderFrames();if(frames.length)await chooseFrame(frames[0].id);}catch(e){status(e.message,true);}}
await init();
if(document.modelContext?.registerTool){try{await document.modelContext.registerTool({name:'select_photo_frame',title:'프레임 선택',description:'촬영 전 프레임을 선택합니다. 카메라를 켜거나 촬영하지 않습니다.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(!input||typeof input.id!=='string')throw new Error('프레임 id가 필요합니다.');return chooseFrame(input.id);}});}catch(e){console.warn('Frame tool unavailable',e);}}
