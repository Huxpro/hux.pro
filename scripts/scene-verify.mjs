// =============================================================================
// pnpm scene:verify: build the experiences if needed, open each in a headless
// browser, and run its own verifier (window.__scene.verify()).
//
// For whoever just wrote a scene, a model included: it prints what is wrong
// and what to do about it, and exits 1 if anything is. Needs Playwright with
// a Chromium (a local or a global install); it is not a site dependency.
//
//   pnpm scene:verify                 every experience
//   pnpm scene:verify wardrobe        one (or several)
// =============================================================================

import { execSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { scenes } from "../experiences/scenes.mjs";

const EXPERIENCES = scenes();
const only = process.argv.slice(2);
const names = only.length ? EXPERIENCES.filter((n) => only.includes(n)) : EXPERIENCES;

execSync("node scripts/experiences.mjs", { stdio: "inherit" });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ["playwright", "@playwright/test"]) {
    try { return require(id); } catch {}
  }
  try {
    const root = execSync("npm root -g").toString().trim();
    return require(join(root, "playwright"));
  } catch {}
  console.error("scene:verify needs Playwright (npm i -g playwright, or a local install) with Chromium.");
  process.exit(2);
}

// A static server for public/, so no dev server has to be running.
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join("public", path);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let failed = false;
for (const name of names) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/scenes/${name}/index.html?lang=en`);
  await page.waitForFunction(() => !!window.__scene, null, { timeout: 15000 });
  const report = await page.evaluate(() => window.__scene.verify());
  const ok = report.ok && errors.length === 0;
  failed ||= !ok;
  console.log(`\n${ok ? "✓" : "✗"} ${name}: ${report.checked.stills} stills · ${report.checked.paths} names · ${report.checked.params} params turned · ${report.checked.words} words resolved`);
  for (const e of errors) console.log(`  ✗ [error] ${e}`);
  for (const i of report.issues) console.log(`  ✗ [${i.check}] ${i.message}`);
  for (const p of report.perturbations) console.log(`  ${p.ok ? "✓" : "✗"} ${p.path}.${p.param}${p.kind === "state" ? " (state)" : ""} ${p.from.toFixed(2)}→${p.to.toFixed(2)} moved ${p.moved.join(", ") || "nothing"}`);
  console.log(`  coverage ${report.coverage.map((c) => `${c.still} ${(c.ratio * 100).toFixed(2)}%`).join(" · ")}`);
  const atmos = new Map();
  for (const a of report.atmosphere) atmos.set(a.name, Math.max(atmos.get(a.name) ?? 0, a.ratio));
  if (atmos.size) console.log(`  atmosphere ${[...atmos].map(([n, r]) => `${n} ≤${Math.round(r * 100)}%`).join(" · ")}`);
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
