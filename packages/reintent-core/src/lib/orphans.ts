/**
 * Decisions no render reads any more: the part they were about is gone (a model rewrote the
 * structure, a block was deleted). Reported, never dropped: the host decides what to do.
 */
import type { Result, Source } from '../core/index';

export function orphans(source: Source, results: Result[], within = ''): string[] {
  const read = new Set(results.flatMap((r) => r.trace.reads.map((x) => x.path)));
  return source.decided().filter((p) => p.startsWith(within) && !read.has(p));
}
