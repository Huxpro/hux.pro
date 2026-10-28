import assert from 'node:assert/strict';
import test from 'node:test';
import { selectionPosition, quoteLabel } from '../systems/ask/lib/selection-layout.ts';
const viewport = { left: 0, top: 0, width: 390, height: 844 };
test('touch action is above an upper-half selection, below a lower-half one', () => {
  assert.equal(selectionPosition({ left: 40, right: 300, top: 200, bottom: 240 }, viewport, 120, 32, true).y, 160);
  assert.equal(selectionPosition({ left: 40, right: 300, top: 600, bottom: 640 }, viewport, 120, 32, true).y, 648);
});
test('action stays in the visual viewport with keyboard, zoom or edge selection', () => {
  const view = { left: 40, top: 100, width: 300, height: 300 };
  const p = selectionPosition({ left: 320, right: 360, top: 105, bottom: 130 }, view, 120, 32, true);
  assert.equal(p.x, 212);
  assert.equal(p.y, 138);
});
test('desktop action follows the selection below, falling above at the bottom', () => {
  assert.equal(selectionPosition({ left: 40, right: 300, top: 200, bottom: 240 }, viewport, 120, 32, false).y, 248);
  assert.equal(selectionPosition({ left: 40, right: 300, top: 800, bottom: 825 }, viewport, 120, 32, false).y, 760);
});
test('quote labels retain both ends without splitting unicode characters', () => {
  assert.equal(quoteLabel('  short\nquote '), 'short quote');
  const text = '头'.repeat(30) + '😀'.repeat(30) + '尾'.repeat(20);
  assert.equal(quoteLabel(text), '头'.repeat(26) + ' … ' + '尾'.repeat(18));
});
