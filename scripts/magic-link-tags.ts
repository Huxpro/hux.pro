/**
 * Every magic link written in the site's MDX (content/**, docs/**), read
 * the way the snapshot scripts need it: which tag, what it names, and where.
 *
 * One reader for both scripts that care (the badge icons
 * (scripts/badge-icon-snapshot.ts: a `<Badge>` must wear its site's icon)
 * and the page cards (scripts/og-snapshot.ts: a link's `href` peeks as its
 * page's card), so they cannot disagree on what a tag says.
 */

import fs from "fs";
import path from "path";

export interface MagicLinkTag {
  /** `Badge` (the pill, which wears an icon) or `MagicLink` (the word). */
  tag: "Badge" | "MagicLink";
  /** Its string attributes: `commit`, `role`, `href`, `icon`… */
  attrs: Record<string, string>;
  /** `content/about/en.mdx:21` */
  where: string;
}

const ROOT = process.cwd();
const SOURCES = [path.join(ROOT, "content"), path.join(ROOT, "docs")];

function mdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return mdxFiles(p);
    return /\.mdx?$/.test(e.name) ? [p] : [];
  });
}

export function collectMagicLinkTags(): MagicLinkTag[] {
  const tags: MagicLinkTag[] = [];
  const tag = /<(Badge|MagicLink)\b([^>]*?)\/?>/g;
  const attr = /(\w+)=(?:"([^"]*)"|\{"([^"]*)"\})/g;
  for (const file of SOURCES.flatMap(mdxFiles)) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(tag)) {
      const attrs: Record<string, string> = {};
      for (const a of m[2].matchAll(attr)) attrs[a[1]] = a[2] ?? a[3];
      // A code sample documenting the syntax is not a link.
      if (Object.values(attrs).some((v) => v.includes("…"))) continue;
      const line = text.slice(0, m.index).split("\n").length;
      tags.push({
        tag: m[1] as MagicLinkTag["tag"],
        attrs,
        where: `${path.relative(ROOT, file)}:${line}`,
      });
    }
  }
  return tags;
}
