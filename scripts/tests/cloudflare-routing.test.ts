import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../lib/cloudflare/worker.ts";

const env = { ASSETS: { async fetch(request: Request) { return new Response(new URL(request.url).pathname); } } };
const get = (path: string, headers: Record<string, string> = {}) => worker.fetch(new Request(`https://hux.pro${path}`, { headers }), env);

test("language redirects honor supported cookies and retain queries", async () => {
  const zh = await get('/writing/pl-chart?from=old', { cookie: 'locale=zh' });
  assert.equal(zh.status, 307);
  assert.equal(zh.headers.get('location'), 'https://hux.pro/writing/pl-chart/zh?from=old');
  assert.equal((await get('/docs/architecture', { cookie: 'locale=invalid' })).headers.get('location'), 'https://hux.pro/docs/architecture/en');
});
test("localized pages, RSC payloads and OG images pass through", async () => {
  for (const path of ['/writing/pl-chart/en', '/writing/pl-chart/en.txt', '/docs/architecture/zh', '/docs/architecture/zh.txt', '/writing/pl-chart/en/opengraph-image']) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), path);
  }
});
test("legacy posts and labs keep their destinations", async () => {
  assert.equal((await get('/2020/07/05/reflection-2020/')).headers.get('location'), 'https://hux.pro/writing/reflection-2020/zh');
  assert.equal((await get('/2000/01/01/old')).headers.get('location'), 'https://huxpro.github.io/2000/01/01/old/');
  assert.equal((await get('/editor/theater-variants')).headers.get('location'), 'https://hux.pro/lab');
  assert.equal((await get('/bezel/index.html')).headers.get('location'), 'https://hux.pro/vitre/index.html');
});
test("Vitre entry follows device, explicit demo entry always works", async () => {
  assert.equal((await get('/vitre')).headers.get('location'), 'https://hux.pro/lab/vitre');
  assert.equal(await (await get('/vitre', { 'user-agent': 'iPhone' })).text(), '/vitre/');
  assert.equal(await (await get('/vitre/index.html')).text(), '/vitre/');
});
test("works query serves the correct OG page and direct reading redirects", async () => {
  assert.equal(await (await get('/works?type=talk')).text(), '/works/talk');
  assert.equal(await (await get('/works?type=project')).text(), '/works/project');
  assert.equal(await (await get('/works?type=invalid')).text(), '/works');
  assert.equal((await get('/works/talk')).headers.get('location'), 'https://hux.pro/works?type=talk');
});
test("production API fails closed without upstream and excludes dev tools", async () => {
  assert.equal((await worker.fetch(new Request('https://hux.pro/api/chat', { method: 'POST' }), env)).status, 503);
  assert.equal((await get('/api/chat')).status, 405);
  assert.equal((await get('/api/log')).status, 404);
  assert.equal((await get('/api/voice')).status, 503);
});

test("AI proxy preserves streaming protocol and request body without forwarding cookies", async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(url.href, 'https://hux-pro.vercel.app/api/chat');
    assert.equal(init.method, 'POST');
    const headers = new Headers(init.headers);
    assert.equal(headers.get('cookie'), null);
    assert.equal(headers.get('authorization'), null);
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(await new Response(init.body).text(), '{"messages":[]}');
    return new Response('data: {"type":"start"}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } });
  });
  const response = await worker.fetch(new Request('https://hux.pro/api/chat', { method: 'POST', body: '{"messages":[]}', headers: { 'content-type': 'application/json', cookie: 'locale=zh', authorization: 'private' } }), { ...env, AI_API_ORIGIN: 'https://hux-pro.vercel.app' });
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(await response.text(), /data: \[DONE\]/);
});
test("voice proxy passes model and bytes, and upstream errors remain errors", async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(url.pathname, '/api/voice');
    assert.equal(new Headers(init.headers).get('x-voice-model'), 'openai/whisper-1');
    assert.equal(await new Response(init.body).text(), 'audio');
    return Response.json({ error: 'Unsupported audio format' }, { status: 415 });
  });
  const response = await worker.fetch(new Request('https://hux.pro/api/voice', { method: 'POST', body: 'audio', headers: { 'x-voice-model': 'openai/whisper-1' } }), { ...env, AI_API_ORIGIN: 'https://hux-pro.vercel.app' });
  assert.equal(response.status, 415);
});
test("upstream redirects and network failures do not escape the proxy", async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { location: 'https://vercel.com/login' } }));
  const target = { ...env, AI_API_ORIGIN: 'https://hux-pro.vercel.app' };
  assert.equal((await worker.fetch(new Request('https://hux.pro/api/voice'), target)).status, 502);
  mock.mock.mockImplementation(async () => { throw new Error('offline'); });
  assert.equal((await worker.fetch(new Request('https://hux.pro/api/voice'), target)).status, 502);
});
