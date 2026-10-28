import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Build in an isolated tree: next dev and the Vercel rollback build retain
// their API routes and middleware. Only the Pages export removes them.
const stage = resolve('.pages-build');
await rm(stage, { recursive: true, force: true });
await mkdir(stage);
for (const name of ['app', 'components', 'content', 'docs', 'lib', 'packages', 'public', 'services', 'shared', 'systems', 'types', 'tsconfig.json', 'postcss.config.mjs', 'package.json', 'next.config.ts']) {
  await cp(name, `${stage}/${name}`, { recursive: true, filter: (path) => !path.includes('/node_modules') });
}
await symlink(resolve('node_modules'), `${stage}/node_modules`, 'dir');
await rm(`${stage}/app/api`, { recursive: true });
await rm(`${stage}/lib/cloudflare`, { recursive: true });
for (const file of ['app/lab/icon/page.tsx', 'app/lab/works/page.tsx']) {
  const path = `${stage}/${file}`;
  await writeFile(path, (await readFile(path, 'utf8')).replace('"force-dynamic"', '"force-static"'));
}
const docs = `${stage}/app/docs/[...slug]/page.tsx`;
await writeFile(docs, (await readFile(docs, 'utf8')).replace('dynamicParams = true', 'dynamicParams = false'));
for (const file of await readdir(`${stage}/app`, { recursive: true })) {
  if (!file.endsWith('opengraph-image.tsx')) continue;
  const path = `${stage}/app/${file}`;
  await writeFile(path, 'export const dynamic = "force-static";\n' + await readFile(path, 'utf8'));
}
const manifest = `${stage}/app/manifest.ts`;
await writeFile(manifest, 'export const dynamic = "force-static";\n' + await readFile(manifest, 'utf8'));
execFileSync(resolve('node_modules/.bin/next'), ['build'], {
  cwd: stage, stdio: 'inherit', env: { ...process.env, HUX_PAGES_EXPORT: '1' },
});
await rm('out', { recursive: true, force: true });
await cp(`${stage}/out`, 'out', { recursive: true });
await import('./bundle-pages.mjs');
