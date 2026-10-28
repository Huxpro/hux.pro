import assert from 'node:assert/strict';
import test from 'node:test';
import { combineContexts, MAX_CONTEXTS } from '../systems/ask/lib/context-policy.ts';
import type { AskContext } from '../systems/ask/lib/tools.ts';
const item = (href: string): AskContext => ({ kind: 'item', title: href, href });
test('all visible attachments fit the server limit, without evicting a selected source', () => {
  const selected = ['/a', '/b', '/c'].map(item);
  assert.equal(MAX_CONTEXTS, 3);
  assert.deepEqual(combineContexts(selected, item('/current')), selected);
});
test('different sections of the same article remain separate sources', () => {
  assert.equal(combineContexts([item('/post#first')], item('/post#second')).length, 2);
});
test('a pointed source replaces only the same automatic location', () => {
  const quote = { ...item('/post#first'), kind: 'quote' as const, text: 'words' };
  assert.deepEqual(combineContexts([quote], item('/post#first')), [quote]);
});
test('removing the automatic page still sends explicitly attached sources', () => {
  assert.deepEqual(combineContexts([item('/other')], null), [item('/other')]);
});
