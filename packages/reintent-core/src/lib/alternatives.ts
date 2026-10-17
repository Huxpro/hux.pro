/**
 * The other kinds an intent could take here, each rendered: exactly one intent changed, as if a
 * person had decided it, and kept only when the world it renders is not the one shown now.
 * Built on the core's whatIf and the kinds a component lists in its reads.
 */
import {
  whatIf,
  type Child,
  type Read,
  type RenderOptions,
  type Result,
  type Source,
} from '../core/index';

export type Alternative = { path: string; name: string; kind: unknown; from: unknown; result: Result };

export function alternatives(
  el: Child,
  source: Source,
  now: Result,
  opts: RenderOptions = {},
  only: (r: Read) => boolean = () => true,
): Alternative[] {
  const shown = JSON.stringify(now.tree);
  const out: Alternative[] = [];
  const seen = new Set<string>();
  for (const r of now.trace.reads) {
    if (!r.kinds || r.by === 'unknown' || !r.open || seen.has(r.path) || !only(r)) continue;
    seen.add(r.path);
    for (const kind of r.kinds) {
      if (JSON.stringify(kind) === JSON.stringify(r.value)) continue;
      const result = whatIf(el, source, { [r.path]: kind }, opts);
      if (JSON.stringify(result.tree) !== shown)
        out.push({ path: r.path, name: r.name, kind, from: r.value, result });
    }
  }
  return out;
}
