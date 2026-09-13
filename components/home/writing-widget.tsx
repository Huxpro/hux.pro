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
// then, under a hairline, every post flagged `featured` in its frontmatter,
// so the evergreen pieces don't scroll out of reach as new ones land. Rows
// echo the /writing list (title + lowercase mono date) and the /works rows
// (date at the muted/50 tier) so the two widgets share one metadata register.
// ---------------------------------------------------------------------------

/** How many of the newest posts are always kept, featured or not. */
const LATEST_COUNT = 3;

export interface WritingSelection {
  /** The newest posts, in date order. */
  latest: BlogPostSummary[];
  /** Curated `featured` posts not already in `latest`, in date order. */
  featured: BlogPostSummary[];
}

export function selectWritingPosts(
  posts: BlogPostSummary[],
  locale: Locale,
): WritingSelection {
  const visible = posts
    .filter((post) => shouldShowPost(post, locale, false))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = visible.slice(0, LATEST_COUNT);
  const seen = new Set(latest.map((p) => p.slug));
  const featured = visible.filter((p) => p.featured && !seen.has(p.slug));
  return { latest, featured };
}

export function WritingWidget({ posts }: { posts: BlogPostSummary[] }) {
  const { locale } = useLocale();
  const { latest, featured } = useMemo(
    () => selectWritingPosts(posts, locale),
    [posts, locale],
  );
  if (latest.length === 0 && featured.length === 0) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-2">
        <WidgetTitle>{t(locale, "widgetBlog")}</WidgetTitle>
        <WidgetLink href="/writing" />
      </WidgetHeader>

      <WidgetScrollBody className="max-h-64">
        {latest.map((post) => (
          <PostRow key={post.slug} post={post} locale={locale} />
        ))}

        {featured.length > 0 && (
          <>
            {/* Section break between "what's new" and "what's worth
                reading": a hairline, then the featured label set exactly like
                the widget's own title so it reads as a second heading — the
                same header-to-first-row rhythm as the top of the card. */}
            {latest.length > 0 && (
              <div className="mt-3 pt-4 pb-2 border-t border-border/30">
                <WidgetTitle>{t(locale, "writingFeatured")}</WidgetTitle>
              </div>
            )}
            {featured.map((post) => (
              <PostRow key={post.slug} post={post} locale={locale} />
            ))}
          </>
        )}
      </WidgetScrollBody>
    </WidgetShell>
  );
}

function PostRow({ post, locale }: { post: BlogPostSummary; locale: Locale }) {
  return (
    <Link
      href={getPostHref(post, locale, "/writing")}
      className="snap-start flex items-baseline gap-3 -mx-2 px-2 py-2 rounded-lg transition-colors duration-150 hover:bg-muted/20"
    >
      {/* Titles are the content here, so they wrap (two lines max) instead
          of truncating like a project name would; the date stays on the
          first baseline. */}
      <span className="min-w-0 flex-1 line-clamp-2 text-sm text-foreground">
        {getLocalizedTitle(post, locale)}
      </span>
      <time
        dateTime={post.date}
        className="shrink-0 font-mono text-xs text-muted-foreground/50"
      >
        {formatPostDate(post.date)}
      </time>
    </Link>
  );
}
