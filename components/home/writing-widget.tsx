"use client";

import {
  WidgetHeader,
  WidgetLink,
  WidgetScrollBody,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import {
  formatPostDate,
  getLocalizedTitle,
  getPostHref,
  shouldShowPost,
  type BlogPostSummary,
} from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { t, useLocale } from "@/services";
import { Link } from "next-view-transitions";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// WritingWidget — the home "writing" card.
//
// A vertical snap stack (same body as the projects widget) of the posts
// worth surfacing: the latest few — so the widget always says what's new —
// plus every post flagged `featured` in its frontmatter, so the evergreen
// pieces don't scroll out of reach as new ones land. The union is sorted by
// date, so it still reads as a timeline rather than two lists stapled
// together. Rows echo the /writing list (title + lowercase mono date) and
// the /works rows (date at the muted/50 tier) so the two widgets share one
// metadata register.
// ---------------------------------------------------------------------------

/** How many of the newest posts are always kept, featured or not. */
const LATEST_COUNT = 3;

export function selectWritingPosts(
  posts: BlogPostSummary[],
  locale: Locale,
): BlogPostSummary[] {
  const visible = posts.filter((post) => shouldShowPost(post, locale, false));
  const picked = new Map<string, BlogPostSummary>();
  for (const post of visible.slice(0, LATEST_COUNT)) picked.set(post.slug, post);
  for (const post of visible) if (post.featured) picked.set(post.slug, post);
  return [...picked.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function WritingWidget({ posts: allPosts }: { posts: BlogPostSummary[] }) {
  const { locale } = useLocale();
  const posts = useMemo(
    () => selectWritingPosts(allPosts, locale),
    [allPosts, locale],
  );
  if (posts.length === 0) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-2">
        <WidgetTitle>{t(locale, "widgetBlog")}</WidgetTitle>
        <WidgetLink href="/writing" />
      </WidgetHeader>

      <WidgetScrollBody className="max-h-64">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={getPostHref(post, locale, "/writing")}
            className="snap-start flex items-baseline gap-3 -mx-2 px-2 py-2 rounded-lg transition-colors duration-150 hover:bg-muted/20"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {getLocalizedTitle(post, locale)}
            </span>
            <time
              dateTime={post.date}
              className="shrink-0 font-mono text-xs text-muted-foreground/50"
            >
              {formatPostDate(post.date)}
            </time>
          </Link>
        ))}
      </WidgetScrollBody>
    </WidgetShell>
  );
}
