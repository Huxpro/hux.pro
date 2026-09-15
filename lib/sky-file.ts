/**
 * Server-side access to `content/sky.json` — the committed Sky Engine config.
 *
 * Node-only (uses `fs`); never imported into client code. The browser reads the
 * same file as a static import in `systems/ambient/lib/scene.ts`, so the site
 * itself needs nothing at runtime; this module exists for the two places that
 * touch the file as a file: the editor page (which reads it at request time,
 * `force-dynamic`, so a save is visible on reload) and the dev save route.
 *
 * Everything goes through `normalizeSkyFile`, exactly like `content/icon.json`:
 * a hand-edited or stale file can never produce a broken sky.
 */

import fs from "fs";
import path from "path";
import {
  normalizeSkyFile,
  type SkyFile,
} from "../systems/ambient/lib/sky-config";

export const SKY_CONFIG_PATH = path.join(process.cwd(), "content", "sky.json");

/** Read + normalize the committed file, falling back to the defaults. */
export function readSkyFile(): SkyFile {
  try {
    return normalizeSkyFile(JSON.parse(fs.readFileSync(SKY_CONFIG_PATH, "utf8")));
  } catch {
    return normalizeSkyFile(undefined);
  }
}

/** Persist a file to `content/sky.json` (pretty, trailing newline). */
export function writeSkyFile(file: unknown): SkyFile {
  const normalized = normalizeSkyFile(file);
  fs.mkdirSync(path.dirname(SKY_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(
    SKY_CONFIG_PATH,
    JSON.stringify(normalized, null, 2) + "\n",
    "utf8"
  );
  return normalized;
}
