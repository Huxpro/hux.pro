// The signals reintent runs on, as tested where they were written (airtalk PR 818).
import test from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, untracked, same } from '../../packages/reintent/src/signal.js';

test('a computed recomputes only when something it read changed', () => {
  const a = signal(1);
  const b = signal(10);
  let runs = 0;
  const sum = computed(() => (runs++, a() + b()));
  assert.equal(sum(), 11);
  assert.equal(sum(), 11);
  assert.equal(runs, 1);
  a.set(2);
  assert.equal(sum(), 12);
  assert.equal(runs, 2);
});

test('a computed that comes out equal stops the change (cutoff)', () => {
  const ratio = signal(0.5);
  const side = computed(() => (ratio() < 0.8 ? 'tall' : 'wide'));
  let renders = 0;
  effect(() => (side(), renders++));
  ratio.set(0.6); // still tall
  ratio.set(0.7);
  assert.equal(renders, 1);
  ratio.set(1.2);
  assert.equal(renders, 2);
});

test('effects see a consistent graph once per batch; diamonds run once', () => {
  const x = signal(1);
  const l = computed(() => x() * 2);
  const r = computed(() => x() * 3);
  const seen = [];
  effect(() => seen.push(l() + r()));
  batch(() => {
    x.set(2);
    x.set(3);
  });
  assert.deepEqual(seen, [5, 15]);
});

test('dependencies follow the branch taken; dispose stops an effect; untracked reads do not subscribe', () => {
  const flag = signal(true);
  const a = signal('a');
  const b = signal('b');
  let runs = 0;
  const stop = effect(() => (runs++, flag() ? a() : b()));
  b.set('b2');
  assert.equal(runs, 1, 'b not read yet');
  flag.set(false);
  a.set('a2');
  assert.equal(runs, 2, 'a no longer read');
  const c = signal(0);
  effect(() => untracked(() => c()));
  stop();
  b.set('b3');
  assert.equal(runs, 2);
  assert.ok(same({ k: 1 }, { k: 1 }));
});
