import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackup, editExpense, persistSnapshot } from '../src/lib/ledger.ts';
const raw = () => ({expenses:[{id:'one',amount:12.5,category:'餐饮',date:'2026-09-15',createdAt:1}],categories:[{name:'餐饮',color:'#E8927C'}],budgets:{'2026-09':1000}});
test('legacy backup round trip retains data',()=>assert.deepEqual(normalizeBackup(raw()),raw()));
test('missing legacy budget resets to empty',()=>assert.deepEqual(normalizeBackup({...raw(),budgets:undefined}).budgets,{}));
for(const bad of [-1,0,NaN,Infinity,1.234]) test(`reject amount ${bad}`,()=>assert.throws(()=>normalizeBackup({...raw(),expenses:[{...raw().expenses[0],amount:bad}]})));
for(const date of ['2026-02-30','2026-13-01','yesterday']) test(`reject date ${date}`,()=>assert.throws(()=>normalizeBackup({...raw(),expenses:[{...raw().expenses[0],date}]})));
test('duplicate IDs rejected',()=>assert.throws(()=>normalizeBackup({...raw(),expenses:[...raw().expenses,...raw().expenses]})));
test('edit keeps identity and creation timestamp',()=>{
 const next=editExpense(raw().expenses,'one',{amount:21,category:'交通',date:'2026-09-14',note:'改过'});
 assert.deepEqual(next[0],{id:'one',createdAt:1,amount:21,category:'交通',date:'2026-09-14',note:'改过'});
 assert.equal(raw().expenses[0].amount,12.5);
});
test('failed persistence leaves prior data intact',()=>{
 let value=JSON.stringify(raw());
 const storage={getItem:()=>value,setItem:()=>{throw new Error('quota');}};
 assert.throws(()=>persistSnapshot(storage,{...raw(),expenses:[]}));
 assert.deepEqual(JSON.parse(value),raw());
});
test('recovery and current snapshot change atomically, survive normal edits',()=>{
 const map=new Map<string,string>();
 const storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,v:string)=>{map.set(key,v)}};
 const before=raw();const after={...raw(),expenses:[]};
 persistSnapshot(storage,after,before);
 const saved=JSON.parse([...map.values()][0]);assert.deepEqual(saved.recovery,before);
 persistSnapshot(storage,{...after,budgets:{}});
 assert.deepEqual(JSON.parse([...map.values()][0]).recovery,before);
 const fail={getItem:storage.getItem,setItem:()=>{throw new Error('quota')}};
 assert.throws(()=>persistSnapshot(fail,before,after));
 assert.deepEqual(JSON.parse([...map.values()][0]).recovery,before);
});
