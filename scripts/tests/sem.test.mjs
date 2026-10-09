// sem's core without a browser: geometry, and a layer over hand-made nodes.
// `pnpm sem:test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bounds, contains, overlaps, within, gapBelow, formatShape, translate } from "../../packages/sem/src/geometry.ts";
import { createLayer } from "../../packages/sem/src/layer.ts";
import { projectPoint, projectSphere } from "../../packages/sem/src/webgl.ts";

test("bounds and translate cover every shape", () => {
  assert.deepEqual(bounds({ rect: [1, 2, 3, 4] }), { x: 1, y: 2, w: 3, h: 4 });
  assert.deepEqual(bounds({ circle: [10, 10, 5] }), { x: 5, y: 5, w: 10, h: 10 });
  assert.deepEqual(bounds({ poly: [0, 0, 4, 1, 2, 6] }), { x: 0, y: 0, w: 4, h: 6 });
  assert.deepEqual(translate({ poly: [0, 0, 1, 1] }, 10, 20), { poly: [10, 20, 11, 21] });
});

test("contains: rect, circle, a concave polygon", () => {
  assert.ok(contains({ rect: [0, 0, 10, 10] }, 10, 10));
  assert.ok(!contains({ circle: [0, 0, 5] }, 4, 4));
  // An L: the notch at (7, 7) is outside.
  const l = { poly: [0, 0, 10, 0, 10, 5, 5, 5, 5, 10, 0, 10] };
  assert.ok(contains(l, 2, 8));
  assert.ok(!contains(l, 7, 7));
});

test("overlaps is exact between circles and rects", () => {
  // A circle in the corner gap of a rect: their bounds meet, they do not.
  assert.ok(!overlaps({ circle: [0, 0, 10] }, { rect: [8, 8, 10, 10] }));
  assert.ok(overlaps({ circle: [0, 0, 12] }, { rect: [8, 8, 10, 10] }));
  assert.ok(!overlaps({ circle: [0, 0, 5] }, { circle: [10, 0, 5] }), "touching is not overlapping");
  assert.ok(overlaps({ rect: [0, 0, 10, 10] }, { rect: [9, 9, 10, 10] }));
  assert.ok(within({ rect: [1, 1, 2, 2] }, { rect: [0, 0, 10, 10] }));
  assert.equal(gapBelow({ rect: [0, 0, 10, 10] }, { rect: [0, 16, 10, 10] }), 6);
  assert.equal(formatShape({ circle: [195.4, 422.6, 164] }), "circle(195,423,164)");
});

test("projectPoint: an identity camera maps clip space onto the canvas", () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  assert.deepEqual(projectPoint(identity, [0, 0, 0], 200, 100), [100, 50, 0.5]);
  assert.deepEqual(projectPoint(identity, [-1, 1, 0], 200, 100), [0, 0, 0.5]);
  assert.deepEqual(projectSphere(identity, [0, 0, 0], 0.5, 200, 100), { rect: [50, 25, 100, 50] });
});

/** A small scene: a canvas-drawn globe, a DOM caption above it, a population of dots. */
function scene() {
  const layer = createLayer({ viewport: () => ({ w: 400, h: 800, dpr: 2 }), now: () => 0 });
  let captionY = 20;
  layer.node({
    id: "s",
    kind: "scene",
    intent: "the whole dream",
    backend: "none",
    measure: () => ({ rect: [0, 0, 400, 800] }),
    invariants: [
      {
        id: "caption-clear",
        text: "the caption keeps clear of the globe",
        check: (snap) => !overlaps(snap.nodes["s/caption"].shape, snap.nodes["s/globe"].shape) || "they overlap",
      },
      { id: "prose", text: "a rule only a person can check" },
    ],
  });
  layer.node({
    id: "s/globe",
    parent: "s",
    kind: "field",
    intent: "everyone, talking",
    backend: "canvas2d",
    measure: () => ({ circle: [200, 400, 150] }),
    count: () => 3,
    item: (i) => ({ circle: [150 + i * 50, 400, 4] }),
    state: () => ({ hushed: 0.25, phase: "talking" }),
    links: [{ rel: "drives", to: "s/caption" }],
  });
  layer.node({
    id: "s/caption",
    parent: "s",
    kind: "text",
    intent: "what this is",
    backend: "dom",
    renamedFrom: ["s/title"],
    measure: () => ({ rect: [0, captionY, 400, 14] }),
  });
  return { layer, moveCaption: (y) => (captionY = y) };
}

test("snapshot: tree order, shapes, state; nothing measured until asked", () => {
  let measured = 0;
  const layer = createLayer({ viewport: () => ({ w: 1, h: 1, dpr: 1 }) });
  layer.node({ id: "child", parent: "root", kind: "x", intent: "", backend: "none", measure: () => (measured++, null) });
  layer.node({ id: "root", kind: "x", intent: "", backend: "none" });
  assert.equal(measured, 0);
  const snap = layer.snapshot();
  assert.equal(measured, 1);
  assert.deepEqual(snap.order, ["root", "child"], "a parent comes first, whatever the order of declaration");
  assert.equal(snap.nodes.child.shape, null);
  assert.equal(snap.nodes.child.visible, false);
});

test("at: topmost first, and a population is hit by its members", () => {
  const { layer } = scene();
  assert.deepEqual(layer.at(250, 400), ["s/globe#2", "s/globe", "s"]);
  assert.deepEqual(layer.at(200, 300), ["s/globe", "s"]);
  assert.deepEqual(layer.at(10, 25), ["s/caption", "s"]);
});

test("at: a member outranks an outline nested deeper than its population", () => {
  const { layer } = scene();
  // A second population over the same outline, one level deeper, with nothing at (250, 400).
  layer.node({ id: "s/rings", parent: "s/globe", kind: "field", intent: "", backend: "canvas2d", measure: () => ({ circle: [200, 400, 150] }), count: () => 1, item: () => ({ circle: [0, 0, 1] }) });
  assert.deepEqual(layer.at(250, 400), ["s/globe#2", "s/rings", "s/globe", "s"]);
});

test("check runs the rules; a failing one says why", () => {
  const { layer, moveCaption } = scene();
  assert.ok(layer.check().every((r) => r.ok));
  moveCaption(260);
  const failed = layer.check().find((r) => r.id === "caption-clear");
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, "they overlap");
});

test("select: the node, its ancestors, its links both ways, the rules over it; by an old id too", () => {
  const { layer } = scene();
  const picked = layer.select("s/title");
  assert.equal(picked.node.id, "s/caption");
  assert.deepEqual(picked.ancestors.map((a) => a.id), ["s"]);
  assert.deepEqual(picked.linked.map((l) => [l.direction, l.rel, l.node.id]), [["in", "drives", "s/globe"]]);
  assert.deepEqual(picked.checks.map((c) => c.id), ["caption-clear", "prose"]);
  assert.equal(layer.select("s/globe#1").node.id, "s/globe");
  assert.equal(layer.select("nope"), null);
});

test("outline: one line a node, indented, then the rules", () => {
  const { layer } = scene();
  assert.equal(
    layer.outline(),
    [
      "s  scene·none 400×800  rect(0,0,400,800)",
      "  s/globe  field·canvas2d  circle(200,400,150)  count=3 hushed=0.25 phase=\"talking\" drives→s/caption",
      "  s/caption  text·dom  rect(0,20,400,14)",
      "rules:",
      "  ✓ caption-clear: the caption keeps clear of the globe",
      "  ✓ prose: a rule only a person can check (not executable)",
    ].join("\n"),
  );
});

test("a disposer removes only its own node", () => {
  const layer = createLayer();
  const first = layer.node({ id: "a", kind: "x", intent: "1", backend: "none" });
  layer.node({ id: "a", kind: "x", intent: "2", backend: "none" });
  first();
  assert.equal(layer.get("a").intent, "2");
});
