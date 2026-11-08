import assert from 'node:assert/strict';import {receiptBook} from '../dist/print/receipt-numbers.mjs';
const m=new Map(),storage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};let b=receiptBook(storage);b.assign([{id:'b',createdAt:2},{id:'a',createdAt:1}]);assert.equal(b.number('a'),'01');assert.equal(b.number('b'),'02');b=receiptBook(storage);b.assign([{id:'c',createdAt:3},{id:'b',createdAt:2}]);assert.equal(b.number('a'),'01');assert.equal(b.number('b'),'02');assert.equal(b.number('c'),'03');assert.equal(b.total(),3);b.assign([{id:'c',createdAt:3}]);assert.equal(b.total(),3);console.log('PASS: chronological receipts remain stable after refresh, hidden rows and new arrivals');

const old=new Map([['yonsei-receipts-v1',JSON.stringify({next:42,ids:{old:41}})]]);const freshStorage={getItem:k=>old.get(k),setItem:(k,v)=>old.set(k,v)};const fresh=receiptBook(freshStorage);fresh.assign([{id:'new',createdAt:1}]);assert.equal(fresh.number('new'),'01');assert.equal(fresh.total(),1);assert.equal(receiptBook(freshStorage).number('new'),'01');console.log('PASS: previous receipt history does not consume new session numbers; reload retains 01');

const dailyMap=new Map(),dailyStorage={getItem:k=>dailyMap.get(k),setItem:(k,v)=>dailyMap.set(k,v)};
let daily=receiptBook(dailyStorage);
daily.assign([{id:'before',createdAt:'2026-11-08T14:59:59.999Z'}]);
assert.equal(daily.number('before'),'01');
daily.assign([{id:'before',createdAt:'2026-11-08T14:59:59.999Z'},{id:'after',createdAt:'2026-11-08T15:00:00.000Z'},{id:'after2',createdAt:'2026-11-08T15:00:01.000Z'}]);
assert.equal(daily.number('before'),'01');assert.equal(daily.number('after'),'01');assert.equal(daily.number('after2'),'02');
daily=receiptBook(dailyStorage);assert.equal(daily.number('after2'),'02');
daily.assign([{id:'late-old',createdAt:'2026-11-08T14:00:00Z'},{id:'after3',createdAt:'2026-11-08T15:00:02Z'}]);
assert.equal(daily.number('late-old'),'02');assert.equal(daily.number('after3'),'03');
const legacyMap=new Map([['yonsei-receipts-20261108-100740',JSON.stringify({next:8,ids:{existing:7}})]]),legacyStorage={getItem:k=>legacyMap.get(k),setItem:(k,v)=>legacyMap.set(k,v)};
const migrated=receiptBook(legacyStorage);migrated.assign([{id:'today',createdAt:'2026-11-08T02:00:00Z'},{id:'tomorrow',createdAt:'2026-11-08T15:00:00Z'}]);assert.equal(migrated.number('existing'),'07');assert.equal(migrated.number('today'),'08');assert.equal(migrated.number('tomorrow'),'01');
console.log('PASS: KST midnight rollover without reload, separate old/new day sequences, reload stability, existing November 8 numbers preserved');
