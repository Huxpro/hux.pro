/**
 * A project row as a résumé entry — the `resume` flag's data
 * (components/log/works-flags.ts).
 *
 *   [tile]  Lynx Framework  1B+ users                     2023 – Present
 *           Architect · Lynx @ ByteDance                <xuan@bytedance>
 *           lynxjs.org  github.com                          (index only)
 *
 * A resume entry answers three things a git log row does not: what I did on
 * the work (`credit`, authored in content/log.json), how far it went (one
 * stat), and where to see it (its links, by name). Everything here is read
 * out of the commit as it is; the row that prints it is TimelineCommit, as a
 * variation of the project row it already draws, not a second renderer.
 *
 * Derived where the locale is resolved (normalizeCommit), for the same reason
 * `stripItems` is: the renderers are deliberately locale-agnostic.
 */

import { t, type Locale } from "@/lib/i18n";
import {
  localizeOptional,
  type Commit,
  type Media,
} from "@/lib/log";
import { getHostname } from "@/lib/og-core";

export interface ResumeLink {
  /** The site, as a person would say it (`github.com`), or `3 posts`. */
  label: string;
  /** Where it lives, for a modified click and for a crawler. */
  href: string;
  /** Its index in the commit's attachment set (`commit.media`). */
  index: number;
}

export interface ResumeFacts {
  /** What I did on it: `Architect`. The row adds the team after it. */
  credit?: string;
  /** The one number worth printing: `1B+ users`, `★ 220k`. */
  stat?: string;
  /** One per site, in the order the commit lists them. */
  links: ResumeLink[];
}

const COMPACT = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * One stat, the biggest claim first. Stars print as GitHub prints them
 * (`★ 220k`), so the number says where it was counted without a word for
 * it in either language.
 */
function statOf(commit: Commit, locale: Locale): string | undefined {
  if (commit.type !== "project" || !commit.stats) return undefined;
  const { users, stars, downloads } = commit.stats;
  if (users) return t(locale, "logStatUsers").replace("{n}", users);
  if (stars) return `★ ${COMPACT.format(stars).toLowerCase()}`;
  if (downloads) return t(locale, "logStatDownloads").replace("{n}", downloads);
  return undefined;
}

function hrefOf(media: Media, locale: Locale): string {
  if (media.kind === "link") {
    return media.internal?.urls[locale] ?? media.urls?.[locale] ?? media.url;
  }
  return media.url;
}

/**
 * A link's name: its site — or, for one of my own posts, the post's title,
 * since `/writing` three times over would name nothing.
 */
function labelOf(media: Media, locale: Locale): string {
  switch (media.kind) {
    case "video":
      return t(locale, "logRecording");
    case "slides":
      return t(locale, "logSlides");
    case "image":
      return t(locale, "logLinkImage");
    default: {
      if (media.kind === "link" && media.url.startsWith("/")) {
        const preview = media.previews?.[locale] ?? media.preview;
        return preview?.title ?? media.url;
      }
      return getHostname(media.url) ?? media.url;
    }
  }
}

/**
 * The row's links, one per site: react.dev twice over is one place to go,
 * and its first link is the one that says the most. Several of my own posts
 * are one link too — `3 posts`, opening the first, from where the
 * attachments page through the rest — because three titles in a line of
 * metadata is a paragraph.
 */
function linksOf(media: readonly Media[], locale: Locale): ResumeLink[] {
  const seen = new Set<string>();
  const isPost = (m: Media) => m.kind === "link" && m.url.startsWith("/writing/");
  const posts = media.filter(isPost).length;
  return media.flatMap((m, index) => {
    const label =
      posts > 1 && isPost(m)
        ? t(locale, "logLinkPosts").replace("{n}", String(posts))
        : labelOf(m, locale);
    if (seen.has(label)) return [];
    seen.add(label);
    return [{ label, index, href: hrefOf(m, locale) }];
  });
}

export function resumeFacts(commit: Commit, locale: Locale): ResumeFacts {
  return {
    credit: localizeOptional(commit.credit, locale),
    stat: statOf(commit, locale),
    links: linksOf(commit.media ?? [], locale),
  };
}
