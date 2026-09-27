"use client";

import { useOptionalAttachments } from "@/systems/attachments/provider";
import { useCommand } from "@/systems/command/provider";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

// =============================================================================
// AboutProvider — the About surface's state.
//
// The About is the one thing on the site that speaks before it is asked: a
// newcomer finds it floating over whatever page they landed on, says hello
// to whoever made this, and dismisses it. From then on it is a slash command
// away — `/` `O`, from anywhere — and a row in the palette.
//
//   first visit   opens itself once the page has painted; dismissing it is
//                 what marks the visitor as having met it (`hux_about_seen`),
//                 so a reload before that shows it again.
//   `/` `O`       the palette's slash command (systems/command/actions.tsx).
//                 Not a bare `O`: a single letter taken over every page is
//                 one keystroke from firing by accident, and the About is
//                 not something anyone needs that often.
//   Esc           closes it — unless something over it (a drawer, a card,
//                 the palette) has taken that press.
//   the drawer    on a phone a magic link in the copy opens the attachment
//                 drawer or the identity card over the About (OVER_ABOUT_Z),
//                 not in its place:
//                 the words stay underneath. The About steps aside only once
//                 something leaves for a home below it — the stage, a
//                 window, the router, the lightbox; a tab leaves the site
//                 and finds it as it was on the way back.
//   `/about`      the linkable address: the home screen with it already up.
//
// The surface itself (components/about-surface.tsx) is mounted once in the
// root layout; the glow around the screen's edge is part of it.
// =============================================================================

const SEEN_KEY = "hux_about_seen";

/** How long a newcomer's first page shows before the About rises over it. */
const FIRST_VISIT_DELAY_MS = 700;

/** Paths that are tools rather than the site — no introduction there. */
const QUIET_PREFIXES = ["/editor", "/vitre"];

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Storage blocked: never nag. The About is still a key away.
    return true;
  }
}

function writeSeen(seen: boolean) {
  try {
    if (seen) localStorage.setItem(SEEN_KEY, "1");
    else localStorage.removeItem(SEEN_KEY);
  } catch {
    /* storage blocked */
  }
}

interface AboutContextValue {
  isOpen: boolean;
  open: () => void;
  /**
   * The visitor puts it away — the button at its foot, Escape, a click well
   * clear of the words. The one close that also leaves `/about` for `/`
   * (app/about/about-route.tsx).
   */
  dismiss: () => void;
  /**
   * Something else takes the screen from it — a link to another page, the
   * stage, a window. Leaves the address alone: a navigation is leaving
   * `/about` already, and swapping it under the router's push would cancel
   * the push.
   */
  close: () => void;
  /** The last put-away was the visitor's (`dismiss`), not a hand-over. */
  dismissed: boolean;
  /** Whether this visitor has dismissed the About at least once. */
  seen: boolean;
}

/**
 * The About's layers, in one place. Above the theater and windows
 * (10000–10005), under the command palette (10050), which can still be
 * summoned over it.
 *
 *   ABOUT_Z                the veil and the words
 *   ABOUT_GLOW_Z           the ring, over them
 *   OVER_ABOUT_Z           what a magic link in its copy opens over it: the
 *                          attachment drawer, the identity card, a peek
 *   DEVTOOL_OVER_ABOUT_Z   the devtool, so the About's own knobs (the Glow
 *                          module) can be turned while it is up
 */
export const ABOUT_Z = 10020;
export const ABOUT_GLOW_Z = 10021;
export const OVER_ABOUT_Z = 10025;
export const DEVTOOL_OVER_ABOUT_Z = 10030;

const AboutContext = createContext<AboutContextValue | null>(null);

export function useAbout(): AboutContextValue {
  const ctx = useContext(AboutContext);
  if (!ctx) throw new Error("useAbout must be used within AboutProvider");
  return ctx;
}

/** Non-throwing variant for components that render with or without it. */
export function useOptionalAbout(): AboutContextValue | null {
  return useContext(AboutContext);
}

export function AboutProvider({ children }: { children: React.ReactNode }) {
  const { close: closeCommand } = useCommand();
  const [isOpen, setIsOpen] = useState(false);
  // Assume met until storage says otherwise: the server render and the first
  // client render agree, and nobody is introduced twice by a hydration race.
  const [seen, setSeen] = useState(true);

  // The palette leaves when the About arrives, from wherever it was asked
  // for: the About is a whole-screen surface, and a palette left underneath
  // shows through its veil as a dark slab.
  const open = useCallback(() => {
    closeCommand();
    setIsOpen(true);
  }, [closeCommand]);

  const [dismissed, setDismissed] = useState(false);
  const putAway = useCallback((byVisitor: boolean) => {
    setDismissed(byVisitor);
    setIsOpen(false);
    setSeen(true);
    writeSeen(true);
  }, []);
  const dismiss = useCallback(() => putAway(true), [putAway]);
  const close = useCallback(() => putAway(false), [putAway]);

  // First visit: rise once the page underneath has had a moment to paint, so
  // the blur has something to blur and the visitor sees where they are.
  useEffect(() => {
    const met = readSeen();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setSeen(met);
    if (met) return;
    const path = window.location.pathname;
    if (QUIET_PREFIXES.some((p) => path.startsWith(p))) return;
    const id = window.setTimeout(() => setIsOpen(true), FIRST_VISIT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  // A thing opened from the About's drawer that lands under the About — on
  // the stage, in a window, on another page — takes the screen from it. A
  // tab leaves the site, and finds it as it was on the way back.
  const onSend = useOptionalAttachments()?.onSend;
  const onAttachmentSent = useEffectEvent((home: string) => {
    if (isOpen && home !== "tab") close();
  });
  useEffect(() => onSend?.((home) => onAttachmentSent(home)), [onSend]);

  // Any page change while it is up — a drawer's Visit, a card's row, a link
  // it did not see — takes the screen from it: the About is over a page,
  // not a page. Coming to `/about` is the one arrival that keeps it.
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);
  const onPathChange = useEffectEvent((path: string) => {
    if (isOpen && path !== "/about") close();
  });
  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;
    onPathChange(pathname);
  }, [pathname]);

  // Escape is the About's only once nothing above it has claimed it. On the
  // window, in the bubble phase — after every surface's own listener — and
  // not if one of them handled it (a drawer, a card, a window, the palette
  // over the About each mark theirs `defaultPrevented`).
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape" || !isOpen || e.defaultPrevented) return;
    e.preventDefault();
    dismiss();
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const value = useMemo<AboutContextValue>(
    () => ({ isOpen, open, dismiss, close, dismissed, seen }),
    [isOpen, open, dismiss, close, dismissed, seen],
  );

  return <AboutContext.Provider value={value}>{children}</AboutContext.Provider>;
}

/**
 * A surface's paint layer while the About is up — `z` (OVER_ABOUT_Z by
 * default) — and `undefined` (its own) otherwise. For whatever must come up
 * over the About rather than under it.
 */
export function useOverAboutZ(z: number = OVER_ABOUT_Z): number | undefined {
  return useOptionalAbout()?.isOpen ? z : undefined;
}
