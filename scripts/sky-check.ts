#!/usr/bin/env node
// =============================================================================
// sky-check — verify the committed Sky Engine config.
//
//   pnpm sky:check
//
// `content/sky.json` is authored in `/editor/sky` and read at build by
// `systems/ambient/lib/scene.ts`. Normalization is forgiving by design — a
// missing or out-of-range field silently falls back to its default so the
// wallpaper always paints something — which means a config can quietly stop
// meaning what it says: a field renamed in `sky-config.ts`, a colour typo, a
// value clamped away, a preset written by an older shape of the config.
//
// This is the check that notices. It normalizes the committed file and fails
// when the result differs from what is on disk, printing every field that
// moved. `pnpm sky:check --write` re-writes the file with the normalized form,
// which is the fix whenever the drift is an intentional schema change.
//
// Runs on Node's own type stripping, through `scripts/register-ts.mjs` — the
// loader that gives plain Node the resolution Next uses — like the other TS
// scripts in this repo. No build step. `sky-config.ts` is a leaf module (no
// React, no Next, no `fs`) by design rather than by necessity: the config is
// plain data, and nothing that reads it should need a framework.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  diffSkyValues,
  normalizeSkyFile,
  SKY_FILE_VERSION,
} from "../systems/ambient/lib/sky-config.ts";

const WRITE = process.argv.includes("--write");
const CONFIG_PATH = path.join(process.cwd(), "content", "sky.json");
const rel = path.relative(process.cwd(), CONFIG_PATH);

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`✗ Missing config: ${rel}`);
    console.error("  Open /editor/sky and save, or restore the file from git.");
    process.exit(1);
  }

  let parsed: unknown;
  const source = fs.readFileSync(CONFIG_PATH, "utf8");
  try {
    parsed = JSON.parse(source);
  } catch (err) {
    console.error(`✗ ${rel} is not valid JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  const normalized = normalizeSkyFile(parsed);
  const issues = diffSkyValues(parsed, normalized);

  if (issues.length > 0) {
    if (WRITE) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalized, null, 2) + "\n", "utf8");
      console.log(`✓ Rewrote ${rel} (${issues.length} field(s) normalized).`);
      return;
    }
    console.error(`✗ ${rel} does not normalize cleanly — ${issues.length} field(s):`);
    for (const issue of issues.slice(0, 40)) {
      const found = issue.found === undefined ? "(not in the config)" : JSON.stringify(issue.found);
      const to =
        issue.normalized === undefined
          ? "(dropped — no such field)"
          : JSON.stringify(issue.normalized);
      console.error(`  · ${issue.path}: ${found} → ${to}`);
    }
    if (issues.length > 40) console.error(`  … and ${issues.length - 40} more`);
    console.error("\nRun `pnpm sky:check --write` to accept the normalized form.");
    process.exit(1);
  }

  // Formatting drift would make every save a noisy diff.
  const expected = JSON.stringify(normalized, null, 2) + "\n";
  if (source !== expected) {
    if (WRITE) {
      fs.writeFileSync(CONFIG_PATH, expected, "utf8");
      console.log(`✓ Reformatted ${rel}.`);
      return;
    }
    console.error(`✗ ${rel} is not in the canonical format (2-space, trailing newline).`);
    console.error("Run `pnpm sky:check --write` to reformat.");
    process.exit(1);
  }

  const presets = normalized.presets.map((p) => p.id);
  console.log(
    `✓ ${rel} normalizes cleanly · v${SKY_FILE_VERSION} · active "${normalized.active}" · ` +
      `${presets.length} preset(s): ${presets.join(", ")}`
  );
}

main();
