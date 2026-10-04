import { MAX_FILE_BYTES } from "../domain/backup.ts";
import { today } from "../domain/book.ts";
interface NativeResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  cancelled?: boolean;
}
declare global {
  interface Window {
    BillNative?: { request(id: string, action: string, payload: string): void };
    billNativeResult?: (id: string, result: NativeResult) => void;
  }
}
const pending = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
if (typeof window !== "undefined")
  window.billNativeResult = (id, result) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    if (result.cancelled) p.resolve(null);
    else if (result.ok) p.resolve(result.data);
    else p.reject(new Error(result.error ?? "原生操作失败"));
  };
export const isNative = () =>
  typeof window !== "undefined" && !!window.BillNative;
export function nativeRequest<T>(
  action: string,
  payload: unknown = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!window.BillNative) {
      reject(new Error("此功能需要 Android 应用"));
      return;
    }
    const id = crypto.randomUUID(),
      timeout = action.startsWith("file.") ? 15 * 60_000 : 60_000;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("操作未确认，请重新加载以核对结果，勿重复提交"));
    }, timeout);
    pending.set(id, { resolve: (v) => resolve(v as T), reject, timer });
    try {
      window.BillNative.request(id, action, JSON.stringify(payload));
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e);
    }
  });
}
export async function saveFile(
  content: string,
  extension = "json",
  mime = "application/json",
) {
  if (new Blob([content]).size > MAX_FILE_BYTES)
    throw new Error("文件超过 32 MB");
  const name = `Bill-${today()}.${extension}`;
  if (isNative())
    return await nativeRequest<boolean | null>("file.save", {
      name,
      mime,
      content,
    });
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export const openFile = () => nativeRequest<string | null>("file.open");
