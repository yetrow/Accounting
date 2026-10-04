import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { formatMoney, type Transaction } from "../domain/book";
import { useBook } from "./context";
import { TransactionForm } from "./TransactionForm";
function Editor({
  transaction,
  close,
}: {
  transaction: Transaction;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return createPortal(
    <dialog
      className="editor-dialog"
      ref={ref}
      onCancel={close}
      aria-label="编辑交易"
    >
      <header>
        <h2>编辑交易</h2>
        <button aria-label="关闭编辑" onClick={close}>
          <X size={20} />
        </button>
      </header>
      <TransactionForm existing={transaction} onSaved={close} />
    </dialog>,
    document.body,
  );
}
export function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const { book, dispatch, busy } = useBook();
  const [editing, setEditing] = useState<Transaction | null>(null),
    [deleting, setDeleting] = useState<string | null>(null),
    [limit, setLimit] = useState(50);
  return (
    <>
      {transactions.length === 0 ? (
        <div className="empty">
          <BookMark />
          <strong>从一笔小事开始</strong>
          <p>这里会留下每一笔收支。</p>
        </div>
      ) : (
        <ul className="transactions">
          {transactions.slice(0, limit).map((t) => {
            const c = book.categories.find((c) => c.id === t.categoryId),
              a = book.accounts.find((a) => a.id === t.accountId);
            const Icon =
              t.kind === "expense"
                ? ArrowUpRight
                : t.kind === "income"
                  ? ArrowDownLeft
                  : ArrowLeftRight;
            return (
              <li key={t.id}>
                <div className="transaction-row">
                  <div className={`transaction-icon ${t.kind}`}>
                    <Icon size={18} />
                  </div>
                  <div className="transaction-info">
                    <strong>{c?.name ?? "账户转账"}</strong>
                    <p>
                      {t.date} · {a?.name}
                      {t.kind === "transfer"
                        ? ` → ${book.accounts.find((a) => a.id === t.toAccountId)?.name}`
                        : ""}
                    </p>
                    {t.note && <p className="transaction-note">{t.note}</p>}
                  </div>
                  <div className="transaction-right">
                    <strong className={t.kind === "income" ? "positive" : ""}>
                      {t.kind === "expense"
                        ? "−"
                        : t.kind === "income"
                          ? "+"
                          : ""}
                      ¥{formatMoney(t.amountMinor)}
                    </strong>
                    <div>
                      <button
                        aria-label="编辑账单"
                        onClick={() => setEditing(t)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label="删除账单"
                        onClick={() => setDeleting(t.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                {deleting === t.id && (
                  <div className="confirmation">
                    <p>删除这笔交易？原记录仍保留在变更历史中。</p>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await dispatch({
                            type: "transaction.delete",
                            id: t.id,
                          })
                        )
                          setDeleting(null);
                      }}
                    >
                      确认删除
                    </button>
                    <button onClick={() => setDeleting(null)}>取消</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {transactions.length > limit && (
        <button
          className="secondary wide"
          onClick={() => setLimit((n) => n + 50)}
        >
          加载更多
        </button>
      )}
      {editing && (
        <Editor transaction={editing} close={() => setEditing(null)} />
      )}
    </>
  );
}
function BookMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <rect
        x="10"
        y="7"
        width="22"
        height="28"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16 14h10m-10 6h10m-10 6h6M7 11v20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
