"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetScrollBody,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import type { WidgetSize } from "@/components/ui/widget-size";
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
// WritingWidget — the home "writing" card, in two sizes.
//
//   medium  what's new: the newest post alone, with its description — the
//           one thing this card can say in a single row's height, said with
//           room to breathe. Tap the post to read it; the card opens the
//           list. Not the large with fewer rows: a row is a title and a
//           date, a hero is a title, a date and what the piece is about.
//   large   what's worth reading, below.
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
// WidgetScrollBody); under a pointer it is a port holding all of them. On
// the board the port is the cell, not a fixed 256px.
// ---------------------------------------------------------------------------

export const WRITING_WIDGET_SIZES: readonly WidgetSize[] = ["medium", "large"];

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

export function WritingWidget({
  posts,
  size = "large",
}: {
  posts: BlogPostSummary[];
  size?: WidgetSize;
}) {
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

  if (size === "medium") {
    const post = rows[0].post;
    return (
      <WidgetShell accent="orange" href="/writing">
        <WidgetHeader className="pb-2">
          <WidgetTitle>{t(locale, "widgetBlog")}</WidgetTitle>
          <WidgetLink href="/writing" />
        </WidgetHeader>
        <WidgetBody fill className="justify-end">
          <Link
            href={getPostHref(post, locale, "/writing")}
            className="pressable -mx-2 block rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35"
          >
            <div className={cn("flex items-center gap-2 skin-apple:text-[13px] skin-apple:capitalize", TYPE.rowMeta)}>
              <span>{t(locale, "widgetLatest")}</span>
              <span aria-hidden className="text-quaternary-foreground">
                ·
              </span>
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            </div>
            {/* Apple skin: the headline a medium News or Notes widget sets —
                17 semibold, the one large line on the card. */}
            <div
              className={cn(
                "mt-1 line-clamp-2",
                TYPE.rowTitle,
                "skin-apple:text-[17px] skin-apple:font-semibold skin-apple:leading-[22px]",
              )}
            >
              {getLocalizedTitle(post, locale)}
            </div>
            {post.description && (
              <p
                className={cn(
                  "mt-1 line-clamp-1 @min-[360px]:line-clamp-2",
                  TYPE.captionQuiet,
                  "skin-apple:text-[13px] skin-apple:leading-4",
                )}
              >
                {post.description}
              </p>
            )}
          </Link>
        </WidgetBody>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell accent="orange" href="/writing">
      <WidgetHeader className="pb-2">
        <WidgetTitle>{t(locale, "widgetBlog")}</WidgetTitle>
        <WidgetLink href="/writing" />
      </WidgetHeader>

      <WidgetScrollBody
        fill
        port={rows.length > PORT_ROWS ? "pointer-fine:max-h-64" : undefined}
      >
        {rows.map(({ post, marker }, i) =>
          i === 0 ? (
            // Apple skin: the large card leads with the newest post as a
            // headline — title, date and what it is about — and lists the
            // rest under it. The HIG's "larger sizes support additional
            // layers of information": the list is the same list, the lead
            // is the layer a medium has no room for. Classic keeps a row.
            <div key={post.slug}>
              <PostHero post={post} locale={locale} />
              <PostRow
                post={post}
                locale={locale}
                marker={marker}
                className="skin-apple:hidden"
              />
            </div>
          ) : (
            <PostRow
              key={post.slug}
              post={post}
              locale={locale}
              marker={marker}
              className={i >= TOUCH_ROWS ? "pointer-coarse:hidden" : undefined}
            />
          ),
        )}
      </WidgetScrollBody>
    </WidgetShell>
  );
}

/** Apple skin only: the newest post, set as the large card's headline. */
function PostHero({ post, locale }: { post: BlogPostSummary; locale: Locale }) {
  return (
    <Link
      href={getPostHref(post, locale, "/writing")}
      className={cn(
        "pressable relative -mx-2 hidden rounded-lg px-2 pb-3 pt-1 transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35 skin-apple:block",
        "after:absolute after:inset-x-2 after:bottom-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-(--apple-separator)",
      )}
    >
      <div className={cn("text-[13px] capitalize", TYPE.rowMeta)}>
        {t(locale, "widgetLatest")} ·{" "}
        <time dateTime={post.date}>{formatPostDate(post.date)}</time>
      </div>
      <div className="mt-1 line-clamp-2 text-[17px] font-semibold leading-[22px] text-foreground">
        {getLocalizedTitle(post, locale)}
      </div>
      {post.description && (
        <p className="mt-1 line-clamp-2 text-[13px] leading-4 text-muted-foreground">
          {post.description}
        </p>
      )}
    </Link>
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
        // Apple skin: a list the way Reminders and Notes draw one — rows a
        // little taller, divided by hairlines inset to the text.
        "relative skin-apple:py-2.5",
        "skin-apple:after:absolute skin-apple:after:inset-x-2 skin-apple:after:bottom-0 skin-apple:after:h-px skin-apple:after:bg-(--apple-separator) skin-apple:after:origin-bottom skin-apple:after:scale-y-50 skin-apple:last:after:hidden",
        className,
      )}
    >
      {/* One line, like a project's name on the projects widget. Wrapping
          would make the card's height a function of how long the titles
          happen to be — and a Chinese title against an English one is a
          whole row of difference — where the whole point of a fixed row
          count is that the card is the same size whatever is in it. The
          title in full is one tap away. */}
      <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle, "skin-apple:text-[15px]")}>
        {getLocalizedTitle(post, locale)}
      </span>
      {/* The date slot carries the marker instead of the date, for the posts
          that are here *because* they are featured: the slot answers why the
          row is on the card, and for those rows the flag is the answer. */}
      {marker ? (
        <span className={cn("shrink-0", TYPE.rowMeta, "skin-apple:text-[13px] skin-apple:capitalize")}>
          {t(locale, "writingFeatured")}
        </span>
      ) : (
        <time dateTime={post.date} className={cn("shrink-0", TYPE.rowMeta, "skin-apple:text-[13px] skin-apple:capitalize")}>
          {formatPostDate(post.date)}
        </time>
      )}
    </Link>
  );
}
