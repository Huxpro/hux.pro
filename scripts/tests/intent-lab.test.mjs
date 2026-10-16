// The Intent Lab's decisions on /dream/forget: what each screen gets, who
// said it, and how a person's choice on one screen moves the others.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCREENS } from "../../app/lab/intent/forget.ts";
import { createLab } from "../../app/lab/intent/model.ts";

const by = Object.fromEntries(SCREENS.map((s) => [s.id, s]));
const axisOf = (lab) => Object.fromEntries(SCREENS.map((s) => [s.id, lab.view("axis", s)().kind]));

test("before anyone decides: the model says what, code says where, and the dream's meaning is asked", () => {
  const lab = createLab();
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "up", landscape: "across", wide: "up" });
  const v = lab.view("axis", by.landscape)();
  assert.equal(v.who, "model");
  assert.equal(v.where, "code");
  assert.deepEqual(lab.questions(by.phone)().map((c) => c.key), ["holding|edge"]);
  assert.equal(lab.view("letgo", by.phone)().who, "model");
  assert.equal(lab.view("holding", by.phone)().who, "code", "unsure: code keeps the dream as written until asked");
  assert.deepEqual(lab.params(by.landscape)().window, { axis: "across" });
});

test("a switch on one screen moves the crossover: wider screens follow, taller ones keep theirs", () => {
  const lab = createLab();
  lab.choose("axis", "across", by.laptop);
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "across", landscape: "across", wide: "across" });
  assert.equal(lab.view("axis", by.wide)().who, "person");
  // Upright on the laptop after all: the crossover moves to the laptop's shape, and only wider ones stay on their side.
  lab.choose("axis", "up", by.laptop);
  assert.deepEqual(axisOf(lab), { phone: "up", tablet: "up", square: "up", laptop: "up", landscape: "across", wide: "across" });
  assert.deepEqual(lab.stored()["axis|window"].pick, { base: "up", below: "across", at: 0.625 });
  // Upright on the widest: every screen taller than it is upright too.
  lab.choose("axis", "up", by.wide);
  assert.deepEqual(new Set(Object.values(axisOf(lab))), new Set(["up"]));
});

test("an answer settles the question everywhere and compiles to the scene's props; undo takes it back", () => {
  const lab = createLab();
  lab.choose("holding", "keeps", by.phone, "asked");
  assert.deepEqual(lab.questions(by.wide)(), []);
  assert.equal(lab.params(by.wide)().edge.erode, 600);
  lab.undo();
  assert.equal(lab.params(by.wide)().edge.erode, 2.6);
  assert.equal(lab.questions(by.wide)().length, 1);
});

test("a screen's props are recomputed only when one of its intents changes", () => {
  const lab = createLab();
  const phone = lab.params(by.phone);
  const before = phone();
  lab.choose("axis", "across", by.laptop);
  assert.equal(phone(), before, "the phone's axis did not change, so its props are the same object");
  lab.choose("dust", "settles", by.laptop);
  assert.notEqual(phone(), before);
});
