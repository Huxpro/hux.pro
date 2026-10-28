// =============================================================================
// Make sure the Vitre demo is built before `next dev`.
//
// The simulator on /lab/vitre is an iframe of the demo build, which Vite
// writes into public/vitre (gitignored) and next.config.ts serves at /vitre.
// `pnpm build` always builds it; `pnpm dev` runs this instead, which builds it
// only when it is missing or older than its sources. A fresh clone gets a
// working phone, and a warm one starts without the extra seconds.
//
// The demo has no hot reload inside the site: after editing the package or
// its site, run `pnpm vitre:site:build` (or restart dev), or work on the demo
// alone with `pnpm vitre:site`.
// =============================================================================

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = "public/vitre/index.html";
const SOURCES = ["packages/vitre/src", "packages/vitre/site"];

function newest(dir) {
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
  }
  return latest;
}

const built = existsSync(OUT) ? statSync(OUT).mtimeMs : 0;
const sources = Math.max(...SOURCES.map(newest));

if (built < sources) {
  console.log(built ? "vitre demo: sources changed, rebuilding" : "vitre demo: not built yet, building");
  execSync("pnpm vitre:site:build", { stdio: "inherit" });
}
