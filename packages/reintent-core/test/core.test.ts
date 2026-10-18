/* eslint-disable @typescript-eslint/no-explicit-any -- ported as written (Huxpro/airtalk#845) */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createCache,
  createSource,
  h,
  isUnresolved,
  render,
  scope,
  stale,
  under,
  UNKNOWN,
  useChoice,
  watch,
  whatIf,
  type HostNode,
  type Result,
} from '../src/core/index';
import { choose } from '../src/lib/axis';
import { Reply, ThreadCtx } from './email';

const at = (id: string, hoursLeft: number) => ({
  provide: [[ThreadCtx, { id, hoursLeft }]] as [any, unknown][],
});
const node = (r: Result) => r.tree as HostNode;
const read = (r: Result, name: string) => r.trace.reads.find((x) => x.name === name)!;

test('precedence: a person (this intent > the deck) > a sure model > code, and the model only when sure', () => {
  const src = createSource();
  const el = h(Reply, { key: 'invoice' });
  assert.equal(read(render(el, src, at('t', 10)), 'tone').by, 'unresolved');
  src.write('Reply:invoice#tone', 'model', { formal: 0.55, warm: 0.45 });
  const unsure = read(render(el, src, at('t', 10)), 'tone');
  assert.deepEqual([unsure.by, unsure.value, unsure.ask], ['unresolved', 'warm', true]);
  src.write('Reply:invoice#tone', 'model', { formal: 0.9, warm: 0.1 });
  assert.deepEqual(
    [read(render(el, src, at('t', 10)), 'tone').by, read(render(el, src, at('t', 10)), 'tone').value],
    ['model', 'formal'],
  );
  src.write('tone', 'human', 'warm', { scope: 'deck' });
  assert.deepEqual(
    [read(render(el, src, at('t', 10)), 'tone').by, read(render(el, src, at('t', 10)), 'tone').scope],
    ['human', 'deck'],
  );
  src.write('Reply:invoice#tone', 'human', 'formal');
  assert.deepEqual(node(render(el, src, at('t', 10))).props.tone, 'formal');
  assert.equal(read(render(el, src, at('t', 10)), 'tone').by, 'human');
});

test('a guard is a branch: length is read only in a formal reply', () => {
  const src = createSource({ entries: { 'Reply:r#tone': { human: 'warm' } } });
  const el = h(Reply, { key: 'r' });
  assert.equal(read(render(el, src, at('t', 1)), 'length'), undefined);
  src.write('Reply:r#tone', 'human', 'formal');
  assert.equal(read(render(el, src, at('t', 1)), 'length').value, 'short');
});

test('a partial decision falls through to the next writer outside its segments', () => {
  const src = createSource();
  // Send now when the deadline is under 4 hours away; elsewhere nobody said: code's pick, unresolved.
  src.write('Reply:r#send', 'human', { $axis: 'Thread.hoursLeft', segments: [{ hi: 4, value: 'now' }] });
  const el = h(Reply, { key: 'r' });
  assert.deepEqual(
    [read(render(el, src, at('t', 2)), 'send').value, read(render(el, src, at('t', 2)), 'send').by],
    ['now', 'human'],
  );
  assert.deepEqual(
    [read(render(el, src, at('t', 30)), 'send').value, read(render(el, src, at('t', 30)), 'send').by],
    ['tomorrow', 'unresolved'],
  );
});

test('ruling kinds out leaves the rest to the model and code', () => {
  const src = createSource();
  src.write('Reply:r#tone', 'model', { formal: 0.5, warm: 0.3, curt: 0.2 });
  src.write('Reply:r#tone', 'human', { $not: ['formal'] });
  const r = read(render(h(Reply, { key: 'r' }), src, at('t', 1)), 'tone');
  assert.equal(r.by, 'unresolved'); // warm 0.6 vs curt 0.4: not sure enough
  assert.deepEqual(r.not, ['formal']);
  assert.ok(Math.abs(r.belief!.warm - 0.6) < 1e-9);
});

test('moot here: only a person overrides code', () => {
  const Thing = () => {
    const v = useChoice<'a' | 'b'>('x', { default: 'a', open: false });
    return h(() => null, null, String(isUnresolved(v) ? 'u' : v));
  };
  const src = createSource({ entries: { 'Thing:t#x': { model: { a: 0, b: 1 } } } });
  assert.equal(render(h(Thing, { key: 't' }), src).trace.reads[0].by, 'code');
  src.write('Thing:t#x', 'human', 'b');
  assert.equal(render(h(Thing, { key: 't' }), src).trace.reads[0].value, 'b');
});

test('unknown is not unresolved: a scope held elsewhere reads as unknown', () => {
  const Doc = scope(function Doc(p: { children?: any }) {
    const v = useChoice('x', { default: 1 });
    return h(() => null, null, v === UNKNOWN ? 'unknown' : String(v), p.children);
  });
  const src = createSource();
  src.setUnknown('Doc:d', true);
  const r = render(h(Doc, { key: 'd' }, h(Reply, { key: 'inner' })), src, at('t', 1));
  assert.ok(r.trace.reads.every((x) => x.by === 'unknown'));
});

test('identity: keys are unique within a scope, so a part keeps its intents when it moves', () => {
  const Box = (p: { children?: any }) => p.children;
  const Doc = scope(function Doc(p: { children?: any }) {
    return p.children;
  });
  const src = createSource({ entries: { 'Doc:d/Reply:r#tone': { human: 'formal' } } });
  const before = h(Doc, { key: 'd' }, h(Reply, { key: 'r' }));
  const after = h(Doc, { key: 'd' }, h(Box, { key: 'b' }, h(Reply, { key: 'r' })));
  assert.equal(read(render(before, src, at('t', 1)), 'tone').value, 'formal');
  assert.equal(read(render(after, src, at('t', 1)), 'tone').value, 'formal');
});

test('a component is named by its displayName before its function name (paths survive renaming)', () => {
  const a = (p: { children?: any }) => p.children;
  a.displayName = 'Box';
  scope(a);
  const src = createSource({ entries: { 'Box:b/Reply:r#tone': { human: 'formal' } } });
  assert.equal(
    read(render(h(a, { key: 'b' }, h(Reply, { key: 'r' })), src, at('t', 1)), 'tone').path,
    'Box:b/Reply:r#tone',
  );
});

test('whatIf renders as if decided, without writing', () => {
  const src = createSource();
  const el = h(Reply, { key: 'r' });
  const r = whatIf(el, src, { 'Reply:r#tone': 'formal' }, at('t', 1));
  assert.equal(node(r).props.tone, 'formal');
  assert.equal(src.get('Reply:r#tone'), undefined);
});

test('watch re-runs only on writes to what it read', () => {
  const src = createSource();
  const w = watch(src, () => render(h(Reply, { key: 'r' }), src, at('t', 1)));
  src.write('Reply:other#tone', 'human', 'formal');
  src.write('fit', 'human', 'fill', { scope: 'deck' });
  assert.equal(w.runs, 1);
  src.write('Reply:r#tone', 'human', 'formal');
  assert.equal(w.runs, 2);
  assert.equal(node(w.value).props.tone, 'formal');
  src.write('Reply:r#tone', 'human', 'formal'); // idempotent: no change, no notification
  assert.equal(w.runs, 2);
  w.dispose();
});

test('stamped results: shown while their values hold, back when they hold again, stale when not read', () => {
  const src = createSource();
  const el = h(Reply, { key: 'r' });
  const cache = createCache<string>();
  const r0 = render(el, src, at('t', 1));
  cache.put('draft written while warm', under(r0.trace.reads));
  src.write('Reply:r#tone', 'human', 'formal');
  const r1 = render(el, src, at('t', 1));
  assert.equal(cache.get(r1.trace.reads), undefined);
  assert.deepEqual(stale(cache.get(r0.trace.reads)!, r1.trace.reads), ['Reply:r#tone']);
  src.write('Reply:r#tone', 'human', undefined);
  assert.equal(cache.get(render(el, src, at('t', 1)).trace.reads)?.value, 'draft written while warm');
  // Read nowhere any more (the reply is gone): not shown.
  assert.equal(cache.get([]), undefined);
});

test('choose: a choice spreads along the axis until it meets another', () => {
  let v = choose<string>(undefined, 'S.r', 0.8, 'cols2', 'cols3');
  v = choose(v, 'S.r', 0.46, 'cols1', 'cols3');
  v = choose(v, 'S.r', 0.69, 'cols3', 'cols3');
  const valueAt = (x: number) =>
    v.segments.find((s) => (s.lo ?? -Infinity) <= x && x < (s.hi ?? Infinity))?.value;
  assert.deepEqual([0.3, 0.46, 0.5, 0.69, 0.8, 0.9].map(valueAt), [
    'cols1',
    'cols1',
    'cols2',
    'cols3',
    'cols3',
    undefined,
  ]);
});
