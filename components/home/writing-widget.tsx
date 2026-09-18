"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetScrollBody,
  WidgetScrollPort,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { sizeSpec } from "@/components/ui/widget-grid";
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
// A collection widget in Android's taxonomy: its job is browsing the
// collection and opening one element of it. What it shows depends on the
// footprint the visitor gave it — the cell decides, the widget adapts:
//
//   h = 1   a headline: the newest post with its excerpt (two of them, side
//           by side, when 2 wide). "What's new", not a list.
//   h ≥ 2   the list: the latest few — so the widget always says what's new
//           — then, under a hairline, every post flagged `featured` in its
//           frontmatter, so the evergreen pieces don't scroll out of reach.
//           From three cells tall the rows carry their excerpt too.
//   w = 2   the two runs stop stacking and sit side by side, each under its
//           own subordinate heading, and every row carries its excerpt —
//           width is spent on words, never on longer rows.
//
// Rows echo the /writing list (title + lowercase mono date) and the /works
// rows (date at the muted/50 tier) so the two widgets share one metadata
// register.
// ---------------------------------------------------------------------------

export const WRITING_WIDGET_SIZE = sizeSpec([1, 1], [2, 3], [1, 2]);

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
  const { w, h } = useWidgetSize(WRITING_WIDGET_SIZE.default);
  const { latest, featured } = useMemo(
    () => selectWritingPosts(posts, locale),
    [posts, locale],
  );
  if (latest.length === 0 && featured.length === 0) return null;

  const wide = w >= 2;
  const excerpt = wide || h >= 3;

  let body: React.ReactNode;
  if (h === 1) {
    const headlines = (latest.length > 0 ? latest : featured).slice(0, wide ? 2 : 1);
    body = (
      <WidgetBody className={cn("grid gap-x-6", wide && "grid-cols-2")}>
        {headlines.map((post) => (
          <Headline key={post.slug} post={post} locale={locale} />
        ))}
      </WidgetBody>
    );
  } else if (wide && featured.length > 0 && latest.length > 0) {
    body = (
      <div className="flex min-h-0 flex-1 gap-x-6 px-5">
        <Column label={t(locale, "writingLatest")} locale={locale}>
          {latest.map((post) => (
            <PostRow key={post.slug} post={post} locale={locale} excerpt />
          ))}
        </Column>
        <Column label={t(locale, "writingFeatured")} locale={locale}>
          {featured.map((post) => (
            <PostRow key={post.slug} post={post} locale={locale} excerpt />
          ))}
        </Column>
      </div>
    );
  } else {
    body = (
      <WidgetScrollBody fill>
        {latest.map((post) => (
          <PostRow key={post.slug} post={post} locale={locale} excerpt={excerpt} />
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
                <SubHeading label={t(locale, "writingFeatured")} />
              </div>
            )}
            {featured.map((post) => (
              <PostRow key={post.slug} post={post} locale={locale} excerpt={excerpt} />
            ))}
          </>
        )}
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

function SubHeading({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "block text-xs text-tertiary-foreground",
        /[぀-ヿ一-鿿]/.test(label) ? "font-mono" : "italic font-serif",
      )}
    >
      {label}
    </span>
  );
}

/** One of the wide widget's two runs: a subordinate heading over its own port. */
function Column({
  label,
  children,
}: {
  label: string;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="pb-1.5">
        <SubHeading label={label} />
      </div>
      <WidgetScrollPort className="min-h-0 flex-1">{children}</WidgetScrollPort>
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
  excerpt = false,
}: {
  post: BlogPostSummary;
  locale: Locale;
  /** Carry the post's description under the title. */
  excerpt?: boolean;
}) {
  return (
    <Link
      href={getPostHref(post, locale, "/writing")}
      // `pressable` + `active:` — the row washes on touch-down, not only on
      // hover (which touch devices never see), and eases back on release.
      className="pressable snap-start flex flex-col -mx-2 px-2 py-2 rounded-lg transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35"
    >
      <span className="flex items-baseline gap-3">
        {/* Titles are the content here, so they wrap (two lines max) instead
            of truncating like a project name would; the date stays on the
            first baseline. */}
        <span className={cn("min-w-0 flex-1 line-clamp-2", TYPE.rowTitle)}>
          {getLocalizedTitle(post, locale)}
        </span>
        <time dateTime={post.date} className={cn("shrink-0", TYPE.rowMeta)}>
          {formatPostDate(post.date)}
        </time>
      </span>
      {excerpt && post.description && (
        <span className={cn("mt-0.5 line-clamp-1", TYPE.captionQuiet)}>
          {post.description}
        </span>
      )}
    </Link>
  );
}
