import test from "node:test";
import assert from "node:assert/strict";
import { donutLayout } from "../src/ui/chart-layout.ts";

// Labels for tiny adjacent slices must remain readable on narrow phones.
for (const width of [248, 272, 309, 520]) {
  test(`donut labels fit without overlaps at ${width}px`, () => {
    const rows = [32.7, 30.7, 18.4, 11.7, 3, 2, 1.5].map((percent, i) => ({
      id: String(i),
      name: i === 4 ? "洗澡+宿舍水费" : `分类${i}`,
      percent,
    }));
    const layout = donutLayout(rows, width);
    assert.equal(layout.labels.length, rows.length);
    for (const label of layout.labels) {
      const side = label.side === "right" ? 1 : -1;
      assert.ok(side * (label.elbowX - layout.cx) > layout.radius + 9);
      const points = [
        [label.anchorX, label.anchorY],
        [label.outerX, label.outerY],
        [label.elbowX, label.outerY],
        [label.elbowX, label.y + label.height / 2],
      ];
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1],
          [bx, by] = points[i];
        const dx = bx - ax,
          dy = by - ay;
        const fraction = Math.max(
          0,
          Math.min(
            1,
            ((layout.cx - ax) * dx + (layout.cy - ay) * dy) /
              (dx * dx + dy * dy) || 0,
          ),
        );
        assert.ok(
          Math.hypot(
            ax + fraction * dx - layout.cx,
            ay + fraction * dy - layout.cy,
          ) >=
            layout.radius + 8,
          "leader lines remain outside the donut, including for tiny slices",
        );
      }
    }
    for (const side of ["left", "right"]) {
      const labels = layout.labels
        .filter((l) => l.side === side)
        .sort((a, b) => a.y - b.y);
      labels.forEach((label, i) => {
        assert.ok(label.y >= 8);
        assert.ok(label.y + label.height <= layout.height - 8);
        assert.equal(
          label.lines.join(""),
          rows.find((r) => r.id === label.id)!.name,
        );
        if (i) assert.ok(label.y >= labels[i - 1].y + labels[i - 1].height + 6);
      });
    }
  });
}
test("many categories and long names expand vertically without dropping labels", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    name: i === 0 ? "很长的分类名称".repeat(10) : `消费分类${i}`,
    percent: 100 / 30,
  }));
  const layout = donutLayout(rows, 272);
  assert.equal(layout.labels.length, 30);
  assert.ok(layout.height > 260);
  for (const side of ["left", "right"]) {
    const labels = layout.labels
      .filter((l) => l.side === side)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++)
      assert.ok(labels[i].y >= labels[i - 1].y + labels[i - 1].height + 6);
  }
});
