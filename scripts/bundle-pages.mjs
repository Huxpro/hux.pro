import { writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await build({
  entryPoints: ['lib/cloudflare/worker.ts'], outfile: 'out/_worker.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
});
// Only request-dependent routing and extensionless OG PNGs enter the Function.
// Everything else (including the homepage and _next assets) is served by Pages.
await writeFile('out/_routes.json', JSON.stringify({
  version: 1,
  include: [
    '/api/*', '/writing/*', '/docs/*', '/works', '/works/*',
    '/vitre', '/vitre/', '/vitre/index.html', '/bezel', '/bezel/*',
    '/editor', '/editor/*', '/opengraph-image', '/prompt/opengraph-image',
    ...Array.from({ length: 10 }, (_, digit) => `/${digit}*`),
  ],
  exclude: [],
}, null, 2));
console.log('Pages deployment ready in out/');
