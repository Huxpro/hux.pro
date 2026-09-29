// =============================================================================
// Comments — giscus, on this repository's GitHub Discussions.
//
// Why giscus: the comments live where the code does (one Discussion per post,
// in `huxpro/hux.pro`), a reader signs in with the GitHub account they already
// have, and there is no server of ours, no database, no tracker and no ad —
// which is the only kind of comment system a static site with no API routes
// can carry. Utterances did the same on Issues and has gone quiet; Gitalk
// wants an OAuth secret in the browser. Discussions give threads, replies and
// reactions natively.
//
// The widget is giscus's own page in an iframe. We draw the frame and speak
// its postMessage protocol ourselves (`components/post/comments.tsx`) instead
// of loading `client.js`, and dress the inside with our own stylesheets
// (`public/giscus/*.css`), so it reads in the site's ink rather than GitHub's.
//
// Setup, once, on GitHub (see docs/system-comments.md):
//   1. Settings → Features → Discussions: on.
//   2. Install the giscus app on the repository: https://github.com/apps/giscus
//   3. Create a Discussions category "Comments" (Announcement type, so only
//      giscus and maintainers open threads), and put its id below.
// Until `categoryId` is set the comments section renders nothing.
// =============================================================================

import type { Locale } from "@/lib/i18n";

export const GISCUS_ORIGIN = "https://giscus.app";

export const GISCUS = {
  repo: "huxpro/hux.pro",
  /** GraphQL node id of the repository (`node_id` on the REST API). */
  repoId: "R_kgDOQ3muug",
  category: "Comments",
  /**
   * GraphQL node id of the category — from https://giscus.app once the app is
   * installed, or `GET https://giscus.app/api/discussions/categories?repo=…`.
   * Overridable per deployment with `NEXT_PUBLIC_GISCUS_CATEGORY_ID`.
   */
  categoryId: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID || "",
} as const;

export const commentsEnabled = () => GISCUS.categoryId !== "";

/** giscus's locale codes for ours. */
export const GISCUS_LANG: Record<Locale, string> = { en: "en", zh: "zh-CN" };

/**
 * The Discussion a post's comments live in. One per post, whatever language
 * it is read in: `/writing/foo/en` and `/writing/foo/zh` are one conversation,
 * so the key is the slug, not the path.
 */
export const commentTermFor = (slug: string) => `writing/${slug}`;

/** Our stylesheet for the widget, per theme. Absolute: giscus loads it. */
export const giscusThemeUrl = (theme: "light" | "dark") =>
  `${window.location.origin}/giscus/${theme}.css`;
