import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRepository } from "../data/create.ts";
import type { RecordState } from "../data/repository.ts";
import { RecoveryGate } from "./RecoveryGate";
import { Context } from "./context";
export function BookProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(createRepository);
  const [state, setState] = useState<RecordState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const locked = useRef(false),
    boot = useRef<Promise<RecordState> | null>(null);
  useEffect(() => {
    let active = true;
    boot.current ??= repository.initialize(localStorage);
    boot.current.then(
      (s) => {
        if (active) setState(s);
      },
      (e) => {
        if (active)
          setError(
            `迁移或读取失败，原数据未覆盖：${e instanceof Error ? e.message : String(e)}`,
          );
      },
    );
    return () => {
      active = false;
    };
  }, [repository]);
  async function run(task: () => Promise<RecordState>) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      setState(await task());
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message.includes("CONFLICT")
          ? "账本已在其他窗口改变，请重新加载后再试。"
          : message,
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (!state)
    return (
      <main className="boot">
        <div className="brand-mark">
          B<span>·</span>
        </div>
        <h1>Bill</h1>
        {!error ? (
          <p role="status">正在打开本机账本…</p>
        ) : (
          <RecoveryGate
            error={error}
            onImport={(raw) => run(() => repository.importBackup(raw))}
          />
        )}
      </main>
    );
  return (
    <Context.Provider
      value={{
        ...state,
        repository,
        busy,
        error,
        dismiss: () => setError(""),
        run,
        dispatch: (command) => run(() => repository.dispatch(command)),
      }}
    >
      {children}
    </Context.Provider>
  );
}
