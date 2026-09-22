// Public privacy details only. Photo delivery uses the device share sheet in app.js.
const el=id=>document.getElementById(id);
el('privacy-open').onclick=async()=>{
 el('privacy-dialog').showModal();
 try{const response=await fetch('/api/delivery/status');if(!response.ok)return;const {policy}=await response.json();
  el('policy-contact').textContent=policy?.contact||'연락처 미설정 · 행사 운영자에게 문의해 주세요.';
 }catch{/* Static hosting keeps the default contact notice. */}
};
el('privacy-close').onclick=()=>el('privacy-dialog').close();
