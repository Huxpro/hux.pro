"use client";

/**
 * Shared UI primitives for commit rendering.
 * Used by TimelineCommit and CommitCompact.
 */

import { cn } from "@/lib/utils";
import { IdentityHover } from "@/systems/identity";
import type { Byline } from "../bylines";

import { TYPE } from "@/lib/typography";
// =============================================================================
// Description
// =============================================================================

interface DescriptionProps {
  text: string;
  className?: string;
}

/**
 * A commit's description: what the work is.
 *
 * `TYPE.message`: 13px, muted. It sat on 12px tertiary for a long time, and
 * the reason was the line between it and the title: the venue, in tertiary
 * mono. Brightening or enlarging the paragraph under that line made a
 * sandwich (ink, the lightest rung, a middle one), so the paragraph stayed
 * as light and as small as the line above it, and the row had no second
 * tier. The venue now sits on the title line (TimelineCommit), nothing
 * stands between a title and its sentence, and the title over a sentence
 * takes medium (`TYPE.rowHeading`), so the sentence can take the rung and
 * the size it needed: a half step under the heading, which is
 * where a sentence under a heading sits. (At 14 it was the heading's size
 * and the two competed for the row.)
 *
 * Never clamped. It was two lines for a long time, with the rest behind the
 * row's press, and a clamp is a statement that the text was not written to
 * be read: what the reader got was the first half of somebody's programme
 * abstract, cut mid-word. A description is now the part that should be
 * read, short enough to print whole; what only elaborates it is `Details`.
 */
export function Description({ text, className }: DescriptionProps) {
  return <p className={cn(TYPE.message, className)}>{text}</p>;
}

// =============================================================================
// Details
// =============================================================================

/**
 * The long form behind a commit's press (`details` in log.json): a talk's
 * programme abstract, a thesis's particulars. It prints under the covers,
 * so it is a step under the description in size (`TYPE.caption`, 12px) and
 * keeps the muted rung: it is running text, and a paragraph on tertiary is
 * a contrast bug, not a hierarchy.
 */
export function Details({ text, className }: { text: string; className?: string }) {
  return <p className={cn(TYPE.caption, className)}>{text}</p>;
}

// =============================================================================
// Commentary Block
// =============================================================================

interface CommentaryProps {
  text: string;
  className?: string;
}

/**
 * What I say about a work, in the margin. The aside's face (italic serif,
 * 12px), but a rung up from `TYPE.aside`: an aside elsewhere annotates a
 * neighbour, and this one is the only place the row says something in my
 * own words. That is why it is read with the description, above the
 * covers, and not kept behind the row's press with the notes.
 */
export function Commentary({ text, className }: CommentaryProps) {
  return (
    <p
      className={cn(
        "text-xs italic font-serif text-muted-foreground leading-relaxed",
        className
      )}
    >
      &ldquo;{text}&rdquo;
    </p>
  );
}

// =============================================================================
// Author Fields: `git log --pretty=fuller`
// =============================================================================

/**
 * Fallback handle for the expanded author block when a commit has no
 * resolvable identity (e.g. personal works with `attachedTo: null`).
 * The subtitle-row byline stays blank for those rows, but the author
 * block still names the person once opened. This is a display fallback
 * only. It is not an identity in the log.
 */
const DEFAULT_AUTHOR_HANDLE = "hux";

/**
 * The `commit` field's hash. No rule under it: a 7-character hex in a
 * `commit` field is the most conventional link there is, so colour carries
 * it and hover confirms.
 */
const HASH_LINK = cn(TYPE.hash, "transition-colors hover:text-muted-foreground");

interface AuthorFieldsProps {
  byline?: Byline | null;
  /**
   * The hash as a leading `commit` field (how `git log --pretty=fuller`
   * opens), and the row's permalink: `onSelect` makes the row the page's
   * address in place.
   */
  commit?: { hash: string; onSelect?: (hash: string) => void };
  /**
   * Print the lines in, one after another (`sig-print`, globals.css "The
   * signature"), when an ancestor carries `data-sig-open`: the phone's
   * easter egg. Each line's label goes first and its value a beat after.
   */
  print?: boolean;
  /**
   * Print the `Role:` field. The signature leaves it out: `Author:` opens
   * the identity card, which carries the role and its tenure, and a role
   * line repeated on every row of a tenure (`Architect @ ByteDance`, eleven
   * times down the Lynx years) restates the company the handle and the
   * team already name. The feed, which prints everything, keeps it.
   */
  withRole?: boolean;
  className?: string;
}

/**
 * A region spanning the field stack's two columns and keeping them: the
 * author block, whose two lines are one thing (see `identity` below).
 */
const FIELD_SUBGRID = "col-span-2 grid grid-cols-subgrid gap-y-0.5";

/**
 * The author block, as `git log --pretty=fuller` writes it: `commit`,
 * `Author:`, and `Role:` where everything is printed (the feed). On /works
 * it is provenance, not content (the chapter names the company, the title
 * line the team), so it never prints at rest and never gates the row's
 * press: on a desk the margin shows it under the hash on hover, and on a
 * phone a tap on the row's mark brings this stack, an easter egg
 * (TimelineCommit, "The signature"). The feed prints it outright.
 */
export function AuthorFields({
  byline,
  commit,
  print = false,
  withRole = true,
  className,
}: AuthorFieldsProps) {
  // `@ Company` never breaks: a role wrapping as `… XROS @` / `Meta` leaves
  // the at-sign hanging at a line's end, pointing at nothing.
  const role = withRole && byline?.expanded.title && (
    <>
      {byline.expanded.title}{" "}
      <span className="whitespace-nowrap">
        <span className="text-quaternary-foreground">@ </span>
        {byline.expanded.company}
      </span>
    </>
  );

  // A cell's place for `print`: its line in the stack, and whether it is
  // the value that follows its label.
  const cell = (i: number, value: boolean) =>
    print
      ? {
          className: "sig-print",
          style: {
            "--sig-i": i,
            "--sig-o": value ? "60ms" : "0ms",
          } as React.CSSProperties,
        }
      : { className: undefined, style: undefined };
  const authorLine = commit ? 1 : 0;
  const commitLabel = commit ? cell(0, false) : null;
  const commitValue = commit ? cell(0, true) : null;
  const authorLabel = cell(authorLine, false);
  const authorValue = cell(authorLine, true);
  const roleLabel = role ? cell(authorLine + 1, false) : null;
  const roleValue = role ? cell(authorLine + 1, true) : null;

  /**
   * The `Author:` and `Role:` lines stand for one identity, so together they
   * are the identity card's trigger (systems/identity): hover peeks the
   * profile on a desktop, a tap opens it as a sheet on a phone, and either
   * lights the whole block. Lighting one line would say the lines were
   * separate things. No control bolted on; the region is the affordance.
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
        // stack whose keys disappear is just three unlabelled lines, not
        // `--pretty=fuller`. The wrap it was avoiding is cheaper than the
        // form it was costing.
        "grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono text-xs",
        className,
      )}
    >
      {commit && (
        <>
          <span
            className={cn("text-tertiary-foreground", commitLabel?.className)}
            style={commitLabel?.style}
          >
            commit
          </span>
          <span className={commitValue?.className} style={commitValue?.style}>
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
              className={cn(HASH_LINK, "sig-hash")}
            >
              {commit.hash}
            </a>
          </span>
        </>
      )}

      {identity(
        <>
          <span
            className={cn("text-tertiary-foreground", authorLabel.className)}
            style={authorLabel.style}
          >
            Author:
          </span>
          {/* The who, a rung above the labels and the role: the one field
              a reader came for. */}
          <span
            className={cn("text-muted-foreground", authorValue.className)}
            style={authorValue.style}
          >
            &lt;{byline?.handle ?? DEFAULT_AUTHOR_HANDLE}&gt;
          </span>

          {role && (
            <>
              <span
                className={cn("text-tertiary-foreground", roleLabel?.className)}
                style={roleLabel?.style}
              >
                Role:
              </span>
              <span
                className={cn("text-tertiary-foreground", roleValue?.className)}
                style={roleValue?.style}
              >
                {/*
                  The role's prose (its tenure, the other roles under the
                  same handle, what was signed with it) is the identity card
                  behind this block rather than a disclosure under it. It is
                  tenure prose, the same under all twelve commits of a
                  tenure, so it belongs to the identity and not to the row.
                */}
                {role}
                {byline.expanded.location && (
                  <>
                    <span className="text-quaternary-foreground"> · </span>
                    <span className="whitespace-nowrap">
                      {byline.expanded.location}
                    </span>
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
