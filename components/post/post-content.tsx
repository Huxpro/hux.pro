"use client";

import { PageLayout } from "@/components/ui/page-layout";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ReadingSettings } from "./reading-sheet";
import { RulerToc } from "./ruler-toc";
import { usePostLanguage } from "./use-post-language";

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
  const hasHeaderMetaContent =
    !!headerMeta || !!displayReadingTime || hasAlternate || !!displayOrigin;
  const headerMetaRow = (
    <div className={cn("flex items-center gap-2 flex-wrap", TYPE.meta)}>
      {headerMeta}

      {displayReadingTime && (
        <>
          {headerMeta && <span className="text-quaternary-foreground">·</span>}
          <span>{displayReadingTime}</span>
        </>
      )}

      {hasAlternate && (
        <>
          {(headerMeta || displayReadingTime) && (
            <span className="text-quaternary-foreground">·</span>
          )}
          <button
            onClick={switchLanguage}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          >
            <Languages className="h-3 w-3" />
            <span>{alternateLabel}</span>
          </button>
        </>
      )}

      {displayOrigin && (
        <>
          <span className="text-quaternary-foreground">·</span>
          <span>{renderMarkdownLinks(displayOrigin)}</span>
        </>
      )}
    </div>
  );

  // The "Aa" belongs to the pages that are actually read end to end — the same
  // ones the ruler tracks. It rides in the header's action slot, where the
  // list pages keep their language filter, so no new floating layer is added
  // to the article.
  const headerActions =
    hasHeaderMetaContent || toc ? (
      <div className="flex items-start gap-3">
        {hasHeaderMetaContent && <div className="min-w-0">{headerMetaRow}</div>}
        {toc && <ReadingSettings className="-mt-1 ml-auto" />}
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
      {toc && <RulerToc />}
    </PageLayout>
  );
}
