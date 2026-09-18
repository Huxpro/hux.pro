"use client";

/**
 * TimelineMini — Minimized git-log row for widget-sized timelines.
 *
 * A trimmed-down `TimelineCommit`: same icon column + tenure rail, same
 * title / link-pill / date summary line and `<handle>` byline, same
 * expanded `git log --pretty=fuller` author block — minus everything that
 * needs page-width real estate (hash column, cursor peek, pinned/expanded
 * media, inspect mode). Tapping a row folds the author / description
 * block in and out; attachments never render here.
 *
 * Consumes NormalizedCommit — fully type-agnostic.
 *
 * It is a preview surface, so it is also a hand-off into /works: `commit`
 * opens that row there. That address belongs to /works and this component
 * names it directly — it is that page in miniature, not a general-purpose row.
 */

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { Byline } from "./bylines";
import type { NormalizedCommit } from "./commit-data";
import { CommitIcon } from "./icons";
import { LinkIcon, Description, AuthorFields } from "./embeds/shared";

import { TYPE } from "@/lib/typography";

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
        "group pressable relative -mx-2 px-2 rounded-lg transition-colors duration-150 overflow-y-clip",
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
              <CommitIcon
                type={data.type}
                override={data.iconOverride}
                className="w-3 h-3 text-tertiary-foreground"
              />
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
                    "text-xs text-tertiary-foreground",
                    /[぀-ヿ一-鿿]/.test(data.title)
                      ? "font-mono"
                      : "italic font-serif",
                  )
                : TYPE.rowTitle,
            )}
          >
            {data.title}
            {data.languageBadge && (
              <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>
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
                  className={cn("inline-flex items-center", TYPE.linkQuiet)}
                >
                  <LinkIcon icon={link.icon} />
                </a>
              ))}
            </div>
          )}

          {hideDate ? (
            data.dateSlotOverride && (
              <span className="font-mono text-xs text-tertiary-foreground shrink-0 ml-auto">
                {data.dateSlotOverride}
              </span>
            )
          ) : (
            <span
              className={cn(
                "font-mono text-xs shrink-0 ml-auto",
                "text-tertiary-foreground",
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
          <div className={cn("col-start-2 mt-0.5 flex items-baseline justify-between gap-2", TYPE.rowMeta)}>
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
              // One form at a time, as on /works: folded, the handle is this
              // compact mark on the meta line; open, it transposes into the
              // `Author:` field at the foot and this one stands down. It fades
              // rather than unmounts, so the row below never moves.
              <span
                className={cn(
                  "shrink-0 text-tertiary-foreground transition-opacity duration-200",
                  isExpanded
                    ? "opacity-0"
                    : byline.isClusterHead
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
          // No enter animation, for the reason TimelineCommit's body has none:
          // a transform on 12px mono re-rasterizes it, and the row's box snaps
          // to its new height regardless.
          <div data-row-body className="col-start-2 mt-2 space-y-1.5">
            {data.description && (
              <Description text={data.description} isExpanded />
            )}

            {/*
              The author fields, at the foot — the vertical form of the handle
              that was on the meta line a moment ago. `commit` leads because
              that is how `git log --pretty=fuller` opens, and because this is
              the only surface where the hash has nowhere else to live: on
              /works it sits in the gutter column, where it is the permalink.
              Here it is the permalink and the field at once.
            */}
            {data.type !== "role" && (
              <AuthorFields
                byline={byline}
                commit={{ hash: data.hash, href: `/works#${data.hash}` }}
                className="pt-1"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
