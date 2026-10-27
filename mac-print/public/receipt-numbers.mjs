// Stable receipt numbers for this browser, independent of list order or hidden rows.
export function receiptBook(storage,key='yonsei-receipts-v1'){
 let book={next:1,ids:{}};
 try{const saved=JSON.parse(storage.getItem(key));if(saved&&Number.isSafeInteger(saved.next)&&saved.next>0&&saved.ids&&typeof saved.ids==='object')book=saved;}catch{}
 return {
  assign(jobs){for(const job of [...jobs].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id))){if(!Object.hasOwn(book.ids,job.id))book.ids[job.id]=book.next++;}storage.setItem(key,JSON.stringify(book));},
  number(id){return String(book.ids[id]||'').padStart(3,'0');},
  total(){return book.next-1;}
 };
}
