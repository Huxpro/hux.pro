"use client";

import { useCommand } from "@/systems/command/provider";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
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
//   Esc           closes it.
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
  close: () => void;
  toggle: () => void;
  /** Whether this visitor has dismissed the About at least once. */
  seen: boolean;
  /** Forget the visitor has met it, so the next load introduces it again. */
  resetSeen: () => void;
}

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

  const close = useCallback(() => {
    setIsOpen(false);
    setSeen(true);
    writeSeen(true);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  const resetSeen = useCallback(() => {
    setSeen(false);
    writeSeen(false);
  }, []);

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

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      close();
    }
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  const value = useMemo<AboutContextValue>(
    () => ({ isOpen, open, close, toggle, seen, resetSeen }),
    [isOpen, open, close, toggle, seen, resetSeen],
  );

  return <AboutContext.Provider value={value}>{children}</AboutContext.Provider>;
}
