// Writes the index Ask searches in the browser: public/ask/index.json.
// Generated, not committed; `predev` and `build` run it.
//
//   node --experimental-strip-types --import ./scripts/register-ts.mjs scripts/ask-index.ts
//
// See systems/ask/lib/corpus.ts for the shape and lib/ask-corpus.ts for how
// the site is read into it.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { buildAskIndex } from "../lib/ask-corpus.ts";

const out = join(process.cwd(), "public/ask/index.json");
const index = buildAskIndex();
const json = JSON.stringify(index);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, json);

const kb = (n: number) => `${(n / 1024).toFixed(0)}KB`;
console.log(
  `ask index: ${index.docs.length} docs, ${index.chunks.length} chunks, ` +
    `${kb(Buffer.byteLength(json))} (${kb(gzipSync(json).length)} gzip) → public/ask/index.json`,
);
