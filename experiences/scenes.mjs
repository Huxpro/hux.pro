// The experiences: every folder in experiences/ with an index.html, except
// shared code (common/, and anything starting with "_"). Read by the Vite
// config, the dev check and the verifier, so a new scene needs no registering.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL(".", import.meta.url));

export function scenes() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "common" && !d.name.startsWith("_") && existsSync(join(ROOT, d.name, "index.html")))
    .map((d) => d.name)
    .sort();
}
