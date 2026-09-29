"use client";

import { LanguageFilter, PostList } from "@/components/post";
import { HeroExitProvider } from "@/components/ui/hero-exit";
import { PageLayout } from "@/components/ui/page-layout";
import { skipNextViewTransition } from "@/components/ui/widget-morph";
import { formatPostDate, type BlogPost } from "@/lib/content";
import { animate, type AnimationPlaybackControls } from "motion";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// App overlay — a widget opens its page the way iOS opens an app: over a home
// screen that stays.
//
// The view-transition morph and the flip both *navigate*: the page replaces
// the home, so the home can only be a picture (the morph) or gone (the flip),
// closing has to wait for the home to render again, and nothing can follow a
// finger, because a navigation cannot be half-undone. Here nothing navigates.
// The page is rendered into a layer over the home, from data fetched on the
// press, and the URL is moved with `history.pushState` — which the App Router
// takes as a *restore*: `usePathname()` reads `/writing`, the home's tree
// stays mounted, nothing is fetched. A reload, or a link in, is the real page.
//
// So the home is live under the layer the whole time, and the layer is one
// rectangle on one Motion spring:
//
//   open    card's box → the page's (the screen on a phone; the page's
//           column, inset, on anything wider)
//   drag    pulled down at the top of its scroll, it shrinks and follows the
//           finger; let go fast or far and it closes, else it springs back
//   close   wherever it is → the card's box, measured live, with the
//           release's velocity — λhux, Esc, the dimmed home, the back button
//
// The page's content is laid out once, at the page's size, and scaled with
// the rectangle (uniformly, by width, clipped at the bottom), so what grows
// out of the card is the page itself, live.
//
// Back and forward are the browser's: closing pops the entry the open
// pushed, and a traversal that lands on an app's path over the home opens it
// again from its card. The router's own crossfade on that popstate is
// skipped (`skipNextViewTransition`) — it would freeze the frame over the
// spring.
//
// A prototype: only /writing is an app so far.
// ---------------------------------------------------------------------------

// --- Apps --------------------------------------------------------------------

interface App {
  /** Start fetching what the page needs. Called on the press. */
  prefetch: () => void;
  render: () => ReactNode;
}

let writingList: Promise<BlogPost[]> | null = null;
function loadWritingList(): Promise<BlogPost[]> {
  writingList ??= fetch("/api/writing-list").then((r) => {
    if (!r.ok) throw new Error(`writing list: ${r.status}`);
    return r.json() as Promise<BlogPost[]>;
  });
  writingList.catch(() => {
    writingList = null;
  });
  return writingList;
}

const APPS: Record<string, App> = {
  "/writing": { prefetch: () => void loadWritingList(), render: () => <WritingApp /> },
};

function pathOf(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin ? url.pathname : null;
  } catch {
    return null;
  }
}

/** Whether `href` opens as an app over the home rather than as a page. */
export function isOverlayApp(href: string): boolean {
  const path = pathOf(href);
  return !!path && path in APPS;
}

export function prefetchOverlayApp(href: string) {
  const path = pathOf(href);
  if (path) APPS[path]?.prefetch();
}

// --- Store ------------------------------------------------------------------

interface Open {
  path: string;
  card: HTMLElement | null;
}

let current: Open | null = null;
/** Layers mounted right now — see the unmount in `AppLayer`. */
let mountedLayers = 0;
const listeners = new Set<() => void>();
function setOpen(next: Open | null) {
  current = next;
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The history entry an open pushed, so closing knows it can pop it. */
const ENTRY = "huxAppOverlay";

/**
 * Open `href` as an app out of `card`. Returns false when `href` is not an
 * app, and the caller navigates as usual.
 */
export function openOverlayApp(card: HTMLElement, href: string): boolean {
  const path = pathOf(href);
  if (!path || !(path in APPS) || current) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  APPS[path].prefetch();
  setOpen({ path, card });
  window.history.pushState({ [ENTRY]: path }, "", path);
  return true;
}

// --- Geometry ---------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/** The page column, as `--page-col` sets it. */
const PAGE_COL = 680;
const CARD_RADIUS = 16;

/**
 * Where the app stands open: the whole screen when the screen is no wider
 * than the page, else the page's column, inset from the top and bottom — a
 * window with edges, the shape the page's content has.
 */
function openBox(): { box: Box; radius: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw <= PAGE_COL) return { box: { x: 0, y: 0, w: vw, h: vh }, radius: 0 };
  const inset = 16;
  return {
    box: { x: (vw - PAGE_COL) / 2, y: inset, w: PAGE_COL, h: vh - inset * 2 },
    radius: 20,
  };
}

function boxOf(el: HTMLElement | null): Box | null {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

const OPEN_SPRING = { type: "spring", visualDuration: 0.45, bounce: 0.12 } as const;
const CLOSE_SPRING = { type: "spring", visualDuration: 0.38, bounce: 0.08 } as const;
/** How dark the home gets under an open app, and how far it leans in. */
const DIM = 0.35;
const LEAN = 0.04;

// --- Host -------------------------------------------------------------------

/**
 * Mounted by the home screen. Renders the open app, and opens one when a
 * traversal lands on an app's path over the home (back into it, forward).
 */
export function AppOverlayHost() {
  const open = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  const pathname = usePathname();

  useEffect(() => {
    if (current || !(pathname in APPS)) return;
    const card = document.querySelector<HTMLElement>(
      `[data-widget-href="${pathname}"]`,
    );
    setOpen({ path: pathname, card });
  }, [pathname]);

  if (!open) return null;
  return createPortal(
    <AppLayer
      key={open.path}
      path={open.path}
      card={open.card}
      onClosed={() => setOpen(null)}
    />,
    document.body,
  );
}

function AppLayer({
  path,
  card,
  onClosed,
}: {
  path: string;
  card: HTMLElement | null;
  onClosed: () => void;
}) {
  const pathname = usePathname();
  const windowRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const spring = useRef<AnimationPlaybackControls | null>(null);
  const closing = useRef(false);
  const arrived = useRef(false);
  /** The rectangle as last painted, and its corner. */
  const now = useRef<{ box: Box; radius: number; dim: number }>({
    box: { x: 0, y: 0, w: 0, h: 0 },
    radius: CARD_RADIUS,
    dim: 0,
  });
  const home = useRef<HTMLElement | null>(null);

  const cardBox = useCallback((): Box => {
    const live = boxOf(card);
    if (live) return live;
    // No card to go back to (it scrolled away, or never was): shrink toward
    // the middle of where the app is.
    const { box } = openBox();
    return { x: box.x + box.w * 0.3, y: box.y + box.h * 0.35, w: box.w * 0.4, h: box.h * 0.3 };
  }, [card]);

  /** Put the page's content on `box`: scaled by width, clipped at the bottom. */
  const paint = useCallback((box: Box, radius: number, dim: number) => {
    now.current = { box, radius, dim };
    const win = windowRef.current;
    if (!win) return;
    const target = openBox().box;
    const s = box.w / target.w;
    win.style.transform = `translate(${box.x - target.x}px, ${box.y - target.y}px) scale(${s})`;
    const bottom = Math.max(0, target.h - box.h / s);
    win.style.clipPath = `inset(0 0 ${bottom}px 0 round ${radius / s}px)`;
    if (dimRef.current) dimRef.current.style.opacity = String(dim * DIM);
    if (home.current) home.current.style.transform = `scale(${1 + LEAN * dim})`;
  }, []);

  const finish = useCallback(() => {
    if (card) card.style.visibility = "";
    if (home.current) {
      home.current.style.transform = "";
      home.current.style.transformOrigin = "";
      home.current.inert = false;
    }
    document.documentElement.removeAttribute("data-app-overlay");
    card?.focus({ preventScroll: true });
    onClosed();
  }, [card, onClosed]);

  /** Fly to the card, from wherever the rectangle is, at `velocity`. */
  const close = useCallback(
    (velocity = 0) => {
      if (closing.current) return;
      closing.current = true;
      spring.current?.stop();
      const from = now.current;
      const to = cardBox();
      const content = scrollerRef.current;
      content?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 160,
        delay: 140,
        easing: "ease-in",
        fill: "forwards",
      });
      spring.current = animate(0, 1, {
        ...CLOSE_SPRING,
        velocity,
        onUpdate: (q) =>
          paint(
            lerpBox(from.box, to, q),
            lerp(from.radius, CARD_RADIUS, Math.min(Math.max(q, 0), 1)),
            lerp(from.dim, 0, Math.min(Math.max(q, 0), 1)),
          ),
        onComplete: finish,
      });
    },
    [cardBox, finish, paint],
  );

  /** Close from the page: pop the entry the open pushed, if it is ours. */
  const requestClose = useCallback(
    (velocity = 0) => {
      close(velocity);
      if (window.history.state?.[ENTRY] === path) window.history.back();
      else window.history.replaceState(null, "", "/");
    },
    [close, path],
  );

  // Open: from the card's box to the page's, over a home that leans back.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-app-overlay", "");
    home.current =
      card?.closest("main") ??
      document.querySelector<HTMLElement>("main:not([data-app-page] main)");
    if (home.current) {
      home.current.inert = true;
      home.current.style.transformOrigin = "50% 40%";
    }
    const from = cardBox();
    const { box: to, radius } = openBox();
    if (card) card.style.visibility = "hidden";
    paint(from, CARD_RADIUS, 0);
    scrollerRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 160,
      easing: "ease-out",
    });
    spring.current = animate(0, 1, {
      ...OPEN_SPRING,
      onUpdate: (p) =>
        paint(
          lerpBox(from, to, p),
          lerp(CARD_RADIUS, radius, Math.min(Math.max(p, 0), 1)),
          Math.min(p, 1),
        ),
    });
    windowRef.current?.focus({ preventScroll: true });
    mountedLayers++;
    return () => {
      mountedLayers--;
      spring.current?.stop();
      // Unmounted with the home (a link onward navigated away): put back
      // what the open changed, without animating anything, and forget the
      // open — a tick later, so a remount (React's development double
      // mount) is not taken for one.
      if (!closing.current) {
        if (card) card.style.visibility = "";
        document.documentElement.removeAttribute("data-app-overlay");
        window.setTimeout(() => {
          if (mountedLayers === 0 && current) setOpen(null);
        }, 0);
      }
    };
    // Mount-only: the layer is keyed by its path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The URL left the app's path: the back button (or a traversal) closed it.
  useEffect(() => {
    if (pathname === path) {
      arrived.current = true;
      return;
    }
    if (arrived.current) close();
  }, [pathname, path, close]);

  // The router crossfades every popstate; this one is the layer's to animate.
  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname !== path) skipNextViewTransition();
    };
    window.addEventListener("popstate", onPop, { capture: true });
    return () => window.removeEventListener("popstate", onPop, { capture: true });
  }, [path]);

  // Esc closes; so does a resize-safe repaint of the open rectangle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    const onResize = () => {
      if (closing.current || spring.current?.state === "running") return;
      const { box, radius } = openBox();
      paint(box, radius, 1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [requestClose, paint]);

  // Pull down at the top of the scroll: the app shrinks after the finger.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let y0 = 0;
    let x0 = 0;
    let dragging = false;
    let tracking = false;
    let lastY = 0;
    let lastT = 0;
    let vy = 0;
    let d = 0;
    const vh = () => window.innerHeight;

    const dragged = (dist: number): { box: Box; radius: number; dim: number } => {
      const { box: open, radius } = openBox();
      const g = Math.min(dist / vh(), 1);
      const k = 1 - 0.45 * g;
      const w = open.w * k;
      const h = open.h * k;
      return {
        box: { x: open.x + (open.w - w) / 2, y: open.y + dist * 0.5, w, h },
        radius: lerp(radius, 32, Math.min(g * 3, 1)),
        dim: 1 - g,
      };
    };

    const onStart = (e: TouchEvent) => {
      if (closing.current || e.touches.length !== 1) return;
      tracking = scroller.scrollTop <= 0;
      dragging = false;
      y0 = lastY = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
      lastT = performance.now();
      vy = 0;
      d = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking || closing.current) return;
      const y = e.touches[0].clientY;
      const dy = y - y0;
      if (!dragging) {
        const dx = e.touches[0].clientX - x0;
        if (scroller.scrollTop > 0 || dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dy) > 6 || Math.abs(dx) > 6) tracking = false;
          return;
        }
        if (dy < 8) return;
        dragging = true;
        spring.current?.stop();
        y0 = y;
      }
      e.preventDefault();
      d = Math.max(0, y - y0);
      const t = performance.now();
      if (t > lastT) vy = ((y - lastY) / (t - lastT)) * 1000;
      lastY = y;
      lastT = t;
      const next = dragged(d);
      paint(next.box, next.radius, next.dim);
    };
    const onEnd = () => {
      if (!dragging) {
        tracking = false;
        return;
      }
      dragging = tracking = false;
      if (vy > 700 || d > vh() * 0.22) {
        // Carry the finger's speed into the flight home, in the spring's
        // own units: the share of the way it covers per second.
        const to = cardBox();
        const dist = Math.max(1, Math.abs(to.y - now.current.box.y));
        requestClose(Math.max(0, vy) / dist);
        return;
      }
      const from = now.current;
      const { box: to, radius } = openBox();
      spring.current = animate(0, 1, {
        ...OPEN_SPRING,
        onUpdate: (q) =>
          paint(
            lerpBox(from.box, to, q),
            lerp(from.radius, radius, Math.min(Math.max(q, 0), 1)),
            lerp(from.dim, 1, Math.min(Math.max(q, 0), 1)),
          ),
      });
    };
    scroller.addEventListener("touchstart", onStart, { passive: true });
    scroller.addEventListener("touchmove", onMove, { passive: false });
    scroller.addEventListener("touchend", onEnd);
    scroller.addEventListener("touchcancel", onEnd);
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
    };
  }, [cardBox, paint, requestClose]);

  // λhux, and any other way home from inside the page, is a close.
  const onClickCapture = useCallback(
    (e: React.MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (pathOf(a.getAttribute("href") ?? "") !== "/") return;
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    },
    [requestClose],
  );

  const { box: target } = openBox();
  return (
    <div className="fixed inset-0 z-40" data-app-page="">
      <div
        ref={dimRef}
        className="absolute inset-0 bg-black"
        style={{ opacity: 0 }}
        onClick={() => requestClose()}
        aria-hidden="true"
      />
      <div
        ref={windowRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClickCapture={onClickCapture}
        // Opaque, as an app is: glass let the home's greeting and icons
        // read through the page's text, and a blur over a full-screen layer
        // is a whole-screen render pass on every frame of the spring.
        className="absolute overflow-hidden bg-background outline-none"
        style={{
          left: target.x,
          top: target.y,
          width: target.w,
          height: target.h,
          transformOrigin: "0 0",
          willChange: "transform, clip-path",
        }}
      >
        <div
          ref={scrollerRef}
          className="h-full overflow-y-auto overscroll-contain no-scrollbar"
        >
          <HeroExitProvider value="scroll">{APPS[path].render()}</HeroExitProvider>
        </div>
      </div>
    </div>
  );
}

// --- Writing ------------------------------------------------------------------

/** /writing, as an app: the same header and list, on data fetched on the press. */
function WritingApp() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  // The page keeps this on the query string; the app keeps it here, so a
  // filter change is not a navigation out from over the home.
  const [includeOther, setIncludeOther] = useState(false);

  useEffect(() => {
    let live = true;
    loadWritingList()
      .then((list) => live && setPosts(list))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <PageLayout
      page="writing"
      headerActions={
        <LanguageFilter
          includeOther={includeOther}
          setIncludeOther={setIncludeOther}
        />
      }
    >
      <div
        className="transition-opacity duration-150"
        style={{ opacity: posts ? 1 : 0 }}
      >
        {posts && (
          <PostList
            posts={posts}
            basePath="/writing"
            includeOther={includeOther}
            renderMeta={(post) => <time>{formatPostDate(post.date)}</time>}
          />
        )}
      </div>
    </PageLayout>
  );
}
