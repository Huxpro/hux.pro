import assert from 'node:assert/strict';
import test from 'node:test';
import { requestedAction, siteActionHref } from '../systems/ask/lib/action-policy.ts';
test('only explicit action requests grant navigation or playback', () => {
  for (const q of ['Open the Haskell post', 'Could you please open that section?', '请帮我打开那篇文章', '带我去那段']) assert.ok(requestedAction(q, 'open_page'), q);
  for (const q of ['Play React for Two Threads', 'Please play the talk', '播放这个演讲']) assert.ok(requestedAction(q, 'play'), q);
  for (const q of ['What does open mean?', 'Where can I watch this?', 'Explain how to play it', 'Do not open the page', '不要播放', 'Explain “open the post”', 'OpenAI tools']) {
    assert.equal(requestedAction(q, 'open_page'), false, q);
    assert.equal(requestedAction(q, 'play'), false, q);
  }
});
test('navigation cannot escape the site through URL normalization', () => {
  for (const href of ['//example.com', '/\\example.com', 'https://example.com', 'javascript:alert(1)']) assert.equal(siteActionHref(href, 'https://hux.pro'), null);
  assert.equal(siteActionHref('/works?type=talk#334e032', 'https://hux.pro'), '/works?type=talk#334e032');
});
