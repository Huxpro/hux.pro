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
import type { Commit as CommitData, PeekItem } from "@/lib/log";
import { getCommitPeekItems, localize } from "@/lib/log";
import { cn } from "@/lib/utils";
import { ExternalImage } from "./media/external-image";
import { CardFace } from "./media/link";
import { normalizeCommit } from "./commit-data";
import { TimelineCommit, type BeamSpec } from "./timeline-commit";
import { CommitCompact } from "./commit-compact";

// =============================================================================
// Types
// =============================================================================

export type CommitVariant = "timeline" | "card" | "bare";

export interface CommitProps {
  commit: CommitData;
  locale?: Locale;
  variant?: CommitVariant;
  defaultExpanded?: boolean;
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
}

// =============================================================================
// Main Component
// =============================================================================

export function Commit({
  commit,
  locale = "en",
  variant = "card",
  defaultExpanded = false,
  className,
  hideDate = false,
  rail,
  segmentId,
  isSegmentActive = false,
  beamSpec = null,
  onBeamSet,
  onBeamClear,
}: CommitProps) {
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

  switch (variant) {
    case "timeline":
      return (
        <TimelineCommit
          data={data}
          cursorPreview={preview?.node ?? null}
          cursorPreviewPanelClassName={preview?.panelClassName}
          defaultExpanded={defaultExpanded}
          className={className}
          hideDate={hideDate}
          rail={rail}
          isRole={commit.type === "role"}
          segmentId={segmentId ?? null}
          isSegmentActive={isSegmentActive}
          beamSpec={beamSpec}
          onBeamSet={onBeamSet}
          onBeamClear={onBeamClear}
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

/** Strips the cursor-preview panel's bg / border / shadow / blur so the peek
 *  content can supply its own. */
const BARE_PANEL_CHROME =
  "bg-transparent border-transparent shadow-none backdrop-blur-none";

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
  const items = getCommitPeekItems(commit);

  if (items.length >= 2) {
    return {
      // Strip the panel chrome so the rotated cards read as floating, not
      // contained in another box — the rotation IS the visual signal of
      // "there's more here" and a background defeats it.
      panelClassName: `p-2 ${BARE_PANEL_CHROME}`,
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
        node: <PeekCard item={item} className="w-72" />,
      };
    }
    return {
      panelClassName: "p-0 overflow-hidden",
      node: <PeekThumb image={item.image} className="w-72 aspect-video" />,
    };
  }

  const description = localize(commit.description, locale);
  if (!description) return null;

  return {
    node: (
      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed max-w-[14rem]">
        {description}
      </p>
    ),
  };
}

// Peek items render as `<div>` (never `<a>`) so they can sit inside the
// row's own clickable wrapper without producing nested anchors.

/** Bare cover image inside a soft card frame. Used for video / image media. */
function PeekThumb({
  image,
  className,
  onResolved,
}: {
  image: string;
  className?: string;
  onResolved?: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-md overflow-hidden border border-border/40 bg-muted/30 shadow-md",
        className,
      )}
    >
      {/* object-cover is safe for thumbnails: YouTube / Bilibili / Vimeo all
          serve 16:9 covers, matching the aspect-video container. */}
      <ExternalImage
        src={image}
        className="block w-full h-full object-cover"
        loading="eager"
        onResolved={onResolved}
      />
    </div>
  );
}

/**
 * Mini OG-style card for `kind:"link", present:"card"` media — a thin
 * adapter over `CardFace` that picks the right slot shape per context:
 *  - Single-item peek: natural aspect (matches the expanded `/works`
 *    LinkCard so the hover and the row read as the same artifact).
 *  - Stacked peek:     fixed `aspect-[2/1]` + blur backdrop, because the
 *    layered `translate/rotate/scale` transforms need predictable
 *    rectangles to overlap cleanly.
 *
 * Rendering as a `<div>` (CardFace's default element) means it can sit
 * inside the row's clickable wrapper without nested anchors.
 */
function PeekCard({
  item,
  fixedAspect = false,
  className,
  onResolved,
}: {
  item: Extract<PeekItem, { kind: "card" }>;
  fixedAspect?: boolean;
  className?: string;
  onResolved?: () => void;
}) {
  return (
    <CardFace
      url={item.url}
      title={item.title}
      description={item.description}
      image={item.image}
      size="compact"
      fixedAspect={fixedAspect}
      className={className}
      onImgResolved={onResolved}
    />
  );
}

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
  // Scale-down on back layers keeps them from poking past the panel clip
  // when rotated, while still letting their corners peek out at the bottom-
  // right of the front card.
  const layers = [
    { dx: 0, dy: 0, rot: 0, scale: 1, opacity: 1 }, //          front
    { dx: 6, dy: 5, rot: 2.5, scale: 0.96, opacity: 0.85 }, //  middle
    { dx: 12, dy: 10, rot: 5, scale: 0.92, opacity: 0.65 }, //  back
  ];

  return (
    <div
      className={cn(
        "relative w-72 transition-opacity duration-200",
        allReady ? "opacity-100" : "opacity-0",
      )}
    >
      {visible.map((item, i) => {
        const pose = layers[i];
        const isFront = i === 0;
        return (
          <div
            key={i}
            className={isFront ? "" : "absolute inset-0"}
            style={{
              transform: `translate(${pose.dx}px, ${pose.dy}px) rotate(${pose.rot}deg) scale(${pose.scale})`,
              transformOrigin: "center center",
              opacity: pose.opacity,
              zIndex: visible.length - i,
            }}
          >
            {item.kind === "card" ? (
              // Stacked: every layer must be the same shape so the layered
              // transforms overlap predictably.
              <PeekCard
                item={item}
                fixedAspect
                onResolved={() => markResolved(i)}
              />
            ) : (
              <PeekThumb
                image={item.image}
                className="aspect-video"
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
