import { NotebookPen, ChartPie } from 'lucide-react';

interface Props {
  tab: 'home' | 'stats';
  onChange: (tab: 'home' | 'stats') => void;
}

export default function BottomNav({ tab, onChange }: Props) {
  const items = [
    { key: 'home' as const, label: '记账', icon: NotebookPen },
    { key: 'stats' as const, label: '占比', icon: ChartPie },
  ];
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <div className="grid grid-cols-2">
        {items.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-0.5 py-2.5 active:scale-95 transition-transform"
            >
              <Icon
                size={22}
                className={active ? 'text-[#E8927C]' : 'text-[#B5AE9C]'}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span className={`text-xs ${active ? 'text-[#2B2A24] font-semibold' : 'text-[#B5AE9C]'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
