import { useMemo, useState } from 'react';
import { Wallet, Pencil } from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';

function monthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetCard() {
  const { expenses, budgets, setBudget } = useExpenses();
  const now = new Date();
  const month = monthStr(now);
  const budget = budgets[month];
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  const stats = useMemo(() => {
    if (!budget) return null;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const today = now.getDate();
    const spent = expenses
      .filter((e) => e.date.startsWith(month))
      .reduce((s, e) => s + e.amount, 0);
    const remaining = budget - spent;
    const dailyAvg = budget / daysInMonth; // 平均每天预算
    const daysLeft = daysInMonth - today + 1; // 含今天
    const dailyLeft = remaining / daysLeft; // 剩余每天额度
    return { spent, remaining, dailyAvg, dailyLeft, daysInMonth, daysLeft, over: remaining < 0 };
  }, [budget, expenses, month, now]);

  const openEdit = () => {
    setInput(budget ? String(budget) : '');
    setEditing(true);
  };

  const save = () => {
    const v = parseFloat(input);
    if (setBudget(month, input.trim() === '' ? null : v)) setEditing(false);
  };

  // 未设置预算：入口卡片
  if (!budget && !editing) {
    return (
      <button
        onClick={openEdit}
        className="w-full flex items-center gap-2.5 rounded-2xl bg-white/60 border border-dashed border-[#C9C2B0] px-4 py-3 mb-4 text-sm text-[#8A8474] active:scale-[0.99] transition-transform"
      >
        <Wallet size={17} className="text-[#B5AE9C]" />
        设置 {now.getMonth() + 1} 月预算（可选）
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white/80 shadow-[0_2px_20px_rgba(43,42,36,0.06)] p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-[#2B2A24] flex items-center gap-1.5">
          <Wallet size={16} className="text-[#E8927C]" />
          {now.getMonth() + 1} 月预算
        </p>
        <button onClick={openEdit} className="p-1 text-[#A8A293] active:text-[#E8927C]" aria-label="修改预算">
          <Pencil size={15} />
        </button>
      </div>

      {editing ? (
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-xl bg-[#F3EFE4] px-3">
            <span className="text-sm text-[#A8A293] mr-1">¥</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="如 900，留空为取消预算"
              className="flex-1 min-w-0 py-2 bg-transparent text-sm text-[#2B2A24] outline-none"
            />
          </div>
          <button onClick={save} className="px-4 rounded-xl bg-[#2B2A24] text-white text-sm active:scale-95 transition-transform">
            确定
          </button>
        </div>
      ) : stats ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-[#2B2A24]">¥{stats.spent.toFixed(2)}</span>
            <span className="text-xs text-[#A8A293]">已花 / 预算 ¥{budget!.toFixed(2)}</span>
          </div>

          {/* 进度条 */}
          <div className="mt-2 h-2 rounded-full bg-[#F3EFE4] overflow-hidden">
            <div
              className={`h-full rounded-full transition-colors duration-150 ${stats.over ? 'bg-[#D95F4B]' : stats.spent / budget! > 0.8 ? 'bg-[#E5B567]' : 'bg-[#7FB685]'}`}
              style={{ width: `${Math.min((stats.spent / budget!) * 100, 100)}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-[#F9F6EE] py-2.5">
              <p className="text-[11px] text-[#A8A293]">平均每天预算</p>
              <p className="text-base font-semibold tabular-nums text-[#2B2A24]">¥{stats.dailyAvg.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-[#F9F6EE] py-2.5">
              {stats.over ? (
                <>
                  <p className="text-[11px] text-[#A8A293]">已超出预算</p>
                  <p className="text-base font-semibold tabular-nums text-[#D95F4B]">¥{Math.abs(stats.remaining).toFixed(2)}</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-[#A8A293]">剩余 {stats.daysLeft} 天，每天还能花</p>
                  <p className="text-base font-semibold tabular-nums text-[#7FB685]">¥{stats.dailyLeft.toFixed(2)}</p>
                </>
              )}
            </div>
          </div>
          {stats.over && (
            <p className="text-xs text-[#D95F4B] mt-2">本月预算已用完，接下来注意控制哦</p>
          )}
        </>
      ) : null}
    </div>
  );
}
