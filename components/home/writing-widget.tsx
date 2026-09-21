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
// The posts worth surfacing: the latest few — so the widget always says
// what's new — then every post flagged `featured` in its frontmatter, so the
// evergreen pieces don't fall off the end as new ones land. Rows echo the
// /writing list (title + lowercase mono date) and the /works rows (date at
// the muted/50 tier) so the two widgets share one metadata register.
//
// Featured is a *word in the date slot*, not a section. A hairline and a
// label cost a row of height and a second heading on a card that already has
// one, to say something each row can say for itself.
//
// Under a finger the body is a plain stack of exactly TOUCH_ROWS rows (see
// WidgetScrollBody); under a pointer it is a fixed port holding all of them.
// ---------------------------------------------------------------------------

/** How many of the newest posts are always kept, featured or not. */
const LATEST_COUNT = 3;

/**
 * Rows that fit the pointer's port without it having to scroll: six at 36px
 * inside a 256px max, once the fade's 28px is taken out. Below this the port
 * is not worn at all, because a list that cannot overflow must not reserve
 * room under its last row for a fade that will never run — which is how the
 * card ended up with 28px of nothing under it on a desktop and 12px on a
 * phone.
 */
const PORT_ROWS = 6;

/** Rows a finger sees. The rest are still rendered — they are what the
 *  pointer's port scrolls through — and hidden by a media query. */
const TOUCH_ROWS = 5;

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
  // The marker belongs to the *run*, not the post. A post in the latest run
  // is there because it is new, so its date is the truer answer even when it
  // is also flagged `featured`; a post in the tail is there for no reason
  // other than the flag, so the flag is what the slot should say.
  const rows = useMemo(
    () => [
      ...latest.map((post) => ({ post, marker: false })),
      ...featured.map((post) => ({ post, marker: true })),
    ],
    [latest, featured],
  );
  if (rows.length === 0) return null;

  return (
    <WidgetShell href="/writing">
      <WidgetHeader className="pb-2">
        <WidgetTitle>{t(locale, "widgetBlog")}</WidgetTitle>
        <WidgetLink href="/writing" />
      </WidgetHeader>

      <WidgetScrollBody
        port={rows.length > PORT_ROWS ? "pointer-fine:max-h-64" : undefined}
      >
        {rows.map(({ post, marker }, i) => (
          <PostRow
            key={post.slug}
            post={post}
            locale={locale}
            marker={marker}
            className={i >= TOUCH_ROWS ? "pointer-coarse:hidden" : undefined}
          />
        ))}
      </WidgetScrollBody>
    </WidgetShell>
  );
}

function PostRow({
  post,
  locale,
  marker,
  className,
}: {
  post: BlogPostSummary;
  locale: Locale;
  /** Print `featured` in the date slot instead of the date. */
  marker: boolean;
  className?: string;
}) {
  return (
    <Link
      href={getPostHref(post, locale, "/writing")}
      // `pressable` + `active:` — the row washes on touch-down, not only on
      // hover (which touch devices never see), and eases back on release.
      className={cn(
        "pressable snap-start flex items-baseline gap-3 -mx-2 px-2 py-2 rounded-lg transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
        className,
      )}
    >
      {/* One line, like a project's name on the projects widget. Wrapping
          would make the card's height a function of how long the titles
          happen to be — and a Chinese title against an English one is a
          whole row of difference — where the whole point of a fixed row
          count is that the card is the same size whatever is in it. The
          title in full is one tap away. */}
      <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>
        {getLocalizedTitle(post, locale)}
      </span>
      {/* The date slot carries the marker instead of the date, for the posts
          that are here *because* they are featured: the slot answers why the
          row is on the card, and for those rows the flag is the answer. */}
      {marker ? (
        <span className={cn("shrink-0", TYPE.rowMeta)}>
          {t(locale, "writingFeatured")}
        </span>
      ) : (
        <time dateTime={post.date} className={cn("shrink-0", TYPE.rowMeta)}>
          {formatPostDate(post.date)}
        </time>
      )}
    </Link>
  );
}
