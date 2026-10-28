// =============================================================================
// Inline links: the one piece of markup a commit's text carries.
//
// A commit's `description`, `commentary` and `details` (content/log.json)
// may name things in place, the way a sentence on the About does:
//
//   "I led bringing [Hermes](https://github.com/facebook/hermes) to iOS."
//   "The open-source debut of [Lynx](commit:lynx-framework)."
//
// `[words](target)`, where the target is what a magic link names
// (components/magic-link): a URL or one of this site's paths, a commit
// (`commit:lynx-framework`), one of its media (`commit:wasmcert#1`), or a
// role (`role:meta-engineer`). /works renders each as a magic link, so a page
// named in the prose peeks its card and opens where a cover's page does, and
// the cover it stands for can leave the strip. Everywhere else the text is
// printed plain (`plainInline`): a peek, a widget, the shelf.
//
// Nothing else is markup. Brackets that are not followed by a parenthesised
// target are text, so `[sic]` and `(2019)` stay as written.
//
// Deliberately free of React: the snapshot script reads it to crawl the
// pages a sentence names.
// =============================================================================

export type InlineSpan =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; target: string };

/** What a link's target names, as a magic link's props. */
export type InlineTarget =
  | { href: string }
  | { commit: string; item?: number }
  | { role: string };

const LINK = /\[([^\][]+)\]\(([^()\s]+)\)/g;

/** The text as runs of words and links, in order. */
export function parseInline(source: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;
  for (const m of source.matchAll(LINK)) {
    const at = m.index ?? 0;
    if (at > last) spans.push({ kind: "text", text: source.slice(last, at) });
    spans.push({ kind: "link", text: m[1], target: m[2] });
    last = at + m[0].length;
  }
  if (last < source.length) spans.push({ kind: "text", text: source.slice(last) });
  return spans;
}

/** The text with each link reduced to its words. */
export function plainInline(source: string): string;
export function plainInline(source: string | undefined): string | undefined;
export function plainInline(source: string | undefined): string | undefined {
  return source?.replace(LINK, "$1");
}

/** A link's target, read as what it names. */
export function resolveInlineTarget(target: string): InlineTarget {
  const commit = /^commit:([\w-]+)(?:#(\d+))?$/.exec(target);
  if (commit) {
    return commit[2] === undefined
      ? { commit: commit[1] }
      : { commit: commit[1], item: Number(commit[2]) };
  }
  const role = /^role:([\w-]+)$/.exec(target);
  if (role) return { role: role[1] };
  return { href: target };
}

/** Every external page the text names, for the snapshot to crawl. */
export function inlineHrefs(source: string | undefined): string[] {
  if (!source) return [];
  const urls: string[] = [];
  for (const span of parseInline(source)) {
    if (span.kind !== "link") continue;
    const target = resolveInlineTarget(span.target);
    if ("href" in target && /^https?:/.test(target.href)) urls.push(target.href);
  }
  return urls;
}
