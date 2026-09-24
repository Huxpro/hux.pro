"use client";

import { useCommand } from "@/systems/command";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  useState,
} from "react";

// =============================================================================
// About — the introduction that floats over every page.
//
// A new visitor sees it once. Dismissing writes `hux_about_seen`. After that,
// O opens it again from anywhere the keyboard is not already in a field, the
// same way D reaches the devtool. Slash mode owns O while the palette is up.
// =============================================================================

const STORAGE_KEY = "hux_about_seen";
const SEEN_EVENT = "hux-about-seen";

function subscribeSeen(onStoreChange: () => void) {
  window.addEventListener(SEEN_EVENT, onStoreChange);
  return () => window.removeEventListener(SEEN_EVENT, onStoreChange);
}

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function publishSeen() {
  window.dispatchEvent(new Event(SEEN_EVENT));
}

interface AboutContextValue {
  open: boolean;
  show: () => void;
  dismiss: () => void;
  toggle: () => void;
}

const AboutContext = createContext<AboutContextValue | null>(null);

export function useAbout(): AboutContextValue {
  const ctx = useContext(AboutContext);
  if (!ctx) throw new Error("useAbout must be used within AboutProvider");
  return ctx;
}

export function AboutProvider({ children }: { children: React.ReactNode }) {
  const { isOpen: isCommandOpen } = useCommand();
  // Server snapshot is "already seen", so the overlay is not in the HTML.
  // The client snapshot opens it for a visitor who has never dismissed it.
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => true);
  const [session, setSession] = useState<"auto" | "open" | "closed">("auto");
  const open = session === "open" || (session === "auto" && !seen);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      publishSeen();
    } catch {
      // Private mode: the overlay still closes for this visit.
    }
  }, []);

  const show = useCallback(() => setSession("open"), []);

  const dismiss = useCallback(() => {
    markSeen();
    setSession("closed");
  }, [markSeen]);

  const toggle = useCallback(() => {
    setSession((prev) => {
      const isOpen = prev === "open" || (prev === "auto" && !readSeen());
      if (isOpen) {
        markSeen();
        return "closed";
      }
      return "open";
    });
  }, [markSeen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape" && open && !isCommandOpen) {
        event.preventDefault();
        dismiss();
        return;
      }

      if (
        (event.key === "o" || event.key === "O") &&
        !isField &&
        !isCommandOpen
      ) {
        event.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isCommandOpen, dismiss, toggle]);

  return (
    <AboutContext.Provider value={{ open, show, dismiss, toggle }}>
      {children}
    </AboutContext.Provider>
  );
}
