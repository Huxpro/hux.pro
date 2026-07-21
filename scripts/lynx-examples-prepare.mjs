#!/usr/bin/env node
// Regenerates public/lynx-examples/* from the official Lynx example npm packages.
//
// Both the ReactLynx (@lynx-example/*) and Vue-Lynx (@vue-lynx-example/*)
// packages ship a PREBUILT `dist/main.web.bundle` inside their npm tarball, so
// no rspeedy/vue-lynx build step is needed — we just `npm pack` each package,
// extract `package/dist/main.web.bundle`, and copy it into the repo.
//
// No repo dependencies are used (Node ESM + built-ins + `npm` + `tar`).
//
// Usage: node scripts/lynx-examples-prepare.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outRoot = join(repoRoot, 'public', 'lynx-examples');

// The set of examples to vendor. `id` becomes the output dir + public path:
//   public/lynx-examples/<id>/<file>  ->  /lynx-examples/<id>/<file>
// `file` is the web-bundle basename inside `package/dist/` (single-page
// examples ship `main.web.bundle`; multi-page examples ship named bundles).
const EXAMPLES = [
  { id: 'react-hello-world', pkg: '@lynx-example/hello-world', file: 'main.web.bundle' },
  { id: 'react-animation', pkg: '@lynx-example/animation', file: 'keyframe_animation.web.bundle' },
  { id: 'react-bankcards', pkg: '@lynx-example/bankcards', file: 'final.web.bundle' },
  { id: 'vue-hello-world', pkg: '@vue-lynx-example/hello-world', file: 'main.web.bundle' },
  { id: 'vue-todomvc', pkg: '@vue-lynx-example/todomvc', file: 'main.web.bundle' },
];

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), 'lynx-examples-'));
  const results = [];
  try {
    for (const ex of EXAMPLES) {
      try {
        // npm pack prints the produced tarball filename on stdout (last line).
        const out = run('npm', ['pack', ex.pkg, '--silent'], work).trim();
        const tgz = out.split('\n').pop().trim();
        const tgzPath = join(work, tgz);
        const file = ex.file || 'main.web.bundle';
        const member = `package/dist/${file}`;
        // Extract only the web bundle.
        run('tar', ['xzf', tgzPath, '-C', work, member], work);
        const bundle = join(work, 'package', 'dist', file);
        if (!existsSync(bundle)) throw new Error(`no dist/${file} in tarball`);
        const destDir = join(outRoot, ex.id);
        mkdirSync(destDir, { recursive: true });
        const dest = join(destDir, file);
        copyFileSync(bundle, dest);
        // Reset the extracted dir for the next package.
        rmSync(join(work, 'package'), { recursive: true, force: true });
        const bytes = statSync(dest).size;
        results.push({ ...ex, ok: true, bytes });
        console.log(`ok  ${ex.id}  <- ${ex.pkg}  (${bytes} bytes)`);
      } catch (err) {
        results.push({ ...ex, ok: false, error: String(err && err.message || err) });
        console.error(`FAIL ${ex.id}  <- ${ex.pkg}: ${err && err.message || err}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} examples prepared -> ${outRoot}`);
  if (failed.length) process.exitCode = 1;
}

main();
