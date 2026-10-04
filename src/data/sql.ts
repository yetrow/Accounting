import { type Book, validateBook } from "../domain/book.ts";
import type { Adapter, AuditEvent, RecordState } from "./repository.ts";
export interface Statement {
  sql: string;
  params: (string | number | null)[];
}
export interface SqlDriver {
  read(queries: Statement[]): Promise<Record<string, unknown>[][]>;
  commit(expected: number, statements: Statement[]): Promise<void>;
}
const query = (sql: string, params: Statement["params"] = []): Statement => ({
  sql,
  params,
});
export const READ_QUERIES = [
  query("SELECT key,value FROM metadata"),
  query("SELECT * FROM accounts ORDER BY rowid"),
  query("SELECT * FROM categories ORDER BY rowid"),
  query("SELECT * FROM transactions ORDER BY rowid"),
  query("SELECT * FROM budgets ORDER BY month"),
  query("SELECT snapshot FROM recovery WHERE id=1"),
];
export function decode(rows: Record<string, unknown>[][]): RecordState {
  const [meta, accounts, categories, transactions, budgets, recovery] = rows;
  const m = Object.fromEntries(meta.map((r) => [r.key, r.value]));
  const book = {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      openingMinor: a.opening_minor,
      archived: !!a.archived,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      color: c.color,
      archived: !!c.archived,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      kind: t.kind,
      amountMinor: t.amount_minor,
      accountId: t.account_id,
      toAccountId: t.to_account_id,
      categoryId: t.category_id,
      date: t.date,
      note: t.note,
      createdAt: t.created_at,
    })),
    budgets: budgets.map((b) => ({
      month: b.month,
      amountMinor: b.amount_minor,
    })),
  };
  const initialized = m.initialized === "1";
  return {
    book: initialized ? validateBook(book) : (book as Book),
    revision: Number(m.revision),
    initialized,
    recovery: recovery[0]
      ? validateBook(JSON.parse(String(recovery[0].snapshot)))
      : null,
  };
}
const fields = {
  accounts: ["id", "name", "opening_minor", "archived"],
  categories: ["id", "name", "kind", "color", "archived"],
  transactions: [
    "id",
    "kind",
    "amount_minor",
    "account_id",
    "to_account_id",
    "category_id",
    "date",
    "note",
    "created_at",
  ],
  budgets: ["month", "amount_minor"],
};
function values(
  entity: keyof Book,
  v: Record<string, unknown>,
): Statement["params"] {
  switch (entity) {
    case "accounts":
      return [
        v.id,
        v.name,
        v.openingMinor,
        Number(v.archived),
      ] as Statement["params"];
    case "categories":
      return [
        v.id,
        v.name,
        v.kind,
        v.color,
        Number(v.archived),
      ] as Statement["params"];
    case "transactions":
      return [
        v.id,
        v.kind,
        v.amountMinor,
        v.accountId,
        v.toAccountId ?? null,
        v.categoryId,
        v.date,
        v.note,
        v.createdAt,
      ] as Statement["params"];
    case "budgets":
      return [v.month, v.amountMinor] as Statement["params"];
  }
}
export function encodeCommit(
  book: Book,
  event: AuditEvent,
  recovery?: Book,
): Statement[] {
  // Import/migration rewrite the materialized projection; audit_log is append-only.
  const replacing = ["migration", "backup.import", "backup.restore"].includes(
    event.kind,
  );
  const stmts: Statement[] = [];
  if (replacing) {
    for (const table of ["transactions", "budgets", "categories", "accounts"])
      stmts.push(query(`DELETE FROM ${table}`));
    for (const entity of [
      "accounts",
      "categories",
      "transactions",
      "budgets",
    ] as const)
      for (const item of book[entity])
        stmts.push(
          query(
            `INSERT INTO ${entity} (${fields[entity].join(",")}) VALUES (${fields[entity].map(() => "?").join(",")})`,
            values(entity, item as unknown as Record<string, unknown>),
          ),
        );
  } else
    for (const c of event.changes) {
      const f = fields[c.entity],
        pk = f[0];
      if (!c.after)
        stmts.push(query(`DELETE FROM ${c.entity} WHERE ${pk}=?`, [c.id]));
      else if (!c.before)
        stmts.push(
          query(
            `INSERT INTO ${c.entity} (${f.join(",")}) VALUES (${f.map(() => "?").join(",")})`,
            values(c.entity, c.after),
          ),
        );
      else {
        const v = values(c.entity, c.after);
        stmts.push(
          query(
            `UPDATE ${c.entity} SET ${f
              .slice(1)
              .map((k) => `${k}=?`)
              .join(",")} WHERE ${pk}=?`,
            [...v.slice(1), v[0]],
          ),
        );
      }
    }
  if (recovery)
    stmts.push(
      query("INSERT OR REPLACE INTO recovery(id,snapshot) VALUES(1,?)", [
        JSON.stringify(recovery),
      ]),
    );
  stmts.push(
    query(
      "INSERT INTO audit_log(id,revision,at,kind,payload) VALUES(?,?,?,?,?)",
      [event.id, event.revision, event.at, event.kind, JSON.stringify(event)],
    ),
    query("UPDATE metadata SET value='1' WHERE key='initialized'"),
  );
  return stmts;
}
export class SqlAdapter implements Adapter {
  readonly name = "SQLite";
  private driver: SqlDriver;
  constructor(driver: SqlDriver) {
    this.driver = driver;
  }
  async load() {
    return decode(await this.driver.read(READ_QUERIES));
  }
  commit(expected: number, book: Book, event: AuditEvent, recovery?: Book) {
    return this.driver.commit(expected, encodeCommit(book, event, recovery));
  }
  async history() {
    return (
      await this.driver.read([
        query("SELECT payload FROM audit_log ORDER BY revision"),
      ])
    )[0].map((r) => JSON.parse(String(r.payload)) as AuditEvent);
  }
}
