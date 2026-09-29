import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import { MAX_FILE_BYTES, normalizeBackup, type Snapshot, getRecovery, rawLocalData } from '@/lib/ledger';
import { exportJson, importNative } from '@/lib/native';
export default function DataManager(){
  const {expenses,categories,budgets,importData,restoreBackup,readError}=useExpenses();
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState<Snapshot|null>(null);
  const [recover,setRecover]=useState(false);
  const [fullscreen,setFullscreen]=useState(()=>window.LedgerAndroid?.isFullscreen()??false);
  const fileRef=useRef<HTMLInputElement>(null);
  const parse=(content:string)=>{
    setPreview(null);
    try {setPreview(normalizeBackup(JSON.parse(content.replace(/^\uFEFF/,''))));setMessage('');}
    catch(e){setMessage(e instanceof SyntaxError?'文件无法解析，请选择有效的 JSON 备份':(e as Error).message);}
  };
  const readFile=async(file:File)=>{
    setPreview(null);setMessage('');
    if(file.size>MAX_FILE_BYTES){setMessage('文件超过 8 MB，无法导入');return;}
    setBusy(true);try{parse(await file.text());}catch{setMessage('文件读取失败，请重新选择');}finally{setBusy(false);}
  };
  const exportData=async()=>{
    if(readError){setMessage('本机数据异常，请先导出原始数据');return;}
    setBusy(true);setMessage('');
    try{const ok=await exportJson({app:'记账小本',version:2,exportedAt:new Date().toISOString(),expenses,categories,budgets});setMessage(ok?(window.LedgerAndroid?'导出成功，文件已保存':'已发起下载，请查看下载文件'):'已取消导出');}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  };
  const chooseFile=async()=>{
    setPreview(null);setMessage('');
    if(!window.LedgerAndroid){fileRef.current?.click();return;}
    setBusy(true);setMessage('');
    try{const raw=await importNative();if(raw!==null)parse(raw);else setMessage('已取消导入');}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  };
  return <section className="rounded-2xl bg-white p-4 mb-4 text-left" aria-label="数据管理面板">
    <h2 className="font-semibold mb-1">数据与显示</h2>
    <p className="text-xs text-[#8A8474] mb-3">账单保存在本机。导出 JSON 可备份，导入前会先检查并确认。</p>
    {readError&&<div role="alert" className="text-sm mb-3"><p>原数据读取异常，当前列表为空。请先备份原始数据，再导入有效备份；原始异常数据会同时保留。</p><button className="secondary mt-2" disabled={busy} onClick={async()=>{setBusy(true);try{const ok=await exportJson({app:'记账小本原始数据',raw:rawLocalData(localStorage)});setMessage(ok?'原始数据已导出':'已取消导出');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>导出原始数据</button></div>}
    <div className="flex gap-2">
      <button disabled={busy} onClick={exportData} className="primary flex-1"><Download size={15}/>导出 JSON</button>
      <button disabled={busy} onClick={chooseFile} className="secondary flex-1"><Upload size={15}/>导入 JSON</button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);e.target.value='';}}/>
    </div>
    {busy&&<p className="text-sm mt-2" role="status">请在文件窗口中选择位置…</p>}
    {message&&<p className="text-sm mt-2" role="status">{message}</p>}
    {preview&&<div className="mt-3 p-3 rounded-xl bg-[#F7F3EB]">
      <p className="text-sm">此备份包含 {preview.expenses.length} 笔账单、{preview.categories.length} 个分类和 {Object.keys(preview.budgets).length} 个月预算。</p>
      <p className="text-xs my-2">将替换当前 {expenses.length} 笔账单。替换前自动保留一份恢复备份。</p>
      <div className="flex flex-wrap gap-2"><button disabled={busy} className="primary" onClick={()=>{if(importData(preview)){setPreview(null);setMessage(readError?'导入成功，原始异常数据已保留':'导入成功，已保留导入前备份');}}}>确认覆盖导入</button><button className="secondary" onClick={()=>setPreview(null)}>取消导入</button></div>
    </div>}
    <button className="text-sm underline mt-3 text-[#6B6656]" onClick={()=>{try{if(getRecovery(localStorage))setRecover(true);else setMessage('尚无导入前备份');}catch{setMessage('无法读取恢复备份');}}}>恢复导入前数据</button>
    {recover&&<div className="mt-2 text-sm"><p>恢复备份将替换当前数据。当前数据也会保留为下一份恢复备份。</p><div className="flex gap-2 mt-2"><button className="primary" onClick={()=>{if(restoreBackup()){setRecover(false);setMessage('已恢复导入前数据');}}}>确认恢复</button><button className="secondary" onClick={()=>setRecover(false)}>取消</button></div></div>}
    {window.LedgerAndroid&&<label className="flex items-center gap-3 border-t mt-4 pt-3 text-sm"><input type="checkbox" checked={fullscreen} onChange={e=>{setFullscreen(e.target.checked);window.LedgerAndroid!.setFullscreen(e.target.checked);}}/>沉浸式全屏（隐藏状态栏和导航栏）</label>}
  </section>;
}
