export interface ChartRow {
  id: string;
  name: string;
  percent: number;
}
export interface DonutLabel extends ChartRow {
  side: "left" | "right";
  lines: string[];
  y: number;
  height: number;
  anchorX: number;
  anchorY: number;
  elbowX: number;
  outerX: number;
  outerY: number;
}
export function donutLayout(rows: ChartRow[], width: number) {
  const labelWidth = Math.min(96, width * 0.27);
  const radius = Math.min(92, (width - 2 * labelWidth - 26) / 2);
  // Wrap full names, including user-defined names, rather than hiding them.
  const charsPerLine = Math.max(1, Math.floor((labelWidth - 8) / 13));
  let offset = 0;
  const labels: DonutLabel[] = rows.map((row) => {
    const angle =
      ((offset + row.percent / 2) / 100) * 2 * Math.PI - Math.PI / 2;
    offset += row.percent;
    const chars = Array.from(row.name),
      lines: string[] = [];
    for (let i = 0; i < chars.length; i += charsPerLine)
      lines.push(chars.slice(i, i + charsPerLine).join(""));
    return {
      ...row,
      side: Math.cos(angle) >= 0 ? "right" : "left",
      lines,
      height: Math.max(44, lines.length * 16 + 20),
      y: 0,
      anchorX: width / 2 + Math.cos(angle) * (radius + 9),
      anchorY: Math.sin(angle) * (radius + 9),
      outerX: width / 2 + Math.cos(angle) * (radius + 14),
      outerY: Math.sin(angle) * (radius + 14),
      elbowX: width / 2 + (Math.cos(angle) >= 0 ? 1 : -1) * (radius + 15),
    };
  });
  const sides = ["left", "right"].map((side) =>
    labels.filter((l) => l.side === side).sort((a, b) => a.anchorY - b.anchorY),
  );
  const height = Math.max(
    260,
    ...sides.map((side) => side.reduce((sum, l) => sum + l.height + 6, 10)),
  );
  const cy = height / 2;
  for (const side of sides) {
    let bottom = 8;
    for (const label of side) {
      label.anchorY += cy;
      label.outerY += cy;
      label.y = Math.max(bottom, label.anchorY - label.height / 2);
      bottom = label.y + label.height + 6;
    }
    // Pack backwards as well so crowded labels stay inside the viewBox.
    let top = height - 8;
    for (const label of [...side].reverse()) {
      label.y = Math.min(label.y, top - label.height);
      top = label.y - 6;
    }
  }
  return { width, height, cx: width / 2, cy, radius, labelWidth, labels };
}
