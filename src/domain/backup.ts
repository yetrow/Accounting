import {
  COLORS,
  emptyBook,
  object,
  parseMoney,
  validateBook,
  type Book,
} from "./book.ts";
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const LEGACY_KEYS = [
  "ledger.snapshot.v2",
  "ledger.recovery.v2",
  "ledger.expenses.v1",
  "ledger.categories.v1",
  "ledger.budgets.v1",
];
export interface LegacyStorage {
  getItem(key: string): string | null;
}
export function rawLegacy(storage: LegacyStorage) {
  return Object.fromEntries(
    LEGACY_KEYS.map((key) => [key, storage.getItem(key)]),
  );
}
export function readLegacy(storage?: LegacyStorage): Book | null {
  if (!storage) return null;
  const raw = storage.getItem(LEGACY_KEYS[0]);
  if (raw !== null) return parseBackup(JSON.parse(raw)).book;
  const e = storage.getItem(LEGACY_KEYS[2]),
    c = storage.getItem(LEGACY_KEYS[3]),
    b = storage.getItem(LEGACY_KEYS[4]);
  if (e === null && c === null && b === null) {
    if (storage.getItem(LEGACY_KEYS[1]) !== null)
      throw new Error("检测到旧版恢复点，请明确选择恢复，不能初始化为空账本");
    return null;
  }
  return parseBackup({
    expenses: JSON.parse(e ?? "[]"),
    categories: JSON.parse(
      c ??
        JSON.stringify(
          emptyBook()
            .categories.filter((c) => c.kind === "expense")
            .map((c) => ({ name: c.name, color: c.color })),
        ),
    ),
    budgets: JSON.parse(b ?? "{}"),
  }).book;
}
export function parseBackup(value: unknown): {
  book: Book;
  sourceAudit: unknown[];
} {
  const raw = object(value);
  if (raw.version === 3) {
    if (raw.app !== "Bill") throw new Error("不是 Bill 备份");
    if (raw.audit !== undefined && !Array.isArray(raw.audit))
      throw new Error("审计记录格式错误");
    return {
      book: validateBook(raw.data),
      sourceAudit: (raw.audit ?? []) as unknown[],
    };
  }
  if (raw.version !== undefined && raw.version !== 1 && raw.version !== 2)
    throw new Error("不支持此备份版本");
  if (!Array.isArray(raw.expenses) || !Array.isArray(raw.categories))
    throw new Error("文件缺少账单或分类列表");
  const base = emptyBook();
  base.categories = [];
  const money = (v: unknown) => {
    if (typeof v !== "number" || !Number.isFinite(v))
      throw new Error("旧账单金额无效");
    return parseMoney(String(v));
  };
  for (const [i, value] of raw.categories.entries()) {
    const c = object(value);
    if (typeof c.name !== "string" || !c.name.trim())
      throw new Error("旧分类无效");
    base.categories.push({
      id: `legacy-cat-${i}`,
      name: c.name.trim(),
      kind: "expense",
      color: typeof c.color === "string" ? c.color : COLORS[i % COLORS.length],
      archived: false,
    });
  }
  base.transactions = raw.expenses.map((value, i) => {
    const e = object(value);
    if (typeof e.category !== "string" || !e.category.trim())
      throw new Error("旧账单分类无效");
    let cat = base.categories.find((c) => c.name === e.category);
    if (!cat) {
      cat = {
        id: `legacy-cat-${base.categories.length}`,
        name: e.category,
        kind: "expense",
        color: COLORS[base.categories.length % COLORS.length],
        archived: true,
      };
      base.categories.push(cat);
    }
    return {
      id: typeof e.id === "string" && e.id ? e.id : `legacy-tx-${i}`,
      kind: "expense" as const,
      amountMinor: money(e.amount),
      accountId: "cash",
      categoryId: cat.id,
      toAccountId: null,
      date: e.date as string,
      note: e.note === undefined ? "" : (e.note as string),
      createdAt: e.createdAt === undefined ? 0 : (e.createdAt as number),
    };
  });
  base.categories.push(
    ...emptyBook().categories.filter((c) => c.kind === "income"),
  );
  base.budgets = Object.entries(
    raw.budgets === undefined ? {} : object(raw.budgets),
  ).map(([month, v]) => ({ month, amountMinor: money(v) }));
  return { book: validateBook(base), sourceAudit: [] };
}
export function parseFile(text: string) {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("文件超过 32 MB");
  return parseBackup(JSON.parse(text.replace(/^\uFEFF/, "")));
}
const quote = (v: string) =>
  `"${v
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n\t]/g, " ")}"`;
/** ASCII account names map bijectively to UTF-8 IDs; readable names are metadata. */
const token = (id: string) =>
  "A" +
  Array.from(new TextEncoder().encode(id), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export function toBeancount(book: Book): string {
  const dates = book.transactions.map((t) => t.date).sort(),
    start = dates[0] ?? "1970-01-01";
  const lines = [
    "; Bill — CNY, UTF-8",
    'option "operating_currency" "CNY"',
    `${start} open Equity:Opening-Balances CNY`,
  ];
  for (const a of book.accounts)
    lines.push(
      `${start} open Assets:${token(a.id)} CNY\n  name: ${quote(a.name)}`,
    );
  for (const c of book.categories)
    lines.push(
      `${start} open ${c.kind === "expense" ? "Expenses" : "Income"}:${token(c.id)} CNY\n  name: ${quote(c.name)}`,
    );
  for (const a of book.accounts)
    if (a.openingMinor)
      lines.push(
        `${start} * "期初余额"\n  Assets:${token(a.id)}  ${(a.openingMinor / 100).toFixed(2)} CNY\n  Equity:Opening-Balances  ${(-a.openingMinor / 100).toFixed(2)} CNY`,
      );
  for (const t of [...book.transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
  )) {
    const amount = (t.amountMinor / 100).toFixed(2),
      source = `Assets:${token(t.accountId)}`,
      target =
        t.kind === "transfer"
          ? `Assets:${token(t.toAccountId!)}`
          : `${t.kind === "expense" ? "Expenses" : "Income"}:${token(t.categoryId!)}`;
    lines.push(
      `${t.date} * ${quote(t.note || "Bill 交易")}\n  bill_id: ${quote(t.id)}\n  ${source}  ${t.kind === "income" ? "" : "-"}${amount} CNY\n  ${target}  ${t.kind === "income" ? "-" : ""}${amount} CNY`,
    );
  }
  return lines.join("\n\n") + "\n";
}
export function toCsv(book: Book): string {
  const cell = (v: string) =>
    `"${(/^[=+@\-\t\r]/.test(v) ? "'" : "") + v.replace(/"/g, '""')}"`;
  const rows = [
    ["编号", "日期", "类型", "金额（元）", "账户", "转入账户", "分类", "备注"],
    ...book.transactions.map((t) => [
      t.id,
      t.date,
      { expense: "支出", income: "收入", transfer: "转账" }[t.kind],
      (t.amountMinor / 100).toFixed(2),
      book.accounts.find((a) => a.id === t.accountId)!.name,
      book.accounts.find((a) => a.id === t.toAccountId)?.name ?? "",
      book.categories.find((c) => c.id === t.categoryId)?.name ?? "",
      t.note,
    ]),
  ];
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
