"use client";

/**
 * MediaStrip — a commit's contact sheet.
 *
 * The `covers` form prints one of these under each folded row: every cover
 * the commit is carrying, as a row of `covers` tiles (attachment-tile.tsx)
 * in authored order. It is the answer to the /works paradox — folded, the page is a perfect two-screen
 * overview and none of the media exists; unfolded, the media is all there
 * and the overview is gone. The strip keeps one row per commit and still
 * puts the work on screen.
 *
 * It is not a picture of the row: the thumbs are the real affordances, wired
 * to the same door the expanded block opens — the attachment system, which
 * sends a video to the theater, a deck to the stage, a card to an in-app
 * window on a desktop, and everything to the attachment sheet on a phone.
 * Nothing here needs a pointer, which is the other half of the point — the
 * hover peek this stands beside has never existed on a phone.
 *
 * Deliberately chrome-light: the tiles and their chips, nothing else. Titles
 * live on the row above and the commit's own description sits over the
 * covers; a caption under every thumbnail on top of that would undo the
 * density the strip exists for.
 *
 * When the covers are wider than the column the strip runs on past it,
 * under the page's bleed (`--page-bleed`, globals.css): to the gutter's
 * edge on a phone, where it scrolls, and into the margin on a desk, where
 * three covers simply fit. A cover is only ever cut by the screen. A row of
 * covers cut mid-page reads as a mistake; the same row running under the
 * edge reads as a rail there is more of, which is what it is.
 *
 * Two more shapes, for the `layout` flag's arrangements of a row
 * (TimelineCommit) — the same tiles, doors and peeks, laid out otherwise:
 *
 *  - `deck` — the covers as one pile: the first in front at the width it
 *    is given, the next two offset down and to the right behind it, and the
 *    count on it. The front cover is the door (it opens the set at the
 *    first, and the sheet or the theater pages through the rest); the ones
 *    behind are its edges, not second doors.
 *  - `wide` — one cover across the column, cropped 2:1 and capped in
 *    height, leading its row.
 *
 * A deck opens up under a pointer three ways (`mode`, the `deck` flag):
 * `click` — the edges and the count, and a click opens the set; `fan` —
 * hovering or focusing it spreads every cover out in place, each its own
 * door; `scrub` — moving across it turns its covers, as scrubbing an album
 * does, with a pager that shows while it is being read. All of it is CSS on
 * `group/deck` (hover exists only where a pointer does, so none of it wakes
 * under a finger, which taps through to the sheet as it always did); the
 * one script is the arrow keys moving focus between a scrub's covers.
 */

import {
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Layers } from "lucide-react";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { DeckMode } from "../works-flags";
import type { Media, StripItem } from "@/lib/log";
import {
  AttachmentTile,
  resolveTile,
  type AttachmentTileSize,
  type TileSlot,
} from "./attachment-tile";
import { ExternalImage } from "./external-image";
import { InspectableMedia } from "./inspectable";
import { mediaPeek } from "./media-peek";

export interface MediaStripProps {
  /**
   * The covers to print, already resolved against the viewer's locale by
   * `getMediaStripItems`. The caller derives them (rather than this
   * component) so a row can ask "is there a strip?" — which decides whether
   * the hover peek is redundant — without building the list twice.
   */
  items: StripItem[];
  /**
   * The commit's attachments as one set (see systems/attachments). A cover
   * opens the set at its own item; without a set, or outside the provider,
   * covers are plain outbound links.
   */
  set?: AttachmentSet | null;
  /**
   * Whether a cover peeks on hover: the form's `peek` (lib/log-view.ts)
   * and a pointer to hover with. Off, no peek tree is built — a phone would
   * build and discard one per cover otherwise.
   */
  peek?: boolean;
  /** `strip` (the default), `deck` or `wide` — see the header. */
  shape?: "strip" | "deck" | "wide";
  /** The strip's tile: `covers`, or `small` for the covers that follow a
   *  `wide` one. */
  size?: Extract<AttachmentTileSize, "covers" | "small">;
  /**
   * `deck` and `wide`: something to wear on the front cover — the row's
   * project mark, positioned by the caller. Decoration: the cover under it
   * is still the door.
   */
  badge?: ReactNode;
  /** How many the row holds, for the count on the cover (`deck`, `wide`);
   *  the deck counts its own items by default. */
  total?: number;
  /** Where the count shows, for a shape that shows it only somewhere. */
  countClassName?: string;
  /** `deck`: how it opens up under a pointer (the `deck` flag). */
  mode?: DeckMode;
  /** `deck` in `fan` mode: which way the covers spread — over the text to
   *  the left (a row), or down over what follows (a tile, whose left may
   *  be the page's edge). */
  fanTo?: "left" | "down";
  className?: string;
  /** Editor inspect: the same handle the leftover renderer wears. */
  inspecting?: boolean;
  onInspect?: (media: Media) => void;
  selectedMedia?: Media | null;
}

/** `fan`: the most covers a fan spreads. No row carries more; a deck past
 *  it spreads its first five, and each opens the set, which holds them all. */
const FAN_MAX = 5;
/** The pile at rest: the front cover, then its two edges fading back. */
const REST_OPACITY = [1, 0.7, 0.45] as const;

/** The deck as one control, for a screen reader: what it holds. */
function deckLabel(count: number, locale: string): string {
  return locale === "zh" ? `${count} 个附件` : `${count} attachments`;
}

/**
 * `scrub`: the classes that raise cover i while its door is under the
 * pointer or has the key's focus, and light its pager segment — spelled out
 * per index, since the stylesheet is built from the source text. Six is
 * more covers than any row carries; a deck past it scrubs the first six.
 *
 * The hover halves ask `pointer-fine` first, as the widgets' scroll does
 * (docs/system-widget-scroll.md): a `:hover` inside `:has()` is not
 * Tailwind's `hover:` and would otherwise stick under a finger — tap the
 * right half of a deck, close the sheet, and find its second cover up.
 */
const SCRUB_UP = [
  "pointer-fine:group-has-[[data-zone='0']:hover]/deck:z-20 group-has-[[data-zone='0']:focus-visible]/deck:z-20",
  "pointer-fine:group-has-[[data-zone='1']:hover]/deck:z-20 group-has-[[data-zone='1']:focus-visible]/deck:z-20",
  "pointer-fine:group-has-[[data-zone='2']:hover]/deck:z-20 group-has-[[data-zone='2']:focus-visible]/deck:z-20",
  "pointer-fine:group-has-[[data-zone='3']:hover]/deck:z-20 group-has-[[data-zone='3']:focus-visible]/deck:z-20",
  "pointer-fine:group-has-[[data-zone='4']:hover]/deck:z-20 group-has-[[data-zone='4']:focus-visible]/deck:z-20",
  "pointer-fine:group-has-[[data-zone='5']:hover]/deck:z-20 group-has-[[data-zone='5']:focus-visible]/deck:z-20",
] as const;
const SCRUB_SEG = [
  "pointer-fine:group-has-[[data-zone='0']:hover]/deck:bg-white group-has-[[data-zone='0']:focus-visible]/deck:bg-white",
  "pointer-fine:group-has-[[data-zone='1']:hover]/deck:bg-white group-has-[[data-zone='1']:focus-visible]/deck:bg-white",
  "pointer-fine:group-has-[[data-zone='2']:hover]/deck:bg-white group-has-[[data-zone='2']:focus-visible]/deck:bg-white",
  "pointer-fine:group-has-[[data-zone='3']:hover]/deck:bg-white group-has-[[data-zone='3']:focus-visible]/deck:bg-white",
  "pointer-fine:group-has-[[data-zone='4']:hover]/deck:bg-white group-has-[[data-zone='4']:focus-visible]/deck:bg-white",
  "pointer-fine:group-has-[[data-zone='5']:hover]/deck:bg-white group-has-[[data-zone='5']:focus-visible]/deck:bg-white",
] as const;

export function MediaStrip({
  items,
  set,
  peek = true,
  shape = "strip",
  badge,
  total,
  countClassName,
  mode = "click",
  fanTo = "left",
  size = "covers",
  className,
  inspecting = false,
  onInspect,
  selectedMedia = null,
}: MediaStripProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  // Once per item, not once per tile per render (attachment-tile.tsx).
  const slots = useMemo(
    () => items.map((item) => resolveTile(item, locale, set, attachments)),
    [items, locale, set, attachments],
  );

  if (slots.length === 0) return null;

  // One cover's tile, with its peek and its inspect handle — the strip's,
  // whatever shape holds it.
  const cover = (slot: TileSlot, i: number, tile: ReactNode, peeks = true) => {
    // The row itself stops peeking once it prints its covers (see
    // `showCursorPreview` in TimelineCommit); each cover peeks instead,
    // in the same vocabulary, showing what it is at a readable size —
    // and whole, where the tile crops.
    const spec = peek && peeks
      ? mediaPeek(slot.media, locale, { leaves: slot.leaves })
      : null;
    return (
      <MagneticPreview
        key={`${slot.media.url}-${i}`}
        preview={spec?.node}
        enabled={!!spec}
        panelClassName={spec?.panelClassName}
        className={shape === "strip" ? "shrink-0 snap-start" : "block"}
      >
        <InspectableMedia
          media={slot.media}
          inspecting={inspecting}
          selected={selectedMedia === slot.media}
          onInspect={onInspect}
        >
          {tile}
        </InspectableMedia>
      </MagneticPreview>
    );
  };

  // How many the pile or the hero stands for, where a count is read: on it.
  const count = total ?? slots.length;
  const countChip = count > 1 && (
    <span
      aria-label={`${count} attachments`}
      className={cn(
        "pointer-events-none absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-background/85 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground backdrop-blur-sm",
        countClassName,
      )}
    >
      <Layers aria-hidden className="h-3 w-3" />
      {count}
    </span>
  );

  if (shape === "wide") {
    const slot = slots[0];
    return (
      <div data-row-body className={cn("relative min-w-0", className)}>
        {cover(
          slot,
          0,
          <AttachmentTile
            slot={slot}
            size="cell"
            locale={locale}
            set={set}
            attachments={attachments}
            className="max-h-80"
          />,
        )}
        {countChip}
        {badge}
      </div>
    );
  }

  // ── fan ──────────────────────────────────────────────────────────────
  // Every cover is a real tile, stacked as the pile at rest (the front one
  // and two edges, as `click` draws it; any more wait unseen). Hovering the deck, or a key's
  // focus inside it, moves each to its place in the fan, and each is its
  // own door into the set at its own item. The front cover keeps its place
  // and the badge; a cover under the pointer lifts, whole, over the ones
  // it lay under.
  //
  // To the left, a row's fan spreads over the row's own text and stops at
  // its edge: the step is whatever lays the last cover's left edge on the
  // text's (the row is the `@container`, and the text column is the row
  // less the hash and the rail's node, 5.75rem), never more than a cover
  // and a gap — so three covers overlap by a third, four by half, and none
  // reaches the hash, the date or the next row — nor the graph's lanes and
  // refs, which hang left of the node. Down, a tile's fan steps by 58% of a
  // cover over the tiles after it (a tile's left may be the page's edge),
  // and stops short of the next chapter's ref, which spans the sheet below
  // (its marker, `data-chapter`): measured as the pointer or a key arrives,
  // before the fan's beat, the step shrinks so the last cover ends above it.
  //
  // Positions are custom properties read by `translate`, so the whole fan
  // is one CSS transition and no render. It waits a beat before it opens
  // (a pointer crossing the deck on its way elsewhere does not fan it), and
  // closes at once; under reduced motion it moves without animating.
  if (shape === "deck" && mode === "fan" && slots.length > 1) {
    const fanned = slots.slice(0, FAN_MAX);
    const gaps = fanned.length - 1;
    const step =
      fanTo === "left"
        ? `min(100% + 0.5rem, (100cqw - 5.75rem - 100%) / ${gaps})`
        : "min(58%, var(--fan-room, 58%))";
    const measureRoom =
      fanTo === "down"
        ? (e: React.SyntheticEvent<HTMLDivElement>) => {
            const deck = e.currentTarget;
            const front = deck.firstElementChild?.getBoundingClientRect();
            if (!front) return;
            const stop = [...document.querySelectorAll("[data-chapter]")]
              .map((el) => el.getBoundingClientRect().top)
              .filter((top) => top > front.top + 1)
              .reduce((a, b) => Math.min(a, b), Infinity);
            // 8px of air over the ref; the front cover's own height is not
            // the fan's to spend.
            const room = (stop - 8 - front.bottom) / gaps;
            deck.style.setProperty(
              "--fan-room",
              Number.isFinite(room) ? `${Math.max(0, room)}px` : "58%",
            );
          }
        : undefined;
    return (
      <div
        data-row-body
        data-deck="fan"
        onPointerEnter={measureRoom}
        onFocusCapture={measureRoom}
        role="group"
        aria-label={deckLabel(count, locale)}
        className={cn(
          // Over what follows it while spread (a fan down crosses the next
          // row of tiles).
          "group/deck relative isolate min-w-0 hover:z-50 has-[:focus-visible]:z-50",
          className,
        )}
      >
        {fanned.map((slot, i) => {
          const rest = Math.min(i, 2) * 5;
          const style = {
            "--rest": `${rest}px ${rest}px`,
            "--fan":
              fanTo === "left"
                ? `calc(${-i} * (${step})) 0`
                : `0 calc(${i} * ${step})`,
            "--rest-opacity": i < REST_OPACITY.length ? REST_OPACITY[i] : 0,
            // The front on top, each after it under the one before; the
            // stacking is explicit, so the DOM (and the tab order) can run
            // front to back.
            zIndex: 30 - i,
          } as CSSProperties;
          return (
            <div
              key={`${slot.media.url}-${i}`}
              style={style}
              className={cn(
                i === 0 ? "relative" : "absolute left-0 top-0 w-full",
                // Opaque: a fanned cover lies over the row's text, and a tile's
                // own fill is a wash (a cover still loading, or one that
                // failed, would show the words through it).
                "rounded-md bg-background [translate:var(--rest)] [opacity:var(--rest-opacity)]",
                "transition-[translate,opacity,scale,box-shadow] duration-200 ease-out motion-reduce:transition-none",
                "group-hover/deck:[translate:var(--fan)] group-hover/deck:opacity-100 group-hover/deck:shadow-[0_1px_2px_rgb(0_0_0/0.10),0_4px_10px_-2px_rgb(0_0_0/0.18)] group-hover/deck:delay-100",
                "group-has-[:focus-visible]/deck:[translate:var(--fan)] group-has-[:focus-visible]/deck:opacity-100 group-has-[:focus-visible]/deck:shadow-[0_1px_2px_rgb(0_0_0/0.10),0_4px_10px_-2px_rgb(0_0_0/0.18)]",
                // The lift: over its neighbours, a touch larger — at once,
                // not after the fan's beat.
                "hover:!z-40 hover:[scale:1.03] hover:delay-0 has-[:focus-visible]:!z-40 has-[:focus-visible]:[scale:1.03]",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
              )}
            >
              {cover(
                slot,
                i,
                <AttachmentTile
                  slot={slot}
                  size="cell"
                  locale={locale}
                  set={set}
                  attachments={attachments}
                />,
                // The fan is the peek: a panel over it would hide the
                // covers it has just spread.
                false,
              )}
              {i === 0 && (
                <>
                  <span className="transition-opacity motion-reduce:transition-none group-hover/deck:opacity-0 group-has-[:focus-visible]/deck:opacity-0">
                    {countChip}
                  </span>
                  {badge}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── scrub ────────────────────────────────────────────────────────────
  // The covers stacked in one place, under as many invisible doors as there
  // are covers, side by side across the deck. The door under the pointer
  // (or the key's focus) raises its cover, and a pager along the foot says
  // which; a click opens the set at the cover it shows. Covers are `inert`:
  // the doors are the deck's only controls, one per cover, in order.
  if (shape === "deck" && mode === "scrub" && slots.length > 1) {
    const turned = slots.slice(0, SCRUB_UP.length);
    // A click opens the set at the cover it shows. A finger scrubs nothing —
    // the front cover is all it has seen — so a tap anywhere opens at the
    // front, and the sheet pages on from there.
    const open = (e: MouseEvent<HTMLAnchorElement>, index: number) => {
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const native = e.nativeEvent as PointerEvent;
      const at = native.pointerType === "touch" ? turned[0].index : index;
      if (at < 0 || !set || !attachments) return;
      e.preventDefault();
      attachments.open(set, at);
    };
    // The deck is one stop in the tab order (its first door); the arrows,
    // Home and End move between its doors — a focus move, not a render, and
    // the focus is what turns the cover.
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      const doors = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-zone]")];
      const at = doors.indexOf(document.activeElement as HTMLElement);
      if (at < 0) return;
      const last = doors.length - 1;
      const next =
        e.key === "ArrowRight" ? Math.min(at + 1, last)
        : e.key === "ArrowLeft" ? Math.max(at - 1, 0)
        : e.key === "Home" ? 0
        : e.key === "End" ? last
        : null;
      if (next === null) return;
      e.preventDefault();
      doors[next]?.focus();
    };
    const behind = turned.slice(1, 3);
    return (
      <div
        data-row-body
        data-deck="scrub"
        role="group"
        aria-label={deckLabel(count, locale)}
        onKeyDown={onKeyDown}
        className={cn(
          "group/deck relative min-w-0 rounded-md",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
          className,
        )}
      >
        {behind
          .map((slot, i) => (
            <span
              key={`${slot.media.url}-behind`}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 aspect-[2/1] w-full overflow-hidden rounded-md border border-border/60 bg-muted"
              style={{
                transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 5}px)`,
                opacity: i === 0 ? 0.7 : 0.45,
              }}
            >
              <ExternalImage src={slot.image} alt="" className="block h-full w-full object-cover" />
            </span>
          ))
          .reverse()}
        <div className="relative">
          <div inert className="relative">
            {turned.map((slot, i) => (
              <div
                key={`${slot.media.url}-${i}`}
                className={cn(
                  // Opaque, as a fan's covers are: the one raised hides the
                  // front whatever its image does.
                  "rounded-md bg-background",
                  i === 0 ? "relative z-10" : "absolute inset-0 z-0",
                  SCRUB_UP[i],
                )}
              >
                <AttachmentTile
                  slot={slot}
                  size="cell"
                  locale={locale}
                  set={set}
                  attachments={attachments}
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 z-30 flex">
            {turned.map((slot, i) => (
              <a
                key={`${slot.media.url}-door`}
                data-zone={i}
                href={slot.media.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${slot.caption.label} (${i + 1}/${turned.length})`}
                tabIndex={i === 0 ? 0 : -1}
                onClick={(e) => open(e, slot.index)}
                className="h-full flex-1 cursor-pointer outline-none"
              />
            ))}
          </div>
          {/* The pager: which cover is up, while the deck is being read —
              centred on the foot, clear of the cover's kind chip at its
              bottom-left, on a scrim of its own so it reads on a white
              page of a paper as on a dark slide. */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full bg-black/35 px-1.5 py-[5px] opacity-0 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none group-hover/deck:opacity-100 group-has-[:focus-visible]/deck:opacity-100"
          >
            {turned.map((slot, i) => (
              <span
                key={`${slot.media.url}-seg`}
                className={cn("h-[3px] w-3.5 rounded-full bg-white/40", SCRUB_SEG[i])}
              />
            ))}
          </div>
          {/* Over the raised cover (the covers' z is theirs, not a layer's). */}
          <span className="pointer-events-none absolute inset-0 z-40 transition-opacity motion-reduce:transition-none group-hover/deck:opacity-0 group-has-[:focus-visible]/deck:opacity-0">
            {countChip}
          </span>
          <span className="pointer-events-none absolute inset-0 z-40">{badge}</span>
        </div>
      </div>
    );
  }

  if (shape === "deck") {
    const [front, ...rest] = slots;
    // Two edges at most: a pile reads as "more" at three. They step down
    // and to the right, 5px each, past the front cover's box — so the front
    // cover keeps the width the deck was given whatever it holds, its edges
    // aligned with a single cover's, and the pile spends the row's padding
    // rather than its column.
    const behind = rest.slice(0, 2);
    return (
      <div data-row-body className={cn("relative min-w-0", className)}>
        {behind
          .map((slot, i) => (
            <span
              key={`${slot.media.url}-behind`}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 aspect-[2/1] w-full overflow-hidden rounded-md border border-border/60 bg-muted"
              style={{
                transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 5}px)`,
                opacity: i === 0 ? 0.7 : 0.45,
              }}
            >
              <ExternalImage
                src={slot.image}
                alt=""
                className="block h-full w-full object-cover"
              />
            </span>
          ))
          .reverse()}
        <div className="relative">
          {cover(
            front,
            0,
            <AttachmentTile
              slot={front}
              size="cell"
              locale={locale}
              set={set}
              attachments={attachments}
            />,
          )}
          {countChip}
          {badge}
        </div>
      </div>
    );
  }

  return (
    <div
      // Content inside the row that is not the row's fold trigger — see the
      // `data-row-body` note in TimelineCommit. Hovering a cover brightens
      // that cover, not the whole commit, exactly as hovering an expanded
      // tile does.
      data-row-body
      className={cn(
        // `w-max` so the track is as wide as the covers it draws and no
        // wider; past that it stops growing and scrolls instead. The cap is
        // the column plus the page's bleed, and the track bleeds by the
        // same, so the scroll edge is the screen's edge and the last cover
        // has a gutter to rest in (`pr-6`). Layout only: the clicks are the
        // covers' own, so an empty stretch of this band is the row's to take.
        "flex w-max max-w-[calc(100%+var(--page-bleed))] gap-2 pr-6",
        "[margin-right:calc(var(--page-bleed)*-1)]",
        "overflow-x-auto overscroll-x-contain",
        "snap-x snap-proximity no-scrollbar",
        className,
      )}
    >
      {slots.map((slot, i) =>
        cover(
          slot,
          i,
          <AttachmentTile
            slot={slot}
            size={size}
            locale={locale}
            set={set}
            attachments={attachments}
          />,
        ),
      )}
    </div>
  );
}
