// The Wardrobe's intent layer, headless: the instance files and intent components as the experience
// runs them (experiences/reintent), driven through a session with the stand-in model. This is what
// /lab/reintent did on the previous core, step by step, held so the port does not regress it.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { HostNode, Read } from "../src/core/index";
import { createSession } from "../src/lib/session";
import { meaning } from "../src/lib/vocab";
import { observe } from "../src/lib/observe";
import V1 from "../../../experiences/reintent/program/v1.tsx";
import V2 from "../../../experiences/reintent/program/v2.tsx";
import * as I1 from "../../../experiences/reintent/intents/v1";
import * as I2 from "../../../experiences/reintent/intents/v2";
import { V1 as B1, V2 as B2 } from "../../../experiences/reintent/beliefs";
import { standIn } from "../../../experiences/reintent/model";

const MAN = "Dream:wardrobe/Man:man";
const WARDROBE = "Dream:wardrobe/Wardrobe:wardrobe";

const session = () =>
  createSession({
    versions: [
      { id: "v1", note: "as written", program: V1, beliefs: B1 },
      { id: "v2", note: "rewritten", program: V2, beliefs: B2 },
    ],
    model: standIn,
  });
type S = ReturnType<typeof session>;
const read = (s: S, path: string) => s.get().reads.find((r) => r.path === path) as Read;
const at = (s: S, name: string) => {
  const r = read(s, name.includes(".") ? `${WARDROBE}#${name.split(".")[1]}` : `${MAN}#${name}`);
  return r && `${String(r.value)}:${r.by}`;
};
const nodes = (s: S) => {
  const dream = s.get().result.tree as HostNode;
  return Object.fromEntries((dream.children as HostNode[]).map((n) => [n.kind, n.props]));
};
const mean = (s: S, thing: "man" | "wardrobe", name: string) => meaning<Record<string, unknown>>(s.get().reads, nodes(s)[thing][name]);

test("every intent component names itself (paths are stored, and a minifier renames functions)", () => {
  for (const c of [...Object.values(I1), ...Object.values(I2)]) assert.ok((c as { displayName?: string }).displayName, String(c));
});

test("as written: what the model was sure of, what code falls back on, and what it asks", () => {
  const s = session();
  assert.deepEqual(
    ["hat", "gaze", "stand", "w.door", "w.pace"].map((n) => at(s, n)),
    ["big:unresolved", "me:model", "bedside:unresolved", "half:model", "slow:model"],
  );
  assert.deepEqual(s.get().asks.map((r) => r.path), [`${MAN}#hat`]);
  assert.deepEqual(mean(s, "man", "hat"), { hatScale: 1.45 });
  assert.deepEqual(mean(s, "wardrobe", "pace"), { over: 6.5 });
});

test("words: steps, a learned kind past the end, a step's own words, kinds by name, a kind that is a refusal", () => {
  const s = session();
  assert.equal(s.say("帽子大一点").outcome, "resolve");
  assert.equal(at(s, "hat"), "absurd:human");
  assert.deepEqual(mean(s, "man", "hat"), { hatScale: 1.95 });
  assert.equal(s.say("帽子还要大").outcome, "infer");
  assert.equal(at(s, "hat"), "more1:human");
  assert.deepEqual(mean(s, "man", "hat"), { hatScale: 2.45 });
  s.say("门慢一点");
  assert.equal(at(s, "w.pace"), "crawl:human");
  s.say("站到窗边");
  assert.equal(at(s, "stand"), "window:human");
  s.say("别看我");
  assert.equal(at(s, "gaze"), "away:human");
  assert.ok(s.observe().includes(`${MAN}#hat (帽子有多大 · the hat) = "more1" [human]`));
});

test("words: a negation outside the kind's words rules it out; a generic step names the hat", () => {
  const s = session();
  s.say("帽子不要大得离谱");
  assert.deepEqual(s.source.get(`${MAN}#hat`)?.human, { $not: ["absurd"] });
  assert.equal(at(s, "hat"), "big:model");
  const t = session();
  const r = t.say("大一点");
  assert.equal(r.outcome === "resolve" && r.reading.path, `${MAN}#hat`);
});

test("said of the whole: the stand-in believes again under it, darker along each scale; undo takes it back", () => {
  const s = session();
  s.say("更压抑一点");
  assert.deepEqual(s.get().said, ["更压抑一点"]);
  assert.equal(at(s, "w.door"), "wide:model");
  assert.deepEqual(s.get().stale, []);
  s.undo();
  assert.deepEqual([s.get().said, at(s, "w.door")], [[], "half:model"]);
});

test("the model rewrites the program: a kind gone waits, a guard drops an intent, a default follows the door; back again", () => {
  const s = session();
  s.say("帽子大得离谱");
  s.say("站到窗边");
  s.use("v2");
  const change = s.get().log[0].program!;
  assert.deepEqual(change.waiting, [`${MAN}#hat`]);
  assert.deepEqual(change.removed, [`${MAN}#gaze`]);
  assert.ok(change.kept.includes(`${MAN}#stand`));
  assert.equal(read(s, `${MAN}#hat`).waiting, "absurd");
  assert.equal(at(s, "hat"), "big:unresolved");
  assert.equal(read(s, `${MAN}#gaze`), undefined);
  // No belief about the pace in the rewrite: its default follows the door.
  s.say("柜门大开");
  assert.deepEqual([at(s, "w.door"), at(s, "w.pace")], ["wide:human", "sudden:unresolved"]);
  assert.deepEqual(mean(s, "wardrobe", "pace"), { over: 2.5 });
  // Away from the window, his gaze is read again, and asked.
  s.say("站到床尾");
  assert.equal(at(s, "gaze"), "me:unresolved");
  assert.ok(s.get().asks.some((r) => r.path === `${MAN}#gaze`));
  s.use("v1");
  assert.deepEqual(s.get().log[0].program!.back, [`${MAN}#hat`]);
  assert.equal(at(s, "hat"), "absurd:human");
});

test("decide, rule out, forget, answer, undo and start over", () => {
  const s = session();
  s.decide(`${MAN}#stand`, "foot");
  s.ruleOut(`${WARDROBE}#door`, "half");
  assert.deepEqual([at(s, "stand"), at(s, "w.door")], ["foot:human", "wide:model"]);
  s.answer({ path: `${MAN}#hat`, kind: "usual", via: "kind" });
  assert.equal(at(s, "hat"), "usual:human");
  s.forget(`${MAN}#hat`);
  assert.equal(at(s, "hat"), "big:unresolved");
  s.undo();
  assert.equal(at(s, "hat"), "usual:human");
  s.reset();
  assert.deepEqual([at(s, "hat"), at(s, "stand"), at(s, "w.door"), s.get().canUndo, s.get().log.length], ["big:unresolved", "bedside:unresolved", "half:model", false, 0]);
});

test("observe: the state as a model is shown it", () => {
  const text = observe(session().get().reads);
  assert.match(text, /Dream:wardrobe\/Man:man#hat \(帽子有多大 · the hat\) = "big" \[unresolved, asking\] · usual 4% · big 52% · absurd 44%/);
});
