// Scene files as data, from the command line.
//
//   pnpm scene:check [files...]              every *.scene.tsx under app/ when none are given
//   pnpm scene:patch <file> <id> <prop> <value>
//
// `value` is read as JSON when it parses (2.4, true, [1,2], "words") and as a
// string otherwise.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { checkScene, patchScene } from "../packages/stage/tools/scene";

const scenes = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(path).isDirectory()) return scenes(path);
    return name.endsWith(".scene.tsx") ? [path] : [];
  });

const [command, ...args] = process.argv.slice(2);

if (command === "check") {
  const files = args.length ? args : scenes("app");
  let failed = 0;
  for (const file of files) {
    const problems = checkScene(readFileSync(file, "utf8"), file);
    for (const p of problems) console.error(`${relative(".", file)}:${p.line}:${p.column}  ${p.message}`);
    failed += problems.length;
  }
  console.log(failed ? `${failed} problem${failed === 1 ? "" : "s"}` : `${files.length} scene${files.length === 1 ? "" : "s"}: data only`);
  process.exit(failed ? 1 : 0);
} else if (command === "patch") {
  const [file, id, prop, raw] = args;
  if (!file || !id || !prop || raw === undefined) {
    console.error("pnpm scene:patch <file> <id> <prop> <value>");
    process.exit(2);
  }
  let value: unknown = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    // A bare word is a string.
  }
  const before = readFileSync(file, "utf8");
  let after: string;
  try {
    after = patchScene(before, id, prop, value);
  } catch (error) {
    console.error(`refused: ${(error as Error).message}`);
    process.exit(1);
  }
  writeFileSync(file, after);
  const problems = checkScene(after, file);
  if (problems.length) {
    writeFileSync(file, before);
    console.error(`refused: the patch would leave ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(`${relative(".", file)}: ${id}.${prop} = ${JSON.stringify(value)}`);
} else {
  console.error("pnpm scene:check [files...] | pnpm scene:patch <file> <id> <prop> <value>");
  process.exit(2);
}
