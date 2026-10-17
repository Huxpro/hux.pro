// The core's rules, one at a time. Run: pnpm reintent:test
import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_DOC, Intent, Scene, Thing, createRoot, effect, intent, narrow, reconcile, values, type Program } from "../src/index.ts";
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

const program = (extra: Partial<Parameters<typeof Intent>[0]> = {}): Program =>
  Scene({
    id: "t",
    children: [
      Thing({
        id: "man",
        aka: ["他"],
        children: [
          Intent({ name: "hat", of: Size, aka: ["帽子"], p: { usual: 0.04, big: 0.52, absurd: 0.44 }, resolve: "ask", ...extra }),
          Intent({ name: "stand", of: Place, aka: ["站"], p: { bed: 0.46, foot: 0.42, window: 0.12 } }),
        ],
      }),
      Thing({
        id: "wardrobe",
        aka: ["衣柜", "门"],
        children: [
          Intent({ name: "door", of: Open, aka: ["柜门", "门"], p: { ajar: 0.12, half: 0.58, wide: 0.3 } }),
          Intent({ name: "pace", of: Pace, aka: ["速度"], p: { sudden: 0.08, slow: 0.7, crawl: 0.22 } }),
        ],
      }),
    ],
  });

test("unsure on an intent that asks: the likeliest kind for now, and a question", () => {
  const v = values(program(), EMPTY_DOC)["man.hat"];
  assert.equal(v.kind, "big");
  assert.equal(v.source, "ask");
  assert.equal(v.ask, true);
  assert.deepEqual(v.data, { hatScale: 1.45 });
});

test("unsure on an intent that switches: code picks, nobody is asked", () => {
  const v = values(program(), EMPTY_DOC)["man.stand"];
  assert.equal(v.kind, "bed");
  assert.equal(v.source, "code");
  assert.equal(v.ask, false);
});

test("a sure model decides", () => {
  assert.equal(values(program(), EMPTY_DOC)["wardrobe.pace"].source, "model");
});

test("precedence: person > rule > author > derived > model", () => {
  const p = program({ pick: "usual" });
  assert.equal(values(p, EMPTY_DOC)["man.hat"].source, "author");
  const ruled = narrow(EMPTY_DOC, "man.hat", "big", { scope: "all" });
  assert.equal(values(p, ruled)["man.hat"].source, "rule");
  const decided = narrow(ruled, "man.hat", "absurd");
  assert.deepEqual([values(p, decided)["man.hat"].kind, values(p, decided)["man.hat"].source], ["absurd", "person"]);
});

test("ruling a kind out leaves the rest to the model and code", () => {
  const doc = narrow(EMPTY_DOC, "man.hat", { not: ["big"] });
  const v = values(program(), doc)["man.hat"];
  assert.equal(v.kind, "absurd");
  assert.equal(v.source, "model");
  assert.deepEqual(v.not, ["big"]);
});

test("derive and follows: a relation is code, and reads the other cell's decided kind", () => {
  const p = Scene({
    id: "rel",
    children: [
      Thing({ id: "man", children: [Intent({ name: "where", of: Place })] }),
      Thing({ id: "cat", children: [Intent({ name: "where", of: Place, follows: "man.where" })] }),
      Thing({
        id: "door",
        children: [Intent({ name: "open", of: Open, derive: (read) => (read("man.where") === "window" ? "wide" : undefined) })],
      }),
    ],
  });
  const doc = narrow(EMPTY_DOC, "man.where", "window");
  const v = values(p, doc);
  assert.deepEqual([v["cat.where"].kind, v["cat.where"].source], ["window", "derived"]);
  assert.deepEqual([v["door.open"].kind, v["door.open"].source], ["wide", "derived"]);
  assert.equal(values(p, EMPTY_DOC)["door.open"].source, "code");
});

test("when: a cell that means nothing is absent, and never asked", () => {
  const p = program({ when: (read) => read("man.stand") !== "window" });
  assert.ok(values(p, EMPTY_DOC)["man.hat"]);
  assert.equal(values(p, narrow(EMPTY_DOC, "man.stand", "window"))["man.hat"], undefined);
});

test("a viewer's leaning tilts what nobody decided, and never overrides a person", () => {
  const lean = { lean: { hat: "absurd" } };
  assert.deepEqual([values(program(), EMPTY_DOC, lean)["man.hat"].kind, values(program(), EMPTY_DOC, lean)["man.hat"].source], ["absurd", "viewer"]);
  assert.equal(values(program(), narrow(EMPTY_DOC, "man.hat", "usual"), lean)["man.hat"].kind, "usual");
});

test("a belief is held under its context: said of the whole, it goes stale", () => {
  const root = createRoot(program());
  root.dispatch({ type: "believe", key: "man.hat", p: { usual: 0.1, big: 0.1, absurd: 0.8 } });
  assert.equal(root.get().values["man.hat"].stale, false);
  root.dispatch({ type: "context", ctx: { prompts: ["更压抑一点"] } });
  const v = root.get().values["man.hat"];
  assert.equal(v.kind, "absurd");
  assert.equal(v.stale, true);
  assert.ok(root.get().stale.some((x) => x.key === "man.hat"));
  // A person's decision does not rest on the belief: nothing to re-infer there.
  root.dispatch({ type: "narrow", key: "man.hat", pick: "usual" });
  assert.equal(root.get().values["man.hat"].stale, false);
});

test("reconcile: a decision is kept by path, parked when its kind goes, back when it returns", () => {
  const v1 = program();
  const v2 = Scene({
    id: "t",
    version: "v2",
    children: [
      Thing({ id: "man", children: [Intent({ name: "hat", of: intent({ usual: {}, towering: {} }) })] }),
      Thing({ id: "wardrobe", children: [Intent({ name: "door", of: Open })] }),
    ],
  });
  let doc = narrow(narrow(EMPTY_DOC, "man.hat", "absurd"), "wardrobe.door", "wide");
  const r1 = reconcile(doc, v2);
  assert.deepEqual(r1.kept, ["wardrobe.door"]);
  assert.deepEqual(r1.suspended, ["man.hat"]);
  doc = r1.doc;
  assert.equal(values(v2, doc)["man.hat"].source, "code");
  const r2 = reconcile(doc, v1);
  assert.deepEqual(r2.restored, ["man.hat"]);
  assert.equal(values(v1, r2.doc)["man.hat"].kind, "absurd");
});

test("learn: the vocabulary grows, with data of the same shape", () => {
  const root = createRoot(program());
  root.dispatch({ type: "batch", actions: [
    { type: "learn", key: "man.hat", name: "towering", kind: { label: "顶天", words: ["顶天"], data: { hatScale: 2.6 }, learned: "model:weak" } },
    { type: "narrow", key: "man.hat", pick: "towering", from: "said" },
  ] });
  const v = root.get().values["man.hat"];
  assert.deepEqual([v.kind, v.data], ["towering", { hatScale: 2.6 }]);
  assert.ok(v.kinds.includes("towering"));
  root.undo();
  assert.equal(root.get().values["man.hat"].kind, "big");
});

test("the root: watch runs only when what it reads changes; preview commits nothing", () => {
  const root = createRoot(program());
  const seen: string[] = [];
  root.watch((s) => s.values["man.hat"].kind, (k) => seen.push(k));
  root.dispatch({ type: "narrow", key: "wardrobe.door", pick: "wide" });
  root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd" });
  assert.deepEqual(seen, ["absurd"]);
  const p = root.preview([{ type: "narrow", key: "man.hat", pick: "usual" }]);
  assert.equal(p.values["man.hat"].kind, "usual");
  assert.equal(root.get().values["man.hat"].kind, "absurd");
  assert.ok(root.get().log[0].changes.some((c) => c.startsWith("man.hat: big → absurd")));
});

test("effect: eager until a lazy world is written, cached under the kinds it was written for", async () => {
  const p = program();
  let calls = 0;
  const fx = effect<string>({
    deps: ["man.hat"],
    eager: (u) => `placeholder ${u["man.hat"]}`,
    lazy: async (u) => {
      calls++;
      return `drawn ${u["man.hat"]}`;
    },
  });
  const a = values(p, EMPTY_DOC);
  assert.deepEqual(fx.get(a), { world: "placeholder big", source: "eager", pending: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(fx.get(a), { world: "drawn big", source: "written", pending: false });
  const b = values(p, narrow(EMPTY_DOC, "man.hat", "absurd"));
  assert.equal(fx.get(b).source, "eager");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(fx.get(a).world, "drawn big");
  assert.equal(calls, 2);
});

test("check: a program that cannot be read does not evaluate", () => {
  assert.throws(() => Scene({ id: "x", children: [Thing({ id: "a", children: [Intent({ name: "i", of: Size, pick: "nope" as "big" })] })] }), /not a kind/);
  assert.throws(() => Scene({ id: "x", children: [Thing({ id: "a", children: [Intent({ name: "i", of: Size, follows: "b.i" })] })] }), /not a cell/);
});

// -----------------------------------------------------------------------------
// The words library
// -----------------------------------------------------------------------------

const said = (text: string, doc = EMPTY_DOC) => {
  const p = program();
  return recognize(text, { program: p, doc, ctx: {}, values: values(p, doc) });
};

test("words: a kind's words resolve", () => {
  const r = said("站到窗边");
  assert.equal(r.outcome, "resolve");
  assert.deepEqual(r.outcome === "resolve" && r.reading, { key: "man.stand", kind: "window", not: false, via: "kind" });
});

test("words: a step's own words name its intent (门慢一点 is the pace, not the door)", () => {
  const r = said("门慢一点");
  assert.equal(r.outcome === "resolve" && r.reading.key, "wardrobe.pace");
  assert.equal(r.outcome === "resolve" && r.reading.kind, "crawl");
});

test("words: a generic step with nothing named is a question", () => {
  const r = said("大一点");
  assert.equal(r.outcome, "ask");
  assert.deepEqual(r.outcome === "ask" && r.readings.map((x) => x.key).sort(), ["man.hat", "wardrobe.door"]);
});

test("words: naming the intent keeps the reading to it; past its end goes to a model", () => {
  const r = said("帽子大一点", narrow(EMPTY_DOC, "man.hat", "absurd"));
  assert.equal(r.outcome, "infer");
  assert.deepEqual(r.outcome === "infer" && r.need, { kind: "extend", key: "man.hat", dir: 1, text: "帽子大一点" });
});

test("words: a negation outside the kind's words rules it out", () => {
  const r = said("帽子不要大得离谱");
  assert.equal(r.outcome === "resolve" && r.reading.not, true);
});

test("words: about nothing in particular, it is context", () => {
  const r = said("更压抑一点");
  assert.equal(r.outcome, "context");
});

test("observe: the state as a model is shown it", () => {
  const p = program();
  const text = observe({ program: p, doc: EMPTY_DOC, ctx: {}, values: values(p, EMPTY_DOC) });
  assert.match(text, /man\.hat \(hat\) = big \[ask, asking\] · usual 4% · big 52% · absurd 44%/);
});
