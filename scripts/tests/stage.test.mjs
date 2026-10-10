// stage without a browser: the machine, the scene tools, and the host's frame
// over a stand-in canvas. `pnpm stage:test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createLayer } from "../../packages/sem/src/layer.ts";
import { createMachine } from "../../packages/stage/src/machine.ts";
import { ref, rule } from "../../packages/stage/src/bind.ts";
import { MAX_DT, Stage, isShown } from "../../packages/stage/src/store.ts";
import { checkScene, patchScene } from "../../packages/stage/tools/scene.ts";

test("machine: events, and `after` on the stage's own clock", () => {
  const m = createMachine({ talking: { on: { touch: "hushed" } }, hushed: { after: [1.8, "you"] }, you: {} });
  assert.equal(m.phase(), "talking");
  assert.equal(m.send("nothing", 0.5), false);
  assert.equal(m.send("touch", 1), true);
  assert.equal(m.tick(2.7), false);
  assert.equal(m.tick(2.9), true);
  assert.equal(m.phase(), "you");
  // It began when the delay ran out, not when the frame noticed.
  assert.equal(m.since("you", 3), 3 - 2.8);
  assert.equal(m.since("never", 3), -1);
});

test("isShown: phases, and phases after a delay", () => {
  const since = (p) => (p === "you" ? 1 : -1);
  assert.ok(isShown(undefined, "you", since));
  assert.ok(isShown(["you"], "you", since));
  assert.ok(isShown([{ phase: "you", delay: 0.5 }], "you", since));
  assert.ok(!isShown([{ phase: "you", delay: 1.5 }], "you", since));
  assert.ok(!isShown(["talking"], "you", since));
});

const SCENE = readFileSync("app/dream/everyone/everyone.scene.tsx", "utf8");

test("checkScene: the real scenes are data", () => {
  for (const dream of ["everyone", "blue", "forget"]) {
    assert.deepEqual(checkScene(readFileSync(`app/dream/${dream}/${dream}.scene.tsx`, "utf8")), [], dream);
  }
});

test("checkScene: logic, hooks, missing and repeated ids are each named", () => {
  const bad = `export default function S() {
  const [x] = useState(0);
  return <Stage id="s"><Light id="a" approach={x * 2} /><Light id="a" /><Voices /></Stage>;
}`;
  assert.match(checkScene(bad)[0].message, /one returned JSX tree/);
  const logic = `export default function S() {
  return <Stage id="s" rules={[rule.below("a", "b")]}><Light id="a" approach={x * 2} hello={[1, 2]} /><Light id="a" /><Voices {...p} /></Stage>;
}`;
  const messages = checkScene(logic).map((p) => p.message);
  assert.equal(messages.length, 4);
  assert.match(messages[0], /approach>: only literals/);
  assert.match(messages[1], /id "a" is used twice/);
  assert.match(messages[2], /spread props/);
  assert.match(messages[3], /<Voices> needs a literal id/);
});

test("patchScene: a literal is replaced in place; a new prop goes after the id; logic is refused", () => {
  const out = patchScene(SCENE, "light", "approach", 2.4);
  assert.ok(out.includes(`<Light id="light" from={ref("touch")} approach={2.4} hello=`));
  assert.equal(out.length, SCENE.length, "only the one value changed");
  assert.deepEqual(checkScene(out), []);
  assert.ok(patchScene(SCENE, "voices", "colour", "warm").includes(`<Voices id="voices" colour="warm" parent=`));
  assert.throws(() => patchScene(`export default function S() { return <Stage id="s"><L id="a" v={x + 1} /></Stage>; }`, "a", "v", 2), /not a literal/);
  assert.throws(() => patchScene(SCENE, "nobody", "x", 1), /no node/);
});

/** A canvas that only remembers what it was asked to fill. */
const fakeCanvas = () => {
  const calls = [];
  return {
    calls,
    g: new Proxy({}, { get: (_, k) => (k === "fillRect" || k === "arc" ? (...a) => calls.push([k, ...a]) : () => {}), set: () => true }),
  };
};
const layout = { w: 400, h: 800, dpr: 1, center: { x: 200, y: 400 }, vmin: (p) => (400 * p) / 100 };

/** A dot that comes from where it was touched to the middle, over `approach` seconds after `hushed`. */
const Dot = {
  name: "Dot",
  kind: "agent",
  intent: "a test dot",
  params: { approach: { unit: "s" } },
  frame: (_s, { from, approach }, { t, layout }) => {
    const e = Math.min(1, Math.max(0, t.since("hushed") / approach));
    return { x: from.x + (layout.center.x - from.x) * e, y: from.y + (layout.center.y - from.y) * e };
  },
  draw: (g, { x, y }) => g.arc(x, y, 5, 0, Math.PI * 2),
  measure: ({ x, y }) => ({ circle: [x, y, 5] }),
};
/** A field that takes a press and says "touch" with where it was. */
const Field = {
  name: "Field",
  kind: "field",
  intent: "takes the touch",
  frame: () => true,
  pointerDown: (_s, _o, p, ctx) => (ctx.emit("touch", p), true),
};

function stage(props = {}) {
  const layer = createLayer({ viewport: () => ({ w: 400, h: 800, dpr: 1 }) });
  const host = new Stage({ id: "t", layer, machine: { talking: { on: { touch: "hushed" } }, hushed: { after: [1, "you"] }, you: {} } });
  host.add("field", Field, host.nextOrder(), () => ({ id: "field" }));
  host.add("dot", Dot, host.nextOrder(), () => ({ id: "dot", from: ref("touch"), approach: 1, shown: ["hushed", "you"], ...props }));
  return { host, layer, canvas: fakeCanvas() };
}

test("host: a shown node frames and draws; sem measures what it drew", () => {
  const { host, layer, canvas } = stage();
  host.tick(canvas.g, layout, 0.016, "#000");
  assert.equal(layer.snapshot().nodes["t/dot"].shape, null, "not shown while talking");
  host.pointerDown({ x: 0, y: 0 });
  assert.equal(host.phase(), "hushed");
  for (let i = 0; i < 20; i++) host.tick(canvas.g, layout, 0.025, "#000"); // half a second
  const drawn = canvas.calls.filter(([k]) => k === "arc").at(-1);
  const shape = layer.snapshot().nodes["t/dot"].shape;
  assert.deepEqual(shape, { circle: [drawn[1], drawn[2], 5] }, "measured where it was drawn");
  assert.ok(Math.abs(drawn[1] - 100) < 1 && Math.abs(drawn[2] - 200) < 1, "halfway from the touch to the middle");
});

test("host: `after` moves the machine; an override changes a prop live; reset starts over", () => {
  const { host, layer, canvas } = stage();
  host.tick(canvas.g, layout, 0.016, "#000"); // a press reaches only nodes that have been drawn
  host.pointerDown({ x: 0, y: 0 });
  for (let i = 0; i < 44; i++) host.tick(canvas.g, layout, 0.025, "#000");
  assert.equal(host.phase(), "you");
  host.set("dot", "approach", 4);
  assert.equal(layer.snapshot().nodes["t/dot"].params.approach.value, 4);
  host.reset();
  assert.equal(host.phase(), "talking");
});

test("host: the same seed gives the same random sequence per node", () => {
  const draws = () => {
    const layer = createLayer();
    const host = new Stage({ id: "r", layer, seed: 7, machine: { a: {} } });
    const seen = [];
    host.add("n", { name: "N", kind: "x", intent: "", init: (_p, { rng }) => [rng(), rng()], frame: (s) => (seen.push(...s), true) }, 0, () => ({ id: "n" }));
    host.tick(fakeCanvas().g, layout, 0.016, "#000");
    return seen;
  };
  assert.deepEqual(draws(), draws());
});

test("host: a slow frame counts in full; only a long gap (a hidden tab) is cut short", () => {
  const { host, layer, canvas } = stage();
  layer.node(host.sceneNode("a test", undefined, []));
  host.tick(canvas.g, layout, 0.2, "#000"); // 5 fps
  assert.equal(layer.snapshot().nodes.t.state.t, 0.2);
  host.tick(canvas.g, layout, 30, "#000");
  assert.equal(layer.snapshot().nodes.t.state.t, Math.round((0.2 + MAX_DT) * 100) / 100);
});

test("host: a press goes only to a node that is shown; a release reaches every node", () => {
  const seen = [];
  const layer = createLayer();
  const host = new Stage({ id: "p", layer, machine: { a: { on: { go: "b" } }, b: {} } });
  const Taker = (name) => ({
    name,
    kind: "x",
    intent: "",
    frame: () => null,
    pointerDown: () => (seen.push(`down ${name}`), true),
    pointerUp: () => seen.push(`up ${name}`),
  });
  host.add("hidden", Taker("hidden"), host.nextOrder(), () => ({ id: "hidden", shown: ["b"] }));
  host.add("under", Taker("under"), host.nextOrder(), () => ({ id: "under" }));
  host.tick(fakeCanvas().g, layout, 0.016, "#000");
  host.pointerDown({ x: 0, y: 0 });
  host.pointerUp();
  assert.deepEqual(seen, ["down under", "up hidden", "up under"], "drawing nothing (a closed sea) still takes a press when shown");
});

test("rules: inside, aligned and atLeast read the snapshot", () => {
  const node = (shape, state = {}) => ({ visible: true, shape, state });
  const snap = (nodes) => ({ viewport: { w: 400, h: 800 }, order: Object.keys(nodes), nodes });
  const box = { rect: [100, 100, 200, 300] };
  const inside = rule.inside("moments", "window")("f");
  assert.equal(inside.check(snap({ "f/window": node(box), "f/moments": node({ rect: [150, 120, 50, 50] }) })), true);
  assert.match(String(inside.check(snap({ "f/window": node(box), "f/moments": node({ rect: [150, 80, 50, 50] }) }))), /outside/);
  const aligned = rule.aligned("sun", "ring")("b");
  assert.equal(aligned.check(snap({ "b/sun": node({ circle: [10, 10, 4] }), "b/ring": node({ circle: [10.5, 10, 9] }) })), true);
  assert.match(String(aligned.check(snap({ "b/sun": node({ circle: [10, 10, 4] }), "b/ring": node({ circle: [20, 10, 9] }) }))), /10px apart/);
  const most = rule.atLeast("dust", "onScreen", 0.95)("f");
  assert.equal(most.check(snap({ "f/dust": node(box, { onScreen: 1 }) })), true);
  assert.match(String(most.check(snap({ "f/dust": node(box, { onScreen: 0.5 }) }))), /onScreen is 0.5/);
});
