import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqlAdapter, type SqlDriver, type Statement } from "../src/data/sql.ts";
import { Repository } from "../src/data/repository.ts";
import { emptyBook } from "../src/domain/book.ts";
function driver(db: DatabaseSync): SqlDriver {
  db.exec("PRAGMA foreign_keys=ON");
  const version = (
    db.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
  for (let i = version + 1; i <= 2; i++) {
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(`database/migrations/00${i}.sql`, "utf8"));
      db.exec(`PRAGMA user_version=${i}; COMMIT`);
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return {
    async read(queries: Statement[]) {
      db.exec("BEGIN");
      try {
        const result = queries.map((q) => db.prepare(q.sql).all(...q.params));
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async commit(expected: number, statements: Statement[]) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const revision = Number(
          (
            db
              .prepare("SELECT value FROM metadata WHERE key='revision'")
              .get() as { value: string }
          ).value,
        );
        if (revision !== expected) throw new Error("CONFLICT");
        for (const s of statements) db.prepare(s.sql).run(...s.params);
        db.prepare("UPDATE metadata SET value=? WHERE key='revision'").run(
          String(expected + 1),
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
const tx = {
  id: "t",
  kind: "expense" as const,
  amountMinor: 1500,
  accountId: "cash",
  categoryId: "food",
  date: "2026-10-01",
  note: "test",
  createdAt: 1,
};
test("SQLite migration is once-only, audit survives edits/deletes and restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bill-"));
  const path = join(dir, "book.db");
  let db = new DatabaseSync(path);
  try {
    let repo = new Repository(new SqlAdapter(driver(db)));
    let reads = 0;
    await repo.initialize({
      getItem() {
        reads++;
        return null;
      },
    });
    assert.ok(reads > 0);
    await repo.dispatch({ type: "transaction.save", transaction: tx });
    await repo.dispatch({
      type: "transaction.save",
      transaction: { ...tx, amountMinor: 2000 },
    });
    await repo.dispatch({ type: "transaction.delete", id: "t" });
    const history = await repo.history();
    assert.equal(history.length, 4);
    assert.equal(history[2].changes[0].before.amountMinor, 1500);
    assert.throws(() => db.exec("DELETE FROM audit_log"));
    assert.throws(() => db.exec("UPDATE audit_log SET kind='oops'"));
    db.close();
    db = new DatabaseSync(path);
    repo = new Repository(new SqlAdapter(driver(db)));
    const state = await repo.initialize({
      getItem() {
        throw new Error("must not read legacy after migration");
      },
    });
    assert.equal(state.book.transactions.length, 0);
    assert.equal((await repo.history()).length, 4);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("atomic rollback and optimistic lock prevent partial writes and lost update", async () => {
  const db = new DatabaseSync(":memory:");
  const d = driver(db);
  const a = new Repository(new SqlAdapter(d)),
    b = new Repository(new SqlAdapter(d));
  await a.initialize();
  await b.initialize();
  await a.dispatch({ type: "transaction.save", transaction: tx });
  await assert.rejects(
    () =>
      b.dispatch({ type: "budget.set", month: "2026-10", amountMinor: 50000 }),
    /CONFLICT/,
  );
  await assert.rejects(() =>
    d.commit(2, [
      {
        sql: "INSERT INTO budgets(month,amount_minor) VALUES('2026-10',1000)",
        params: [],
      },
      { sql: "INSERT INTO missing_table VALUES(1)", params: [] },
    ]),
  );
  assert.equal(db.prepare("SELECT * FROM budgets").all().length, 0);
  assert.equal((await a.load()).revision, 2);
  db.close();
});
test("import and recovery preserve audit history and integer balances", async () => {
  const db = new DatabaseSync(":memory:");
  const repo = new Repository(new SqlAdapter(driver(db)));
  await repo.initialize();
  await repo.dispatch({ type: "transaction.save", transaction: tx });
  await repo.importBackup({
    app: "Bill",
    version: 3,
    data: emptyBook(),
    audit: [],
  });
  assert.equal((await repo.load()).book.transactions.length, 0);
  await repo.restore();
  assert.equal((await repo.load()).book.transactions.length, 1);
  const backup = await repo.exportBackup();
  assert.equal(backup.audit.length, 4);
  assert.equal(backup.data.transactions[0].amountMinor, 1500);
  await repo.restore();
  assert.equal((await repo.load()).book.transactions.length, 0);
  db.close();
});
test("corrupt legacy cannot initialize or overwrite data; valid import repairs", async () => {
  const db = new DatabaseSync(":memory:");
  const repo = new Repository(new SqlAdapter(driver(db)));
  await assert.rejects(() => repo.initialize({ getItem: () => "{bad" }));
  assert.equal((await repo.load()).initialized, false);
  await repo.importBackup({ version: 2, expenses: [], categories: [] });
  assert.equal((await repo.load()).initialized, true);
  db.close();
});
test("schema upgrades from v1 without dropping user entities", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("database/migrations/001.sql", "utf8"));
  db.exec(
    "INSERT INTO accounts VALUES ('keep','Cash',10,0); PRAGMA user_version=1",
  );
  driver(db);
  assert.equal(db.prepare("SELECT id FROM accounts").get()?.id, "keep");
  assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 2);
  db.close();
});

test("export must not silently rebase a stale editor, and history matches snapshot revision", async () => {
  const db = new DatabaseSync(":memory:");
  const d = driver(db),
    a = new Repository(new SqlAdapter(d)),
    b = new Repository(new SqlAdapter(d));
  await a.initialize();
  await a.dispatch({ type: "transaction.save", transaction: tx });
  await b.initialize();
  await a.dispatch({
    type: "transaction.save",
    transaction: { ...tx, amountMinor: 999 },
  });
  const backup = await b.exportBackup();
  assert.equal(backup.data.transactions[0].amountMinor, 999);
  await assert.rejects(
    () =>
      b.dispatch({
        type: "transaction.save",
        transaction: { ...tx, note: "stale note" },
      }),
    /CONFLICT/,
  );
  db.close();
});
test("repeated full backup roundtrips preserve provenance without nesting growth", async () => {
  const db = new DatabaseSync(":memory:");
  const repo = new Repository(new SqlAdapter(driver(db)));
  await repo.initialize();
  await repo.dispatch({ type: "transaction.save", transaction: tx });
  const originalSize = JSON.stringify(await repo.exportBackup()).length;
  for (let n = 0; n < 12; n++)
    await repo.importBackup(await repo.exportBackup());
  const backup = await repo.exportBackup();
  assert.ok(JSON.stringify(backup).length < originalSize * 10);
  assert.equal(backup.audit.length, 14);
  const foreign = new Repository(
    new SqlAdapter(driver(new DatabaseSync(":memory:"))),
  );
  await foreign.initialize();
  await foreign.importBackup(backup);
  const afterFirst = await foreign.exportBackup();
  await foreign.importBackup(backup);
  const afterSecond = await foreign.exportBackup();
  assert.ok(
    JSON.stringify(afterSecond).length <
      JSON.stringify(afterFirst).length * 1.5,
  );
  db.close();
});

test("backup is a consistent revision even if another writer commits during export", async () => {
  const db = new DatabaseSync(":memory:");
  const base = new SqlAdapter(driver(db));
  const writer = new Repository(base);
  await writer.initialize();
  await writer.dispatch({ type: "transaction.save", transaction: tx });
  let interleave = true;
  const exporter = new Repository({
    name: base.name,
    load: () => base.load(),
    commit: (...args) => base.commit(...args),
    history: async () => {
      if (interleave) {
        interleave = false;
        await writer.dispatch({
          type: "transaction.save",
          transaction: { ...tx, amountMinor: 777 },
        });
      }
      return base.history();
    },
  });
  const out = await exporter.exportBackup();
  assert.equal(out.data.transactions[0].amountMinor, 1500);
  assert.equal(out.audit.at(-1)?.revision, 2);
  assert.equal((await writer.load()).revision, 3);
  db.close();
});
