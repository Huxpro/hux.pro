"use client";

/**
 * Shared UI primitives for commit rendering.
 * Used by TimelineCommit and CommitCompact.
 */

import { Link } from "next-view-transitions";
import { cn } from "@/lib/utils";
import { IdentityHover } from "@/systems/identity";
import type { Byline } from "../bylines";
import {
  ExternalLink,
  Github,
  Globe,
  Instagram,
  MessageCircle,
  Presentation,
  Twitter,
  Youtube,
  FileText,
} from "lucide-react";

import { TYPE } from "@/lib/typography";
// =============================================================================
// Link Icon
// =============================================================================

export function LinkIcon({ icon }: { icon?: string }) {
  switch (icon?.toLowerCase()) {
    case "github":
      return <Github className="w-3 h-3" />;
    case "globe":
    case "website":
      return <Globe className="w-3 h-3" />;
    case "youtube":
      return <Youtube className="w-3 h-3" />;
    case "bilibili":
    case "vimeo":
    case "video":
      return <Youtube className="w-3 h-3" />;
    case "x":
    case "twitter":
      return <Twitter className="w-3 h-3" />;
    case "instagram":
      return <Instagram className="w-3 h-3" />;
    case "tiktok":
      return <MessageCircle className="w-3 h-3" />;
    case "slides":
      return <Presentation className="w-3 h-3" />;
    case "file":
      return <FileText className="w-3 h-3" />;
    default:
      return <ExternalLink className="w-3 h-3" />;
  }
}

// =============================================================================
// Description
// =============================================================================

interface DescriptionProps {
  text: string;
  /** Full text. Otherwise clamped to two lines. */
  isExpanded?: boolean;
  className?: string;
}

/**
 * A commit's description — what the work is.
 *
 * `TYPE.captionQuiet` at both lengths: 12px, tertiary. It was briefly raised
 * to `TYPE.body` (14px, muted) to buy the row a second tier — everything that
 * was not the title sat on tertiary, which is not a hierarchy — but at that
 * weight the description competes with the title for the row rather than
 * sitting under it, and a column of twenty-five rows reads louder than the
 * log wants. The hierarchy it was after is carried by the rest of the row
 * instead: the title is the only thing on the ink, and the mono metadata
 * around it annotates.
 */
export function Description({
  text,
  isExpanded = false,
  className,
}: DescriptionProps) {
  return (
    <p
      className={cn(
        TYPE.captionQuiet,
        // Two lines everywhere, and the measure does the rest: a phone's
        // ~40 characters a line, a desktop's ~90. A wider column is already
        // being handed more of the text, so spending a breakpoint to hand it
        // a third line as well buys a screen and a half of page for a hook
        // that was long enough at two.
        !isExpanded && "line-clamp-2",
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

/** Who a commit belongs to when no identity resolves. */
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
   * A field value that stands for an identity — the handle, the role — is
   * the identity card's trigger (systems/identity): hover peeks the profile
   * on a desktop, a tap opens it as a sheet on a phone. The affordance is the
   * text itself; a control bolted onto a line of prose reads as chrome, and
   * this block has none.
   */
  const identity = (children: React.ReactNode) =>
    byline ? (
      <IdentityHover
        identityId={byline.identityId}
        roleId={byline.roleId}
        className="text-tertiary-foreground"
      >
        {children}
      </IdentityHover>
    ) : (
      children
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

      <span className="text-tertiary-foreground">Author:</span>
      <span className="text-tertiary-foreground">
        {identity(<>&lt;{byline?.handle ?? DEFAULT_AUTHOR_HANDLE}&gt;</>)}
      </span>

      {role && (
        <>
          <span className="text-tertiary-foreground">Role:</span>
          <span className="text-tertiary-foreground">
            {/*
              The role's prose — its tenure, the other roles under the same
              handle, what was signed with it — is the identity card behind
              this field rather than a disclosure under it. It is tenure
              prose, the same under all twelve commits of a tenure, so it
              belongs to the identity and not to the row.
            */}
            {identity(role)}
            {byline.expanded.location && (
              <>
                <span className="text-quaternary-foreground"> · </span>
                {byline.expanded.location}
              </>
            )}
          </span>
        </>
      )}
    </div>
  );
}
