"use client";

/**
 * TimelineMini — Minimized git-log row for widget-sized timelines.
 *
 * A trimmed-down `TimelineCommit`: same icon column + tenure rail, same
 * title / link-pill / date summary line and `<handle>` byline — minus
 * everything that needs page-width real estate (hash column, cursor peek,
 * pinned/expanded media, inspect mode). Attachments never render here.
 *
 * Consumes NormalizedCommit — fully type-agnostic.
 *
 * **The row is a permalink into /works.** It used to fold an author /
 * description block open in place, which made the card a second, worse
 * reader for something /works already shows better — and made the card's
 * own height a function of what you had tapped. Now that a commit has an
 * address (`/works#<hash>`, see `use-commit-anchor.ts`), the row hands off
 * instead: tapping it opens that row on /works, which travels to it and
 * marks it. The preview stays a preview.
 *
 * That address belongs to /works and this component names it directly — it
 * is that page in miniature, not a general-purpose row.
 */

import { cn } from "@/lib/utils";
import { Link } from "next-view-transitions";
import type { Byline } from "./bylines";
import type { NormalizedCommit } from "./commit-data";
import { CommitIcon } from "./icons";
import { LinkIcon } from "./embeds/shared";

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
  const isAside = data.present === "aside";
  // Folded asides borrow the event voice: muted italic line, rail
  // dot. Mini rows do not unfold in place — they permalink into /works,
  // where the aside can be opened. The type is unchanged, so filters
  // still find it.
  const displayTitle =
    isAside && data.foldedTitle ? data.foldedTitle : data.title;

  // Attachments never render here, so the pills that merely proxy a link
  // card (`redundantWhenExpanded`) go too — what's left are the commit's
  // real outbound links (website / GitHub / platform), which keeps narrow
  // rows from drowning the title in globes.
  const links = isAside
    ? []
    : data.links.filter((l) => !l.redundantWhenExpanded);

  // Events are the log's punctuation — they have no page of their own to
  // open, so they stay plain text. Asides are real commits (a talk, a
  // post) wearing the event voice, so they still permalink into /works.
  const href = isEvent ? null : `/works#${data.hash}`;

  // Rail drawn through the icon column as two segments (above / below the
  // icon), each stopping short of the icon so it sits in a gap on the line.
  // See TimelineCommit for the full rationale — same glyph vocabulary.
  const hasRailAbove = rail === "│" || rail === "┘";
  const hasRailBelow = rail === "│" || rail === "┐";
  const isRoleAnchor = isRole && rail !== "";
  const iconGapPx = isEvent || isAside ? 3 : isRoleAnchor ? 10 : 7;

  const body = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 items-start">
      <span
        data-rail-icon
        className={cn(
          "relative inline-flex items-center justify-center w-5",
          isEvent || isAside ? "h-4" : "h-5",
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
        {isEvent || isAside ? (
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
            isEvent || isAside
              ? cn(
                  "text-xs text-tertiary-foreground",
                  /[぀-ヿ一-鿿]/.test(displayTitle)
                    ? "font-mono"
                    : "italic font-serif",
                )
              : TYPE.rowTitle,
          )}
        >
          {displayTitle}
          {!(isEvent || isAside) && data.languageBadge && (
            <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>
              {data.languageBadge}
            </span>
          )}
        </span>

        {links.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
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
          fade in on row hover. */}
      {(!(isEvent || isAside) && (data.meta || byline)) && (
        <div
          className={cn(
            "col-start-2 mt-0.5 flex items-baseline justify-between gap-2",
            TYPE.rowMeta,
          )}
        >
          <span className="min-w-0 truncate">
            {data.meta ? (
              data.metaUrl ? (
                <a
                  href={data.metaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {data.meta}
                  <span aria-hidden className="text-[0.7rem]">
                    ↗
                  </span>
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
                "shrink-0 text-tertiary-foreground transition-opacity duration-200",
                byline.isClusterHead
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
            >
              {byline.handle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const shell = cn(
    "group pressable relative block -mx-2 px-2 rounded-lg transition-colors duration-150 overflow-y-clip",
    isEvent || isAside ? "py-1" : "py-2",
    className,
  );

  // Nested links (the outbound pills, the `meta` site) are why the row is a
  // grid with a link around it rather than an `<a>` with links inside it —
  // except an anchor can't legally contain one, so the row's own anchor is
  // a sibling laid over the row, under the pills in the stacking order.
  if (!href) return <div className={shell}>{body}</div>;

  return (
    <div
      id={data.hash}
      data-rail-row
      // `data-role-row` + `data-rail-*` hook the shared tenure-rail CSS in
      // globals.css (hover / focus on the role brightens the rail).
      data-role-row={isRoleAnchor ? "" : undefined}
      className={cn(
        shell,
        "[&:hover:not(:has(a:not([data-row-link]):hover))]:bg-muted/20",
        "[&:active:not(:has(a:not([data-row-link]):active))]:bg-muted/30",
        "has-[[data-row-link]:focus-visible]:bg-muted/20",
      )}
    >
      <Link
        href={href}
        data-row-link
        aria-label={displayTitle}
        className="absolute inset-0 z-0 rounded-lg outline-none"
      />
      <div className="relative z-10 pointer-events-none [&_a]:pointer-events-auto">
        {body}
      </div>
    </div>
  );
}
