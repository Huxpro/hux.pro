// Values, not signals: the execution model the core's header states, held as tests. Then what this
// repository adds to the core ported from Huxpro/airtalk#845: kinds that bound a person's value
// (a value of a kind the program no longer has waits), kinds a model learned, `about` passed through.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSource, h, host, isUnresolved, render, scope, usePath, useChoice, watch, whatIf, type Child, type HostNode, type Source } from "../src/core/index";

function Lamp() {
  const on = useChoice<"on" | "off">("light", { default: "off", kinds: ["on", "off"], about: { label: "灯" } });
  const again = useChoice<"on" | "off">("light", { default: "off", kinds: ["on", "off"] });
  return host("lamp", { on, same: on === again, path: usePath("light") });
}
const Room = scope(function Room(p: { children?: Child }) {
  return host("room", { children: p.children });
});
const tree = h(Room, { key: "r" }, h(Lamp, { key: "l" }));
const lamp = (s: Source) => (render(tree, s).tree as HostNode).children[0] as HostNode;

test("a render is a value: the same inputs give the same output, and reading twice gives the same value", () => {
  const src = createSource({ entries: { "Room:r/Lamp:l#light": { human: "on" } } });
  const a = render(tree, src);
  const b = render(tree, src);
  assert.deepEqual(a, b);
  assert.equal(lamp(src).props.same, true);
  assert.equal(lamp(src).props.path, "Room:r/Lamp:l#light");
});

test("nothing in a render writes: the source is only read", () => {
  const src = createSource();
  let writes = 0;
  src.subscribe(() => writes++);
  render(tree, src);
  whatIf(tree, src, { "Room:r/Lamp:l#light": "on" });
  assert.equal(writes, 0);
});

test("many worlds at once: renders under other overrides do not disturb one another", () => {
  const src = createSource();
  const on = whatIf(tree, src, { "Room:r/Lamp:l#light": "on" });
  const off = render(tree, src);
  assert.equal(((on.tree as HostNode).children[0] as HostNode).props.on, "on");
  assert.equal(isUnresolved(((off.tree as HostNode).children[0] as HostNode).props.on), true);
});

test("change propagates by rendering again, and only on writes to what was read", () => {
  const src = createSource();
  const w = watch(src, () => render(tree, src));
  src.write("Room:r/Lamp:other#light", "human", "on");
  assert.equal(w.runs, 1);
  src.write("Room:r/Lamp:l#light", "human", "on");
  assert.equal(w.runs, 2);
  assert.equal(((w.value.tree as HostNode).children[0] as HostNode).props.on, "on");
});

test("kinds bound a person's value: one the program does not have waits, and applies again when it has it", () => {
  const Hat = (p: { kinds: string[] }) => host("hat", { size: useChoice<string>("size", { default: "big", kinds: p.kinds }) });
  const src = createSource({ entries: { "Hat:h#size": { human: "absurd", model: { big: 0.9, towering: 0.1 } } } });
  const v1 = render(h(Hat, { key: "h", kinds: ["usual", "big", "absurd"] }), src);
  assert.deepEqual([v1.trace.reads[0].value, v1.trace.reads[0].by, v1.trace.reads[0].waiting], ["absurd", "human", undefined]);
  const v2 = render(h(Hat, { key: "h", kinds: ["usual", "big", "towering"] }), src);
  assert.deepEqual([v2.trace.reads[0].value, v2.trace.reads[0].by, v2.trace.reads[0].waiting], ["big", "model", "absurd"]);
  assert.equal(src.get("Hat:h#size")?.human, "absurd");
  // A deck-wide decision of a kind it does not have waits too.
  src.write("Hat:h#size", "human", undefined);
  src.write("size", "human", "absurd", { scope: "deck" });
  assert.equal(render(h(Hat, { key: "h", kinds: ["usual", "big", "towering"] }), src).trace.reads[0].waiting, "absurd");
});

test("learned kinds: a model adds a kind to an intent, and a person can take it", () => {
  const Hat = () => host("hat", { size: useChoice<string>("size", { default: "big", kinds: ["usual", "big"] }) });
  const src = createSource();
  src.learn("Hat:h#size", "towering", { label: "顶天", data: { hatScale: 2.4 } });
  src.write("Hat:h#size", "human", "towering");
  const r = render(h(Hat, { key: "h" }), src).trace.reads[0];
  assert.deepEqual([r.value, r.by, r.kinds], ["towering", "human", ["usual", "big", "towering"]]);
  assert.deepEqual(r.learned, { towering: { label: "顶天", data: { hatScale: 2.4 } } });
  src.learn("Hat:h#size", "towering", undefined);
  assert.equal(render(h(Hat, { key: "h" }), src).trace.reads[0].waiting, "towering");
});

test("about is passed through to the read, untouched", () => {
  const r = render(tree, createSource()).trace.reads[0];
  assert.deepEqual(r.about, { label: "灯" });
});
