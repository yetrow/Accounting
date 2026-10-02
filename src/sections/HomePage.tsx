import { useMemo, useState } from 'react';
import { Plus, Check, Settings2, Pencil, X } from 'lucide-react';
import { useExpenses } from '@/hooks/useExpenses';
import BudgetCard from '@/sections/BudgetCard';
import DataManager from './DataManager';
import ExpenseList from './ExpenseList';
import { validDate } from '@/lib/ledger';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomePage() {
  const { expenses, categories, addExpense, addCategory, renameCategory, removeCategory } = useExpenses();
  const [managing, setManaging] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [listDate, setListDate] = useState(todayStr());
  const [allDates, setAllDates] = useState(false);
  const [listCategory, setListCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.name ?? '餐饮');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [saved, setSaved] = useState(false);

  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.date === todayStr())
        .sort((a, b) => b.createdAt - a.createdAt),
    [expenses]
  );

  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);

  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && parseFloat(amount) > 0 && validDate(date) && date <= todayStr();
  const listedExpenses = useMemo(() => expenses.filter(e => (allDates || e.date === listDate) && (listCategory === null || e.category === listCategory)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt),[expenses,allDates,listDate,listCategory]);

  const handleSave = () => {
    if (!valid) return;
    if (!addExpense({ amount: parseFloat(amount), category, note: note.trim() || undefined, date })) return;
    setListDate(date); setAllDates(false);
    if (listCategory !== null) setListCategory(category);
    setAmount('');
    setNote('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const handleAddCategory = () => {
    if (addCategory(newCat)) {
      setCategory(newCat.trim());
      setNewCat('');
      setAddingCat(false);
    }
  };

  const startRename = (name: string) => {
    setRenaming(name);
    setRenameVal(name);
  };

  const commitRename = () => {
    if (renaming && renameVal.trim() && renameVal.trim() !== renaming) {
      if (renameCategory(renaming, renameVal)) {
        if (category === renaming) setCategory(renameVal.trim());
        if (listCategory === renaming) setListCategory(renameVal.trim());
      }
    }
    setRenaming(null);
  };

  const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  const pressKey = (k: string) => {
    setAmount((prev) => {
      if (k === '⌫') return prev.slice(0, -1);
      if (k === '.') {
        if (prev.includes('.') || prev === '') return prev;
        return prev + '.';
      }
      const next = prev + k;
      if (!/^\d{0,7}(\.\d{0,2})?$/.test(next)) return prev;
      return next;
    });
  };

  return (
    <div className="page-content">
      {/* 今日汇总 */}
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-[#8A8474]">今日已花</p>
          <h1 className="text-4xl font-bold tracking-tight text-[#2B2A24] tabular-nums">
            ¥{todayTotal.toFixed(2)}
          </h1>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="p-2 rounded-full text-[#8A8474] active:bg-[#EDE8D9] transition-colors"
          aria-label="数据管理"
        >
          <Settings2 size={20} />
        </button>
      </header>

      {/* 本月预算 */}
      <BudgetCard />

      {showSettings && <DataManager />}

      {/* 记账卡片 */}
      <div className="rounded-3xl bg-white/80 shadow-[0_2px_20px_rgba(43,42,36,0.06)] p-5">
        <div className="flex items-baseline justify-center gap-1 py-2">
          <span className="text-2xl text-[#B5AE9C]">¥</span>
          <span data-testid="entry-amount" className={`amount-display font-bold tabular-nums ${amount ? 'text-[#2B2A24]' : 'text-[#D8D2C2]'}`}>
            {amount || '0'}
          </span>
        </div>

        {/* 分类 */}
        <div className="flex flex-wrap gap-2 mt-3">
          {categories.map((c) =>
            renaming === c.name ? (
              <span key={c.name} className="flex items-center gap-1">
                <input
                  autoFocus
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  maxLength={8}
                  className="w-24 px-3 py-1.5 rounded-full text-sm bg-white outline-none ring-2 ring-[#E8927C]/50 text-[#2B2A24]"
                />
                <button onClick={commitRename} className="p-1 text-[#7FB685]" aria-label="确认">
                  <Check size={15} />
                </button>
              </span>
            ) : (
              <button
                key={c.name}
                onClick={() => {
                  if (managing) startRename(c.name);
                  else { setCategory(c.name); setListCategory(c.name); }
                }}
                className={`relative px-3.5 py-1.5 rounded-full text-sm transition-colors duration-200 active:scale-95 ${
                  category === c.name && !managing
                    ? 'text-white shadow-sm'
                    : 'bg-[#F3EFE4] text-[#6B6656]'
                } ${managing ? 'pr-6 ring-1 ring-[#C9C2B0]/60' : ''}`}
                style={category === c.name && !managing ? { backgroundColor: c.color } : undefined}
              >
                {c.name}
                {managing && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCategory(c.name);
                      if (category === c.name) setCategory(categories.find((x) => x.name !== c.name)?.name ?? '其他');
                    }}
                    className="absolute -top-1 -right-1 w-4.5 h-4.5 w-[18px] h-[18px] rounded-full bg-[#2B2A24] text-white flex items-center justify-center"
                    aria-label={`删除${c.name}`}
                  >
                    <X size={11} />
                  </span>
                )}
              </button>
            )
          )}
          <button
            onClick={() => setAddingCat((v) => !v)}
            className="px-3 py-1.5 rounded-full text-sm bg-transparent border border-dashed border-[#C9C2B0] text-[#8A8474] active:scale-95 transition-transform"
          >
            <Plus size={14} className="inline -mt-0.5" /> 新分类
          </button>
          <button
            onClick={() => {
              setManaging((v) => !v);
              setRenaming(null);
            }}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors active:scale-95 ${
              managing
                ? 'bg-[#2B2A24] text-white border-[#2B2A24]'
                : 'border-[#C9C2B0] text-[#8A8474]'
            }`}
          >
            <Pencil size={13} className="inline -mt-0.5" /> {managing ? '完成' : '管理'}
          </button>
        </div>
        {managing && (
          <p className="text-[11px] text-[#A8A293] mt-1.5">管理模式下：点分类可改名，点 ✕ 删除分类（已有账单会保留原名）</p>
        )}

        {addingCat && (
          <div className="flex gap-2 mt-3">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              placeholder="输入分类名，如：咖啡"
              maxLength={8}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#F3EFE4] text-sm text-[#2B2A24] outline-none focus:ring-2 ring-[#E8927C]/40"
            />
            <button
              onClick={handleAddCategory}
              className="px-4 rounded-xl bg-[#2B2A24] text-white text-sm active:scale-95 transition-transform"
            >
              添加
            </button>
          </div>
        )}

        {/* 日期与备注 */}
        <div className="entry-fields grid grid-cols-2 gap-2 mt-3">
          <input
            aria-label="记账日期"
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-w-0 px-2 py-2 rounded-xl bg-[#F3EFE4] text-sm text-[#2B2A24] outline-none"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注（可选）"
            maxLength={20}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#F3EFE4] text-sm text-[#2B2A24] outline-none"
          />
        </div>

        {/* 键盘 */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {keypadKeys.map((k) => (
            <button
              key={k}
              onClick={() => pressKey(k)}
              className="h-12 rounded-2xl bg-[#F9F6EE] text-xl font-medium text-[#2B2A24] active:bg-[#EDE8D9] active:scale-95 transition-colors duration-100 select-none"
            >
              {k}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!valid}
          className={`w-full mt-3 h-13 py-3.5 rounded-2xl text-base font-semibold transition-colors duration-200 active:scale-[0.98] ${
            saved
              ? 'bg-[#7FB685] text-white'
              : valid
              ? 'bg-[#2B2A24] text-white'
              : 'bg-[#E4DFD1] text-[#A8A293] cursor-not-allowed'
          }`}
        >
          {saved ? (
            <span className="inline-flex items-center gap-1.5"><Check size={18} /> 已记一笔</span>
          ) : (
            '记一笔'
          )}
        </button>
      </div>

      <section className="mt-6" aria-label="账单流水">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold min-w-0" style={{ overflowWrap: 'anywhere' }}>账单流水{listCategory !== null ? ` · ${listCategory}` : ''}</h2>
          <button type="button" className="secondary shrink-0" aria-pressed={listCategory === null} onClick={() => setListCategory(null)}>全部分类</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button className="secondary" onClick={()=>{const d=new Date();d.setDate(d.getDate()-1);setListDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);setAllDates(false);}}>昨天</button>
          <button className="secondary" onClick={()=>{setListDate(todayStr());setAllDates(false);}}>今天</button>
          <button className="secondary" onClick={()=>setAllDates(true)}>全部</button>
          <input aria-label="流水日期" className="min-w-0 rounded-xl bg-white px-2 py-2 text-sm" type="date" value={listDate} max={todayStr()} onChange={e=>{setListDate(e.target.value);setAllDates(false);}}/>
        </div>
        <p className="text-xs text-[#8A8474] mb-2">{allDates?'全部日期':listDate} · {listedExpenses.length} 笔 · ¥{(listedExpenses.reduce((sum,e)=>sum+Math.round(e.amount*100),0)/100).toFixed(2)}</p>
        <ExpenseList key={JSON.stringify([allDates,listDate,listCategory])} expenses={listedExpenses}/>
      </section>
    </div>
  );
}
