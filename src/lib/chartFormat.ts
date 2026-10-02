export const formatPercent = (pct: number) => `${pct > 0 && pct < 0.1 ? '<0.1' : pct.toFixed(1)}%`;
