"use client";

/**
 * Shared UI primitives for commit rendering.
 * Used by TimelineCommit and CommitCompact.
 */

import { Link } from "next-view-transitions";
import { cn } from "@/lib/utils";
import { IdentityHover } from "@/systems/identity";
import type { Byline } from "../bylines";

import { TYPE } from "@/lib/typography";
// =============================================================================
// Description
// =============================================================================

interface DescriptionProps {
  text: string;
  /** Full text. Otherwise clamped — see `major`. */
  isExpanded?: boolean;
  /** The row is the work itself (`rowWeight`, lib/log-view.ts). */
  major?: boolean;
  className?: string;
}

/**
 * A commit's description — what the work is.
 *
 * Two rungs, by the row's weight. A talk's or a press piece's sits on
 * `TYPE.captionQuiet` — 12px, tertiary — and only once the row is open. It
 * was briefly raised to `TYPE.body` to buy every row a second tier, but at
 * that weight a column of twenty-five descriptions competed with its own
 * titles, and it was pulled back.
 *
 * The work's sits one rung up, on `TYPE.caption`: muted, not tertiary. That
 * argument was about twenty-five rows all printing prose; the default form
 * now prints it for the work alone (`ROW_FORM`), eleven rows across four
 * chapters, and for those rows the description is *the* answer to what the
 * work was — on tertiary, clamped at two lines, it was the part of the page
 * a newcomer needed most and could read least. Still 12px, so it sits under
 * the title rather than beside it.
 */
export function Description({
  text,
  isExpanded = false,
  major = false,
  className,
}: DescriptionProps) {
  return (
    <p
      className={cn(
        major ? TYPE.caption : TYPE.captionQuiet,
        // Clamped, the measure does most of the work: a phone's ~40
        // characters a line, a desktop's ~90. Two lines is a hook, which is
        // all a talk's blurb is asked to be; three is where the work's
        // descriptions, all a sentence or two, finish on a desk.
        !isExpanded && (major ? "line-clamp-3" : "line-clamp-2"),
        className
      )}
    >
      {text}
    </p>
  );
}

// =============================================================================
// Commentary Block
// =============================================================================

interface CommentaryProps {
  text: string;
  className?: string;
}

export function Commentary({ text, className }: CommentaryProps) {
  return (
    <p
      className={cn(
        TYPE.aside,
        className
      )}
    >
      &ldquo;{text}&rdquo;
    </p>
  );
}

// =============================================================================
// Author Fields — `git log --pretty=fuller`
// =============================================================================

/**
 * Fallback handle for the expanded author block when a commit has no
 * resolvable identity (e.g. personal works with `attachedTo: null`).
 * The subtitle-row byline stays blank for those rows, but the author
 * block still names the person once opened. This is a display fallback
 * only — it is not an identity in the log.
 */
const DEFAULT_AUTHOR_HANDLE = "hux";

/**
 * The `commit` field's hash, in both its modes.
 *
 * No rule under it: a 7-character hex in a `commit` field is the most
 * conventional link on the web, and the block had two dotted underlines in
 * three lines — one for this, which navigates, and one for `Role:`, which
 * expands in place. The same mark for two different behaviours told the
 * reader nothing, and under CJK the rule is drawn by the fallback font's
 * metrics rather than the mono's, so the two did not even match each other.
 * Colour carries it instead, and hover does the confirming.
 */
const HASH_LINK = cn(TYPE.hash, "transition-colors hover:text-muted-foreground");

interface AuthorFieldsProps {
  byline?: Byline | null;
  /**
   * The hash as a leading `commit` field — how `git log --pretty=fuller`
   * opens, and the surface's permalink.
   *
   * Two surfaces need it for two reasons. The home widget hands off to
   * /works, so it passes `href` and the field is a link; `scroll={false}`,
   * because `useCommitAnchor` takes the hash from the URL on arrival and
   * eases to it — left on, the router's jump and the eased correction run in
   * series and read as a stumble. /works is already the page, so it passes
   * `onSelect` and the field makes this row the address in place.
   *
   * On /works it also carries `className: "@sm:hidden"`: the gutter hash
   * column is `hidden @sm:inline`, so below that width the row has no
   * permalink at all, and above it two would be a duplicate.
   */
  commit?: {
    hash: string;
    /** Link away to the row (the widget's hand-off to /works). */
    href?: string;
    /** Make this row the page's address, without navigating (/works). */
    onSelect?: (hash: string) => void;
    /** Applied to both cells, so the whole field hides together. */
    className?: string;
  };
  className?: string;
}

/**
 * A region spanning the field stack's two columns and keeping them: the
 * author block, whose two lines are one thing (see `identity` below).
 */
const FIELD_SUBGRID = "col-span-2 grid grid-cols-subgrid gap-y-0.5";

/**
 * The author block at the foot of an expanded commit — the vertical form of
 * the handle that was on the meta line a moment ago. Folded, the row states
 * its author compactly on that line; open, it transposes into this labelled
 * field stack and the mark above stands down, so the fact is stated once and
 * the two states are the same thing seen along two axes.
 *
 * Lives here because both surfaces print it and both must keep printing the
 * same thing: it carries state (the role disclosure) rather than only markup,
 * so a copy on each surface is a behaviour to keep in sync by hand.
 */
export function AuthorFields({
  byline,
  commit,
  className,
}: AuthorFieldsProps) {
  const role = byline?.expanded.title && (
    <>
      {byline.expanded.title}
      <span className="text-quaternary-foreground"> @ </span>
      {byline.expanded.company}
    </>
  );

  /**
   * The `Author:` and `Role:` lines stand for one identity, so together they
   * are the identity card's trigger (systems/identity): hover peeks the
   * profile on a desktop, a tap opens it as a sheet on a phone, and either
   * lights the whole block — not one line of it, which would say the lines
   * were separate things. No control bolted on; the region is the affordance.
   */
  const identity = (children: React.ReactNode) =>
    byline ? (
      <IdentityHover
        identityId={byline.identityId}
        roleId={byline.roleId}
        block
        wrapperClassName={FIELD_SUBGRID}
        className={FIELD_SUBGRID}
      >
        {children}
      </IdentityHover>
    ) : (
      <div className={FIELD_SUBGRID}>{children}</div>
    );

  return (
    <div
      className={cn(
        // The labels hold their column at every width. They used to stand
        // down below `@sm` to spare a phone the 64px gutter, but a field
        // stack whose keys disappear is no longer `--pretty=fuller` — it is
        // three unlabelled lines — and the wrap it was avoiding is cheaper
        // than the form it was costing.
        "grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono text-xs",
        className,
      )}
    >
      {commit && (
        <>
          <span
            className={cn("text-tertiary-foreground", commit.className)}
          >
            commit
          </span>
          <span className={commit.className}>
            {commit.href ? (
              <Link
                href={commit.href}
                scroll={false}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open commit ${commit.hash} in works`}
                className={cn(HASH_LINK)}
              >
                {commit.hash}
              </Link>
            ) : (
              <a
                href={`#${commit.hash}`}
                onClick={(e) => {
                  // Modified clicks belong to the browser.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  e.stopPropagation();
                  commit.onSelect?.(commit.hash);
                }}
                aria-label={`Link to commit ${commit.hash}`}
                className={cn(HASH_LINK)}
              >
                {commit.hash}
              </a>
            )}
          </span>
        </>
      )}

      {identity(
        <>
          <span className="text-tertiary-foreground">Author:</span>
          <span className="text-tertiary-foreground">
            &lt;{byline?.handle ?? DEFAULT_AUTHOR_HANDLE}&gt;
          </span>

          {role && (
            <>
              <span className="text-tertiary-foreground">Role:</span>
              <span className="text-tertiary-foreground">
                {/*
                  The role's prose — its tenure, the other roles under the
                  same handle, what was signed with it — is the identity card
                  behind this block rather than a disclosure under it. It is
                  tenure prose, the same under all twelve commits of a
                  tenure, so it belongs to the identity and not to the row.
                */}
                {role}
                {byline.expanded.location && (
                  <>
                    <span className="text-quaternary-foreground"> · </span>
                    {byline.expanded.location}
                  </>
                )}
              </span>
            </>
          )}
        </>,
      )}
    </div>
  );
}
