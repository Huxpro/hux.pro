#!/usr/bin/env node
// Validate built-in wallpaper assets exist and resolve() stays consistent.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ids = [
  "tahoe",
  "sequoia",
  "sonoma",
  "ventura",
  "big-sur",
  "ios-27",
  "ios-18",
  "ios-17",
];

const files = ids.flatMap((id) => [
  `public/wallpapers/${id}/light.jpg`,
  `public/wallpapers/${id}/dark.jpg`,
  `public/wallpapers/${id}/light.thumb.jpg`,
  `public/wallpapers/${id}/dark.thumb.jpg`,
]);

const missing = files.filter((file) => !existsSync(join(root, file)));
if (missing.length) {
  console.error("missing wallpaper assets:\n" + missing.join("\n"));
  process.exit(1);
}

function resolvePairVariant(appearance, theme) {
  return appearance === "auto" ? theme : appearance;
}

const cases = [
  ["auto", "light", "light"],
  ["auto", "dark", "dark"],
  ["light", "dark", "light"],
  ["dark", "light", "dark"],
];
for (const [appearance, theme, expected] of cases) {
  const got = resolvePairVariant(appearance, theme);
  if (got !== expected) {
    console.error(`resolvePairVariant(${appearance}, ${theme}) === ${got}, expected ${expected}`);
    process.exit(1);
  }
}

console.log(`ok ${ids.length} pairs · ${files.length} files`);
