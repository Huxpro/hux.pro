"use client";

import { PageLayout } from "@/components/ui/page-layout";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, type ReactNode } from "react";
import { ReadingSettings } from "./reading-sheet";
import { RulerToc } from "./ruler-toc";
import { usePostLanguage } from "./use-post-language";

import { HeaderAction } from "@/components/ui/controls";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
interface PostContentProps {
  title: string;
  titleZh?: string;
  locale: Locale;
  language: PostLanguage;
  children: ReactNode;

  readingTime?: string;
  readingTimeZh?: string;

  backHref: string;
  backLabel: string;

  headerMeta?: ReactNode;
  origin?: string;
  originZh?: string;

  /** Show the scroll-driven ruler table of contents */
  toc?: boolean;

  onMount?: (slug: string, title: string, href: string) => void;
}

/**
 * Render a markdown string with inline links as JSX.
 * Supports `[text](url)` syntax only.
 */
function renderMarkdownLinks(md: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(md)) !== null) {
    if (match.index > lastIndex) {
      parts.push(md.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 decoration-muted-foreground/30 hover:text-foreground hover:decoration-foreground/40 transition-colors"
      >
        {match[1]}
      </a>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < md.length) {
    parts.push(md.slice(lastIndex));
  }

  return parts;
}

export function PostContent({
  title,
  titleZh,
  locale,
  language,
  children,
  readingTime,
  readingTimeZh,
  backHref,
  backLabel,
  headerMeta,
  origin,
  originZh,
  toc,
  onMount,
}: PostContentProps) {
  const pathname = usePathname();

  const { displayLocale, switchLanguage, hasAlternate, alternateLabel } =
    usePostLanguage({ locale, language });

  useEffect(() => {
    if (onMount) {
      const segments = pathname.split("/");
      const slug = segments[segments.length - 2] || "";
      onMount(slug, title, pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayTitle = displayLocale === "zh" && titleZh ? titleZh : title;
  const displayReadingTime =
    displayLocale === "zh" && readingTimeZh ? readingTimeZh : readingTime;
  const displayOrigin =
    displayLocale === "zh" && originZh ? originZh : origin;
  // Provenance is a sentence, and a thing a reader looks up once, if ever.
  // Among the header's handles it read as clutter — and on a phone it had to
  // fold behind an `(i)` to fit at all. It is a colophon: it closes the
  // article instead of standing between the title and the text.
  /**
   * One row, joined by dots -- the shape the header had before any of this was
   * interactive, and the shape it keeps. That some of these now do something
   * when pressed is not a reason for them to look like a row of buttons: the
   * chips cancel their own padding with a matching negative margin, so every
   * gap along the line is the row's single `gap-2` and nothing sits closer to
   * one neighbour than the other. The chip only paints when pointed at.
   *
   * The order is the array's order, and the dots fall between whatever
   * survives the filter, so there is never one stranded at the end of a line.
   */
  const items = [
    headerMeta,
    displayReadingTime && <span>{displayReadingTime}</span>,
    hasAlternate && (
      <HeaderAction variant="action" onClick={switchLanguage}>
        <Languages className="h-3 w-3" />
        <span>{alternateLabel}</span>
      </HeaderAction>
    ),
    // Left with everything else. It was pushed to the far edge once, and that
    // is the one place on the page the ruler also wants.
    toc && <ReadingSettings />,
  ].filter(Boolean);

  // `relative z-[35]`: the row wraps, so any item can end up near the docked
  // edge on a narrow screen, and the collapsed ruler (z-30) is interactive
  // across a band it paints nothing in. Under the open ruler's backdrop.
  const headerActions = items.length ? (
    <div
      className={cn(
        "relative z-[35] flex flex-wrap items-center gap-2",
        TYPE.meta,
      )}
    >
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span aria-hidden className="text-quaternary-foreground">
              ·
            </span>
          )}
          {item}
        </Fragment>
      ))}
    </div>
  ) : undefined;

  return (
    <PageLayout
      title={displayTitle}
      backHref={backHref}
      backLabel={backLabel}
      variant="reader"
      headerActions={headerActions}
      className="min-h-screen"
    >
      <div className="prose-article" lang={displayLocale}>
        {children}
      </div>
      {displayOrigin && (
        <p
          lang={displayLocale}
          className={cn("mt-[calc(var(--reading-size)*4)]", TYPE.meta)}
        >
          {renderMarkdownLinks(displayOrigin)}
        </p>
      )}
      {toc && <RulerToc />}
    </PageLayout>
  );
}
