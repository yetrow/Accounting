import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { categoryTotals, formatMoney, today } from "../domain/book";
import { useBook } from "./context";
import { TransactionList } from "./TransactionList";
export function Insights() {
  const { book } = useBook();
  const [period, setPeriod] = useState<"day" | "week" | "month">("month"),
    [date, setDate] = useState(today()),
    [kind, setKind] = useState<"expense" | "income">("expense");
  const cursor = new Date(`${date}T12:00:00`),
    start = new Date(cursor),
    end = new Date(cursor);
  if (period === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  }
  const from = today(start),
    to = today(end),
    rows = categoryTotals(book, from, to, kind),
    total = rows.reduce((sum, c) => sum + c.amountMinor, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = book.transactions
    .filter(
      (t) =>
        t.date >= from &&
        t.date <= to &&
        t.kind === kind &&
        (!selected || t.categoryId === selected),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  function move(step: number) {
    const d = new Date(cursor);
    if (period === "month") {
      d.setDate(1);
      d.setMonth(d.getMonth() + step);
    } else d.setDate(d.getDate() + step * (period === "week" ? 7 : 1));
    setDate(today(d));
    setSelected(null);
  }
  const segments = rows.map((row, i) => ({
    ...row,
    offset: rows.slice(0, i).reduce((sum, r) => sum + r.percent, 0),
  }));
  return (
    <div className="content">
      <header className="page-header">
        <div>
          <p className="eyebrow">YOUR MONEY, CLEARLY</p>
          <h1>看见生活的去向</h1>
        </div>
      </header>
      <div className="segmented period-tabs">
        {(["day", "week", "month"] as const).map((p) => (
          <button
            key={p}
            className={period === p ? "selected" : ""}
            onClick={() => {
              setPeriod(p);
              setSelected(null);
            }}
          >
            {{ day: "日", week: "周", month: "月" }[p]}
          </button>
        ))}
      </div>
      <div className="date-navigation">
        <button aria-label="上一期" onClick={() => move(-1)}>
          <ChevronLeft />
        </button>
        <div>
          <strong>
            {period === "month"
              ? `${start.getFullYear()} 年 ${start.getMonth() + 1} 月`
              : from === to
                ? from
                : `${from} 至 ${to}`}
          </strong>
          <button
            onClick={() => {
              setDate(today());
              setSelected(null);
            }}
          >
            回到本期
          </button>
        </div>
        <button aria-label="下一期" onClick={() => move(1)}>
          <ChevronRight />
        </button>
      </div>
      <section className="card insight-card">
        <div className="mini-tabs">
          <button
            className={kind === "expense" ? "active" : ""}
            onClick={() => {
              setKind("expense");
              setSelected(null);
            }}
          >
            支出占比
          </button>
          <button
            className={kind === "income" ? "active" : ""}
            onClick={() => {
              setKind("income");
              setSelected(null);
            }}
          >
            收入占比
          </button>
        </div>
        {rows.length ? (
          <>
            <div className="donut-wrap">
              <svg
                className="donut"
                viewBox="0 0 220 220"
                role="img"
                aria-label={rows
                  .map((r) => `${r.name} ${r.percent.toFixed(1)}%`)
                  .join("，")}
              >
                <circle
                  cx="110"
                  cy="110"
                  r="83"
                  fill="none"
                  stroke="var(--surface-alt)"
                  strokeWidth="23"
                />
                {segments.map((s) => (
                  <circle
                    key={s.id}
                    cx="110"
                    cy="110"
                    r="83"
                    fill="none"
                    stroke={s.color}
                    strokeWidth={selected === s.id ? 29 : 23}
                    pathLength="100"
                    strokeDasharray={`${s.percent} ${100 - s.percent}`}
                    strokeDashoffset={-s.offset}
                    transform="rotate(-90 110 110)"
                  />
                ))}
              </svg>
              <div className="donut-center">
                <span>本期{kind === "expense" ? "支出" : "收入"}</span>
                <strong>¥{formatMoney(total)}</strong>
                <small>{rows.length} 个分类</small>
              </div>
            </div>
            <div className="chart-labels" aria-label="图表分类及百分比">
              {rows.map((r) => (
                <button
                  key={r.id}
                  className={selected === r.id ? "active" : ""}
                  onClick={() => setSelected(selected === r.id ? null : r.id)}
                >
                  <i style={{ background: r.color }} />
                  <span>{r.name}</span>
                  <strong>{r.percent.toFixed(1)}%</strong>
                </button>
              ))}
            </div>
            <p className="hint center">点击分类筛选流水 · 再次点击显示全部</p>
          </>
        ) : (
          <div className="empty">
            <strong>这一期还没有{kind === "expense" ? "支出" : "收入"}</strong>
            <p>记下一笔，就能看见占比。</p>
          </div>
        )}
      </section>
      {rows.length > 0 && (
        <section className="category-ranking">
          {rows.map((r) => (
            <div key={r.id} className="rank-row">
              <div>
                <i style={{ background: r.color }} />
                <span>{r.name}</span>
                <strong>¥{formatMoney(r.amountMinor)}</strong>
              </div>
              <div className="progress">
                <i style={{ width: `${r.percent}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="section-heading">
        <h2>
          {selected
            ? book.categories.find((c) => c.id === selected)?.name
            : "本期"}
          流水
        </h2>
        <span>{filtered.length} 笔</span>
      </div>
      <TransactionList transactions={filtered} />
    </div>
  );
}
