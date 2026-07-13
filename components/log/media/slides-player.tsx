"use client";

/**
 * SlidesPlayer — shared lightbox for HTML slide decks.
 *
 * One modal at the timeline root; any cover / rail affordance can call
 * `open({ url, title })` without mounting its own portal. Keeps Escape /
 * scroll-lock / z-index behavior consistent across entry points.
 *
 * Outside the provider (e.g. MDX `<Media as="slides" />`), `useSlidesPlayer`
 * reports `hasProvider: false` so the Slides cover can fall back to a
 * locally-owned SlideModal.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SlideModal } from "./slide-modal";

export interface OpenSlidesOptions {
  /** Direct playable deck URL. */
  url: string;
  /** Accessible title for the iframe / dialog. */
  title?: string;
}

/**
 * Desktop keeps the in-site theater modal; phones open the deck in a new tab
 * instead. reveal.js decks are keyboard/gesture-driven and read poorly in a
 * cramped mobile iframe, and the native tab gives real fullscreen + the
 * browser's own controls. The 640px cutoff matches the modal's own `sm:`
 * breakpoint (below which it was an edge-to-edge takeover anyway).
 */
export function prefersSlidesModal(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(min-width: 640px)").matches;
}

/** Open a deck in a new browser tab (mobile fallback / non-modal path). */
export function openSlidesInNewTab(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

interface SlidesPlayerContextValue {
  open: (opts: OpenSlidesOptions) => void;
  close: () => void;
  hasProvider: true;
}

type SlidesPlayerHookValue =
  | SlidesPlayerContextValue
  | { open: null; close: null; hasProvider: false };

const SlidesPlayerContext = createContext<SlidesPlayerContextValue | null>(
  null,
);

export function SlidesPlayerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<OpenSlidesOptions | null>(null);

  const open = useCallback((opts: OpenSlidesOptions) => {
    // Phones bypass the modal and open the deck in its own tab.
    if (!prefersSlidesModal()) {
      openSlidesInNewTab(opts.url);
      return;
    }
    setActive(opts);
  }, []);

  const close = useCallback(() => {
    setActive(null);
  }, []);

  const value = useMemo(
    () => ({ open, close, hasProvider: true as const }),
    [open, close],
  );

  return (
    <SlidesPlayerContext.Provider value={value}>
      {children}
      <SlideModal
        open={!!active}
        onClose={close}
        src={active?.url ?? ""}
        title={active?.title || "Slide deck"}
      />
    </SlidesPlayerContext.Provider>
  );
}

/**
 * Hook into the shared slides lightbox. When used outside the provider,
 * `hasProvider` is false and callers should own a local SlideModal.
 */
export function useSlidesPlayer(): SlidesPlayerHookValue {
  const ctx = useContext(SlidesPlayerContext);
  if (ctx) return ctx;
  return { open: null, close: null, hasProvider: false };
}
