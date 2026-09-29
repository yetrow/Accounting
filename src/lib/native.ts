import { MAX_FILE_BYTES, todayStr } from './ledger';
interface Bridge { exportJson:(id:string,name:string,content:string)=>void; importJson:(id:string)=>void; setFullscreen:(enabled:boolean)=>void; isFullscreen:()=>boolean }
declare global { interface Window { LedgerAndroid?:Bridge; ledgerNativeResult?:(id:string,result:{ok?:boolean;cancelled?:boolean;data?:string;error?:string})=>void } }
let sequence=0;
const pending=new Map<string,{resolve:(value:string|null)=>void;reject:(error:Error)=>void}>();
window.ledgerNativeResult=(id,result)=>{
  const request=pending.get(id);if(!request)return;pending.delete(id);
  if(result.cancelled)request.resolve(null);
  else if(result.ok)request.resolve(result.data??'');
  else request.reject(new Error(result.error??'文件操作失败'));
};
function requestNative(run:(id:string)=>void) {
  return new Promise<string|null>((resolve,reject)=>{
    const id=`file-${++sequence}`;pending.set(id,{resolve,reject});
    try{run(id);}catch(e){pending.delete(id);reject(e);}
  });
}
export function importNative(){return requestNative(id=>window.LedgerAndroid!.importJson(id));}
export async function exportJson(payload:unknown) {
  const content=JSON.stringify(payload,null,2);
  if(new Blob([content]).size>MAX_FILE_BYTES)throw new Error('备份超过 8 MB，无法导出');
  const name=`记账数据-${todayStr()}.json`;
  if(window.LedgerAndroid)return (await requestNative(id=>window.LedgerAndroid!.exportJson(id,name,content)))!==null;
  const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);return true;
}
