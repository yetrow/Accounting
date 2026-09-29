import type { Expense, Category } from '../types/index.ts';
export interface Snapshot { expenses: Expense[]; categories: Category[]; budgets: Record<string, number> }
export const SNAPSHOT_KEY = 'ledger.snapshot.v2';
export const RECOVERY_KEY = 'ledger.recovery.v2';
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export function todayStr(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(`${value}T12:00:00`);
  return Number.isFinite(d.getTime()) && todayStr(d) === value;
}
export function validAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 9999999.99 && Math.abs(value*100-Math.round(value*100))<0.000001;
}
export function newId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function record(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
export function normalizeBackup(data: unknown): Snapshot {
  if (!record(data) || !Array.isArray(data.expenses) || !Array.isArray(data.categories)) throw new Error('文件缺少账单或分类列表');
  if (data.version !== undefined && data.version !== 1 && data.version !== 2) throw new Error('不支持此备份版本');
  const ids = new Set<string>();
  const expenses: Expense[]=data.expenses.map((e,i)=>{
    if (!record(e) || !validAmount(e.amount) || !validDate(e.date) || typeof e.category!=='string' || !e.category.trim() || e.category.length>100) throw new Error(`第 ${i+1} 笔账单的金额、日期或分类不正确`);
    if (e.note !== undefined && (typeof e.note !== 'string' || e.note.length>2000)) throw new Error(`第 ${i+1} 笔备注不正确`);
    const id=typeof e.id==='string' && e.id ? e.id : newId();
    if(ids.has(id)) throw new Error('备份中存在重复的账单编号');
    ids.add(id);
    const item: Expense={id,amount:e.amount,category:e.category,date:e.date,createdAt:typeof e.createdAt==='number' && Number.isFinite(e.createdAt)?e.createdAt:Date.now()};
    if(e.note !== undefined) item.note=e.note as string;
    return item;
  });
  const names=new Set<string>();
  const categories: Category[]=data.categories.map((c,i)=>{
    if(!record(c)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||names.has(c.name.trim())) throw new Error(`第 ${i+1} 个分类无效或重复`);
    names.add(c.name.trim());
    if(c.color !== undefined && (typeof c.color !== 'string'||!/^#[0-9a-f]{6}$/i.test(c.color))) throw new Error('分类颜色格式不正确');
    return {name:c.name.trim(),color:typeof c.color==='string'?c.color:'#A8A8A0'};
  });
  const budgets: Record<string,number>={};
  if(data.budgets!==undefined){
    if(!record(data.budgets))throw new Error('预算格式不正确');
    for(const [key,value] of Object.entries(data.budgets)){
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)||!validAmount(value)) throw new Error('预算月份或金额不正确');
      budgets[key]=value;
    }
  }
  return {expenses,categories,budgets};
}
export function editExpense(expenses: Expense[], id: string, patch: Omit<Expense,'id'|'createdAt'>): Expense[] {
  if (!validAmount(patch.amount)||!validDate(patch.date)||patch.date>todayStr()||!patch.category.trim()) throw new Error('请填写有效金额、分类和日期');
  if(!expenses.some(e=>e.id===id))throw new Error('账单不存在，请重新选择');
  return expenses.map(e=>e.id===id?{...e,...patch,id:e.id,createdAt:e.createdAt}:e);
}
export function persistSnapshot(storage: Pick<Storage,'getItem'|'setItem'>, snapshot: Snapshot, recovery?: Snapshot, unreadableBackup?: Record<string,string|null>) {
  let metadata: {recovery?: Snapshot; unreadableBackup?: Record<string,string|null>} = {};
  try {
    const previous=JSON.parse(storage.getItem(SNAPSHOT_KEY)??'{}');
    if(previous.recovery)metadata.recovery=previous.recovery;
    if(previous.unreadableBackup)metadata.unreadableBackup=previous.unreadableBackup;
  } catch(e) { if(!unreadableBackup)throw e; }
  if(recovery)metadata.recovery=recovery;
  if(unreadableBackup)metadata.unreadableBackup=unreadableBackup;
  storage.setItem(SNAPSHOT_KEY,JSON.stringify({...snapshot,...metadata}));
}
export function getRecovery(storage: Pick<Storage,'getItem'>): Snapshot | null {
  try {const raw=storage.getItem(SNAPSHOT_KEY);if(raw){const current=JSON.parse(raw);if(current.recovery)return normalizeBackup(current.recovery);}} catch { /* legacy recovery remains usable if primary is malformed */ }
  const legacy=storage.getItem(RECOVERY_KEY);
  return legacy?normalizeBackup(JSON.parse(legacy)):null;
}
export function rawLocalData(storage: Pick<Storage,'getItem'>) {
  return Object.fromEntries([SNAPSHOT_KEY,RECOVERY_KEY,'ledger.expenses.v1','ledger.categories.v1','ledger.budgets.v1'].map(key=>[key,storage.getItem(key)]));
}
