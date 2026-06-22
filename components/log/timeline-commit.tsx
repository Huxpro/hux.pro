"use client";

/**
 * TimelineCommit — Dense git-log style commit row for /works timeline.
 *
 * Summary: hash · icon · title · [link-icons] ··· date
 * Expanded: subtitle, description, links, tags, stats, commentary, media
 *
 * 3-column grid: [hash | icon | content]. Hash column collapses on small containers.
 * Uses the same shared primitives as CommitCard to ensure visual sync.
 * Consumes NormalizedCommit — fully type-agnostic.
 */

import { useCallback, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { NormalizedCommit } from "./commit-data";
import { commitIcons } from "./icons";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import {
  LinkIcon,
  Description,
  Commentary,
  TagBadges,
  Stats,
} from "./embeds/shared";
import { MediaRenderer } from "./media";

interface TimelineCommitProps {
  data: NormalizedCommit;
  cursorPreview?: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  hideDate?: boolean;
  /** Git-graph rail char to draw in the gutter (`┌`, `│`, `●` or empty). */
  rail?: string;
}

export function TimelineCommit({
  data,
  cursorPreview,
  defaultExpanded = false,
  className,
  hideDate = false,
  rail,
}: TimelineCommitProps) {
  const Icon = commitIcons[data.type];
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasExpandableContent = !!(
    data.description ||
    data.commentary ||
    data.tags.length > 0 ||
    data.stats ||
    data.nonLinkMedia.length > 0
  );

  const handleToggleExpanded = useCallback(() => {
    if (!hasExpandableContent) return;
    setIsExpanded((prev) => !prev);
  }, [hasExpandableContent]);

  const rowOnClick = hasExpandableContent ? handleToggleExpanded : undefined;

  const showCursorPreview = !!cursorPreview && !isExpanded;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
      }
    },
    [],
  );

  const hasRail = !!rail && rail !== "";

  const rowContent = (
    <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
      <span className="hidden @sm:inline font-mono text-xs text-muted-foreground/40 select-all leading-5">
        {data.hash}
      </span>

      <span className="inline-flex items-center h-5">
        <Icon className="w-3 h-3 text-muted-foreground/50" />
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-foreground min-w-0 flex-1">
          {data.title}
          {data.languageBadge && (
            <span className="ml-2 text-xs font-mono text-muted-foreground/40 align-baseline">
              {data.languageBadge}
            </span>
          )}
        </span>

        <div
          className={cn(
            "flex items-center shrink-0",
            isExpanded ? "gap-3" : "gap-1.5",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {data.links.map((link, i) => (
            <a
              key={`link-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <LinkIcon icon={link.icon} />
              {isExpanded && (
                <span className="hidden @sm:inline text-xs">
                  {link.label}
                </span>
              )}
            </a>
          ))}
        </div>

        {hideDate ? (
          data.dateSlotOverride && (
            <span className="font-mono text-xs text-muted-foreground/50 shrink-0 ml-auto">
              {data.dateSlotOverride}
            </span>
          )
        ) : (
          <span className="font-mono text-xs text-muted-foreground/50 shrink-0 ml-auto">
            {data.date}
          </span>
        )}
      </div>

      {data.meta && (
        <div className="col-start-2 @sm:col-start-3 mt-1 text-xs font-mono text-muted-foreground/40">
          {data.meta}
        </div>
      )}

      {isExpanded && (
        <div className="col-start-2 @sm:col-start-3 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {data.subtitle && (
            <div className="text-xs text-muted-foreground/60">
              {data.subtitle}
            </div>
          )}

          {data.nonLinkMedia.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <MediaRenderer
                media={data.nonLinkMedia}
                layout="stack"
                size="default"
              />
            </div>
          )}

          <Description text={data.description} isExpanded />

          {data.commentary && <Commentary text={data.commentary} />}

          {data.tags.length > 0 && <TagBadges items={data.tags} />}

          {data.stats && <Stats {...data.stats} />}
        </div>
      )}

    </div>
  );

  return (
    <div id={data.hash} className={className}>
      <MagneticPreview preview={cursorPreview} enabled={showCursorPreview}>
        <div
          role={rowOnClick ? "button" : undefined}
          tabIndex={rowOnClick ? 0 : undefined}
          onClick={rowOnClick}
          onKeyDown={rowOnClick ? handleKeyDown : undefined}
          className={cn(
            "group relative -mx-3 px-3 py-2.5 rounded-lg transition-colors duration-150",
            rowOnClick ? "cursor-pointer" : "cursor-default",
            "@container hover:bg-muted/20 active:bg-muted/30",
          )}
        >
          {rowContent}
          {/* Right-side rail char: ┐ (role top) / │ (mid) / ┘ (last).
              Drawn as a mono glyph at the row's right edge, aligned to
              the title baseline. */}
          {hasRail && (
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-2.5 font-mono text-xs leading-5 text-muted-foreground/40 select-none"
            >
              {rail}
            </span>
          )}
        </div>
      </MagneticPreview>
    </div>
  );
}
