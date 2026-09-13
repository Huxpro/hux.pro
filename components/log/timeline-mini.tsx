"use client";

/**
 * TimelineMini — Minimized git-log row for widget-sized timelines.
 *
 * A trimmed-down `TimelineCommit`: same icon column + tenure rail, same
 * title / link-pill / date summary line and `<handle>` byline, same
 * expanded `git log --pretty=fuller` author block — minus everything that
 * needs page-width real estate (hash column, cursor peek, pinned/expanded
 * media, inspect mode). Tapping a row folds the author / description
 * block in and out; attachments, tags and stats never render here.
 *
 * Consumes NormalizedCommit — fully type-agnostic.
 */

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { Byline } from "./bylines";
import type { NormalizedCommit } from "./commit-data";
import { commitIcons, commitIconOverrides } from "./icons";
import { LinkIcon, Description } from "./embeds/shared";

const DEFAULT_AUTHOR_HANDLE = "hux";

interface TimelineMiniProps {
  data: NormalizedCommit;
  /** Git-graph rail char for the icon column (`┐`, `│`, `┘` or empty). */
  rail?: string;
  /** True when this row IS a role that anchors its tenure segment. */
  isRole?: boolean;
  /** Pre-localized author byline (see `computeBylines`). */
  byline?: Byline | null;
  hideDate?: boolean;
  className?: string;
}

export function TimelineMini({
  data,
  rail = "",
  isRole = false,
  byline = null,
  hideDate = false,
  className,
}: TimelineMiniProps) {
  const Icon =
    (data.iconOverride && commitIconOverrides[data.iconOverride]) ||
    commitIcons[data.type];
  const isEvent = data.type === "event";
  const [isExpanded, setIsExpanded] = useState(false);

  // Attachments never render here, so the pills that merely proxy a link
  // card (`redundantWhenExpanded`) go too — what's left are the commit's
  // real outbound links (website / GitHub / platform), which keeps narrow
  // rows from drowning the title in globes.
  const links = data.links.filter((l) => !l.redundantWhenExpanded);

  const hasExpandableContent = !isEvent && !!(data.description || byline);

  const handleToggle = useCallback(() => {
    if (!hasExpandableContent) return;
    setIsExpanded((prev) => !prev);
  }, [hasExpandableContent]);

  // Rail drawn through the icon column as two segments (above / below the
  // icon), each stopping short of the icon so it sits in a gap on the line.
  // See TimelineCommit for the full rationale — same glyph vocabulary.
  const hasRailAbove = rail === "│" || rail === "┘";
  const hasRailBelow = rail === "│" || rail === "┐";
  const isRoleAnchor = isRole && rail !== "";
  const iconGapPx = isEvent ? 3 : isRoleAnchor ? 10 : 7;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
      }
    },
    [],
  );

  return (
    <div
      id={data.hash}
      data-rail-row
      // `data-role-row` + `data-rail-*` hook the shared tenure-rail CSS in
      // globals.css (hover / focus / expand on the role brightens the rail).
      data-role-row={isRoleAnchor ? "" : undefined}
      role={hasExpandableContent ? "button" : undefined}
      tabIndex={hasExpandableContent ? 0 : undefined}
      onClick={hasExpandableContent ? handleToggle : undefined}
      onKeyDown={hasExpandableContent ? handleKeyDown : undefined}
      data-expanded={isExpanded ? "" : undefined}
      className={cn(
        "group relative -mx-2 px-2 rounded-lg transition-colors duration-150 overflow-y-clip",
        isEvent ? "py-1" : "py-2",
        hasExpandableContent ? "cursor-pointer" : "cursor-default",
        // Keyboard focus reuses the hover wash instead of the UA outline,
        // which reads as a heavy box inside the card.
        "outline-none focus-visible:bg-muted/20",
        "[&:hover:not(:has([data-row-body]:hover))]:bg-muted/20",
        "[&:active:not(:has([data-row-body]:active))]:bg-muted/30",
        className,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 items-start">
        <span
          data-rail-icon
          className={cn(
            "relative inline-flex items-center justify-center w-5",
            isEvent ? "h-4" : "h-5",
          )}
        >
          {hasRailAbove && (
            <span
              aria-hidden
              data-rail-above
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-muted-foreground/10 transition-colors duration-200"
              style={{ top: "-1000px", bottom: `calc(50% + ${iconGapPx}px)` }}
            />
          )}
          {hasRailBelow && (
            <span
              aria-hidden
              data-rail-below
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-muted-foreground/10 transition-colors duration-200"
              style={{ top: `calc(50% + ${iconGapPx}px)`, bottom: "-1000px" }}
            />
          )}
          {isEvent ? (
            <span
              aria-hidden
              className="block w-[3px] h-[3px] rounded-full bg-muted-foreground/30"
            />
          ) : (
            <span
              className={cn(
                "inline-flex items-center justify-center w-5 h-5 rounded-full transition-[box-shadow] duration-200",
                isRoleAnchor && [
                  "ring-1 ring-inset ring-muted-foreground/15",
                  "group-hover/tenure:ring-muted-foreground/40",
                  "group-has-[[data-expanded]]/tenure:ring-muted-foreground/40",
                ],
              )}
            >
              <Icon className="w-3 h-3 text-muted-foreground/50" />
            </span>
          )}
        </span>

        {/* Summary line: title · [link-icons] ··· date */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              isEvent
                ? cn(
                    "text-xs text-muted-foreground/40",
                    /[぀-ヿ一-鿿]/.test(data.title)
                      ? "font-mono"
                      : "italic font-serif",
                  )
                : "text-sm text-foreground",
            )}
          >
            {data.title}
            {data.languageBadge && (
              <span className="ml-2 text-xs font-mono text-muted-foreground/40 align-baseline">
                {data.languageBadge}
              </span>
            )}
          </span>

          {links.length > 0 && (
            <div
              className="flex items-center gap-1.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {links.map((link, i) => (
                <a
                  key={`link-${i}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className="inline-flex items-center text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  <LinkIcon icon={link.icon} />
                </a>
              ))}
            </div>
          )}

          {hideDate ? (
            data.dateSlotOverride && (
              <span className="font-mono text-xs text-muted-foreground/50 shrink-0 ml-auto">
                {data.dateSlotOverride}
              </span>
            )
          ) : (
            <span
              className={cn(
                "font-mono text-xs shrink-0 ml-auto",
                isEvent ? "text-muted-foreground/30" : "text-muted-foreground/50",
              )}
            >
              {data.date}
            </span>
          )}
        </div>

        {/* Subtitle row: meta / team on the left, <handle> byline on the
            right. Sparse handle: cluster heads print it at rest, the rest
            fade in on row hover (or while expanded). */}
        {(data.meta || byline) && (
          <div className="col-start-2 mt-0.5 text-xs font-mono text-muted-foreground/40 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">
              {data.meta ? (
                data.metaUrl ? (
                  <a
                    href={data.metaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {data.meta}
                    <span aria-hidden className="text-[0.7rem]">↗</span>
                  </a>
                ) : (
                  data.meta
                )
              ) : (
                byline?.subtitle
              )}
            </span>
            {byline && (
              <span
                className={cn(
                  "shrink-0 text-muted-foreground/55 transition-opacity duration-200",
                  byline.isClusterHead || isExpanded
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                )}
              >
                {byline.handle}
              </span>
            )}
          </div>
        )}

        {isExpanded && (
          <div
            data-row-body
            className="col-start-2 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {/* Abbreviated `git log --pretty=fuller` author block. */}
            {data.type !== "role" && (
              <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs font-mono pb-2 mb-0.5">
                <span className="text-muted-foreground/40">Author:</span>
                <span className="text-muted-foreground/65">
                  &lt;{byline?.handle ?? DEFAULT_AUTHOR_HANDLE}&gt;
                </span>

                {byline?.expanded.title && (
                  <>
                    <span className="text-muted-foreground/40">Role:</span>
                    <span className="text-muted-foreground/60">
                      {byline.expanded.title}
                      <span className="text-muted-foreground/35"> @ </span>
                      {byline.expanded.company}
                      {byline.expanded.location && (
                        <>
                          <span className="text-muted-foreground/30"> · </span>
                          {byline.expanded.location}
                        </>
                      )}
                    </span>
                  </>
                )}
              </div>
            )}

            {data.description && (
              <Description text={data.description} isExpanded />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
