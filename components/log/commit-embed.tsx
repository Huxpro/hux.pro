"use client";

/**
 * Commit — Unified entry point for rendering commits.
 *
 * Normalizes type-specific commit data via the adapter, then dispatches
 * to the appropriate variant renderer:
 * - "timeline": Dense git-log row (TimelineCommit)
 * - "card": TimelineCommit in a border frame container
 * - "bare": Minimal compact for widgets (CommitCompact)
 */

import { useCallback, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import type { Commit as CommitData, Media, PeekItem } from "@/lib/log";
import { getCommitPeekItems, localize } from "@/lib/log";
import { DEFAULT_DENSITY, type LogDensity } from "@/lib/log-view";
import { cn } from "@/lib/utils";
import { attachmentSetFor } from "@/systems/attachments";
import { IDENTITY_PEEK_PANEL, IdentityPeek } from "@/systems/identity";
import { PeekCard, PeekThumb } from "./media/media-peek";
import { PEEK_W } from "@/components/motion-primitives/magnetic-preview";
import type { Byline } from "./bylines";
import { normalizeCommit } from "./commit-data";
import { TimelineCommit, type BeamSpec } from "./timeline-commit";
import { CommitCompact } from "./commit-compact";
import { useTimelineEdit } from "./timeline-edit-context";

import { TYPE } from "@/lib/typography";
// =============================================================================
// Types
// =============================================================================

export type CommitVariant = "timeline" | "card" | "bare";

export interface CommitProps {
  commit: CommitData;
  locale?: Locale;
  variant?: CommitVariant;
  defaultExpanded?: boolean;
  /** Timeline-only: when this boolean flips, the row syncs its expanded
   *  state to it (drives the page-level "expand/collapse all" control). */
  expandAll?: boolean;
  className?: string;
  hideDate?: boolean;
  /** Pre-computed git-graph rail char for the timeline gutter. */
  rail?: string;
  /** The role commit's id that owns this row's rail segment. */
  segmentId?: string | null;
  /** True when the parent timeline currently highlights this segment. */
  isSegmentActive?: boolean;
  /** The beam this row emits when hovered. */
  beamSpec?: BeamSpec | null;
  /** Notify the parent the row would like its beam rendered. */
  onBeamSet?: (spec: BeamSpec) => void;
  /** Notify the parent the row no longer wants its beam rendered.
   *  Parent should ignore stale clears that don't match the current beam. */
  onBeamClear?: (spec: BeamSpec) => void;
  /** Author byline for git-author-style rendering. Pre-localized in
   *  the timeline so this component stays locale-agnostic. */
  byline?: Byline | null;
  /** Timeline-only: how much of the commit to print (see `lib/log-view`). */
  density?: LogDensity;
  /** Make a commit the page's address; wires the hash column. */
  onSelectHash?: (hash: string) => void;
}

// =============================================================================
// Main Component
// =============================================================================

export function Commit({
  commit,
  locale = "en",
  variant = "card",
  defaultExpanded = false,
  expandAll,
  className,
  hideDate = false,
  rail,
  segmentId,
  isSegmentActive = false,
  beamSpec = null,
  onBeamSet,
  onBeamClear,
  byline = null,
  density = DEFAULT_DENSITY,
  onSelectHash,
}: CommitProps) {
  const edit = useTimelineEdit();

  // Runtime guard: MDX/JSON inputs can bypass static typing.
  if (
    !commit ||
    (commit.type !== "project" &&
      commit.type !== "talk" &&
      commit.type !== "post" &&
      commit.type !== "role" &&
      commit.type !== "social" &&
      commit.type !== "event")
  ) {
    return null;
  }

  const data = normalizeCommit(commit, locale);
  const preview = buildCommitPreview(commit, locale);
  // Everything the commit attaches, as the one set every affordance on the
  // row opens (systems/attachments). Not while inspecting: the editor's
  // clicks select, they do not open.
  const attachmentSet =
    edit?.mode === "inspect" ? null : attachmentSetFor(commit, locale);
  const inspecting = edit?.mode === "inspect";
  const isSelected = !!edit && edit.selectedCommitId === commit.id;
  const selectedMedia =
    inspecting && isSelected && edit && edit.selectedMediaIndex != null
      ? commit.media?.[edit.selectedMediaIndex] ?? null
      : null;
  const onInspectCommit =
    inspecting && edit ? () => edit.onSelectCommit(commit.id) : undefined;
  const onInspectMedia =
    inspecting && edit
      ? (media: Media) => {
          const index = commit.media?.indexOf(media) ?? -1;
          if (index >= 0) edit.onSelectMedia(commit.id, index);
        }
      : undefined;

  switch (variant) {
    case "timeline":
      return (
        <TimelineCommit
          data={data}
          cursorPreview={preview?.node ?? null}
          cursorPreviewPanelClassName={preview?.panelClassName}
          defaultExpanded={defaultExpanded}
          expandAll={expandAll}
          className={className}
          hideDate={hideDate}
          rail={rail}
          isRole={commit.type === "role"}
          segmentId={segmentId ?? null}
          isSegmentActive={isSegmentActive}
          beamSpec={beamSpec}
          onBeamSet={onBeamSet}
          onBeamClear={onBeamClear}
          byline={byline}
          density={density}
          onSelectHash={onSelectHash}
          attachmentSet={attachmentSet}
          inspecting={inspecting}
          isSelected={isSelected}
          isUnlisted={commit.listed === false}
          onInspectCommit={onInspectCommit}
          onInspectMedia={onInspectMedia}
          selectedMedia={selectedMedia}
        />
      );

    case "card":
      return (
        <div
          className={cn(
            "rounded-lg border border-border bg-muted/5 overflow-hidden",
            "p-4",
            className,
          )}
        >
          <TimelineCommit
            data={data}
            defaultExpanded={defaultExpanded}
            hideDate={hideDate}
          />
        </div>
      );

    case "bare":
      return <CommitCompact data={data} className={className} />;
  }
}

// =============================================================================
// Preview Content (for MagneticPreview)
// =============================================================================

interface CommitPreview {
  node: ReactNode;
  /** Extra class merged into the cursor-preview panel. */
  panelClassName?: string;
}

/** Strips the cursor-preview panel's bg / border / blur so the peek content
 *  can supply its own. (The panel carries no shadow to strip — see the panel
 *  base in magnetic-preview; the visible card/thumb casts the shadow.) */
const BARE_PANEL_CHROME =
  "bg-transparent border-transparent backdrop-blur-none";

/**
 * Build the cursor-preview for a commit — a "peek view" that scales to how
 * much media the commit carries. Returns `null` when there's nothing worth
 * showing so the hover never renders an empty card.
 *
 * Three modes by media count:
 *  - 2+ items: a deck-of-cards stack. Card-presented links render as mini
 *    LinkCards (image + domain + title); videos / images render as bare
 *    covers. Front card sharp; back cards rotated, scaled, and faded so they
 *    peek out without overflowing the panel's rounded clip.
 *  - 1 item:   a single instance of the same chrome — mini-card for a link,
 *    flush poster for a video / image.
 *  - 0 items:  the commit's description text, if any.
 *
 * Reconciliation with `pinned`: peek = "what's *behind* the fold". Pinned
 * items are already visible inline, so the peek excludes them — see
 * `getCommitPeekItems` for the exact filter rationale.
 */
function buildCommitPreview(
  commit: CommitData,
  locale: Locale,
): CommitPreview | null {
  // A role row stands for an identity, and its peek is that identity's
  // card — the same profile the handle on any other row peeks.
  if (commit.type === "role") {
    return {
      panelClassName: IDENTITY_PEEK_PANEL,
      node: <IdentityPeek identityId={commit.identityId} roleId={commit.id} />,
    };
  }

  const items = getCommitPeekItems(commit);

  if (items.length >= 2) {
    return {
      // Strip the panel chrome so the rotated cards read as floating, not
      // contained in another box — the rotation IS the visual signal of
      // "there's more here" and a background defeats it. Padding (`p-8`)
      // gives the back layers' translate + rotate room to peek out around
      // the front card (the panel's default cap already fits it).
      panelClassName: `p-8 ${BARE_PANEL_CHROME}`,
      node: <StackedPeek items={items} />,
    };
  }

  if (items.length === 1) {
    const item = items[0];
    // Single mini-card brings its own border/shadow, so the panel stays flush.
    // Single thumb keeps the panel's chrome and lets its border double as
    // the poster's edge.
    if (item.kind === "card") {
      return {
        panelClassName: `p-0 ${BARE_PANEL_CHROME}`,
        // Single peek mirrors the expanded /works LinkCard: natural aspect.
        node: <PeekCard item={item} className={cn(PEEK_W, "shadow-raised")} />,
      };
    }
    return {
      // Strip the panel chrome so the thumb is the only surface (keeping it
      // stacked the panel's border on top of the thumb's — a double edge).
      panelClassName: `p-0 ${BARE_PANEL_CHROME}`,
      // A pure-media poster: cover + rounded clip + shadow, no border (unlike
      // the link/writing cards, whose border frames their text). The image
      // bleeds to the rounded edge and the shadow does the lifting.
      node: (
        <PeekThumb
          image={item.image}
          className={cn(PEEK_W, "aspect-video border-0 shadow-raised")}
        />
      ),
    };
  }

  // No peekable media → fall back to a small designed card carrying the
  // description. This used to print a mono-uppercase strip of the commit's
  // topics under it, echoing the /writing peek; the topics are no longer
  // printed anywhere on the page (see the expanded body in TimelineCommit),
  // and a peek is not the place to reintroduce them.
  const description = localize(commit.description, locale);
  if (!description) return null;

  return {
    // Unlike the other peeks (bare panel, content == PEEK_W), this fallback
    // uses the panel itself as the visible card, so PEEK_W goes on the PANEL
    // — otherwise its p-3 padding would make the outer box wider (408) than
    // the flush 384 peeks. It's a visible card, so it opts into shadow-raised.
    panelClassName: `${PEEK_W} shadow-raised`,
    node: (
      <p className={cn(TYPE.caption, "w-full line-clamp-3")}>{description}</p>
    ),
  };
}

// The deck's rotated/translated back cards add ~20–40px of overhang beyond
// the front card, so a front card at the full PEEK_W (384) makes the deck
// read wider and heavier than the flush single-card / video / writing peeks.
// Size the front card DOWN so the deck's *perceived footprint* (front + fan
// overhang) lands at ~PEEK_W. Stacks also carry more visual mass than a flat
// card, so we aim a touch under.
const DECK_FRONT_W = "w-[22rem]"; // 352px

/**
 * Stacked-card peek for commits with 2+ peek items. We show up to three
 * front-to-back; the front item sharp; back ones translated, scaled down,
 * rotated, and faded so they peek without escaping the panel clip. A "+N"
 * badge surfaces the rest of the count when relevant.
 *
 * Reveal is gated on every image resolving (load OR error) so the layers
 * appear together — Bilibili's CDN especially trickles in on a cold hover
 * and a staggered reveal looks broken.
 */
function StackedPeek({ items }: { items: PeekItem[] }) {
  const visible = items.slice(0, 3);
  const overflow = items.length - visible.length;

  const [resolved, setResolved] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const allReady = resolved.size >= visible.length;
  const markResolved = useCallback((i: number) => {
    setResolved((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }, []);

  // Per-depth pose. Index 0 = front (items[0]); larger index = deeper.
  // Tuned so back cards visibly peek out without busting the panel padding
  // (p-8) — i=2's corner is ~30px past the front; needs >= 32px of slack.
  const layers = [
    { dx: 0, dy: 0, rot: 0, scale: 1, opacity: 1 }, //          front
    { dx: 14, dy: 10, rot: 5, scale: 0.97, opacity: 0.92 }, //  middle
    { dx: 28, dy: 18, rot: 9, scale: 0.94, opacity: 0.78 }, //  back
  ];

  return (
    <div
      className={cn(
        "relative transition-opacity duration-200",
        DECK_FRONT_W,
        allReady ? "opacity-100" : "opacity-0",
      )}
    >
      {visible.map((item, i) => {
        const pose = layers[i];
        const isFront = i === 0;
        return (
          <div
            key={i}
            // Front uses `relative` (not static) so its `zIndex` applies —
            // `z-index` is a no-op on static elements, which would let the
            // absolute back layers stack above the front regardless of value.
            // Front being `relative` also keeps it in-flow so the container
            // sizes to it.
            className={isFront ? "relative" : "absolute inset-0"}
            style={{
              transform: `translate(${pose.dx}px, ${pose.dy}px) rotate(${pose.rot}deg) scale(${pose.scale})`,
              transformOrigin: "center center",
              opacity: pose.opacity,
              zIndex: visible.length - i,
            }}
          >
            {item.kind === "card" ? (
              // Stacked: every layer keeps the same shape so the layered
              // transforms overlap predictably. The front layer's bg is
              // forced opaque so back cards' content can't bleed *through*
              // it — translucency only makes sense where the page bg sits
              // behind, which is true for back cards (peeking from behind)
              // but not for the front (a full card sits behind it).
              // Every layer carries its own `shadow-raised` so the deck reads
              // as real stacked cards — each lifted above the one behind it —
              // not one silhouette with a single outer shadow. Safe now that
              // the shadow is light (raised, black/5): each layer's wrapper
              // opacity (0.92 / 0.78) also fades its shadow, so the back
              // cards' shadows recede instead of compounding into mud (which
              // the old heavy shadow-2xl did).
              <PeekCard
                item={item}
                fixedAspect
                className={cn("shadow-raised", isFront && "bg-card")}
                onResolved={() => markResolved(i)}
              />
            ) : (
              <PeekThumb
                image={item.image}
                className={cn("aspect-video shadow-raised", isFront && "bg-muted")}
                onResolved={() => markResolved(i)}
              />
            )}
          </div>
        );
      })}

      {overflow > 0 && (
        <div
          className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-sm bg-background/85 backdrop-blur-sm text-[10px] font-mono text-muted-foreground tracking-tight"
          style={{ zIndex: visible.length + 1 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
