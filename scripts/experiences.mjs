// =============================================================================
// Make sure the experiences are built before `next dev`.
//
// The experiences (experiences/*, on packages/scene) are Vite pages written
// into public/scenes/<name>/ (gitignored), which the home folder opens as apps
// and the labs frame. `pnpm build` always builds them; `pnpm dev` runs this,
// which builds only when the output is missing or older than its sources.
// For live work on one: `pnpm experiences` (Vite, with hot reload).
// =============================================================================

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { scenes } from "../experiences/scenes.mjs";

const OUTS = scenes().map((name) => `public/scenes/${name}/index.html`);
const SOURCES = ["experiences", "packages/scene/src"];

function newest(dir) {
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
  }
  return latest;
}

const built = Math.min(...OUTS.map((out) => (existsSync(out) ? statSync(out).mtimeMs : 0)));
if (built < Math.max(...SOURCES.map(newest))) {
  console.log(built ? "experiences: sources changed, rebuilding" : "experiences: not built yet, building");
  execSync("pnpm experiences:build", { stdio: "inherit" });
}
