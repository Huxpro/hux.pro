"use client";

import { HANDOFF, useHomeEditing } from "@/components/ui/home-edit-store";
import { cn } from "@/lib/utils";
import { t, useLocale, type Locale } from "@/services";
import { useWallpaper } from "@/systems/ambient";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, GitCommit, Home, Search, Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
//   • The selected pill is one absolutely-positioned span that animates `x`
//     by whole multiples of its own width — not `layoutId`, and not a border
//     on the tab. Five `flex-1` tabs are exactly a fifth of the track each, so
//     the pill needs no measuring, no ResizeObserver and no state: the active
//     index is the animation. A shared-element projection would instead
//     re-run whenever anything else in the bar moved — which the scroll
//     shrink does on every scroll — and the pill would trail the bar rather
//     than sit in it.
//   • The scroll state is a transform on the whole bar, so the shrink costs
//     no layout at all; the pill is laid out inside that transform and comes
//     along for free.
// =============================================================================

/** cubic-bezier for chrome that reshapes — the site's morph curve. */
const EASE = [0.32, 0.72, 0, 1] as const;

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

export function CommandTabBar() {
  const { toggle } = useCommand();
  const { locale } = useLocale();
  const pathname = usePathname();
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

  const active = activeTabOf(pathname);
  // Nowhere to be (an unlisted route): the pill parks under the palette — the
  // one tab that is never wrong — and fades out there, rather than vanishing
  // from under the finger that just left it.
  const index = TABS.findIndex((tab) => tab.id === (active ?? "search"));

  return (
    <>
      <div
        className={cn(
          "system-chrome fixed bottom-6 left-0 right-0 z-50 px-6",
          "flex justify-center pointer-events-none"
        )}
      >
        <motion.nav
          aria-label={t(locale, "navigation")}
          // The scroll state, published the way the other chrome publishes
          // its gesture states (`data-pull-armed`, `data-dock-pad`): visible
          // in the inspector, and something a test can wait on.
          data-shrunk={shrunk || undefined}
          className={cn(
            "pointer-events-auto relative flex w-full max-w-sm items-center",
            "rounded-full p-1.5",
            // Panel fill, not the button's: this is a full-width surface
            // lying over the text of the page, and at the button's 50% the
            // paragraph behind it reads straight through the bar in dark
            // mode. Live Activity's panels are the same job at the same
            // strength.
            "bg-glass-overlay backdrop-blur-xl",
            "border border-border/50",
            "shadow-raised",
            yielding && "pointer-events-none"
          )}
          // The bar shrinks toward the edge it is anchored to, so the gap
          // under it stays the gap and only the bar changes size.
          style={{ transformOrigin: "bottom center" }}
          animate={{ opacity: yielding ? 0 : 1, scale: shrunk ? SHRUNK_SCALE : 1 }}
          transition={{
            scale: { duration: 0.34, ease: EASE },
            opacity: yielding
              ? { duration: HANDOFF.out }
              : { duration: HANDOFF.in, delay: HANDOFF.delay },
          }}
        >
          {/* The pill's track: the nav's content box, so a fifth of it is a
              tab and `x: 100%` is exactly one tab across. */}
          <span className="pointer-events-none absolute inset-1.5">
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
              style={{ width: `${100 / TABS.length}%` }}
              initial={false}
              animate={{ x: `${index * 100}%`, opacity: active ? 1 : 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "tween", duration: 0.28, ease: EASE }
              }
            />
          </span>

          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              locale={locale}
              active={tab.id === active}
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
  active,
  searchRef,
  hold,
  onSearch,
}: {
  tab: Tab;
  locale: Locale;
  active: boolean;
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
    active ? "text-foreground" : "text-muted-foreground",
    "hover:text-foreground focus-visible:text-foreground",
    "active:text-foreground",
    // Touch-down wash, but only where there is no pill under the finger —
    // on the selected tab the pill is already the fill, and a second one
    // over it reads as the tab flashing rather than answering.
    !active && "active:bg-foreground/[0.06]"
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
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {icon}
    </Link>
  );
}
