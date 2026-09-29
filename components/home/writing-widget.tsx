"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetScrollBody,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { rowsThatFit, sizeSpec } from "@/components/ui/widget-grid";
import { useWidgetSize } from "@/components/ui/widget-size";
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
// A collection widget in Android's taxonomy, and its footprint (the
// visitor's to change — see docs/system-widget-grid.md) decides what it
// says. No size scrolls: a widget holds still under a finger, so a taller
// footprint prints more rows, never a port.
//
//   h = 1   a headline: the newest post with its excerpt (two abreast when
//           2 wide). "What's new", not a list.
//   h = 2   the list — as many rows as the cell holds.
//   h = 3   the list, each row carrying its excerpt.
//   w = 2   latest and featured stop sharing one column and sit side by
//           side, each under its own name, every row with its excerpt —
//           width is spent on words, never on longer rows.
// ---------------------------------------------------------------------------

export const WRITING_WIDGET_SIZE = sizeSpec([1, 1], [2, 3], [1, 2]);

/** How many of the newest posts are always kept, featured or not. */
const LATEST_COUNT = 3;

/** Header (`pt-5` + title + `pb-2`) and the stack's `pb-3`. */
const CHROME_PX = 56;
/** A title row (`py-2` + one 20px line), and one that carries its excerpt. */
const ROW_PX = 36;
const EXCERPT_ROW_PX = 56;

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
  const { w, h } = useWidgetSize(WRITING_WIDGET_SIZE.default);
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

  const wide = w >= 2;
  let body: React.ReactNode;

  if (h === 1) {
    const headlines = rows.slice(0, wide ? 2 : 1);
    body = (
      <WidgetBody className={cn("grid gap-x-6", wide && "grid-cols-2")}>
        {headlines.map(({ post }) => (
          <Headline key={post.slug} post={post} locale={locale} />
        ))}
      </WidgetBody>
    );
  } else if (wide && latest.length > 0 && featured.length > 0) {
    const fit = rowsThatFit(h, EXCERPT_ROW_PX, CHROME_PX + 20);
    body = (
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-6 overflow-hidden px-5 pb-3">
        <Column label={t(locale, "writingLatest")}>
          {latest.slice(0, fit).map((post) => (
            <PostRow key={post.slug} post={post} locale={locale} excerpt />
          ))}
        </Column>
        <Column label={t(locale, "writingFeatured")}>
          {featured.slice(0, fit).map((post) => (
            <PostRow key={post.slug} post={post} locale={locale} excerpt />
          ))}
        </Column>
      </div>
    );
  } else {
    const excerpt = wide || h >= 3;
    const fit = rowsThatFit(h, excerpt ? EXCERPT_ROW_PX : ROW_PX, CHROME_PX);
    body = (
      <WidgetScrollBody className="min-h-0">
        {rows.slice(0, fit).map(({ post, marker }) => (
          <PostRow
            key={post.slug}
            post={post}
            locale={locale}
            marker={marker}
            excerpt={excerpt}
          />
        ))}
      </WidgetScrollBody>
    );
  }

  return (
    <WidgetShell href="/writing">
      <WidgetHeader className="pb-2">
        <WidgetTitle>{t(locale, "widgetBlog")}</WidgetTitle>
        <WidgetLink href="/writing" />
      </WidgetHeader>
      {body}
    </WidgetShell>
  );
}

/**
 * One of the wide card's two runs. The run is named because, side by side,
 * it is no longer obvious from the date slot why a row is in which column.
 * Subordinate to the card's title: the log's event voice (serif italic;
 * mono for CJK, where italic reads as emphasis), one tier fainter.
 */
function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span
        className={cn(
          "block pb-1 text-xs text-tertiary-foreground",
          /[぀-ヿ一-鿿]/.test(label) ? "font-mono" : "italic font-serif",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** The one-cell-tall representation: the newest post, as a headline. */
function Headline({ post, locale }: { post: BlogPostSummary; locale: Locale }) {
  return (
    <Link
      href={getPostHref(post, locale, "/writing")}
      className="pressable -mx-2 flex min-w-0 flex-col gap-1 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35"
    >
      <span className="line-clamp-2 font-serif text-base leading-snug text-foreground">
        {getLocalizedTitle(post, locale)}
      </span>
      {post.description && (
        <span className={cn("line-clamp-1", TYPE.captionQuiet)}>
          {post.description}
        </span>
      )}
      <time dateTime={post.date} className={TYPE.rowMeta}>
        {formatPostDate(post.date)}
      </time>
    </Link>
  );
}

function PostRow({
  post,
  locale,
  marker = false,
  excerpt = false,
  className,
}: {
  post: BlogPostSummary;
  locale: Locale;
  /** Print `featured` in the date slot instead of the date. */
  marker?: boolean;
  /** Carry the post's description under the title. */
  excerpt?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={getPostHref(post, locale, "/writing")}
      // `pressable` + `active:` — the row washes on touch-down, not only on
      // hover (which touch devices never see), and eases back on release.
      className={cn(
        "pressable snap-start flex flex-col -mx-2 px-2 py-2 rounded-lg transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
        className,
      )}
    >
      <span className="flex items-baseline gap-3">
        {/* One line, like a project's name on the projects widget. Wrapping
            would make the card's height a function of how long the titles
            happen to be; the cell is what decides the height here. The title
            in full is one tap away. */}
        <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>
          {getLocalizedTitle(post, locale)}
        </span>
        {/* The date slot carries the marker instead of the date, for the
            posts that are here *because* they are featured: the slot answers
            why the row is on the card, and for those rows the flag is the
            answer. */}
        {marker ? (
          <span className={cn("shrink-0", TYPE.rowMeta)}>
            {t(locale, "writingFeatured")}
          </span>
        ) : (
          <time dateTime={post.date} className={cn("shrink-0", TYPE.rowMeta)}>
            {formatPostDate(post.date)}
          </time>
        )}
      </span>
      {excerpt && post.description && (
        <span className={cn("mt-0.5 truncate", TYPE.captionQuiet)}>
          {post.description}
        </span>
      )}
    </Link>
  );
}
