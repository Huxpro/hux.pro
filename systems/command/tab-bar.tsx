"use client";

import { HANDOFF, useHomeEditing } from "@/components/ui/home-edit-store";
import { cn } from "@/lib/utils";
import { t, useLocale, type Locale } from "@/services";
import { useWallpaper } from "@/systems/ambient";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { FileText, GitCommit, Home, Search, Sparkles } from "lucide-react";
import { Link, useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { onPageScroll, pageScrollTop, type BezelScroll } from "vitre";
import { useCommand } from "./provider";
import { useDevtoolHold } from "./use-devtool-hold";

// =============================================================================
// CommandTabBar — the search button as a phone tab bar.
//
// The palette is still the way around this site; this is the shortcut for the
// four places it is usually asked for, with the palette itself in the middle
// where a thumb already is. Tapping Search opens the same drawer the button
// always did — nothing about the palette changes, only what stands in front
// of it. A devtool switch chooses between this and the button
// (Command → Phone nav); on a desktop the button is untouched.
//
// Three things keep the morph steady, and each of them is a decision:
//
//   • The bar is mounted once in the root layout, so a route change moves the
//     pill and nothing else. Nothing here remounts between pages.
//   • The pill is one absolutely-positioned span whose `x` is a motion value
//     in *pill widths* — not `layoutId`, and not a border on the tab. Five
//     `flex-1` tabs are exactly a fifth of the track each, so a tab is 100%
//     of the pill and the whole bar needs no measuring and no layout state:
//     the active index is the position. A shared-element projection would
//     instead re-run whenever anything else in the bar moved — which the
//     scroll shrink does on every scroll — and the pill would trail the bar
//     rather than sit in it.
//   • The scroll state is a transform on the whole bar, so the shrink costs
//     no layout at all; the pill is laid out inside that transform and comes
//     along for free. It is also why the scrub below reads fractions of a
//     live rect rather than pixels: a fraction is the same number whatever
//     the bar is currently scaled to.
// =============================================================================

/** cubic-bezier for chrome that reshapes — the site's morph curve. */
const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * The pill's travel. Nearly critically damped (ζ ≈ 0.97): it arrives fast and
 * settles without a wobble when a tab is tapped, and under a dragging finger
 * the same spring is what keeps the pill feeling attached to it rather than
 * nailed to it.
 */
const PILL_SPRING = { stiffness: 520, damping: 42, mass: 0.9 } as const;

/** How much the pill lifts while it is being dragged. */
const PILL_LIFT = 1.06;

/** Sideways travel that turns a press into a scrub. */
const DRAG_SLOP_PX = 8;

/** Let go this far above or below the bar and the scrub is called off. */
const DRAG_CANCEL_Y_PX = 72;

/**
 * How small the bar gets while the page is running away under it. iOS 26 does
 * this to Safari's tab bar: the chrome steps back from content in motion and
 * comes forward again the moment the page settles. It is a transform and
 * nothing else — the icons do not re-lay out, they just get smaller.
 */
const SHRUNK_SCALE = 0.86;

/** Back to full size this long after the last scroll event. */
const SETTLE_MS = 420;

/** Scroll deltas under this are momentum jitter and rubber-band, not a scroll. */
const SCROLL_EPSILON = 4;

/** At the very top the bar is always full size, whichever way the page moved. */
const SHRINK_AFTER_PX = 24;

/**
 * How long the floor stays down across a page change. The page transition is
 * 200ms of crossfade and up to 300ms of the identifier morphing (see the View
 * Transition block in globals.css); the tail is the frames in which the new
 * page paints and the compositor gets the blur back up. It then fades rather
 * than switching off (`duration-300` on the layer), so what the eye gets is
 * the bar settling onto the page rather than a slab being taken away.
 */
const NAV_SOLID_MS = 380;

/** The tabs' own radius, which is also what the hold ring has to match. */
const TAB_RADIUS = 22;

type TabId = "home" | "writing" | "search" | "works" | "prompt";

interface Tab {
  id: TabId;
  /** Absent on `search`, which opens the palette instead of going anywhere. */
  href?: string;
  icon: typeof Home;
  /** i18n key for the accessible name. */
  label: Parameters<typeof t>[1];
}

/**
 * The four places, with the palette in the middle. Same glyphs the palette's
 * own navigation rows use (`actions.tsx`) — a tab and its row are one
 * destination, so they are not allowed to look like two.
 */
const TABS: Tab[] = [
  { id: "home", href: "/", icon: Home, label: "home" },
  { id: "writing", href: "/writing", icon: FileText, label: "writingTitle" },
  { id: "search", icon: Search, label: "searchMobile" },
  { id: "works", href: "/works", icon: GitCommit, label: "worksTitle" },
  { id: "prompt", href: "/prompt", icon: Sparkles, label: "promptsTitle" },
];

/**
 * Which tab the current route belongs to, or null where none does — /docs and
 * /editor are reachable but unlisted, and a tab bar that guesses is worse than
 * one that admits it is showing nothing.
 */
function activeTabOf(pathname: string): TabId | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/writing")) return "writing";
  if (pathname.startsWith("/works")) return "works";
  if (pathname.startsWith("/prompt")) return "prompt";
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where a finger is on the track: which tab it is over, and where the pill's
 * left edge has to be for the pill to be centred under it — in pill widths,
 * ×100, because that is the unit the pill's `x` is in.
 *
 * Read off the live rect of the tabs' own box, never off remembered pixels:
 * the bar may be mid-shrink under the finger, and a *fraction* of the rect is
 * the same number at any scale while a pixel offset is not.
 */
function scrubAt(track: HTMLElement | null, clientX: number) {
  if (!track) return null;
  const rect = track.getBoundingClientRect();
  if (!rect.width) return null;
  const reach = ((clientX - rect.left) / rect.width) * TABS.length;
  return {
    index: clamp(Math.floor(reach), 0, TABS.length - 1),
    offset: clamp(reach - 0.5, 0, TABS.length - 1) * 100,
  };
}

/**
 * True while the page is being scrolled *down*, false once it settles or turns
 * around. Page scroll, not window scroll — with the bezel on an iPhone the
 * page scrolls inside a container (see vitre).
 *
 * State, not a motion value: this is two positions with a transition between
 * them, and the whole point is that it does not follow the finger. A
 * scroll-linked scale would re-blur the bar's backdrop on every frame of
 * every scroll, which is the one thing a glass surface must not do.
 *
 * `mode` is only ever a resubscribe key, and it is not optional. `onPageScroll`
 * binds the container it can see when it is called, and the container does not
 * exist yet on this bar's first effect: the bezel reads its boot record after
 * mount, so container scroll arrives a commit later and a subscription taken
 * before it only ever hears the window — which, in container scroll, never
 * moves. Bound this way the bar simply resubscribes when the page changes
 * scroller. (`useHeroFade` re-subscribes on the same signal, off `useBezel()`;
 * that context belongs to the page inside `<Bezel>`, and this bar is a sibling
 * of it, so the mode comes from the ambient provider instead.)
 */
function useScrollShrink(enabled: boolean, mode: BezelScroll): boolean {
  const [shrunk, setShrunk] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last = pageScrollTop();
    let settle: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const y = pageScrollTop();
      const delta = y - last;
      if (Math.abs(delta) < SCROLL_EPSILON) return;
      last = y;
      setShrunk(delta > 0 && y > SHRINK_AFTER_PX);
      clearTimeout(settle);
      settle = setTimeout(() => setShrunk(false), SETTLE_MS);
    };
    const off = onPageScroll(update);
    return () => {
      off();
      clearTimeout(settle);
    };
  }, [enabled, mode]);

  return enabled && shrunk;
}

/**
 * Solid while the page changes.
 *
 * A `backdrop-filter` is not repainted in the same frame as the element that
 * owns it. On iOS Safari a route change lands the bar's *translucency* one or
 * more frames before its blur, and for those frames the new page is legible
 * straight through a bar that is supposed to be frosted — the one moment the
 * material looks like a bug rather than a material.
 *
 * So for the length of the transition the bar gets an opaque floor: a page-
 * ground fill *under* its glass, which the glass then sits on instead of on
 * the page. The material itself never changes, and that is the point —
 * raising the fill to 100% instead would flatten the bar and the pill into
 * one colour, since both are the same base at different strengths and all of
 * the pill's contrast comes from how much page each of them lets through.
 *
 * The floor is the page's ground and not the wallpaper's colour, because
 * nothing here knows the wallpaper's colour: `--tint` is deliberately clamped
 * to a mid lightness for mixing into a surface, and is not what is behind
 * one. So over a picture the bar does lose its borrowed colour for a third of
 * a second — during a crossfade, and it fades back rather than switching. A
 * bar that is a shade too plain for a moment is a smaller lie than a frosted
 * bar you can read the page through.
 *
 * Driven onto the element rather than through state: this has to land in the
 * *same commit* as the route — the one React flushes inside the view
 * transition's update callback — so it is a layout effect writing an
 * attribute, and no render of this bar depends on it.
 */
function useSolidWhilePageChanges(ref: React.RefObject<HTMLElement | null>) {
  const pathname = usePathname();
  const mounted = useRef(false);

  useLayoutEffect(() => {
    // The first paint is not a transition; the bar arrives with the page.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-nav-solid", "");
    const done = setTimeout(
      () => el.removeAttribute("data-nav-solid"),
      NAV_SOLID_MS
    );
    return () => {
      clearTimeout(done);
      el.removeAttribute("data-nav-solid");
    };
  }, [pathname, ref]);
}

export function CommandTabBar() {
  const { toggle } = useCommand();
  const { locale } = useLocale();
  const pathname = usePathname();
  const router = useTransitionRouter();
  const reduceMotion = useReducedMotion();
  // The home grid's jiggle mode wants the bottom of the screen, and this bar
  // is standing in it. Same hand-off the button does (HANDOFF).
  const homeEditing = useHomeEditing();
  const yielding = pathname === "/" && homeEditing;
  // Which element actually scrolls — see `useScrollShrink`.
  const { bezelScroll } = useWallpaper();
  const shrunk = useScrollShrink(!reduceMotion, bezelScroll);
  // The hidden way into the devtool, shared with the button it replaces.
  const searchRef = useRef<HTMLButtonElement>(null);
  const hold = useDevtoolHold(searchRef, TAB_RADIUS);
  const barRef = useRef<HTMLElement>(null);
  useSolidWhilePageChanges(barRef);

  const active = activeTabOf(pathname);
  // Nowhere to be (an unlisted route): the pill parks under the palette — the
  // one tab that is never wrong — and fades out there, rather than vanishing
  // from under the finger that just left it.
  const activeIndex = TABS.findIndex((tab) => tab.id === (active ?? "search"));

  // The pill's position, in pill widths ×100. Born where it belongs, so the
  // first paint of a deep link is not a slide in from Home.
  const target = useMotionValue(activeIndex * 100);
  const travel = useSpring(target, PILL_SPRING);
  const x = useTransform(travel, (v) => `${v}%`);

  const place = useCallback(
    (value: number) => {
      target.set(value);
      if (reduceMotion) travel.jump(value);
    },
    [target, travel, reduceMotion]
  );

  // The scrub: press anywhere on the bar and slide, and the pill comes with
  // the finger while the icons light as it passes them. The page changes on
  // release and never during — a tab bar that navigated mid-drag would load
  // four pages on the way to the fifth. (iOS 26's own tab bar, minus the
  // haptic tick at each boundary, which a phone browser cannot fire.)
  const drag = useRef<{
    pointerId: number;
    track: HTMLElement | null;
    startX: number;
    startY: number;
    scrubbing: boolean;
  } | null>(null);
  // A scrub ends in a release over a tab, so the click it also produces must
  // not arrive as a second, different answer.
  const swallowClick = useRef(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // Route changes the bar did not cause — a palette command, the back button,
  // a link in the page — move the pill the same way a tap does.
  useEffect(() => {
    if (drag.current?.scrubbing) return;
    place(activeIndex * 100);
  }, [activeIndex, place]);

  const endScrub = useCallback(() => {
    drag.current = null;
    setScrubIndex(null);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!e.isPrimary) return;
    swallowClick.current = false;
    drag.current = {
      pointerId: e.pointerId,
      track: e.currentTarget.querySelector<HTMLElement>("[data-tab-track]"),
      startX: e.clientX,
      startY: e.clientY,
      scrubbing: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.scrubbing) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      // Sideways, and more sideways than not: a mostly-vertical drag is
      // someone scrolling the page with a thumb that happens to be down here,
      // and `touch-action: pan-y` will hand it to the browser.
      if (Math.abs(dx) <= DRAG_SLOP_PX || Math.abs(dx) <= Math.abs(dy)) return;
      d.scrubbing = true;
      // Only now: a captured pointer retargets the click that ends a tap, and
      // a tap must reach the tab it landed on.
      e.currentTarget.setPointerCapture(d.pointerId);
    }
    const at = scrubAt(d.track, e.clientX);
    if (!at) return;
    place(at.offset);
    setScrubIndex(at.index);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    endScrub();
    // Not a scrub: it was a tap, and the click that follows is the answer.
    if (!d.scrubbing) return;
    swallowClick.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    const strayed =
      e.clientY < rect.top - DRAG_CANCEL_Y_PX ||
      e.clientY > rect.bottom + DRAG_CANCEL_Y_PX;
    const at = strayed ? null : scrubAt(d.track, e.clientX);
    const tab = at ? TABS[at.index] : null;

    // Called off, or landed on the palette — which is a door, not a place, so
    // the pill goes back to the page that is actually open.
    if (!tab || !tab.href) {
      place(activeIndex * 100);
      if (tab && !tab.href) toggle();
      return;
    }
    place(at!.index * 100);
    if (tab.href !== pathname) router.push(tab.href);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const scrubbing = d.scrubbing;
    endScrub();
    if (scrubbing) place(activeIndex * 100);
  };

  const scrubbing = scrubIndex !== null;
  // Which icon reads as selected: the one under the finger while scrubbing,
  // the open page otherwise. `aria-current` never moves — it belongs to the
  // page that is actually open, and during a scrub nothing has happened yet.
  const litIndex = scrubIndex ?? (active ? activeIndex : null);

  return (
    <>
      <div
        className={cn(
          "system-chrome fixed bottom-6 left-0 right-0 z-50 px-6",
          "flex justify-center pointer-events-none"
        )}
      >
        <motion.nav
          ref={barRef}
          aria-label={t(locale, "navigation")}
          // The scroll state, published the way the other chrome publishes
          // its gesture states (`data-pull-armed`, `data-dock-pad`): visible
          // in the inspector, and something a test can wait on.
          data-shrunk={shrunk || undefined}
          data-scrubbing={scrubbing || undefined}
          className={cn(
            "group/bar pointer-events-auto relative flex w-full max-w-sm items-center",
            "rounded-full p-1.5",
            "border border-border/50",
            "shadow-raised",
            yielding && "pointer-events-none"
          )}
          // The bar shrinks toward the edge it is anchored to, so the gap
          // under it stays the gap and only the bar changes size.
          // `pan-y`: a sideways drag is the scrub, a vertical one is the page
          // being scrolled by a thumb resting down here, and the browser
          // keeps that one (the scrub gets a pointercancel and stands down).
          style={{ transformOrigin: "bottom center", touchAction: "pan-y" }}
          animate={{ opacity: yielding ? 0 : 1, scale: shrunk ? SHRUNK_SCALE : 1 }}
          transition={{
            scale: { duration: 0.34, ease: EASE },
            opacity: yielding
              ? { duration: HANDOFF.out }
              : { duration: HANDOFF.in, delay: HANDOFF.delay },
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClickCapture={(e) => {
            if (!swallowClick.current) return;
            swallowClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* The floor, and the glass standing on it. Two layers rather than
              a fill on the bar itself, because a `backdrop-filter` blurs what
              is painted behind it and a parent's own background is not — see
              `useSolidWhilePageChanges`. Instant going on, eased coming off:
              the blur is what the floor is outrunning, and there is nothing
              to outrun on the way back. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 rounded-full bg-background",
              "opacity-0 transition-opacity duration-300",
              "group-data-[nav-solid]/bar:opacity-100",
              "group-data-[nav-solid]/bar:duration-0"
            )}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 rounded-full",
              // Panel fill, not the button's: this is a full-width surface
              // lying over the text of the page, and at the button's 50% the
              // paragraph behind it reads straight through the bar in dark
              // mode. Live Activity's panels are the same job at the same
              // strength.
              "bg-glass-overlay backdrop-blur-xl"
            )}
          />

          {/* The pill's track: the nav's content box, so a fifth of it is a
              tab and `x: 100%` is exactly one tab across. */}
          <span
            data-tab-track
            className="pointer-events-none absolute inset-1.5"
          >
            <motion.span
              aria-hidden
              data-tab-pill
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                // The site's selected-pill recipe — the lifted fill the
                // album tabs and the theater switch use (`GLASS_PILL`,
                // systems/theater/lib/chrome.ts), written out rather than
                // imported across systems.
                "bg-glass-sheet shadow-sm ring-1 ring-border/50"
              )}
              style={{ width: `${100 / TABS.length}%`, x }}
              initial={false}
              animate={{
                opacity: active || scrubbing ? 1 : 0,
                scale: scrubbing ? PILL_LIFT : 1,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "tween", duration: 0.22, ease: EASE }
              }
            />
          </span>

          {TABS.map((tab, i) => (
            <TabButton
              key={tab.id}
              tab={tab}
              locale={locale}
              current={tab.id === active}
              lit={i === litIndex}
              searchRef={tab.id === "search" ? searchRef : undefined}
              hold={tab.id === "search" ? hold : undefined}
              onSearch={toggle}
            />
          ))}
        </motion.nav>
      </div>
      {hold.ring}
    </>
  );
}

/** One tab: a link to a page, or the button that opens the palette. */
function TabButton({
  tab,
  locale,
  current,
  lit,
  searchRef,
  hold,
  onSearch,
}: {
  tab: Tab;
  locale: Locale;
  /** This tab's page is the one that is open. */
  current: boolean;
  /** The pill is on this tab — the open page, or the finger's during a scrub. */
  lit: boolean;
  /** Only the search tab carries the hold that summons the devtool. */
  searchRef?: React.RefObject<HTMLButtonElement | null>;
  hold?: ReturnType<typeof useDevtoolHold>;
  onSearch: () => void;
}) {
  const Icon = tab.icon;
  const label = t(locale, tab.label);
  const className = cn(
    "pressable relative z-10 flex h-11 flex-1 items-center justify-center rounded-full",
    "select-none outline-none",
    // No press scale: the tabs sit on a backdrop-blur surface, and a
    // transform under the finger makes the compositor re-blur the bar on
    // every frame of the press (same reason the homepage bar has none).
    "transition-colors duration-200",
    lit ? "text-foreground" : "text-muted-foreground",
    "hover:text-foreground focus-visible:text-foreground",
    "active:text-foreground",
    // Touch-down wash, but only where there is no pill under the finger —
    // on the selected tab the pill is already the fill, and a second one
    // over it reads as the tab flashing rather than answering.
    !lit && "active:bg-foreground/[0.06]"
  );
  const icon = <Icon className="h-5 w-5 shrink-0" />;

  if (!tab.href) {
    return (
      <button
        type="button"
        ref={searchRef}
        aria-label={label}
        aria-haspopup="dialog"
        // The hold has already done something by the time the finger lifts,
        // so the press that carried it must not also open the palette.
        onClick={() => {
          if (hold?.consume()) return;
          onSearch();
        }}
        {...hold?.handlers}
        className={className}
      >
        {icon}
      </button>
    );
  }

  return (
    <Link
      href={tab.href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      // A link is draggable by default, and the browser's own link-drag
      // fires `pointercancel` the moment a press on one starts to move —
      // which is exactly the movement the scrub is made of.
      draggable={false}
      className={className}
    >
      {icon}
    </Link>
  );
}
