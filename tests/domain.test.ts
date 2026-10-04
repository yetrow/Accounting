import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyBook,
  applyCommand,
  parseMoney,
  budgetSummary,
  balances,
  validateBook,
} from "../src/domain/book.ts";
import { parseBackup, readLegacy, toBeancount } from "../src/domain/backup.ts";
const tx = {
  id: "t1",
  kind: "expense" as const,
  amountMinor: 1234,
  accountId: "cash",
  categoryId: "food",
  date: "2026-10-01",
  note: "午餐",
  createdAt: 1,
};
test("money rejects floating point drift, precision, zero and overflow", () => {
  assert.equal(parseMoney("12.34"), 1234);
  assert.equal(parseMoney("0.10"), 10);
  for (const bad of ["1.001", "NaN", "-1", "1e2", "0", "10000000"])
    assert.throws(() => parseMoney(bad));
});
test("expense, income and transfer affect balances, budget only spends", () => {
  let b = emptyBook();
  b = applyCommand(b, {
    type: "account.add",
    account: {
      id: "bank",
      name: "银行卡",
      openingMinor: 10000,
      archived: false,
    },
  });
  b = applyCommand(b, { type: "transaction.save", transaction: tx });
  b = applyCommand(b, {
    type: "transaction.save",
    transaction: {
      ...tx,
      id: "i",
      kind: "income",
      categoryId: "salary",
      amountMinor: 2000,
    },
  });
  b = applyCommand(b, {
    type: "transaction.save",
    transaction: {
      ...tx,
      id: "x",
      kind: "transfer",
      categoryId: null,
      toAccountId: "bank",
      amountMinor: 500,
    },
  });
  b = applyCommand(b, {
    type: "budget.set",
    month: "2026-10",
    amountMinor: 10000,
  });
  assert.equal(balances(b).cash, 266);
  assert.equal(balances(b).bank, 10500);
  assert.equal(budgetSummary(b, "2026-10-04").remainingMinor, 8766);
  assert.equal(budgetSummary(b, "2026-10-04").daysLeft, 28);
  const edited = applyCommand(b, {
    type: "transaction.save",
    transaction: { ...tx, amountMinor: 500 },
  });
  assert.equal(budgetSummary(edited, "2026-10-04").spentMinor, 500);
  const deleted = applyCommand(edited, {
    type: "transaction.delete",
    id: "t1",
  });
  assert.equal(budgetSummary(deleted, "2026-10-04").spentMinor, 0);
  assert.equal(b.transactions[0].amountMinor, 1234);
});
test("reference integrity and invalid dates are rejected", () => {
  for (const patch of [
    { accountId: "missing" },
    { date: "2026-02-30" },
    { amountMinor: 1.5 },
    { kind: "income", categoryId: "food" },
    { kind: "transfer", categoryId: null, toAccountId: "cash" },
  ])
    assert.throws(() =>
      applyCommand(emptyBook(), {
        type: "transaction.save",
        transaction: { ...tx, ...patch } as typeof tx,
      }),
    );
  assert.throws(() =>
    applyCommand(emptyBook(), {
      type: "budget.set",
      month: "2026-13",
      amountMinor: 10,
    }),
  );
  assert.throws(() => validateBook({ ...emptyBook(), accounts: [] }));
});
test("legacy v2 imports integer cents and archived missing category, budgets", () => {
  const b = parseBackup({
    version: 2,
    expenses: [
      {
        id: "old",
        amount: 0.1,
        date: "2026-01-02",
        category: "旧类别",
        createdAt: 3,
      },
    ],
    categories: [],
    budgets: { "2026-10": 900 },
  }).book;
  assert.equal(b.transactions[0].amountMinor, 10);
  assert.equal(b.categories[0].archived, true);
  assert.equal(b.budgets[0].amountMinor, 90000);
});
test("corrupt primary must not silently use older fallback", () => {
  const s = {
    getItem: (key: string) => (key === "ledger.snapshot.v2" ? "{bad" : null),
  };
  assert.throws(() => readLegacy(s));
  assert.throws(() =>
    parseBackup({ version: 99, expenses: [], categories: [] }),
  );
  const b = emptyBook();
  assert.throws(() =>
    parseBackup({
      app: "Bill",
      version: 3,
      data: { ...b, transactions: [tx, tx] },
    }),
  );
});
test("Beancount emits balanced expense and transfer postings and escapes notes", () => {
  let b = applyCommand(emptyBook(), {
    type: "transaction.save",
    transaction: { ...tx, note: 'a"b\nc' },
  });
  b = applyCommand(b, {
    type: "account.add",
    account: { id: "bank", name: "银行", openingMinor: 0, archived: false },
  });
  b = applyCommand(b, {
    type: "transaction.save",
    transaction: {
      ...tx,
      id: "x",
      kind: "transfer",
      categoryId: null,
      toAccountId: "bank",
      amountMinor: 100,
    },
  });
  const output = toBeancount(b);
  assert.match(output, /12\.34 CNY/);
  assert.match(output, /-12\.34 CNY/);
  assert.match(output, /a\\"b c/);
});

test("orphan legacy recovery blocks empty initialization", () => {
  const storage = {
    getItem: (key: string) =>
      key === "ledger.recovery.v2"
        ? JSON.stringify({ expenses: [], categories: [] })
        : null,
  };
  assert.throws(() => readLegacy(storage), /恢复/);
});

test("legacy upgrades seed usable income categories without changing expense names", () => {
  const b = parseBackup({
    version: 2,
    expenses: [],
    categories: [{ name: "餐饮", color: "#d87962" }],
  }).book;
  assert.equal(b.categories.filter((c) => c.kind === "expense").length, 1);
  assert.ok(b.categories.some((c) => c.kind === "income" && c.name === "工资"));
});
