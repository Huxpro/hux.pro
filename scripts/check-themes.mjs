#!/usr/bin/env node
// =============================================================================
// themes:check — keeps the OS theme layers from leaking into each other.
//
//   1. Every rule in a theme overlay (app/themes/<id>/*.css) is scoped to
//      `:root[data-os-theme="<id>"]`, so removing the attribute is a
//      complete revert and the Hux theme never sees the overlay.
//   2. Every overlay is imported by app/globals.css.
//   3. Nothing outside an overlay styles a theme by attribute: the Hux
//      stylesheet stays theme-agnostic, and small per-element differences
//      go through the `android:` / `hux:` / `m3:` variants.
//   4. Components branch on a theme's metadata (`useOsTheme().meta`,
//      `currentThemeMetadata()`), never on its id — the registry is the
//      only place that knows which theme does what.
//   5. No raw colour in product code: a palette class (`bg-white/80`,
//      `text-zinc-500`) or a colour literal in a class (`bg-[#ff5f57]`) is a
//      value no theme can reach — use a token (the ladder, or the fixed and
//      status tokens: on-media, scrim, plate, success, live, info, brand-*,
//      …; app/globals.css). The count is ratcheted per file against
//      scripts/theme-leaks.json, which is empty: every product file is at
//      zero, and stays there.
//      (The editor's labs under app/editor are exempt: they are instruments.)
//
// Plain Node, filesystem only. See docs/system-os-theme.md.
// =============================================================================

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const errors = [];
const rel = (p) => relative(ROOT, p);

function walk(dir, exts, skip = []) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (skip.some((s) => p.startsWith(join(ROOT, s)))) continue;
    if (name === "node_modules" || name.startsWith(".")) continue;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, exts, skip));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

/** Top-level-comma split, ignoring commas inside (), [] and strings. */
function splitSelectors(prelude) {
  const parts = [];
  let depth = 0, quote = null, cur = "";
  for (const ch of prelude) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** Visit every style rule's selector list, with the at-rules around it. */
function visitRules(css, onRule) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  let i = 0;
  const stack = [];
  let buf = "";
  let quote = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) { buf += ch; if (ch === quote) quote = null; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; i++; continue; }
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      const line = src.slice(0, i).split("\n").length;
      if (prelude.startsWith("@")) {
        stack.push(prelude.split(/\s/)[0]);
      } else {
        const inKeyframes = stack.includes("@keyframes");
        if (!inKeyframes) onRule(prelude, line, [...stack]);
        stack.push("rule");
      }
      i++;
      continue;
    }
    if (ch === "}") { stack.pop(); buf = ""; i++; continue; }
    if (ch === ";") { buf = ""; i++; continue; }
    buf += ch;
    i++;
  }
}

// --- 1 & 2: overlays ---------------------------------------------------------
const themesDir = join(ROOT, "app/themes");
const globals = readFileSync(join(ROOT, "app/globals.css"), "utf8");
for (const id of readdirSync(themesDir)) {
  const dir = join(themesDir, id);
  if (!statSync(dir).isDirectory()) continue;
  if (!globals.includes(`@import "./themes/${id}/index.css";`)) {
    errors.push(`app/globals.css does not import the ${id} overlay (app/themes/${id}/index.css)`);
  }
  const scope = new RegExp(`^:root(\\.[\\w-]+)*\\[data-os-theme="${id}"\\]`);
  for (const file of walk(dir, [".css"])) {
    visitRules(readFileSync(file, "utf8"), (prelude, line) => {
      for (const sel of splitSelectors(prelude)) {
        if (!scope.test(sel)) {
          errors.push(`${rel(file)}:${line}: selector not scoped to :root[data-os-theme="${id}"]: ${sel}`);
        }
      }
    });
  }
}

// --- 3: no theme styling outside an overlay ----------------------------------
for (const file of walk(join(ROOT, "app"), [".css"], ["app/themes"])) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  visitRules(css, (prelude, line) => {
    if (/data-os-theme|data-skin/.test(prelude)) {
      errors.push(`${rel(file)}:${line}: theme selector outside an overlay (move it to app/themes/<id>/): ${prelude}`);
    }
  });
}

// --- 4: branch on metadata, not ids -------------------------------------------
const OWNERS = ["systems/os/themes", "systems/os/lib", "services/os-theme.tsx", "scripts"];
const ID_BRANCH = /(?:theme|osTheme|os\.theme|currentOsTheme\(\))\s*[!=]==?\s*["'](?:hux|android)["']|dataset\.(?:osTheme|skin)\b|data-skin/;
for (const file of walk(ROOT, [".ts", ".tsx"], ["node_modules", ".next", "out", ...OWNERS])) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((l, n) => {
    if (ID_BRANCH.test(l)) {
      errors.push(`${rel(file)}:${n + 1}: branches on a theme id — read the theme's metadata instead: ${l.trim()}`);
    }
  });
}

// --- 5: the leak ratchet ------------------------------------------------------
// A palette colour (`bg-white/80`, `text-zinc-500`) or a colour literal in
// an arbitrary value (`bg-[#ff5f57]`, `shadow-[0_1px_2px_rgb(0_0_0/.3)]`).
const RAW_COLOUR =
  /(?<![\w-])(?:text|bg|border|ring|fill|stroke|from|to|via|shadow|outline|divide|decoration|caret)-(?:white|black|(?:neutral|zinc|gray|slate|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b|-\[[^\]\s]*(?:#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\()/g;
const LEAKS_FILE = join(ROOT, "scripts/theme-leaks.json");
const counts = {};
for (const file of walk(ROOT, [".ts", ".tsx"], ["node_modules", ".next", "out", "app/editor", "scripts"])) {
  const n = (readFileSync(file, "utf8").match(RAW_COLOUR) ?? []).length;
  if (n) counts[rel(file)] = n;
}
if (process.argv.includes("--update")) {
  writeFileSync(LEAKS_FILE, JSON.stringify(counts, null, 2) + "\n");
  console.log(`themes:check — leak baseline written (${Object.values(counts).reduce((a, b) => a + b, 0)} raw colours in ${Object.keys(counts).length} files).`);
} else {
  const baseline = JSON.parse(readFileSync(LEAKS_FILE, "utf8"));
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (n > allowed) {
      errors.push(`${file}: ${n} raw palette colour(s) in classes, baseline ${allowed} — use a token (text-foreground, bg-glass, border-border, …) so a theme can reach it`);
    }
  }
}

if (errors.length) {
  console.error(`themes:check — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("themes:check — overlays scoped, globals theme-agnostic, no id branches.");
