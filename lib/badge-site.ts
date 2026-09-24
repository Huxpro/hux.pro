// =============================================================================
// Badge sites — which site's icon a badge wears.
//
// A badge wears the official icon of the thing it names, and a thing's icon is
// its site's: the icon the site itself declares for a home screen (manifest →
// apple-touch-icon → favicon), downloaded once by `pnpm badges:snapshot` into
// public/badge-icons/ and recorded in content/badge-icons.json, keyed by site.
//
// This module is the one rule for "which site", shared by the component
// (components/badge/resolve.ts) and the snapshot script, so the script fetches
// exactly the icons the page will ask for. Plain TypeScript, no React, no
// aliases the Node loader cannot follow.
//
//   commit=   the site in content/badges.json `commits` when one is named there
//             (a project whose first link is an article about it, not its
//             home — Ele.me's PWA is a Medium post, Alitrip is now Fliggy);
//             otherwise the host of its first external attachment.
//   href=     the URL's host. youtu.be is YouTube, twitter.com is X.
//   neither   an app wears its home-screen icon (content/app-icons.json), a
//             path on this site wears this site's icon, and an image wears
//             itself. None of those needs a site.
// =============================================================================

import type { Commit } from "./log";

/** content/badges.json — authored. */
export interface BadgeConfig {
  /** Commit id → the URL of the site that stands for it. */
  commits?: Record<string, string>;
  /** Site key → an icon URL to use instead of discovering one. */
  icons?: Record<string, string>;
}

/** What a badge names, as far as its icon is concerned. */
export interface BadgeSiteSpec {
  commit?: string;
  app?: string;
  href?: string;
  icon?: string;
}

const ALIASES: Record<string, string> = {
  "youtu.be": "youtube.com",
  "m.youtube.com": "youtube.com",
  "twitter.com": "x.com",
  "b23.tv": "bilibili.com",
  "m.bilibili.com": "bilibili.com",
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;

/** A URL's site: its host without `www.`, aliases folded. */
export function siteKey(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  return ALIASES[host] ?? host;
}

/** The address the snapshot crawls for a site: the URL's origin. */
export function siteOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * The URL whose site a badge wears, or null when the badge needs no site
 * icon (an app, an explicit `icon`, a path on this site, an image).
 */
export function badgeSiteUrl(
  spec: BadgeSiteSpec,
  commits: readonly Commit[],
  config: BadgeConfig,
): string | null {
  if (spec.icon || spec.app) return null;
  if (spec.commit) {
    const named = config.commits?.[spec.commit];
    if (named) return named;
    const commit = commits.find((c) => c.id === spec.commit);
    const external = commit?.media?.find((m) => /^https?:/.test(m.url));
    return external?.url ?? null;
  }
  if (spec.href) {
    if (!/^https?:/.test(spec.href)) return null;
    if (IMAGE_EXTENSIONS.test(spec.href)) return null;
    return spec.href;
  }
  return null;
}
