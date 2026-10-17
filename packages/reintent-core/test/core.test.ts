// The core's rules, one at a time. Run: pnpm reintent:test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_DOC,
  collect,
  createRoot,
  effect,
  intent,
  narrow,
  part,
  render,
  runPart,
  useCell,
  useDerived,
  useIntent,
  useLazy,
  values,
  type IntentOptions,
  type Root,
} from "../src/index.ts";
import { recognize } from "../src/words.ts";
import { observe } from "../src/observe.ts";

const Size = intent(
  {
    usual: { words: ["寻常", "正常"], hatScale: 1 },
    big: { words: ["大很多"], hatScale: 1.45 },
    absurd: { words: ["大得离谱", "离谱"], hatScale: 1.95 },
  },
  { ordered: true },
);
const Place = intent({ bed: { words: ["床头"], x: 236 }, foot: { words: ["床尾"], x: 318 }, window: { words: ["窗边", "窗"], x: 118 } });
const Open = intent({ ajar: { words: ["一条缝"], open: 0.18 }, half: { words: ["半开"], open: 0.36 }, wide: { words: ["大开"], open: 0.66 } }, { ordered: true });
const Pace = intent(
  { sudden: { words: ["一下子"], over: 2.5 }, slow: { words: ["慢慢"], over: 6.5 }, crawl: { words: ["极慢"], over: 12 } },
  { ordered: true, more: ["慢一点", "更慢"], less: ["快一点", "更快"] },
);

/** Him: two intents in, what he looks like out. */
const man = (extra: IntentOptions<"usual" | "big" | "absurd"> = {}) =>
  part("man", { aka: ["他"] }, () => {
    const hat = useIntent("hat", Size, { aka: ["帽子"], p: { usual: 0.04, big: 0.52, absurd: 0.44 }, resolve: "ask", ...extra });
    const stand = useIntent("stand", Place, { aka: ["站"], p: { bed: 0.46, foot: 0.42, window: 0.12 } });
    return { hatScale: hat.data.hatScale, x: stand.data.x };
  });
const Wardrobe = part("wardrobe", { aka: ["衣柜", "门"] }, () => {
  const door = useIntent("door", Open, { aka: ["柜门", "门"], p: { ajar: 0.12, half: 0.58, wide: 0.3 } });
  useIntent("pace", Pace, { aka: ["速度"], p: { sudden: 0.08, slow: 0.7, crawl: 0.22 } });
  return { open: door.data.open };
});

const setup = (extra?: IntentOptions<"usual" | "big" | "absurd">) => {
  const root = createRoot({ id: "t" });
  render(root, [man(extra), Wardrobe]);
  return root;
};
const v = (root: Root, key: string) => root.get().values[key];

test("a part: intents in, the world out", () => {
  const root = createRoot();
  const M = man();
  const [out] = render(root, [M]);
  assert.deepEqual(out, { hatScale: 1.45, x: 236 });
  root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd" });
  assert.deepEqual(runPart(root, M, {}), { hatScale: 1.95, x: 236 });
});

test("unsure on an intent that asks: the likeliest kind for now, and a question", () => {
  const x = v(setup(), "man.hat");
  assert.deepEqual([x.kind, x.source, x.ask, x.data], ["big", "ask", true, { hatScale: 1.45 }]);
});

test("unsure on an intent that switches: code picks, nobody is asked", () => {
  const x = v(setup(), "man.stand");
  assert.deepEqual([x.kind, x.source, x.ask], ["bed", "code", false]);
});

test("a sure model decides", () => {
  assert.equal(v(setup(), "wardrobe.pace").source, "model");
});

test("precedence: person > rule > author > model", () => {
  const root = setup({ pick: "usual" });
  assert.equal(v(root, "man.hat").source, "author");
  root.dispatch({ type: "narrow", key: "man.hat", pick: "big", scope: "all" });
  assert.equal(v(root, "man.hat").source, "rule");
  root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd" });
  assert.deepEqual([v(root, "man.hat").kind, v(root, "man.hat").source], ["absurd", "person"]);
});

test("ruling a kind out leaves the rest to the model and code", () => {
  const root = setup();
  root.dispatch({ type: "narrow", key: "man.hat", pick: { not: ["big"] } });
  const x = v(root, "man.hat");
  assert.deepEqual([x.kind, x.source, x.not], ["absurd", "model", ["big"]]);
});

test("a hook is known by its label: under an `if`, its cell comes and goes, and a decision waits for it", () => {
  const M = part("man", {}, () => {
    const stand = useIntent("stand", Place);
    // At the window he faces the moon: where he looks is no question there.
    const gaze = stand.kind === "window" ? null : useIntent("gaze", intent({ me: {}, away: {} }));
    return gaze?.kind ?? "moon";
  });
  const root = createRoot();
  render(root, [M]);
  root.dispatch({ type: "narrow", key: "man.gaze", pick: "away" });
  assert.deepEqual(render(root, [M]), ["away"]);
  root.dispatch({ type: "narrow", key: "man.stand", pick: "window" });
  assert.deepEqual(render(root, [M]), ["moon"]);
  assert.equal(v(root, "man.gaze"), undefined);
  assert.deepEqual(root.get().log[0].program?.removed, ["man.gaze"]);
  assert.deepEqual(root.get().log[0].program?.suspended, ["man.gaze"]);
  root.dispatch({ type: "narrow", key: "man.stand", pick: "bed" });
  assert.deepEqual(render(root, [M]), ["away"]);
  assert.deepEqual(root.get().log[0].program?.restored, ["man.gaze"]);
});

test("reading sideways: a part that reads a cell before it is declared runs again, and settles", () => {
  const Cat = part("cat", {}, () => {
    const where = useDerived("where", Place, (read) => read("man.stand"));
    const his = useCell("man.stand", Place);
    return [where.kind, where.source, his?.kind ?? "(nothing yet)"];
  });
  const root = createRoot();
  root.dispatch({ type: "narrow", key: "man.stand", pick: "window" });
  // The cat first: on the first pass there is no man to read.
  assert.deepEqual(runPart(root, Cat, {}), ["bed", "code", "(nothing yet)"]);
  const [cat] = render(root, [Cat, man()]);
  assert.deepEqual(cat, ["window", "derived", "window"]);
});

test("a part rewritten: decisions kept by path, waiting when their kind is gone, back when it returns", () => {
  const V2 = part("man", { aka: ["他"] }, () => {
    useIntent("hat", intent({ usual: {}, towering: {} }), { aka: ["帽子"] });
    return null;
  });
  const root = setup();
  root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd" });
  root.dispatch({ type: "narrow", key: "wardrobe.door", pick: "wide" });
  render(root, [V2, Wardrobe]);
  const c = root.get().log[0].program!;
  assert.deepEqual([c.kept, c.suspended, c.removed], [["wardrobe.door"], ["man.hat"], ["man.stand"]]);
  assert.equal(v(root, "man.hat").source, "code");
  render(root, [man(), Wardrobe]);
  assert.deepEqual(root.get().log[0].program!.restored, ["man.hat"]);
  assert.equal(v(root, "man.hat").kind, "absurd");
});

const tick = () => new Promise((r) => setTimeout(r, 0));

test("a thing drawn twice is one thing: two holders; gone only when the last lets go", async () => {
  const root = setup();
  const man = root.get().program.things.find((t) => t.id === "man")!;
  root.hold("him in the wardrobe", man, man.intents);
  root.hold("him at the bed", man, man.intents);
  root.release("run:man");
  root.release("him in the wardrobe");
  await tick();
  assert.ok(v(root, "man.hat"));
  root.release("him at the bed");
  await tick();
  assert.equal(v(root, "man.hat"), undefined);
  assert.deepEqual(root.get().log[0].program?.removed, ["man.hat", "man.stand"]);
});

test("released and held again before the flush (a version switched in one commit): nothing goes", async () => {
  const root = setup();
  const w = root.get().program.things.find((t) => t.id === "wardrobe")!;
  root.release("run:wardrobe");
  root.hold("run:wardrobe", w, w.intents);
  await tick();
  assert.ok(v(root, "wardrobe.door"));
  assert.equal(root.get().log.filter((e) => e.program?.removed.length).length, 0);
});

test("a run is pure: collecting a part declares nothing; holding it does", async () => {
  const root = createRoot();
  const r = collect(root, man(), {});
  assert.deepEqual(r.out, { hatScale: 1.45, x: 236 });
  assert.deepEqual(r.decls.map((d) => d.name), ["hat", "stand"]);
  assert.deepEqual(r.reads, ["man.hat", "man.stand"]);
  await tick();
  assert.equal(root.get().program.things.length, 0);
  root.hold("h", r.thing, r.decls);
  await tick();
  assert.deepEqual(Object.keys(root.get().values), ["man.hat", "man.stand"]);
});

test("an unchanged cell keeps its identity across publishes; a changed one does not", () => {
  const root = setup();
  const hat = v(root, "man.hat");
  const door = v(root, "wardrobe.door");
  root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd" });
  assert.notEqual(v(root, "man.hat"), hat);
  assert.equal(v(root, "wardrobe.door"), door);
  // And evaluate gives the published object for a declaration as published.
  const decl = root.get().program.things[1].intents.find((i) => i.name === "door")!;
  assert.equal(root.evaluate({ id: "wardrobe" }, decl), door);
});

test("a scope: a subtree's own leaning, without touching anyone else's values", () => {
  const root = setup();
  const leaning = root.view({ lean: { hat: "absurd" } });
  assert.deepEqual([leaning["man.hat"].kind, leaning["man.hat"].source], ["absurd", "viewer"]);
  assert.equal(v(root, "man.hat").kind, "big");
  assert.equal(root.view({ lean: { hat: "absurd" } }), leaning);
});

test("a hook outside a part, or a kind a type does not have, is an error", () => {
  assert.throws(() => useIntent("hat", Size), /outside a part/);
  const Bad = part("x", {}, () => useIntent("hat", Size, { pick: "nope" as "big" }));
  assert.throws(() => render(createRoot(), [Bad]), /not a kind/);
});

test("a viewer's leaning tilts what nobody decided, and never overrides a person", () => {
  const root = setup();
  root.dispatch({ type: "context", ctx: { lean: { hat: "absurd" } } });
  assert.deepEqual([v(root, "man.hat").kind, v(root, "man.hat").source], ["absurd", "viewer"]);
  root.dispatch({ type: "narrow", key: "man.hat", pick: "usual" });
  assert.equal(v(root, "man.hat").kind, "usual");
});

test("a belief is held under its context: said of the whole, it goes stale", () => {
  const root = setup();
  root.dispatch({ type: "believe", key: "man.hat", p: { usual: 0.1, big: 0.1, absurd: 0.8 } });
  assert.equal(v(root, "man.hat").stale, false);
  root.dispatch({ type: "context", ctx: { prompts: ["更压抑一点"] } });
  assert.deepEqual([v(root, "man.hat").kind, v(root, "man.hat").stale], ["absurd", true]);
  assert.ok(root.get().stale.some((x) => x.key === "man.hat"));
  // A person's decision does not rest on the belief: nothing to re-infer there.
  root.dispatch({ type: "narrow", key: "man.hat", pick: "usual" });
  assert.equal(v(root, "man.hat").stale, false);
});

test("learn: the vocabulary grows, with data of the same shape; undo", () => {
  const root = setup();
  root.dispatch({
    type: "batch",
    actions: [
      { type: "learn", key: "man.hat", name: "towering", kind: { label: "顶天", words: ["顶天"], data: { hatScale: 2.6 }, learned: "model:weak" } },
      { type: "narrow", key: "man.hat", pick: "towering", from: "said" },
    ],
  });
  assert.deepEqual([v(root, "man.hat").kind, v(root, "man.hat").data], ["towering", { hatScale: 2.6 }]);
  root.undo();
  assert.equal(v(root, "man.hat").kind, "big");
});

test("the root: watch runs only when what it reads changes; preview commits nothing", () => {
  const root = setup();
  const seen: string[] = [];
  root.watch((s) => s.values["man.hat"].kind, (k) => seen.push(k));
  root.dispatch({ type: "narrow", key: "wardrobe.door", pick: "wide" });
  root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd" });
  assert.deepEqual(seen, ["absurd"]);
  assert.equal(root.preview([{ type: "narrow", key: "man.hat", pick: "usual" }]).values["man.hat"].kind, "usual");
  assert.equal(v(root, "man.hat").kind, "absurd");
  assert.ok(root.get().log[0].changes.some((c) => c.startsWith("man.hat: big → absurd")));
});

test("effect, through useLazy: eager until a lazy world is written, cached under the kinds it was written for", async () => {
  let calls = 0;
  const look = effect<string>({
    deps: ["man.hat"],
    eager: (u) => `placeholder ${u["man.hat"]}`,
    lazy: async (u) => {
      calls++;
      return `drawn ${u["man.hat"]}`;
    },
  });
  const Hat = part("man", {}, () => {
    useIntent("hat", Size, { p: { big: 0.6, absurd: 0.3, usual: 0.1 } });
    return useLazy(look);
  });
  const root = createRoot();
  assert.deepEqual(render(root, [Hat])[0], { world: "placeholder big", source: "eager", pending: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(runPart(root, Hat, {}), { world: "drawn big", source: "written", pending: false });
  root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd" });
  assert.equal(runPart(root, Hat, {}).source, "eager");
  await new Promise((r) => setTimeout(r, 0));
  root.undo();
  assert.equal(runPart(root, Hat, {}).world, "drawn big");
  assert.equal(calls, 2);
});

test("values() on its own: the program as data, the doc as data", () => {
  const p = setup().get().program;
  assert.equal(values(p, narrow(EMPTY_DOC, "man.hat", "usual"))["man.hat"].source, "person");
});

// -----------------------------------------------------------------------------
// The words library
// -----------------------------------------------------------------------------

const said = (text: string, pick?: string) => {
  const root = setup();
  if (pick) root.dispatch({ type: "narrow", key: "man.hat", pick });
  return recognize(text, root.get());
};

test("words: a kind's words resolve", () => {
  const r = said("站到窗边");
  assert.deepEqual(r.outcome === "resolve" && r.reading, { key: "man.stand", kind: "window", not: false, via: "kind" });
});

test("words: a step's own words name its intent (门慢一点 is the pace, not the door)", () => {
  const r = said("门慢一点");
  assert.deepEqual(r.outcome === "resolve" && [r.reading.key, r.reading.kind], ["wardrobe.pace", "crawl"]);
});

test("words: a generic step with nothing named is a question", () => {
  const r = said("大一点");
  assert.deepEqual(r.outcome === "ask" && r.readings.map((x) => x.key).sort(), ["man.hat", "wardrobe.door"]);
});

test("words: naming the intent keeps the reading to it; past its end goes to a model", () => {
  const r = said("帽子大一点", "absurd");
  assert.deepEqual(r.outcome === "infer" && r.need, { kind: "extend", key: "man.hat", dir: 1, text: "帽子大一点" });
});

test("words: a negation outside the kind's words rules it out", () => {
  const r = said("帽子不要大得离谱");
  assert.equal(r.outcome === "resolve" && r.reading.not, true);
});

test("words: about nothing in particular, it is context", () => {
  assert.equal(said("更压抑一点").outcome, "context");
});

test("observe: the state as a model is shown it", () => {
  assert.match(observe(setup().get()), /man\.hat \(hat\) = big \[ask, asking\] · usual 4% · big 52% · absurd 44%/);
});
