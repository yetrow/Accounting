import { useLayoutEffect, useRef, useState } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import { formatPercent } from '@/lib/chartFormat';

type Row = { name: string; value: number; pct: number; color: string };
type Label = { row: Row; angle: number; left: boolean; height: number; top: number };

// Keep the vertical order of the sector anchors, then push labels apart.
// The chart grows before placement, so even many long names have enough room.
function placeLabels(labels: Label[], height: number, radius: number) {
  const sorted = [...labels].sort((a, b) => Math.sin(a.angle) - Math.sin(b.angle));
  let bottom = 12;
  for (const label of sorted) {
    label.top = Math.max(bottom, height / 2 + Math.sin(label.angle) * (radius + 16) - label.height / 2);
    bottom = label.top + label.height + 8;
  }
  let ceiling = height - 12;
  for (const label of sorted.reverse()) {
    label.top = Math.min(label.top, ceiling - label.height);
    ceiling = label.top - 8;
  }
}

export default function ExpenseDonut({ rows, total, selectedCategory, onSelect }: {
  rows: Row[]; total: number; selectedCategory: string | null; onSelect: (name: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [measurements, setMeasurements] = useState<{ width: number; heights: Record<string, number> }>({ width: 0, heights: {} });

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const width = Math.round(el.getBoundingClientRect().width);
      if (!width) return; // The stats tab stays mounted while hidden.
      const heights: Record<string, number> = {};
      el.querySelectorAll<HTMLButtonElement>('.donut-label').forEach(label => {
        heights[label.dataset.category!] = Math.ceil(label.getBoundingClientRect().height);
      });
      setMeasurements(old => old.width === width && JSON.stringify(old.heights) === JSON.stringify(heights) ? old : { width, heights });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.querySelectorAll('.donut-label').forEach(label => observer.observe(label));
    measure();
    return () => observer.disconnect();
  }, [rows]);

  const width = measurements.width || 320;
  const column = Math.min(144, Math.floor(width * 0.24));
  const radius = Math.min(96, (width - column * 2 - 36) / 2);
  // Turn a boundary near the middle of the category count toward the bottom.
  // This spreads tiny slices across both columns even with one dominant share.
  const splitValue = rows.slice(0, Math.ceil(rows.length / 2)).reduce((sum, row) => sum + row.value, 0);
  const startAngle = splitValue / total * 360 - 90;
  let angle = -startAngle * Math.PI / 180;
  const labels: Label[] = [];
  for (const row of rows) {
    const sweep = row.value / total * Math.PI * 2;
    const mid = angle + sweep / 2;
    angle += sweep;
    labels.push({ row, angle: mid, left: Math.cos(mid) < -1e-10, height: measurements.heights[row.name] || 44, top: 0 });
  }
  const left = labels.filter(label => label.left);
  const right = labels.filter(label => !label.left);
  const columnHeight = (side: Label[]) => side.reduce((sum, label) => sum + label.height + 8, 16);
  const height = Math.max(260, columnHeight(left), columnHeight(right));
  placeLabels(left, height, radius);
  placeLabels(right, height, radius);
  const cx = width / 2, cy = height / 2;

  return (
    <div ref={host} className="expense-donut" role="group" aria-label="带分类和百分比的饼图"
      data-layout-width={measurements.width} style={{ height }}>
      <PieChart width={width} height={height} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie data={rows} dataKey="value" nameKey="name" cx={cx} cy={cy}
          startAngle={startAngle} endAngle={startAngle - 360} innerRadius={radius * 0.67} outerRadius={radius}
          paddingAngle={0} strokeWidth={0} isAnimationActive={false}
          onClick={(_entry, index) => onSelect(rows[index].name)} style={{ cursor: 'pointer' }}>
          {rows.map(row => <Cell key={row.name} fill={row.color}
            opacity={selectedCategory === null || selectedCategory === row.name ? 1 : 0.4} />)}
        </Pie>
      </PieChart>
      <svg className="donut-connectors" width={width} height={height} aria-hidden="true">
        {labels.map(({ row, angle, left, top, height: labelHeight }) => {
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const endX = left ? column + 3 : width - column - 3;
          const endY = top + labelHeight / 2;
          const outerX = cx + Math.cos(angle) * (radius + 6);
          const outerY = cy + Math.sin(angle) * (radius + 6);
          const railX = cx + (left ? -1 : 1) * (radius + 9);
          return <polyline key={row.name} points={`${x},${y} ${outerX},${outerY} ${railX},${outerY} ${endX},${endY}`}
            fill="none" stroke={row.color} strokeWidth={1.2} />;
        })}
      </svg>
      <div className="donut-center" style={{ left: cx - radius * 0.64, top: cy - 25, width: radius * 1.28 }}>
        <span>共 {rows.length} 类</span>
        <strong style={{ fontSize: radius < 66 ? 13 : 16 }}>¥{total.toFixed(0)}</strong>
      </div>
      {labels.map(({ row, left, top }) => (
        <button key={row.name} type="button" className="donut-label" data-category={row.name}
          style={{ top, width: column, left: left ? 0 : width - column, textAlign: left ? 'right' : 'left' }}
          aria-label={`图中筛选${row.name}`} aria-pressed={selectedCategory === row.name} onClick={() => onSelect(row.name)}>
          <span className="donut-label-name">{row.name}</span>
          <span className="donut-label-percent">{formatPercent(row.pct)}</span>
        </button>
      ))}
    </div>
  );
}
