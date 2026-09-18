// Placement and size-family checks for the home widget board.
// Run: node --experimental-strip-types --import ./scripts/register-ts.mjs scripts/widget-size-check.ts
import assert from "node:assert/strict";
import {
  FOOTPRINT,
  boardRows,
  cellArea,
  fitSize,
  nextSize,
  offeredSizes,
  placeInFlow,
  resolveDropIndex,
  resolveResize,
  type FlowItem,
  type WidgetSize,
} from "@/components/ui/widget-size";

let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    failed++;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

const DEFAULT_BOARD: FlowItem[] = [
  { id: "apps", size: "medium" },
  { id: "weather", size: "small" },
  { id: "music", size: "small" },
  { id: "blog", size: "large" },
  { id: "status", size: "large" },
  { id: "featured-talks", size: "large" },
  { id: "prompt", size: "medium" },
];

check("default desktop board is 18 cells and three full rows of six", () => {
  const area = DEFAULT_BOARD.reduce((sum, item) => sum + cellArea(item.size), 0);
  assert.equal(area, 18);
  const placed = placeInFlow(DEFAULT_BOARD, 6);
  assert.equal(boardRows(placed), 3);
  const cells = new Set<string>();
  for (const p of placed) {
    for (let r = p.row; r < p.row + p.h; r++) {
      for (let c = p.col; c < p.col + p.w; c++) {
        const key = `${c},${r}`;
        assert.equal(cells.has(key), false, `overlap at ${key}`);
        cells.add(key);
      }
    }
  }
  assert.equal(cells.size, 18);
});

check("dense first-fit: a later small fills the hole a large leaves", () => {
  const placed = placeInFlow(
    [
      { id: "a", size: "medium" },
      { id: "b", size: "large" },
      { id: "c", size: "small" },
    ],
    4,
  );
  const byId = Object.fromEntries(placed.map((p) => [p.id, p]));
  assert.deepEqual(
    { col: byId.a.col, row: byId.a.row, w: byId.a.w, h: byId.a.h },
    { col: 0, row: 0, w: 2, h: 1 },
  );
  assert.deepEqual(
    { col: byId.b.col, row: byId.b.row, w: byId.b.w, h: byId.b.h },
    { col: 2, row: 0, w: 2, h: 2 },
  );
  assert.deepEqual(
    { col: byId.c.col, row: byId.c.row, w: byId.c.w, h: byId.c.h },
    { col: 0, row: 1, w: 1, h: 1 },
  );
});

check("phone (2 cells): two smalls share a row; medium and large are full width", () => {
  const placed = placeInFlow(DEFAULT_BOARD, 2);
  const weather = placed.find((p) => p.id === "weather")!;
  const music = placed.find((p) => p.id === "music")!;
  assert.equal(weather.row, music.row);
  assert.equal(weather.col + weather.w, music.col);
  for (const id of ["apps", "blog", "status", "featured-talks", "prompt"]) {
    const p = placed.find((x) => x.id === id)!;
    assert.equal(p.w, FOOTPRINT[DEFAULT_BOARD.find((x) => x.id === id)!.size].w);
    assert.ok(p.w <= 2);
    if (p.w === 2) assert.equal(p.col, 0);
  }
});

check("fitSize clamps xl to large on a phone", () => {
  assert.equal(fitSize("xl", ["medium", "large", "xl"], 2), "large");
  assert.equal(fitSize("xl", ["medium", "large", "xl"], 6), "xl");
  assert.equal(fitSize("small", ["small", "medium"], 2), "small");
});

check("offeredSizes and nextSize wrap among what fits", () => {
  const offered = offeredSizes(["medium", "large", "xl"], 2);
  assert.deepEqual(offered, ["medium", "large"]);
  assert.equal(nextSize("medium", offered), "large");
  assert.equal(nextSize("large", offered), "medium");
});

check("resolveDropIndex: over a widget takes its place; empty cells continue the sequence", () => {
  const rest = placeInFlow(
    [
      { id: "a", size: "medium" },
      { id: "b", size: "small" },
    ],
    4,
  );
  assert.equal(
    resolveDropIndex(rest, { col: 0, row: 0, w: 2, h: 1 }),
    0,
  );
  assert.equal(
    resolveDropIndex(rest, { col: 2, row: 0, w: 1, h: 1 }),
    1,
  );
  assert.equal(
    resolveDropIndex(rest, { col: 3, row: 1, w: 1, h: 1 }),
    2,
  );
});

check("resolveResize: nearest footprint, current wins ties", () => {
  const offered: WidgetSize[] = ["small", "medium", "large"];
  assert.equal(resolveResize(1.1, 1.0, "small", offered), "small");
  assert.equal(resolveResize(2.2, 1.1, "small", offered), "medium");
  assert.equal(resolveResize(2.0, 2.0, "medium", offered), "large");
  assert.equal(resolveResize(1.5, 1.5, "small", offered), "small");
});

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("widget-size-check: all checks passed");
