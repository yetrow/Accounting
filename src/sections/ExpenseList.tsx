import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import type { Expense } from '@/types';
import ExpenseEditor from './ExpenseEditor';
export default function ExpenseList({expenses}:{expenses:Expense[]}){
  const {colorOf,removeExpense}=useExpenses();const [editing,setEditing]=useState<Expense|null>(null);const [deleting,setDeleting]=useState<string|null>(null);
  const [limit,setLimit]=useState(100);
  return <>
    {expenses.length===0?<p className="text-sm text-[#8A8474] text-center py-8">这一天或本期还没有记录</p>:<ul className="space-y-2">{expenses.slice(0,limit).map(e=><li key={e.id} className="rounded-2xl bg-white px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-full text-white text-xs flex items-center justify-center shrink-0" style={{backgroundColor:colorOf(e.category)}}>{e.category.slice(0,2)}</span>
        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.category}</p><p className="text-xs text-[#8A8474]">{e.date}</p>{e.note&&<p className="text-xs text-[#8A8474] break-words">{e.note}</p>}</div>
        <div className="text-right shrink-0"><span className="text-sm font-semibold tabular-nums">-¥{e.amount.toFixed(2)}</span><div className="flex justify-end"><button className="icon-button" aria-label="编辑账单" onClick={()=>setEditing(e)}><Pencil size={17}/></button><button className="icon-button" aria-label="删除账单" onClick={()=>setDeleting(e.id)}><Trash2 size={17}/></button></div></div>
      </div>
      {deleting===e.id&&<div className="text-sm mt-2"><p>删除这笔账单？</p><div className="flex gap-2 mt-2"><button className="primary" onClick={()=>{if(removeExpense(e.id))setDeleting(null);}}>确认删除</button><button className="secondary" onClick={()=>setDeleting(null)}>取消</button></div></div>}
    </li>)}</ul>}
    {expenses.length>limit&&<button className="secondary w-full mt-3" onClick={()=>setLimit(v=>v+100)}>加载更多流水</button>}
    {editing&&<ExpenseEditor expense={editing} onClose={()=>setEditing(null)}/>}
  </>;
}
