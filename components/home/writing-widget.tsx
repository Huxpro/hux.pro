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
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Link } from "next-view-transitions";
import { useMemo } from "react";

import { TYPE } from "@/lib/typography";
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
    <WidgetShell href="/writing">
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
                reading". The label is a *subordinate* heading, not a second
                widget title: the log's event-row voice (serif italic; mono
                for CJK, where italic reads as emphasis) one tier fainter
                than an event, on the header-to-first-row rhythm of the card
                so the featured run reads as a second paragraph. */}
            {latest.length > 0 && (
              <div className="mt-3 pt-4 pb-1.5 border-t border-border/30">
                <span
                  className={cn(
                    "block text-xs text-tertiary-foreground",
                    /[぀-ヿ一-鿿]/.test(t(locale, "writingFeatured"))
                      ? "font-mono"
                      : "italic font-serif",
                  )}
                >
                  {t(locale, "writingFeatured")}
                </span>
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
      // `pressable` + `active:` — the row washes on touch-down, not only on
      // hover (which touch devices never see), and eases back on release.
      className="pressable snap-start flex items-baseline gap-3 -mx-2 px-2 py-2 rounded-lg transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35"
    >
      {/* Titles are the content here, so they wrap (two lines max) instead
          of truncating like a project name would; the date stays on the
          first baseline. */}
      <span className={cn("min-w-0 flex-1 line-clamp-2", TYPE.rowTitle)}>
        {getLocalizedTitle(post, locale)}
      </span>
      <time
        dateTime={post.date}
        className={cn("shrink-0", TYPE.rowMeta)}
      >
        {formatPostDate(post.date)}
      </time>
    </Link>
  );
}
