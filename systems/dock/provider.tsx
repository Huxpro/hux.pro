"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// =============================================================================
// Dock System — coordination layer for "Live Activities"
//
// A Live Activity is a collapsed pill that morphs into an expanded panel —
// the iOS Dynamic Island / Notification Center metaphor. Multiple activities
// (music, ambient phase changes, …) coexist in a single horizontal dock at the
// top of the screen.
//
// This provider owns the *coordination*, not the visuals:
//   • which activity (if any) is currently expanded — only ONE at a time
//   • collapse on Escape
//   • collapse on route change
//
// The visuals live in <LiveActivity /> and the layout in <Dock />. Keeping the
// shared state here means new activities just register an id and a renderer —
// they never re-implement the open/close state machine.
// =============================================================================

interface DockContextType {
  /** Id of the currently expanded activity, or null when all are collapsed. */
  openId: string | null;
  /** True when any activity is expanded (used to hide sibling pills). */
  isAnyOpen: boolean;
  isOpen: (id: string) => boolean;
  open: (id: string) => void;
  close: () => void;
  toggle: (id: string) => void;
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

  const open = useCallback((id: string) => setOpenId(id), []);
  const close = useCallback(() => setOpenId(null), []);
  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    []
  );
  const isOpen = useCallback((id: string) => openId === id, [openId]);

  // Collapse whenever the route changes (matches the old MusicDock behaviour).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(null);
  }, [pathname]);

  // Esc collapses the expanded panel.
  useEffect(() => {
    if (openId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

  return (
    <DockContext.Provider
      value={{
        openId,
        isAnyOpen: openId !== null,
        isOpen,
        open,
        close,
        toggle,
      }}
    >
      {children}
    </DockContext.Provider>
  );
}
