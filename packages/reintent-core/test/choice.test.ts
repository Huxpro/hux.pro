// Choices: beliefs given other choices, structural choice (<Choose>), and worlds (a choice map
// with its joint probability) chosen before rendering. The brief is in ./brief.tsx.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSource, render, whatIf, type HostNode, type Result } from '../src/core/index';
import { split, worlds } from '../src/lib/worlds';
import BRIEF from './brief';

const TONE = 'Experience:brief/Title:title#tone';
const DENSITY = 'Experience:brief/Layout:layout#density';
const FORM = 'Experience:brief/Choose:form#form';
const PACE = 'Experience:brief/Storytelling:story#pace';
const DEPTH = 'Experience:brief/ProductDemo:demo#depth';

const read = (r: Result, path: string) => r.trace.reads.find((x) => x.path === path);
const kinds = (r: Result) => {
  const out: Record<string, unknown> = {};
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object' || !('$$host' in n)) return;
    const h = n as HostNode;
    out[h.kind] = h.props.tone ?? h.props.density ?? h.props.chosen ?? h.props.pace ?? h.props.depth ?? h.props.difficulty;
    h.children.forEach(walk);
  };
  walk(r.tree);
  return out;
};
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

// The model's joint over (tone, layout): playful+roomy 0.39, serious+dense 0.35, serious+roomy 0.26.
// As the marginal of the tone and the layout given it:
const correlated = () => {
  const src = createSource();
  src.write(TONE, 'model', { playful: 0.39, serious: 0.61 });
  src.write(DENSITY, 'model', {
    $given: [
      { when: { [TONE]: 'playful' }, p: { roomy: 1, dense: 0 } },
      { when: { [TONE]: 'serious' }, p: { dense: 0.35 / 0.61, roomy: 0.26 / 0.61 } },
    ],
  });
  return src;
};

test('a conditional belief: the case that holds for what was read before it', () => {
  const src = correlated();
  const now = render(BRIEF, src);
  assert.deepEqual([read(now, TONE)!.by, read(now, TONE)!.value], ['model', 'serious']);
  assert.deepEqual(read(now, DENSITY)!.given, { [TONE]: 'serious' });
  near(read(now, DENSITY)!.belief!.dense, 0.35 / 0.61);
  const playful = whatIf(BRIEF, src, { [TONE]: 'playful' });
  assert.deepEqual([read(playful, DENSITY)!.by, read(playful, DENSITY)!.value, read(playful, DENSITY)!.given], ['model', 'roomy', { [TONE]: 'playful' }]);
});

test('a case names only what was read before it; otherwise `else`, or no belief', () => {
  const src = createSource();
  // The tone given the layout: the layout is read after the tone, so no case holds yet.
  src.write(TONE, 'model', { $given: [{ when: { [DENSITY]: 'dense' }, p: { serious: 1, playful: 0 } }], else: { playful: 0.9, serious: 0.1 } });
  const r = read(render(BRIEF, src), TONE)!;
  assert.deepEqual([r.value, r.given], ['playful', undefined]);
  src.write(TONE, 'model', { $given: [{ when: { [DENSITY]: 'dense' }, p: { serious: 1, playful: 0 } }] });
  assert.deepEqual([read(render(BRIEF, src), TONE)!.by, read(render(BRIEF, src), TONE)!.belief], ['unresolved', undefined]);
});

test('settling each intent on its own breaks what goes together; a world keeps it', () => {
  const src = correlated();
  // The render: the model is sure of serious (0.61 vs 0.39), unsure of the layout given it
  // (0.57 vs 0.43), so code's roomy: serious + roomy, the least likely of the three (0.26).
  assert.deepEqual(kinds(render(BRIEF, src)), { experience: undefined, title: 'serious', layout: 'roomy', choice: 'story', story: 'slow' });
  // Greedy, a world at a time: serious, then dense given it.
  const [greedy] = worlds(BRIEF, src, { beam: 1, only: (r) => r.path !== FORM });
  assert.deepEqual(greedy.choices, { [TONE]: 'serious', [DENSITY]: 'dense' });
  near(greedy.p, 0.35);
  // A beam: the likeliest world is the one greedy never reaches.
  const ws = worlds(BRIEF, src, { k: 3, only: (r) => r.path !== FORM });
  assert.deepEqual(ws.map((w) => w.choices), [
    { [TONE]: 'playful', [DENSITY]: 'roomy' },
    { [TONE]: 'serious', [DENSITY]: 'dense' },
    { [TONE]: 'serious', [DENSITY]: 'roomy' },
  ]);
  ws.forEach((w, i) => near(w.p, [0.39, 0.35, 0.26][i]));
  assert.deepEqual(kinds(ws[0].result), { experience: undefined, title: 'playful', layout: 'roomy', choice: 'story', story: 'slow' });
  // Nothing was written: choosing a world is writing its choices.
  assert.equal(src.get(TONE)!.human, undefined);
});

test('<Choose>: one intent over subtrees, and only the chosen one is rendered (or read)', () => {
  const src = createSource();
  src.write(FORM, 'model', { story: 0.45, demo: 0.4, game: 0.15 });
  const now = render(BRIEF, src);
  assert.deepEqual([read(now, FORM)!.by, read(now, FORM)!.value, read(now, FORM)!.kinds], ['unresolved', 'story', ['story', 'demo', 'game']]);
  assert.ok(read(now, PACE) && !read(now, DEPTH));
  const demo = whatIf(BRIEF, src, { [FORM]: 'demo' });
  assert.equal(kinds(demo).demo, 'overview');
  assert.ok(read(demo, DEPTH) && !read(demo, PACE));
  // A keyed alternative keeps its path: what a person decided about it holds across choices.
  src.write(PACE, 'human', 'brisk');
  src.write(FORM, 'human', 'demo');
  src.write(FORM, 'human', 'story');
  assert.equal(kinds(render(BRIEF, src)).story, 'brisk');
  // A choice the program no longer offers waits, like any kind.
  src.write(FORM, 'human', 'film');
  assert.deepEqual([read(render(BRIEF, src), FORM)!.waiting, read(render(BRIEF, src), FORM)!.value], ['film', 'story']);
});

test('worlds branch where the render branches: each form brings its own choices', () => {
  const src = createSource();
  src.write(FORM, 'model', { story: 0.45, demo: 0.4, game: 0.15 });
  src.write(PACE, 'model', { slow: 0.9, brisk: 0.1 });
  src.write(DEPTH, 'model', { overview: 0.5, walkthrough: 0.5 });
  const ws = worlds(BRIEF, src, { k: 4 });
  assert.deepEqual(ws.map((w) => w.choices), [
    { [FORM]: 'story', [PACE]: 'slow' },
    { [FORM]: 'demo', [DEPTH]: 'overview' },
    { [FORM]: 'demo', [DEPTH]: 'walkthrough' },
    { [FORM]: 'game' },
  ]);
  ws.forEach((w, i) => near(w.p, [0.405, 0.2, 0.2, 0.15][i]));
  // One question splits them: the form, with the mass of each answer.
  const q = split(ws)!;
  assert.equal(q.path, FORM);
  assert.deepEqual(q.options.map((o) => [o.kind, o.worlds]), [['story', [0]], ['demo', [1, 2]], ['game', [3]]]);
  near(q.options[1].p, 0.4);
  // A person's decision is not a choice: it holds in every world.
  src.write(FORM, 'human', 'demo');
  assert.ok(worlds(BRIEF, src).every((w) => !(FORM in w.choices) && kinds(w.result).choice === 'demo'));
});
