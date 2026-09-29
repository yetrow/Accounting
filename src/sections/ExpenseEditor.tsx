import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useExpenses } from '@/hooks/useExpenses';
import type { Expense } from '@/types';
import { todayStr, validAmount, validDate } from '@/lib/ledger';
export default function ExpenseEditor({expense,onClose}:{expense:Expense;onClose:()=>void}){
  const {categories,updateExpense}=useExpenses();
  const [amount,setAmount]=useState(expense.amount.toFixed(2));
  const [category,setCategory]=useState(expense.category);
  const [date,setDate]=useState(expense.date);const [note,setNote]=useState(expense.note??'');
  const [error,setError]=useState('');const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  const names=Array.from(new Set([expense.category,...categories.map(c=>c.name)]));
  return createPortal(<dialog ref={dialog} className="editor-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <form className="p-5 space-y-4" onSubmit={e=>{e.preventDefault();if(!/^\d+(\.\d{1,2})?$/.test(amount)||!validAmount(Number(amount))||!validDate(date)||date>todayStr()){setError('请填写有效的金额和日期');return;}if(updateExpense(expense.id,{amount:Number(amount),category,date,note:note.trim()||undefined}))onClose();else setError('保存失败，请检查存储空间');}}>
      <h2 className="text-xl font-semibold">编辑账单</h2>
      <label className="field">金额（元）<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} required/></label>
      <label className="field">分类<select aria-label="分类" value={category} onChange={e=>setCategory(e.target.value)}>{names.map(name=><option key={name}>{name}</option>)}</select></label>
      <label className="field">日期<input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} required/></label>
      <label className="field">备注<input value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label>
      {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
      <div className="flex gap-2"><button type="button" className="secondary flex-1" onClick={onClose}>取消编辑</button><button type="submit" className="primary flex-1">保存修改</button></div>
    </form>
  </dialog>,document.body);
}
