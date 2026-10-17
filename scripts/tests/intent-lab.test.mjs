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
  lessonOf,
  recognize,
  standInAdd,
  standInSelect,
  weakReads,
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

test("② a weak model's reading is a belief: the model's, under any person's decision, and not learned", () => {
  const lab = createLab();
  const e = say("像雪一样慢慢落下", "dust");
  const o = observe(lab, e);
  const out = acceptSelection(standInSelect(o), o);
  assert.equal(out.action.type, "believe");
  lab.dispatch(out.action);
  const v = lab.view(KEY.dust, by.phone)();
  assert.deepEqual([v.kind, v.who], ["settles", "model"]);
  lab.dispatch({ type: "decide", key: KEY.dust, kind: "rises", from: "switched", screen: by.phone });
  assert.equal(lab.view(KEY.dust, by.phone)().kind, "rises", "a person's decision is over it");
  assert.equal(recognize(say("像雪一样慢慢落下"), lab.tree()), null, "nothing learned from a weak reading");
  assert.equal(weakReads(drag({ x: 0, y: 0, id: "window" }, { x: 99, y: 0, id: null }, { from: [], to: [] })), false, "a drag never takes the weak path");
});

test("③ what the strong model decides is the person's, and is learned: the same words or drag next time are ①", () => {
  const lab = createLab();
  const e = say("let them linger a little longer", "moments");
  const o = observe(lab, e);
  const out = acceptAddition({ action: "decide", key: KEY.holding, kind: "keeps", why: "lingering is waiting" }, o, "strong");
  lab.dispatch(out.action);
  assert.equal(lab.view(KEY.holding, by.phone)().who, "person");
  lab.dispatch(lessonOf(e, out.action, lab.tree()));
  assert.deepEqual(Object.values(recognize(say("let them linger a little longer", "edge"), lab.tree())).slice(0, 2), [KEY.holding, "keeps"]);
  // A drag the strong model read: its shape is learned as a gesture.
  const d = drag({ x: 100, y: 300, id: "dust" }, { x: 300, y: 300, id: null }, { from: ["dust"], to: [] });
  const lesson = lessonOf(d, { type: "decide", key: KEY.dust, kind: "settles", from: "dragged", screen: by.phone }, lab.tree());
  assert.deepEqual(lesson.gesture, { from: "self", dir: "right" }, "the dust is what the intent is about: \"self\", and which way");
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
  ]);
  // A wrong word costs a short path, not the intent: dropped, and said.
  const loose = admit(
    {
      type: "pace",
      of: "moments",
      words: { en: "Pace" },
      kinds: { asWritten: { words: { en: "As written" }, patch: {} }, slow: { words: { en: "Slow" }, patch: { moments: { gap: 1.6 } } } },
      resolve: "switch",
      say: { b: ["x"], slow: ["slower"] },
      gestures: { slow: [{ from: "sky", dir: "up" }, { from: "self", dir: "down", into: "self" }] },
    },
    ENTITIES,
  );
  assert.deepEqual(loose.dropped, [`it says "b", which is not one of its kinds`, `a gesture for "slow" names nothing on the stage, or no way to go`]);
  assert.deepEqual(loose.node.say, { slow: ["slower"] });
  assert.deepEqual(loose.node.gestures.slow, [{ from: "self", dir: "down", into: "self" }], "\"self\" is a place too");
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

/** A dream's stage as a model is told about it: its kinds' declared knobs, with the values its scene file writes. */
async function stageOf(dream, kinds, members = {}) {
  const { readFileSync } = await import("node:fs");
  const scene = readFileSync(`app/dream/${dream}/${dream}.scene.tsx`, "utf8");
  const written = (id) => {
    const at = scene.indexOf(`id="${id}"`);
    const element = scene.slice(scene.lastIndexOf("<", at), scene.indexOf("/>", at));
    const props = {};
    for (const m of element.matchAll(/(\w+)=(?:\{([^{}]*\]?)\}|"([^"]*)")/g)) {
      try {
        props[m[1]] = m[3] !== undefined ? m[3] : JSON.parse(m[2]);
      } catch {
        // a binding (ref, after): not a knob
      }
    }
    return props;
  };
  return Object.entries(kinds).map(([id, k]) => ({
    id,
    kind: k.def.kind,
    intent: k.def.intent,
    names: k.def.names ?? [],
    params: Object.fromEntries(Object.entries(k.def.params ?? {}).map(([p, spec]) => [p, { value: written(id)[p], ...spec }])),
    ...(members[id] ? { members: members[id] } : {}),
  }));
}

test("every dream's cached tree passes against its real stage: the kinds' declared knobs and the values the scene writes", async () => {
  const forget = await stageOf(
    "forget",
    {
      window: (await import("../../app/dream/forget/kinds/window.ts")).Window,
      edge: (await import("../../app/dream/forget/kinds/edge.ts")).Edge,
      tide: (await import("../../app/dream/forget/kinds/tide.ts")).Tide,
      moments: (await import("../../app/dream/forget/kinds/moments.ts")).Moments,
      dust: (await import("../../app/dream/forget/kinds/dust.ts")).Dust,
    },
    { moments: ["your cat", "a late night", "the two of us", "a home", "a little sun"] },
  );
  const everyone = await stageOf("everyone", {
    globe: (await import("../../app/dream/everyone/kinds/globe.ts")).Globe,
    voices: (await import("../../app/dream/everyone/kinds/voices.ts")).Voices,
    light: (await import("../../app/dream/everyone/kinds/light.ts")).Light,
  });
  const blue = await stageOf("blue", {
    contours: (await import("../../app/dream/blue/kinds/contours.ts")).Contours,
    "sun-ring": (await import("../../app/dream/blue/kinds/sun-ring.ts")).SunRing,
    sea: (await import("../../app/dream/blue/kinds/sea.ts")).Sea,
    surf: (await import("../../app/dream/blue/kinds/surf.ts")).SurfSound,
  });
  for (const [name, entities, tree] of [
    ["forget", forget, PRESET],
    ["everyone", everyone, (await import("../../app/lab/intent/everyone.ts")).PRESET],
    ["blue", blue, (await import("../../app/lab/intent/blue.ts")).PRESET],
  ]) {
    const r = acceptAuthoring({ tree }, entities, "strong");
    assert.equal(r.problems, undefined, `${name}: ${JSON.stringify(r.problems)}`);
    assert.equal(r.dropped, undefined, `${name}: ${JSON.stringify(r.dropped)}`);
    assert.equal(r.action.tree.length, tree.length, name);
    // The scene as written comes first in every intent: what code falls back to is the dream as it is.
    for (const n of r.action.tree) assert.equal(Object.keys(n.kinds)[0], Object.keys(tree.find((t) => t.type === n.type && t.of === n.of).kinds)[0], `${name} ${n.type}`);
  }
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
  assert.equal(read("dust").action.beliefs[0].key, KEY.dust, "a type with one intent");
  assert.equal(read("dust|of:dust").action.beliefs[0].key, KEY.dust);
  assert.equal(read("dust|dust:settles").action.beliefs[0].key, KEY.dust, "a kind stuck on the end");
  assert.ok(read("keep").problems, "five keep intents: not guessed");
});

test("an authored tree loses an intent that fails, not the tree", () => {
  const scene = { ...PRESET[0], type: "mood", of: "what I forget" };
  const r = acceptAuthoring({ tree: [...PRESET, scene] }, ENTITIES, "strong");
  assert.equal(r.action.tree.length, PRESET.length);
  assert.deepEqual(r.dropped, [`left out #${PRESET.length}: "what I forget" is not on the stage`]);
  assert.deepEqual(acceptAuthoring({ tree: [scene] }, ENTITIES, "strong").problems, [`#0: "what I forget" is not on the stage`], "with none let in, it is refused");
});

test("the kind that is the scene as written comes first, wherever a model put it", () => {
  const r = admit(
    {
      type: "pace",
      of: "moments",
      words: { en: "Pace" },
      kinds: { faster: { words: { en: "Faster" }, patch: { moments: { gap: 0.6 } } }, normal: { words: { en: "As written" }, patch: { moments: { gap: 0.95 } } } },
      resolve: "switch",
    },
    ENTITIES,
  );
  assert.deepEqual(Object.keys(r.node.kinds), ["normal", "faster"]);
});

test("directions: every kind a screen is not, likeliest first by what the model believes; a what-if commits nothing", () => {
  const lab = createLab();
  const d = lab.directions(by.phone)();
  assert.deepEqual(
    d.slice(0, 4).map((x) => `${x.key}=${x.kind}`),
    [`${KEY.axis}=across`, `${KEY.holding}=keeps`, `${KEY.dust}=settles`, `${KEY.letgo}=oneByOne`],
  );
  assert.ok(d[0].believed && !d.at(-1).believed, "a model's belief, then code's prior");
  const preview = lab.whatIf({ type: "decide", key: KEY.axis, kind: "across", from: "switched", screen: by.laptop });
  assert.equal(preview(by.wide).window.axis, "across", "the wide screen would follow the laptop");
  assert.equal(preview(by.phone).window.axis, "up");
  assert.equal(lab.params(by.wide)().window.axis, "up", "and nothing changed");
  assert.deepEqual(lab.stored(), {});
});

test("on the other dreams: a drag that leaves a shape means the place, not the way; a drag inside it means the way", async () => {
  const everyone = await import("../../app/lab/intent/everyone.ts");
  const blue = await import("../../app/lab/intent/blue.ts");
  // Out of the world, sideways: both "spins" (sideways from it) and "larger" (out of it) fit; leaving it says more.
  const out = recognize(drag({ x: 600, y: 400, id: "globe" }, { x: 1400, y: 400, id: null }, { from: ["globe", "voices"], to: [] }), everyone.PRESET);
  assert.deepEqual(Object.values(out).slice(0, 2), ["world|globe", "larger"]);
  const spin = recognize(drag({ x: 500, y: 400, id: "globe" }, { x: 700, y: 400, id: "globe" }, { from: ["globe", "voices"], to: ["globe", "voices"] }), everyone.PRESET);
  assert.deepEqual(Object.values(spin).slice(0, 2), ["turning|globe", "spins"]);
  // The sun is small: a drag of it leaves it whichever way it goes, so its size is a way (up), not a place.
  const left = recognize(drag({ x: 250, y: 350, id: "sun-ring" }, { x: 110, y: 352, id: null }, { from: ["sun-ring", "contours"], to: ["contours"] }), blue.PRESET);
  assert.deepEqual(Object.values(left).slice(0, 2), ["sun|sun-ring", "left"]);
  const up = recognize(drag({ x: 250, y: 350, id: "sun-ring" }, { x: 252, y: 220, id: null }, { from: ["sun-ring"], to: [] }), blue.PRESET);
  assert.deepEqual(Object.values(up).slice(0, 2), ["sunSize|sun-ring", "larger"]);
});

test("“the sea is red”: with the colour a real knob, ③ adds an intent; a none names only knobs the stage truly lacks", async () => {
  const blue = await stageOf("blue", {
    contours: (await import("../../app/dream/blue/kinds/contours.ts")).Contours,
    "sun-ring": (await import("../../app/dream/blue/kinds/sun-ring.ts")).SunRing,
    sea: (await import("../../app/dream/blue/kinds/sea.ts")).Sea,
    surf: (await import("../../app/dream/blue/kinds/surf.ts")).SurfSound,
  });
  const tree = (await import("../../app/lab/intent/blue.ts")).PRESET;
  const o = { entities: blue, tree, decisions: {}, event: say("海水是红色"), prompts: [] };
  assert.equal(blue.find((e) => e.id === "sea").params.hue.value, 0, "the scene writes its blue as hue 0");
  // ② what the weak model really answered on the preview: sure enough, but about the sun, when the words name the sea. Not kept: the strong model decides.
  const misread = acceptSelection({ action: "decide", key: "sunSize", kind: "larger", sure: 0.75, why: "a red sea is a sunset, with a larger sun" }, o);
  assert.equal(misread.action, null);
  assert.equal(misread.escalate, true, misread.why.en);
  const fits = acceptSelection({ action: "decide", key: "opening", kind: "quickly", sure: 0.8, why: "" }, { ...o, event: say("the sea should open quickly") });
  assert.equal(fits.action?.type, "believe", "a reading about what the words name stands");
  const sun = acceptSelection({ action: "decide", key: "sunSize", kind: "larger", sure: 0.9, why: "" }, { ...o, event: say("make the sun a bit bigger") });
  assert.equal(sun.action?.type, "believe", "the drawn sun is what people call the sun");
  const added = acceptAddition(standInAdd(o), o, "stand-in");
  assert.equal(added.action?.type, "add", JSON.stringify(added));
  assert.equal(added.action.node.kinds.red.patch.sea.hue, 150);
  assert.ok(added.action.node.say.red.includes("海水是红色"), "this event's words are its vocabulary");
  // A none: a knob the thing already has is not a need, nor is one about nothing on the stage.
  const none = acceptAddition(
    {
      action: "none",
      why: "no knob",
      needs: [
        { of: "sea", knob: "sea.color", note: "its colour" },
        { of: "sea", knob: "hue" },
        { of: "the ocean", knob: "tint" },
      ],
    },
    o,
    "strong",
  );
  assert.deepEqual(none.needs, [{ of: "sea", knob: "color", note: "its colour" }]);
});
