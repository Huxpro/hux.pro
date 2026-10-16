// The Intent Lab on /dream/forget. A strong model drives everything; every
// other path is a short one through what it wrote: ① the tree's vocabulary,
// ② a weak model choosing within the tree (and what it chose is learned),
// ③ the strong model adding an intent when no kind fits.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptAddition,
  acceptAuthoring,
  acceptSelection,
  recognize,
  standInAdd,
  standInSelect,
} from "../../app/lab/intent/events.ts";
import { BELIEFS, KEY, PRESET, SCREENS } from "../../app/lab/intent/forget.ts";
import { createLab } from "../../app/lab/intent/model.ts";
import { admit } from "../../app/lab/intent/tree.ts";

const by = Object.fromEntries(SCREENS.map((s) => [s.id, s]));
const axisOf = (lab) => Object.fromEntries(SCREENS.map((s) => [s.id, lab.view(KEY.axis, s)().kind]));

/** The stage's things as a model is told about them (what the page reads off the host). */
const ENTITIES = [
  { id: "window", kind: "surface", intent: "", names: [], params: { width: { value: 240, range: [160, 400] }, axis: { value: "up", note: "up or across" } } },
  {
    id: "edge",
    kind: "effect",
    intent: "",
    names: [],
    params: { wears: { value: true }, erode: { value: 2.6, range: [0.5, 6] }, shed: { value: 0.9, range: [0, 3] } },
  },
  { id: "tide", kind: "effect", intent: "", names: [], params: { stagger: { value: 0.12, range: [0, 1.2] } } },
  {
    id: "moments",
    kind: "field",
    intent: "",
    names: [],
    params: { gap: { value: 0.95, range: [0.4, 2] }, size: { value: 56, range: [32, 80] }, kept: { value: [] } },
    members: ["your cat", "a late night", "the two of us", "a home", "a little sun"],
  },
  { id: "dust", kind: "field", intent: "", names: [], params: { rise: { value: 1.3, range: [0.3, 2] }, drag: { value: 0.7, range: [0, 3] } } },
];
const observe = (lab, event) => ({ entities: ENTITIES, tree: lab.tree(), decisions: lab.stored(), event, prompts: [] });
const drag = (from, to, within) => ({ kind: "drag", screen: by.phone, from, to, within });
const say = (text, entity = null) => ({ kind: "prompt", screen: by.phone, entity, text });

test("before anyone decides: the model says what, code says where, and the dream's meaning is asked", () => {
  const lab = createLab();
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "up", landscape: "across", wide: "up" });
  const v = lab.view(KEY.axis, by.landscape)();
  assert.equal(v.who, "model");
  assert.equal(v.where, "code");
  assert.deepEqual(lab.questions(by.phone)(), [KEY.holding]);
  assert.equal(lab.view(KEY.keep(0), by.phone)().who, "code", "a prior is code's, not a model's");
  assert.deepEqual(lab.params(by.landscape)().edge, { wears: true });
});

test("a switch on one screen moves the crossover: wider screens follow, taller ones keep theirs", () => {
  const lab = createLab();
  lab.dispatch({ type: "decide", key: KEY.axis, kind: "across", from: "switched", screen: by.laptop });
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "across", landscape: "across", wide: "across" });
  lab.dispatch({ type: "decide", key: KEY.axis, kind: "up", from: "switched", screen: by.laptop });
  assert.deepEqual(lab.stored()[KEY.axis].pick, { base: "up", below: "across", at: 0.625 });
});

test("① a drag the vocabulary names is decided with no model: out of the window keeps, into it lets go, sideways lays down, down settles", () => {
  const tree = PRESET;
  const out = recognize(drag({ x: 200, y: 300, id: "moments", member: 2 }, { x: 200, y: 60, id: null }, { from: ["window", "moments"], to: [] }), tree);
  assert.deepEqual([out.key, out.kind], [KEY.keep(2), "stays"]);
  const back = recognize(drag({ x: 200, y: 60, id: "moments", member: 2 }, { x: 200, y: 300, id: "window" }, { from: [], to: ["window"] }), tree);
  assert.deepEqual([back.key, back.kind], [KEY.keep(2), "goes"]);
  const flat = recognize(drag({ x: 150, y: 300, id: "window" }, { x: 300, y: 310, id: "window" }, { from: ["window"], to: ["window"] }), tree);
  assert.deepEqual([flat.key, flat.kind], [KEY.axis, "across"]);
  const settle = recognize(drag({ x: 200, y: 50, id: "dust" }, { x: 205, y: 160, id: null }, { from: ["dust"], to: [] }), tree);
  assert.deepEqual([settle.key, settle.kind], [KEY.dust, "settles"]);
  const reorder = drag({ x: 200, y: 300, id: "moments", member: 1 }, { x: 200, y: 220, id: "moments", member: 0 }, { from: ["window"], to: ["window"] });
  assert.equal(recognize(reorder, tree), null, "a reorder is not in the vocabulary");
});

test("① a phrase the vocabulary names is decided; an ambiguous or unknown one goes to a model", () => {
  const tree = PRESET;
  assert.deepEqual(Object.values(recognize(say("落下"), tree)).slice(0, 2), [KEY.dust, "settles"]);
  assert.deepEqual(Object.values(recognize(say("All at once."), tree)).slice(0, 2), [KEY.letgo, "tide"]);
  assert.equal(recognize(say("keep it"), tree), null, "five moments could be kept");
  assert.deepEqual(Object.values(recognize(say("keep it", "moments#3"), tree)).slice(0, 2), [KEY.keep(3), "stays"]);
  assert.equal(recognize(say("像雪一样慢慢落下"), tree), null, "not word for word: for the weak model");
});

test("② a weak model's choice is applied, and learned: the same words next time are ①", () => {
  const lab = createLab();
  const e = say("像雪一样慢慢落下", "dust");
  const o = observe(lab, e);
  const out = acceptSelection(standInSelect(o), o);
  assert.deepEqual([out.action.type, out.action.key, out.action.kind], ["decide", KEY.dust, "settles"]);
  lab.dispatch(out.action);
  lab.dispatch({ type: "learn", key: KEY.dust, kind: "settles", phrase: e.text });
  assert.deepEqual(Object.values(recognize(say("像雪一样慢慢落下"), lab.tree())).slice(0, 2), [KEY.dust, "settles"]);
});

test("② a weak model may only choose: a new intent it is not allowed to write is escalated, not let in", () => {
  const lab = createLab();
  const o = observe(lab, say("slower", "moments"));
  const sel = acceptSelection(standInSelect(o), o);
  assert.equal(sel.action, null);
  assert.equal(sel.escalate, true);
  assert.deepEqual(acceptSelection({ action: "add", node: {}, why: "" }, o).action, null, "add is not a selection");
});

test("③ the strong model's new intent is checked, compiles, carries this event's words, and undoes", () => {
  const lab = createLab();
  const o = observe(lab, say("let them linger", "moments"));
  const out = acceptAddition(standInAdd(o), o, "strong");
  assert.equal(out.action.type, "add");
  assert.ok(out.action.node.say.slower.includes("let them linger"), "the event itself is in its vocabulary");
  lab.dispatch(out.action);
  assert.equal(lab.params(by.phone)().moments.gap, 1.5);
  assert.equal(lab.view("pace|moments", by.wide)().who, "person");
  assert.deepEqual(Object.values(recognize(say("let them linger", "moments"), lab.tree())).slice(0, 2), ["pace|moments", "slower"], "now a short path");
  lab.undo();
  assert.equal(lab.params(by.phone)().moments.gap, undefined, "undone: the intent is gone");
});

test("what a model writes that the stage cannot hold is not let in", () => {
  const bad = admit(
    {
      type: "glow",
      of: "moon",
      words: { en: "Glow" },
      kinds: { a: { words: { en: "a" }, patch: { moments: { gap: 9, colour: "red" } } } },
      resolve: "maybe",
      say: { b: ["x"] },
      gestures: { a: [{ from: "sky", dir: "up" }] },
    },
    ENTITIES,
  );
  assert.deepEqual(bad.problems, [
    `"moon" is not on the stage`,
    "it has 1 kinds; a choice has two to four",
    "moments.gap = 9 is outside 0.4–2",
    `moments has no knob "colour"`,
    "resolve is \"maybe\", not ask or switch",
    `it says "b", which is not one of its kinds`,
    `a gesture for "a" names nothing on the stage, or no way to go`,
  ]);
  assert.deepEqual(
    admit({ type: "x", of: "edge", words: { en: "x" }, kinds: { a: { words: { en: "a" }, patch: { edge: { wears: "no" } } }, b: { words: { en: "b" }, patch: {} } }, resolve: "switch" }, ENTITIES).problems,
    ["edge.wears takes true or false"],
  );
});

test("authoring: the cached tree is what a strong model may write, and a re-authored tree keeps decisions that still mean something", () => {
  const lab = createLab();
  lab.dispatch({ type: "decide", key: KEY.holding, kind: "keeps", from: "asked", screen: by.phone });
  lab.dispatch({ type: "decide", key: KEY.letgo, kind: "oneByOne", from: "switched", screen: by.phone });
  const authored = { tree: PRESET.filter((n) => n.type !== "letgo"), beliefs: Object.entries(BELIEFS).map(([key, b]) => ({ key, p: b.p })) };
  const r = acceptAuthoring(authored, ENTITIES, "strong");
  assert.equal(r.problems, undefined, "the cached authoring passes every check a model's does");
  lab.dispatch(r.action);
  assert.equal(lab.view(KEY.holding, by.phone)().kind, "keeps", "a decision about an intent still there stays");
  assert.equal(lab.stored()[KEY.letgo], undefined, "a decision about an intent gone goes with it");
  assert.equal(lab.tree()[0].by, "strong");
});

test("a mood moves beliefs, never a person's decision", () => {
  const lab = createLab();
  lab.dispatch({ type: "decide", key: KEY.dust, kind: "rises", from: "switched", screen: by.phone });
  const o = observe(lab, say("sadder"));
  lab.dispatch(acceptSelection(standInSelect(o), o).action);
  assert.equal(lab.view(KEY.letgo, by.phone)().kind, "oneByOne");
  assert.equal(lab.view(KEY.dust, by.phone)().kind, "rises", "the person said rises; it stays");
  assert.equal(lab.view(KEY.holding, by.phone)().asks, false, "sure now (0.8): no longer asked");
});

test("a screen's props are recomputed only when one of its intents changes", () => {
  const lab = createLab();
  const phone = lab.params(by.phone);
  const before = phone();
  lab.dispatch({ type: "decide", key: KEY.axis, kind: "across", from: "switched", screen: by.laptop });
  assert.equal(phone(), before);
  lab.dispatch({ type: "decide", key: KEY.dust, kind: "settles", from: "switched", screen: by.laptop });
  assert.notEqual(phone(), before);
});

test("the cached tree passes against the real stage: the kinds' declared knobs and the values the scene writes", async () => {
  const { readFileSync } = await import("node:fs");
  const kinds = {
    window: (await import("../../app/dream/forget/kinds/window.ts")).Window,
    edge: (await import("../../app/dream/forget/kinds/edge.ts")).Edge,
    tide: (await import("../../app/dream/forget/kinds/tide.ts")).Tide,
    moments: (await import("../../app/dream/forget/kinds/moments.ts")).Moments,
    dust: (await import("../../app/dream/forget/kinds/dust.ts")).Dust,
  };
  const scene = readFileSync("app/dream/forget/forget.scene.tsx", "utf8");
  const written = (id) => {
    const line = scene.split("\n").find((l) => l.includes(`id="${id}"`));
    const props = {};
    for (const m of line.matchAll(/(\w+)=(?:\{([^}]*\]?)\}|"([^"]*)")/g)) props[m[1]] = m[3] !== undefined ? m[3] : JSON.parse(m[2]);
    return props;
  };
  const entities = Object.entries(kinds).map(([id, k]) => ({
    id,
    kind: k.def.kind,
    intent: k.def.intent,
    names: k.def.names ?? [],
    params: Object.fromEntries(Object.entries(k.def.params ?? {}).map(([p, spec]) => [p, { value: written(id)[p], ...spec }])),
    ...(id === "moments" ? { members: ["your cat", "a late night", "the two of us", "a home", "a little sun"] } : {}),
  }));
  const r = acceptAuthoring({ tree: PRESET }, entities, "strong");
  assert.equal(r.problems, undefined, JSON.stringify(r.problems));
});

test("re-authoring keeps what was learned, and the intents added for this person's events", () => {
  const lab = createLab();
  lab.dispatch({ type: "learn", key: KEY.dust, kind: "settles", phrase: "像雪一样慢慢落下" });
  const o = observe(lab, say("let them linger", "moments"));
  lab.dispatch(acceptAddition(standInAdd(o), o, "strong").action);
  lab.dispatch(acceptAuthoring({ tree: PRESET }, ENTITIES, "strong").action);
  assert.deepEqual(Object.values(recognize(say("像雪一样慢慢落下"), lab.tree())).slice(0, 2), [KEY.dust, "settles"], "still a short path");
  assert.equal(lab.view("pace|moments", by.phone)().kind, "slower", "the added intent and its decision stay");
});

test("② a weak model's choice stands only when it is sure; otherwise the strong model decides", () => {
  const lab = createLab();
  const o = observe(lab, say("make it more hopeful"));
  const unsure = acceptSelection({ action: "decide", key: KEY.holding, kind: "keeps", sure: 0.4, why: "maybe" }, o);
  assert.equal(unsure.action, null);
  assert.equal(unsure.escalate, true);
  assert.equal(acceptSelection({ action: "decide", key: KEY.holding, kind: "keeps", why: "no sureness given" }, o).escalate, true, "a choice without a sureness is not sure");
  const strong = acceptAddition({ action: "believe", beliefs: [{ key: KEY.holding, p: { wears: 0.3, keeps: 0.7 } }], why: "a mood" }, o, "strong");
  assert.equal(strong.action.type, "believe", "the strong model may choose too, with no threshold");
});

test("a key a model wrote is read the only way it can have meant, and no other", () => {
  const lab = createLab();
  const o = observe(lab, say("x"));
  const read = (key) => acceptSelection({ action: "decide", key, kind: "settles", sure: 0.9, why: "" }, o);
  assert.equal(read("dust").action.key, KEY.dust, "a type with one intent");
  assert.equal(read("dust|of:dust").action.key, KEY.dust);
  assert.ok(read("keep").problems, "five keep intents: not guessed");
});
