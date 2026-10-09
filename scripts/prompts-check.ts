#!/usr/bin/env node
// =============================================================================
// prompts-check: hold content/prompts.json to its own rules.
//
//   pnpm prompts:check          errors fail; warnings and suggestions print
//   pnpm prompts:check --all    the suggestions (info) too
//
// The rules are the ones `lib/prompts.ts` states in comments (three voices at
// most under a head, each on its own facet; one shelf per entry; every ref
// lands on an entry; both languages everywhere) plus a few the file cannot
// say about itself (a mark left open, the same sentence twice, an influence
// nothing points at). They live in `lib/prompts-lab.ts`, which the Prompts
// Lab (/lab/prompts) reads too, so the page and this script agree.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { RawPromptsData } from "../lib/prompts.ts";
import { checkPrompts, convictionStats, promptRows, promptVoices } from "../lib/prompts-lab.ts";

const file = path.join(process.cwd(), "content", "prompts.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as RawPromptsData;
const all = process.argv.includes("--all");

const issues = checkPrompts(data);
const rows = promptRows(data);
const stats = convictionStats(data);
const count = (level: string) => issues.filter((i) => i.level === level).length;

console.log(
  `prompts.json: ${data.convictions.length} convictions, ${rows.filter((r) => r.kind !== "instance").length} statements, ` +
    `${rows.filter((r) => r.kind === "instance").length} instances, ${data.influences.length} influences, ` +
    `${promptVoices(data, rows).length} voices`,
);
const full = stats.filter((s) => s.voices >= 3).length;
console.log(`voices: ${full}/${stats.length} heads at three`);

for (const issue of issues) {
  if (issue.level === "info" && !all) continue;
  const tag = issue.level === "error" ? "✗" : issue.level === "warn" ? "!" : "·";
  console.log(`${tag} ${issue.rule.padEnd(16)} ${issue.where.padEnd(14)} ${issue.message.en}`);
}

const hidden = all ? 0 : count("info");
console.log(
  `\n${count("error")} errors, ${count("warn")} warnings, ${count("info")} suggestions` +
    (hidden ? ` (--all to list them)` : ""),
);
process.exit(count("error") ? 1 : 0);
