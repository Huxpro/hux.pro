// =============================================================================
// A library on the core: the state as text, for a model. What it is shown is
// exactly this: each cell, its kinds (learned ones marked), its belief, its
// value and who said it, and everything said of the whole.
// =============================================================================

import { kindOf } from "./doc";
import { cells } from "./program";
import type { Snapshot } from "./root";

const pct = (n: number) => Math.round(n * 100);

export function observe(s: Pick<Snapshot, "program" | "doc" | "ctx" | "values">): string {
  const out = [`program ${s.program.id}${s.program.version ? ` @${s.program.version}` : ""}`];
  if (s.ctx.prompts?.length) out.push(`said of the whole: ${s.ctx.prompts.map((p) => `"${p}"`).join(" · ")}`);
  for (const c of cells(s.program)) {
    const v = s.values[c.key];
    if (!v) {
      out.push(`${c.key}: does not apply`);
      continue;
    }
    const kinds = v.kinds.map((k) => {
      const kd = kindOf(c, s.doc, k);
      return `${k}${kd?.learned ? "*" : ""}${v.not.includes(k) ? "✗" : ""} ${pct(v.p[k] ?? 0)}%`;
    });
    out.push(`${c.key} (${c.decl.label ?? c.decl.name}) = ${v.kind} [${v.source}${v.stale ? ", stale" : ""}${v.ask ? ", asking" : ""}] · ${kinds.join(" · ")}`);
  }
  return out.join("\n");
}
