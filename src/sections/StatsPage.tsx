import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useExpenses } from '@/hooks/useExpenses';
import type { Period } from '@/types';
import ExpenseList from './ExpenseList';

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekStart(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 周一为一周开始
  x.setDate(x.getDate() - day);
  return x;
}

export default function StatsPage() {
  const { expenses, colorOf, budgets } = useExpenses();
  const [period, setPeriod] = useState<Period>('day');
  const [cursor, setCursor] = useState(() => new Date());

  // 当前周期起止
  const [rangeStart, rangeEnd, label, isToday] = useMemo(() => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    if (period === 'day') {
      // start = end = cursor
    } else if (period === 'week') {
      const s = weekStart(cursor);
      start.setTime(s.getTime());
      end.setTime(s.getTime());
      end.setDate(end.getDate() + 6);
    } else {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
    }
    const sStr = fmt(start);
    const eStr = fmt(end);
    const nowStr = fmt(new Date());
    const inCurrent = nowStr >= sStr && nowStr <= eStr;
    let lbl = '';
    if (period === 'day') lbl = sStr;
    else if (period === 'week') lbl = `${sStr.slice(5)} ~ ${eStr.slice(5)}`;
    else lbl = `${start.getFullYear()}年${start.getMonth() + 1}月`;
    return [sStr, eStr, lbl, inCurrent] as const;
  }, [period, cursor]);

  const move = (dir: 1 | -1) => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (period === 'day') d.setDate(d.getDate() + dir);
      else if (period === 'week') d.setDate(d.getDate() + 7 * dir);
      else { d.setDate(1); d.setMonth(d.getMonth() + dir); }
      return d;
    });
  };

  // 聚合
  const { rows, total } = useMemo(() => {
    const inRange = expenses.filter((e) => e.date >= rangeStart && e.date <= rangeEnd);
    const map = new Map<string, number>();
    for (const e of inRange) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    const rows = [...map.entries()]
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        color: colorOf(name),
      }))
      .sort((a, b) => b.value - a.value);
    return { rows, total };
  }, [expenses, rangeStart, rangeEnd, colorOf]);

  return (
    <div className="page-content">
      {/* 周期切换 */}
      <div className="flex rounded-2xl bg-[#EDE8D9] p-1">
        {(['day', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${
              period === p ? 'bg-white text-[#2B2A24] shadow-sm' : 'text-[#8A8474]'
            }`}
          >
            {p === 'day' ? '日' : p === 'week' ? '周' : '月'}
          </button>
        ))}
      </div>

      {/* 日期导航 */}
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => move(-1)} className="p-2 rounded-full active:bg-[#EDE8D9]" aria-label="上一期">
          <ChevronLeft size={20} className="text-[#6B6656]" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#2B2A24]">{label}</p>
          {!isToday && (
            <button onClick={() => setCursor(new Date())} className="text-xs text-[#E8927C]">
              回到本期
            </button>
          )}
        </div>
        <button onClick={() => move(1)} className="p-2 rounded-full active:bg-[#EDE8D9]" aria-label="下一期">
          <ChevronRight size={20} className="text-[#6B6656]" />
        </button>
      </div>

      {/* 总额 */}
      <p className="text-center mt-3 text-sm text-[#8A8474]">
        本{period === 'day' ? '日' : period === 'week' ? '周' : '月'}总支出
      </p>
      <p className="text-center text-3xl font-bold tabular-nums text-[#2B2A24] mt-1">
        ¥{total.toFixed(2)}
      </p>
      {period === 'month' && budgets[rangeStart.slice(0, 7)] !== undefined && (
        <p className="text-center text-xs mt-1.5">
          <span className="text-[#A8A293]">预算 ¥{budgets[rangeStart.slice(0, 7)].toFixed(0)} · </span>
          {total <= budgets[rangeStart.slice(0, 7)] ? (
            <span className="text-[#7FB685]">剩余 ¥{(budgets[rangeStart.slice(0, 7)] - total).toFixed(2)}</span>
          ) : (
            <span className="text-[#D95F4B]">已超额 ¥{(total - budgets[rangeStart.slice(0, 7)]).toFixed(2)}</span>
          )}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-[#B5AE9C] py-14 text-center">这个周期还没有消费记录</p>
      ) : (
        <>
          {/* 饼图 */}
          <div className="relative h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={82}
                  paddingAngle={2}
                  cornerRadius={6}
                  strokeWidth={0}
                  isAnimationActive={false}
                  labelLine={{ stroke: '#C9C2B0', strokeWidth: 1 }}
                  label={(props: { name?: string; percent?: number; x?: number; y?: number; textAnchor?: string }) => {
                    const pct = (props.percent ?? 0) * 100;
                    if (pct < 4) return <g />; // 太小的扇区不标，避免重叠
                    return (
                      <text
                        x={props.x}
                        y={props.y}
                        textAnchor={props.textAnchor as 'start' | 'middle' | 'end'}
                        dominantBaseline="central"
                        className="fill-[#2B2A24]"
                        fontSize={12}
                      >
                        {props.name} {pct.toFixed(0)}%
                      </text>
                    );
                  }}
                >
                  {rows.map((r) => (
                    <Cell key={r.name} fill={r.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-[#8A8474]">共 {rows.length} 类</span>
              <span className="text-lg font-bold tabular-nums text-[#2B2A24]">
                ¥{total.toFixed(0)}
              </span>
            </div>
          </div>

          {/* 占比列表 */}
          <ul className="mt-2 space-y-2">
            {rows.map((r) => (
              <li key={r.name} className="rounded-2xl bg-white/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="flex-1 text-sm font-medium text-[#2B2A24]">{r.name}</span>
                  <span className="text-sm tabular-nums text-[#8A8474]">{r.pct.toFixed(1)}%</span>
                  <span className="text-sm font-semibold tabular-nums text-[#2B2A24] w-20 text-right">
                    ¥{r.value.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#F3EFE4] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-colors duration-500"
                    style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="text-base font-semibold mt-6 mb-3">本期流水 · 可编辑</h2>
      <ExpenseList expenses={expenses.filter(e=>e.date>=rangeStart&&e.date<=rangeEnd).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt)}/>
    </div>
  );
}
