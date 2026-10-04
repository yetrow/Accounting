import { newProvenance } from "./provenance.ts";
import {
  applyCommand,
  emptyBook,
  validateBook,
  type Book,
  type Command,
} from "../domain/book.ts";
import {
  parseBackup,
  readLegacy,
  type LegacyStorage,
} from "../domain/backup.ts";
export interface Change {
  entity: keyof Book;
  id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}
export interface AuditEvent {
  id: string;
  revision: number;
  at: number;
  kind: string;
  changes: Change[];
  sourceAudit?: unknown[];
}
export interface RecordState {
  book: Book;
  revision: number;
  initialized: boolean;
  recovery: Book | null;
}
export interface Adapter {
  readonly name: string;
  load(): Promise<RecordState>;
  commit(
    expected: number,
    book: Book,
    event: AuditEvent,
    recovery?: Book,
  ): Promise<void>;
  history(): Promise<AuditEvent[]>;
}
export function changes(before: Book, after: Book): Change[] {
  const result: Change[] = [];
  for (const entity of [
    "accounts",
    "categories",
    "transactions",
    "budgets",
  ] as const) {
    const key = (v: unknown) => {
      const o = v as Record<string, unknown>;
      return String(o.id ?? o.month);
    };
    const a = new Map(before[entity].map((v) => [key(v), v])),
      b = new Map(after[entity].map((v) => [key(v), v]));
    for (const id of new Set([...a.keys(), ...b.keys()]))
      if (JSON.stringify(a.get(id)) !== JSON.stringify(b.get(id)))
        result.push({
          entity,
          id,
          before: (a.get(id) ?? null) as Record<string, unknown> | null,
          after: (b.get(id) ?? null) as Record<string, unknown> | null,
        });
  }
  return result;
}
export class Repository {
  readonly adapter: Adapter;
  private current: RecordState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(adapter: Adapter) {
    this.adapter = adapter;
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work);
    this.queue = task.catch(() => {});
    return task;
  }
  async load() {
    this.current = await this.adapter.load();
    return structuredClone(this.current);
  }
  async initialize(legacy?: LegacyStorage) {
    return this.serial(async () => {
      const state = await this.load();
      if (state.initialized) return state;
      const book = readLegacy(legacy) ?? emptyBook();
      return this.persist(book, "migration", false);
    });
  }
  private async persist(
    book: Book,
    kind: string,
    replacing: boolean,
    sourceAudit?: unknown[],
  ): Promise<RecordState> {
    const prior = this.current ?? (await this.load());
    const clean = validateBook(book);
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      revision: prior.revision + 1,
      at: Date.now(),
      kind,
      changes: changes(prior.book, clean),
    };
    if (sourceAudit?.length) event.sourceAudit = sourceAudit;
    const recovery = replacing && prior.initialized ? prior.book : undefined;
    await this.adapter.commit(prior.revision, clean, event, recovery);
    this.current = {
      book: clean,
      revision: event.revision,
      initialized: true,
      recovery: recovery ?? prior.recovery,
    };
    return structuredClone(this.current);
  }
  dispatch(command: Command) {
    return this.serial(async () => {
      const state = this.current ?? (await this.load());
      if (!state.initialized) throw new Error("请先完成数据迁移");
      return this.persist(
        applyCommand(state.book, command),
        command.type,
        false,
      );
    });
  }
  importBackup(raw: unknown) {
    return this.serial(async () => {
      const { book, sourceAudit } = parseBackup(raw);
      if (!this.current) await this.load();
      return this.persist(
        book,
        "backup.import",
        true,
        newProvenance(sourceAudit, await this.history()),
      );
    });
  }
  restore() {
    return this.serial(async () => {
      const state = this.current ?? (await this.load());
      if (!state.recovery) throw new Error("尚无导入前恢复点");
      return this.persist(state.recovery, "backup.restore", true);
    });
  }
  history() {
    return this.adapter.history();
  }
  exportBackup() {
    return this.serial(async () => {
      const state = await this.adapter.load();
      if (!state.initialized) throw new Error("账本尚未初始化");
      return {
        app: "Bill" as const,
        version: 3 as const,
        currency: "CNY",
        exportedAt: new Date().toISOString(),
        data: state.book,
        audit: (await this.history()).filter(
          (event) => event.revision <= state.revision,
        ),
      };
    });
  }
}
/** Future transport must supply encryption, identity, conflict semantics and acknowledgments.
 * The presence of an audit log does not make remote changes safe to replay. */
export interface SyncTransport {
  pushEncrypted(envelope: Uint8Array): Promise<string>;
  pullEncrypted(
    cursor: string | null,
  ): Promise<{ cursor: string; envelopes: Uint8Array[] }>;
}
