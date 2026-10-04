import type { Adapter, AuditEvent, RecordState } from "./repository.ts";
import { validateBook, type Book } from "../domain/book.ts";
const entities = ["accounts", "categories", "transactions", "budgets"] as const;
const stores = [...entities, "metadata", "audit_log", "recovery"];
function requested<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("存储事务已取消"));
    tx.onerror = () => {};
  });
}
/** Browser adapter only. Android never falls back here if SQLite fails. */
export class IndexedDbAdapter implements Adapter {
  readonly name = "IndexedDB（浏览器）";
  private db: Promise<IDBDatabase>;
  constructor() {
    this.db = new Promise((resolve, reject) => {
      const r = indexedDB.open("bill", 1);
      r.onupgradeneeded = () => {
        for (const name of stores)
          r.result.createObjectStore(name, {
            keyPath:
              name === "budgets" ? "month" : name === "metadata" ? "key" : "id",
          });
      };
      r.onsuccess = () => {
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error("请关闭其他 Bill 标签页后重试"));
    });
  }
  async load(): Promise<RecordState> {
    const db = await this.db,
      tx = db.transaction(stores, "readonly"),
      finished = done(tx);
    const requests = [
      ...entities.map((e) => requested(tx.objectStore(e).getAll())),
      requested(tx.objectStore("metadata").get("state")),
      requested(tx.objectStore("recovery").get(1)),
    ];
    const [accounts, categories, transactions, budgets, meta, recovery] =
      await Promise.all(requests);
    await finished;
    const book = { accounts, categories, transactions, budgets } as Book;
    return {
      book: meta?.initialized ? validateBook(book) : book,
      revision: meta?.revision ?? 0,
      initialized: !!meta?.initialized,
      recovery: recovery ? validateBook(recovery.book) : null,
    };
  }
  async commit(
    expected: number,
    book: Book,
    event: AuditEvent,
    recovery?: Book,
  ) {
    const db = await this.db,
      tx = db.transaction(stores, "readwrite"),
      finished = done(tx);
    let conflict = false;
    const r = tx.objectStore("metadata").get("state");
    r.onsuccess = () => {
      if ((r.result?.revision ?? 0) !== expected) {
        conflict = true;
        tx.abort();
        return;
      }
      const replace = ["migration", "backup.import", "backup.restore"].includes(
        event.kind,
      );
      if (replace) {
        for (const e of entities) {
          const store = tx.objectStore(e);
          store.clear();
          for (const item of book[e]) store.put(item);
        }
      } else
        for (const change of event.changes) {
          const store = tx.objectStore(change.entity);
          if (change.after) store.put(change.after);
          else store.delete(change.id);
        }
      tx.objectStore("audit_log").add(event);
      if (recovery) tx.objectStore("recovery").put({ id: 1, book: recovery });
      tx.objectStore("metadata").put({
        key: "state",
        revision: expected + 1,
        initialized: true,
      });
    };
    try {
      await finished;
    } catch (e) {
      if (conflict) throw new Error("CONFLICT");
      throw e;
    }
  }
  async history(): Promise<AuditEvent[]> {
    const db = await this.db,
      tx = db.transaction("audit_log", "readonly"),
      finished = done(tx);
    const rows = await requested(tx.objectStore("audit_log").getAll());
    await finished;
    return rows.sort((a, b) => a.revision - b.revision);
  }
}
