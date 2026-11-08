// Receipt sequences follow each photo's reception date in Korea, independent of the laptop timezone.
export function receiptDay(value){
 const time=typeof value==='number'?value:Date.parse(value);
 if(!Number.isFinite(time))throw new Error('Invalid receipt date');
 return new Date(time+9*60*60*1000).toISOString().slice(0,10);
}
export function receiptBook(storage,key='yonsei-receipts-20261108-100740'){
 function read(){
  try{
   const saved=JSON.parse(storage.getItem(key));
   if(saved?.version===2&&saved.days&&saved.ids)return saved;
   // Preserve numbers issued during the November 8 reset instead of renumbering today's photos.
   if(saved&&Number.isSafeInteger(saved.next)&&saved.next>0&&saved.ids){
    const day='2026-11-08';return {version:2,days:{[day]:saved.next},ids:Object.fromEntries(Object.entries(saved.ids).map(([id,number])=>[id,{day,number}]))};
   }
  }catch{}
  return {version:2,days:{},ids:{}};
 }
 let book=read();
 return {
  assign(jobs){
   book=read();
   for(const job of [...jobs].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)||a.id.localeCompare(b.id))){
    if(Object.hasOwn(book.ids,job.id))continue;
    const day=receiptDay(job.createdAt),number=book.days[day]||1;
    book.ids[job.id]={day,number};book.days[day]=number+1;
   }
   storage.setItem(key,JSON.stringify(book));
  },
  number(id){return book.ids[id]?String(book.ids[id].number).padStart(2,'0'):'';},
  total(){return Object.values(book.days).reduce((sum,next)=>sum+next-1,0);}
 };
}
