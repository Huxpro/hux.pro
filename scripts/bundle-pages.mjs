import { writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await build({
  entryPoints: ['lib/cloudflare/worker.ts'], outfile: 'out/_worker.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
});
await writeFile('out/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: ['/_next/*', '/img/*', '/fonts/*', '/icons/*', '/ask/*', '/vitre/assets/*'] }, null, 2));
console.log('Pages deployment ready in out/');
