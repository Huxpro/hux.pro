// The Intent Lab on /dream/forget: what each screen gets and who said it;
// events, and what each comes to (① a preset's action, ② a model's, checked).
import assert from "node:assert/strict";
import { test } from "node:test";
import { accept, recognize, standIn } from "../../app/lab/intent/events.ts";
import { KEY, SCREENS } from "../../app/lab/intent/forget.ts";
import { createLab } from "../../app/lab/intent/model.ts";
import { admit } from "../../app/lab/intent/tree.ts";

const by = Object.fromEntries(SCREENS.map((s) => [s.id, s]));
const axisOf = (lab) => Object.fromEntries(SCREENS.map((s) => [s.id, lab.view(KEY.axis, s)().kind]));

/** The stage's things as a model is told about them (what the page reads off the host). */
const ENTITIES = [
  { id: "window", kind: "surface", intent: "", names: [], params: { width: { value: 240, range: [160, 400] }, axis: { value: "up" } } },
  { id: "edge", kind: "effect", intent: "", names: [], params: { erode: { value: 2.6, range: [0.5, 6] }, shed: { value: 0.9, range: [0, 3] } } },
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
const box = { x: 100, y: 100, w: 240, h: 320 };

test("before anyone decides: the model says what, code says where, and the dream's meaning is asked", () => {
  const lab = createLab();
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "up", landscape: "across", wide: "up" });
  const v = lab.view(KEY.axis, by.landscape)();
  assert.equal(v.who, "model");
  assert.equal(v.where, "code");
  assert.deepEqual(lab.questions(by.phone)(), [KEY.holding]);
  assert.equal(lab.view(KEY.letgo, by.phone)().who, "model");
  assert.equal(lab.view(KEY.keep(0), by.phone)().who, "code", "a prior is code's, not a model's");
  assert.deepEqual(lab.params(by.landscape)().moments, { kept: [] });
});

test("a switch on one screen moves the crossover: wider screens follow, taller ones keep theirs", () => {
  const lab = createLab();
  lab.dispatch({ type: "decide", key: KEY.axis, kind: "across", from: "switched", screen: by.laptop });
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "across", landscape: "across", wide: "across" });
  lab.dispatch({ type: "decide", key: KEY.axis, kind: "up", from: "switched", screen: by.laptop });
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "up", landscape: "across", wide: "across" });
  assert.deepEqual(lab.stored()[KEY.axis].pick, { base: "up", below: "across", at: 0.625 });
});

test("① a drag a preset knows: a moment out of the window is kept, back in it goes; the window sideways lies down; the dust down settles", () => {
  const lab = createLab();
  const drag = (from, to) => ({ kind: "drag", screen: by.phone, from, to, window: box });
  const out = recognize(drag({ x: 200, y: 300, id: "moments", member: 2 }, { x: 30, y: 300, id: null }), lab.tree(), []);
  assert.equal(out.action.key, KEY.keep(2));
  assert.equal(out.action.kind, "stays");
  lab.dispatch(out.action);
  assert.deepEqual(lab.params(by.wide)().moments.kept, [2], "kept on every screen");
  const back = recognize(drag({ x: 30, y: 300, id: "moments", member: 2 }, { x: 200, y: 300, id: "window" }), lab.tree(), [2]);
  assert.equal(back.action.kind, "goes");
  const flat = recognize(drag({ x: 150, y: 200, id: "window" }, { x: 300, y: 210, id: "window" }), lab.tree(), []);
  assert.deepEqual([flat.action.key, flat.action.kind], [KEY.axis, "across"]);
  const settle = recognize(drag({ x: 200, y: 50, id: "dust" }, { x: 205, y: 160, id: null }), lab.tree(), []);
  assert.deepEqual([settle.action.key, settle.action.kind], [KEY.dust, "settles"]);
  assert.equal(recognize(drag({ x: 200, y: 300, id: "moments", member: 1 }, { x: 200, y: 200, id: "moments", member: 0 }), lab.tree(), []), null, "a reorder is no preset's");
});

test("① a prompt that names one kind is that kind; anything else is for the model", () => {
  const lab = createLab();
  const say = (text, entity = null) => recognize({ kind: "prompt", screen: by.phone, entity, text }, lab.tree(), []);
  assert.deepEqual([say("落下").action.key, say("落下").action.kind], [KEY.dust, "settles"]);
  assert.deepEqual([say("one by one").action.key, say("one by one").action.kind], [KEY.letgo, "oneByOne"]);
  assert.equal(say("kept"), null, "five moments could be kept: ambiguous without one chosen");
  assert.equal(say("kept", "moments#3").action.key, KEY.keep(3));
  assert.equal(say("slower please"), null);
});

test("② a model's new intent is checked against the stage, made whole, and compiles like any other", () => {
  const lab = createLab();
  const o = observe(lab, { kind: "prompt", screen: by.phone, entity: "moments", text: "slower" });
  const out = accept(standIn(o), o);
  assert.equal(out.action.type, "add");
  lab.dispatch(out.action);
  assert.equal(lab.params(by.phone)().moments.gap, 1.5);
  assert.equal(lab.view("pace|moments", by.wide)().who, "person", "the person's prompt decided it");
  lab.dispatch({ type: "decide", key: "pace|moments", kind: "asWritten", from: "switched", screen: by.phone });
  assert.equal(lab.params(by.phone)().moments.gap, 0.95, "its first kind is the scene as written");
  lab.undo();
  lab.undo();
  assert.equal(lab.params(by.phone)().moments.gap, undefined, "undone: the node is gone");
});

test("② what a model writes that the stage cannot hold is not let in", () => {
  const bad = admit(
    {
      type: "glow",
      of: "moon",
      words: { en: "Glow" },
      kinds: { a: { words: { en: "a" }, patch: { moments: { gap: 9, colour: "red" } } } },
      resolve: "maybe",
    },
    ENTITIES,
  );
  assert.deepEqual(bad.problems, [
    `"moon" is not on the stage`,
    "it has 1 kinds; a choice has two to four",
    "moments.gap = 9 is outside 0.4–2",
    `moments has no knob "colour"`,
    "resolve is \"maybe\", not ask or switch",
  ]);
  const lab = createLab();
  const o = observe(lab, { kind: "prompt", screen: by.phone, entity: null, text: "x" });
  assert.deepEqual(accept({ action: "decide", key: KEY.dust, kind: "floats", why: "" }, o).problems, [`no kind "floats" on "dust|dust"`]);
  // Made whole: a kind that leaves a knob out gets the scene's value, so switching back undoes.
  const ok = admit(
    { type: "pace", of: "moments", words: { en: "Pace" }, kinds: { asWritten: { words: { en: "As written" }, patch: {} }, slow: { words: { en: "Slow" }, patch: { moments: { gap: 1.6 } } } }, resolve: "switch" },
    ENTITIES,
  );
  assert.deepEqual(ok.node.kinds.asWritten.patch, { moments: { gap: 0.95 } });
});

test("② a mood moves beliefs, never a person's decision", () => {
  const lab = createLab();
  lab.dispatch({ type: "decide", key: KEY.dust, kind: "rises", from: "switched", screen: by.phone });
  const o = observe(lab, { kind: "prompt", screen: by.phone, entity: null, text: "sadder" });
  const out = accept(standIn(o), o);
  assert.equal(out.action.type, "believe");
  lab.dispatch(out.action);
  assert.equal(lab.view(KEY.letgo, by.phone)().kind, "oneByOne", "the model now believes one by one");
  assert.equal(lab.view(KEY.dust, by.phone)().kind, "rises", "the person said rises; it stays");
  assert.equal(lab.view(KEY.holding, by.phone)().asks, false, "sure now (0.8): no longer asked");
});

test("② what no knob can express is answered with none, and says why", () => {
  const lab = createLab();
  const o = observe(lab, { kind: "drag", screen: by.phone, from: { x: 1, y: 1, id: "moments", member: 1 }, to: { x: 1, y: 60, id: "moments", member: 0 }, window: box });
  const out = accept(standIn(o), o);
  assert.equal(out.action, null);
  assert.match(out.why.en, /regenerate/);
});

test("a screen's props are recomputed only when one of its intents changes", () => {
  const lab = createLab();
  const phone = lab.params(by.phone);
  const before = phone();
  lab.dispatch({ type: "decide", key: KEY.axis, kind: "across", from: "switched", screen: by.laptop });
  assert.equal(phone(), before, "the phone's axis did not change, so its props are the same object");
  lab.dispatch({ type: "decide", key: KEY.dust, kind: "settles", from: "switched", screen: by.laptop });
  assert.notEqual(phone(), before);
});
