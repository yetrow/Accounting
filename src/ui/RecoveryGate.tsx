import { useRef, useState } from "react";
import { MAX_FILE_BYTES, parseFile, rawLegacy } from "../domain/backup";
import { isNative, openFile, saveFile } from "../platform/native";
export function RecoveryGate({
  error,
  onImport,
}: {
  error: string;
  onImport: (raw: unknown) => Promise<boolean>;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{ raw: unknown; count: number } | null>(
      null,
    );
  const input = useRef<HTMLInputElement>(null);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setPreview(null);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function parse(text: string) {
    setPreview(null);
    const { book } = parseFile(text);
    setPreview({
      raw: JSON.parse(text.replace(/^\uFEFF/, "")),
      count: book.transactions.length,
    });
  }
  return (
    <>
      <p role="alert">{error}</p>
      {message && <p role="status">{message}</p>}
      <button disabled={busy} onClick={() => location.reload()}>
        重新加载
      </button>
      <button
        disabled={busy}
        onClick={() =>
          void action(async () => {
            await saveFile(
              JSON.stringify(
                { app: "Bill rescue", raw: rawLegacy(localStorage) },
                null,
                2,
              ),
            );
            setMessage("原始数据导出已结束，请核对文件。");
          })
        }
      >
        导出旧版原始数据
      </button>
      <button
        disabled={busy}
        onClick={() => {
          setPreview(null);
          if (isNative())
            void action(async () => {
              const raw = await openFile();
              if (raw !== null) parse(raw);
            });
          else input.current?.click();
        }}
      >
        选择备份恢复
      </button>
      <input
        ref={input}
        type="file"
        hidden
        aria-label="恢复备份"
        accept=".json,application/json"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          setPreview(null);
          if (file)
            void action(async () => {
              if (file.size > MAX_FILE_BYTES) throw new Error("文件超过 32 MB");
              parse(await file.text());
            });
        }}
      />
      <button
        disabled={busy}
        onClick={() =>
          void action(async () => {
            const raw = localStorage.getItem("ledger.recovery.v2");
            if (raw) {
              parse(raw);
              return;
            }
            const current = JSON.parse(
              localStorage.getItem("ledger.snapshot.v2") ?? "{}",
            );
            if (current.recovery) {
              parse(JSON.stringify(current.recovery));
              return;
            }
            throw new Error("未找到可用的旧版恢复点");
          })
        }
      >
        查找旧版恢复点
      </button>
      {preview && (
        <div className="confirmation">
          <p>
            此备份包含 {preview.count} 笔交易。确认后导入到
            Bill，旧版原始数据保持不变。
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await onImport(preview.raw);
              })
            }
          >
            确认恢复此备份
          </button>
          <button disabled={busy} onClick={() => setPreview(null)}>
            取消
          </button>
        </div>
      )}
    </>
  );
}
