// Public privacy details only. Photo delivery uses the device share sheet in app.js.
const el=id=>document.getElementById(id);
el('privacy-open').onclick=async()=>{
 el('privacy-dialog').showModal();
 try{const response=await fetch('/api/delivery/status');if(!response.ok)return;const {policy}=await response.json();
  el('policy-contact').textContent=policy?.contact||'010-5602-5740';
 }catch{/* Static hosting keeps the default contact notice. */}
};
el('privacy-close').onclick=()=>el('privacy-dialog').close();
