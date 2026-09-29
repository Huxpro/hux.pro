"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// =============================================================================
// Dock System — coordination layer for "Live Activities"
//
// A Live Activity is a compact form at the top of the screen that grows into
// an expanded panel. The dock is ONE island, not a row of them: Apple's own
// first sentence about the Dynamic Island is that it "serves as a unified home
// for alerts and indicators of ongoing activity", and what makes it read that
// way is not its corner radius but that several activities *merge* into one
// object instead of queueing up beside each other.
//
// So this provider owns two decisions, and no visuals:
//
//   • which activity is expanded — only ONE at a time, as before
//   • which activity holds the island — everything else takes the minimal
//     form, a bare circle detached from it (iOS: "one appears attached to the
//     Dynamic Island while the other appears detached")
//
// The island goes to the activity that arrived LAST. A Live Activity appearing
// is news — the sunrise notification opening while music plays is the same
// shape of event as an alert, and iOS answers an alert by showing it — so the
// newcomer takes the island and the incumbent steps down to a dot. When the
// newcomer's window passes and it unmounts, the island falls back to whoever
// is still there. Opening an activity does NOT promote it: its panel grows out
// of wherever its compact form actually is, dot included, which is exactly
// what a touch-and-hold on a minimal presentation does on iOS.
//
// Escape and the outside press are not here: the panel is a Base UI drawer
// (live-activity.tsx) and the library already does both.
//
// The visuals live in <LiveActivity /> and the layout in <Dock />. Keeping the
// shared state here means new activities just register an id and a renderer —
// they never re-implement the open/close state machine.
// =============================================================================

interface DockContextType {
  /** Id of the currently expanded activity, or null when all are collapsed. */
  openId: string | null;
  /** True when any activity is expanded (used to hide the compact forms). */
  isAnyOpen: boolean;
  isOpen: (id: string) => boolean;
  /**
   * True for the one activity holding the island. Everything else renders its
   * minimal form — see the note at the top of this file for who wins.
   */
  isPrimary: (id: string) => boolean;
  open: (id: string) => void;
  close: () => void;
  toggle: (id: string) => void;
  /**
   * Tie an activity's lifecycle to the dock. Call on mount; run the returned
   * teardown on unmount. Two things hang off it: an activity that disappears
   * while it is the open one (e.g. a notification window passes) collapses the
   * dock, so the hiding doesn't get stuck on a phantom `openId`; and the order
   * of these calls is what decides who holds the island.
   */
  registerActivity: (id: string) => () => void;
}

const DockContext = createContext<DockContextType | undefined>(undefined);

export function useDock() {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error("useDock must be used within a Dock");
  return ctx;
}

export function DockProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  // Arrival order, oldest first. The last one in holds the island.
  const [order, setOrder] = useState<string[]>([]);

  const open = useCallback((id: string) => setOpenId(id), []);
  const close = useCallback(() => setOpenId(null), []);
  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    []
  );
  const isOpen = useCallback((id: string) => openId === id, [openId]);

  const primaryId = order.length ? order[order.length - 1] : null;
  const isPrimary = useCallback((id: string) => primaryId === id, [primaryId]);

  const registerActivity = useCallback((id: string) => {
    setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
    return () => {
      setOrder((prev) => prev.filter((x) => x !== id));
      setOpenId((prev) => (prev === id ? null : prev));
    };
  }, []);

  // Collapse whenever the route changes (matches the old MusicDock behaviour).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(null);
  }, [pathname]);

  return (
    <DockContext.Provider
      value={{
        openId,
        isAnyOpen: openId !== null,
        isOpen,
        isPrimary,
        open,
        close,
        toggle,
        registerActivity,
      }}
    >
      {children}
    </DockContext.Provider>
  );
}
