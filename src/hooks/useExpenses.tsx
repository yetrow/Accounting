import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { Expense, Category } from '@/types';
import { CATEGORY_COLORS } from '@/types';
import { normalizeBackup, editExpense, newId, persistSnapshot, SNAPSHOT_KEY, getRecovery, rawLocalData, validAmount, validDate, todayStr, type Snapshot } from '@/lib/ledger';
const DEFAULT_CATEGORIES: Category[]=['餐饮','交通','购物','居住','娱乐','医疗','人情','其他'].map((name,i)=>({name,color:CATEGORY_COLORS[i]}));
const empty=():Snapshot=>({expenses:[],categories:DEFAULT_CATEGORIES,budgets:{}});
function loadInitial(): {data:Snapshot;error:string} {
  try {
    const raw=localStorage.getItem(SNAPSHOT_KEY);
    if(raw)return {data:normalizeBackup(JSON.parse(raw)),error:''};
    const legacy={expenses:JSON.parse(localStorage.getItem('ledger.expenses.v1')??'[]'),categories:JSON.parse(localStorage.getItem('ledger.categories.v1')??JSON.stringify(DEFAULT_CATEGORIES)),budgets:JSON.parse(localStorage.getItem('ledger.budgets.v1')??'{}')};
    return {data:normalizeBackup(legacy),error:''};
  }catch{return {data:empty(),error:'本机数据读取失败，原数据未覆盖。请导出原始数据备份后再处理。'};}
}
interface Store extends Snapshot {
  readError:boolean; error:string; clearError:()=>void;
  setBudget:(month:string,amount:number|null)=>boolean;
  addExpense:(e:Omit<Expense,'id'|'createdAt'>)=>boolean;
  updateExpense:(id:string,e:Omit<Expense,'id'|'createdAt'>)=>boolean;
  removeExpense:(id:string)=>boolean;
  addCategory:(name:string)=>boolean;
  renameCategory:(oldName:string,newName:string)=>boolean;
  removeCategory:(name:string)=>boolean;
  importData:(data:unknown)=>boolean;
  restoreBackup:()=>boolean;
  colorOf:(name:string)=>string;
}
const ExpenseContext=createContext<Store|null>(null);
export function ExpenseProvider({children}:{children:ReactNode}) {
  const [initial]=useState(loadInitial);
  const [data,setData]=useState(initial.data);
  const latest=useRef(data);
  const [error,setError]=useState(initial.error);
  const [readError,setReadError]=useState(Boolean(initial.error));
  const commit=(next:Snapshot,replacing=false)=>{
    try {
      if(readError&&!replacing)throw new Error(initial.error);
      const raw=readError?rawLocalData(localStorage):undefined;
      persistSnapshot(localStorage,next,replacing&&!readError?latest.current:undefined,raw);
      latest.current=next;setData(next);setReadError(false);setError('');return true;
    }catch(e){setError(e instanceof Error && e.message===initial.error?e.message:'保存失败：设备存储空间不足或不可用，改动尚未保存。');return false;}
  };
  const addExpense:Store['addExpense']=e=>{
    if(!validAmount(e.amount)||!validDate(e.date)||e.date>todayStr()||!e.category.trim()){setError('请填写有效金额、日期和分类');return false;}
    return commit({...latest.current,expenses:[...latest.current.expenses,{...e,id:newId(),createdAt:Date.now()}]});
  };
  const updateExpense:Store['updateExpense']=(id,e)=>{
    try{return commit({...latest.current,expenses:editExpense(latest.current.expenses,id,e)});}
    catch(err){setError((err as Error).message);return false;}
  };
  const addCategory=(name:string)=>{
    const trimmed=name.trim();
    if(!trimmed||latest.current.categories.some(c=>c.name===trimmed)){setError('分类名称为空或已经存在');return false;}
    return commit({...latest.current,categories:[...latest.current.categories,{name:trimmed,color:CATEGORY_COLORS[latest.current.categories.length%CATEGORY_COLORS.length]}]});
  };
  const renameCategory=(oldName:string,newName:string)=>{
    const name=newName.trim();
    if(!name||name===oldName||latest.current.categories.some(c=>c.name===name)){setError('分类名称为空或已经存在');return false;}
    return commit({...latest.current,categories:latest.current.categories.map(c=>c.name===oldName?{...c,name}:c),expenses:latest.current.expenses.map(e=>e.category===oldName?{...e,category:name}:e)});
  };
  const importData=(raw:unknown)=>{
    try {
      const next=normalizeBackup(raw);
      return commit(next,true);
    }catch(e){setError(`导入失败：${e instanceof Error?e.message:'无法保存备份'}`);return false;}
  };
  const restoreBackup=()=>{
    try {const snapshot=getRecovery(localStorage);if(!snapshot)throw new Error('尚无导入前备份');return importData(snapshot);}
    catch(e){setError((e as Error).message);return false;}
  };
  const setBudget:Store['setBudget']=(month,amount)=>{
    const budgets={...latest.current.budgets};
    if(amount===null)delete budgets[month];
    else if(validAmount(amount))budgets[month]=amount;
    else {setError('请输入有效预算');return false;}
    return commit({...latest.current,budgets});
  };
  const value:Store={...data,readError,error,clearError:()=>setError(''),addExpense,updateExpense,addCategory,renameCategory,importData,restoreBackup,setBudget,
    removeExpense:id=>commit({...latest.current,expenses:latest.current.expenses.filter(e=>e.id!==id)}),
    removeCategory:name=>commit({...latest.current,categories:latest.current.categories.filter(c=>c.name!==name)}),
    colorOf:name=>data.categories.find(c=>c.name===name)?.color??'#A8A8A0'};
  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}
export function useExpenses():Store {const ctx=useContext(ExpenseContext);if(!ctx)throw new Error('Missing ExpenseProvider');return ctx;}
