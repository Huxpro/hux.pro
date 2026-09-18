"use client";

import { PageLayout } from "@/components/ui/page-layout";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { Info, Languages } from "lucide-react";
import { t } from "@/services";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
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
  const originId = useId();
  const [originOpen, setOriginOpen] = useState(false);

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
  // Two kinds of thing were sharing one line. The date, the reading time and
  // the language switch are handles — a word or two each, to scan and to
  // press. Provenance is a sentence. A sentence set among chips reads as
  // clutter however short it is, and the longest of them wrapped the row onto
  // two lines at every width, stranding a "·" at the end of the first and
  // leaving the "Aa" alone above an empty half-line.
  //
  // So the provenance folds away instead. It keeps the handles' face and its
  // size exactly -- the two things tried before this, a serif aside and a
  // point smaller, each bought quiet by making the header a place where two
  // typographic systems meet, which is the crowding it was meant to fix. A
  // chevron is not a third voice: the row is one line until someone asks it
  // not to be, and when they do the sentence arrives in the voice it always
  // had, one ink rung down because that is what tertiary is for.
  //
  // Folded by default. Provenance is a thing a reader looks up once, if ever;
  // the article is what they came for.
  const hasHandles = !!headerMeta || !!displayReadingTime || hasAlternate;
  const hasHeaderMetaContent = hasHandles || !!displayOrigin;
  /**
   * One row, joined by dots -- the shape the header had before any of this was
   * interactive, and the shape it keeps. That some of these now do something
   * when pressed is not a reason for them to look like a row of buttons: the
   * chips cancel their own padding with a matching negative margin, so every
   * gap along the line is the row's single `gap-2` and nothing sits closer to
   * one neighbour than the other. The chip only paints when pointed at.
   *
   * Two items are width-dependent, and each carries its own dot so no
   * separator is ever left hanging at the end of a line:
   *
   *   the `(i)`   below `md` only, where the provenance has to fold
   *   its dot     `md` and up only, where the provenance is already inline
   */
  const dot = <span aria-hidden className="text-quaternary-foreground">·</span>;
  /** Nothing has been printed yet, so the next item leads without a dot. */
  let printed = false;
  const lead = () => {
    if (!printed) { printed = true; return null; }
    return dot;
  };

  const facts = (
    <>
      {headerMeta && <>{lead()}{headerMeta}</>}
      {displayReadingTime && <>{lead()}<span>{displayReadingTime}</span></>}
    </>
  );

  const langChip = hasAlternate ? (
    <>
      {lead()}
      <HeaderAction variant="action" onClick={switchLanguage}>
        <Languages className="h-3 w-3" />
        <span>{alternateLabel}</span>
      </HeaderAction>
    </>
  ) : null;

  // Left with everything else. It was pushed to the far edge once and that is
  // the one place on the page the ruler also wants.
  const readingChip = toc ? (
    <>
      {lead()}
      <ReadingSettings />
    </>
  ) : null;

  /**
   * Where this text came from, last on the line either way.
   *
   * At `md` and up it is simply there. Below it, the `(i)` stands in its place
   * -- literally: the handle takes the slot the sentence would have had, so
   * the row does not rearrange itself between widths. Pressing it wraps the
   * sentence onto a second line as the row's last item.
   *
   * One dot serves both, because exactly one of them is ever on screen: the
   * `(i)` is `md:hidden`, the sentence is hidden below `md` until asked for.
   * So nothing is left dangling at the end of a line at either width, and
   * there is no second separator to keep in step with the first.
   */
  const provenance = displayOrigin ? (
    <>
      {lead()}
      <HeaderAction
        variant="action"
        className="md:hidden"
        active={originOpen}
        onClick={() => setOriginOpen((v) => !v)}
        expanded={originOpen}
        controls={originId}
        label={t(displayLocale, "postOrigin")}
        title={t(displayLocale, "postOrigin")}
      >
        <Info className="h-3 w-3" />
      </HeaderAction>
      <span
        id={originId}
        className={cn(
          originOpen ? "animate-in fade-in duration-200" : "hidden",
          "md:inline"
        )}
      >
        {renderMarkdownLinks(displayOrigin)}
      </span>
    </>
  ) : null;

  // `relative z-[35]`: the row wraps, so any item can end up near the docked
  // edge on a narrow screen, and the collapsed ruler (z-30) is interactive
  // across a band it paints nothing in. Under the open ruler's backdrop.
  const headerActions =
    hasHeaderMetaContent || toc ? (
      <div
        className={cn(
          "relative z-[35] flex flex-wrap items-center gap-2",
          TYPE.meta
        )}
      >
        {facts}
        {langChip}
        {readingChip}
        {provenance}
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
