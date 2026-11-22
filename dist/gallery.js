import {readAlbumId} from './gallery-link.mjs';
const status=document.getElementById('gallery-status'),grid=document.getElementById('gallery-photos');
let expiryTimer;
function clear(){grid.replaceChildren();status.textContent='앨범이 만료되었습니다.';}
try{
 const id=readAlbumId(location.hash.slice(1));
 const r=await fetch(`/api/gallery/albums/${id}`),data=await r.json();if(!r.ok)throw new Error(data.error);
 status.textContent=`${new Date(data.expiresAt).toLocaleString('ko-KR')}까지 저장할 수 있어요.`;
 for(const i of (data.photoIndexes||[8,0,1,2,3,4,5,6,7])){
  const figure=document.createElement('figure'),img=document.createElement('img'),a=document.createElement('a');img.src=`/api/gallery/albums/${id}/${i}`;img.alt=i===8?'완성 사진':`${i+1}번 사진`;img.loading='lazy';a.href=img.src;a.download=`연세스튜디오-${i===8?'완성':i+1}.jpg`;a.textContent=i===8?'완성 사진 저장':`${i+1}번 사진 저장`;figure.append(img,a);grid.append(figure);
 }
 expiryTimer=setTimeout(clear,Math.max(0,data.expiresAt-Date.now()));
 document.addEventListener('visibilitychange',()=>{if(Date.now()>=data.expiresAt)clear();});
}catch(e){status.textContent=e.message||'사진을 열지 못했어요.';}
