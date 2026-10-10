// =============================================================================
// Make sure the experiences are built before `next dev`.
//
// The experiences (experiences/*, on packages/scene) are Vite pages written
// into public/dreams/<name>/ (gitignored), which the home folder opens as apps
// and the labs frame. `pnpm build` always builds them; `pnpm dev` runs this,
// which builds only when the output is missing or older than its sources.
// For live work on one: `pnpm experiences` (Vite, with hot reload).
// =============================================================================

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = "public/dreams/wardrobe/index.html";
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

const built = existsSync(OUT) ? statSync(OUT).mtimeMs : 0;
if (built < Math.max(...SOURCES.map(newest))) {
  console.log(built ? "experiences: sources changed, rebuilding" : "experiences: not built yet, building");
  execSync("pnpm experiences:build", { stdio: "inherit" });
}
