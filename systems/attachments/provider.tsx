"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useTransitionRouter } from "next-view-transitions";
import { useLocale } from "@/services";
import { useBreakpointValue } from "@/systems/surface";
import { useOptionalTheater } from "@/systems/theater";
import { commitAlbum, isTheaterMedia } from "@/systems/theater/lib/albums";
import { useOptionalWindows } from "@/systems/windows";
import { homeFor, linkTarget, nativeHomeFor, type HomeContext } from "./lib/policy";
import type { AttachmentHome, AttachmentSet } from "./lib/types";

// =============================================================================
// AttachmentProvider — one door for everything a commit attaches.
//
// Every affordance on a commit row — a cover on the contact strip, the player
// in the expanded body, the icon in the folded rail — calls `open(set, index)`
// and stops thinking. The provider applies the policy (lib/policy.ts): on a
// phone the attachment surface comes up at that item; on a desktop the item
// goes straight to its native home — the theater, an in-app browser window,
// the router — and the surface only appears for the kinds that have none.
//
// The surface itself (components/attachment-surface.tsx) is mounted once in
// the root layout and reads `session` from here. Its pages call `act(index)`
// for their primary button, which is the same policy with the surface taken
// out of the picture: what the item does natively, from wherever it is asked.
// =============================================================================

/** What the surface shows: a set, and the item it was opened at. */
export interface AttachmentSession {
  set: AttachmentSet;
  index: number;
  /** Bumped per open, so the surface's pager re-lands on `index`. */
  key: number;
}

interface AttachmentsContextValue {
  /** Open the attachment at `index` — per the policy, wherever it belongs. */
  open: (set: AttachmentSet, index?: number) => void;
  /** Perform the attachment's native action: play it, open its page… */
  act: (set: AttachmentSet, index: number) => void;
  /** Where `open` would send the attachment right now. */
  homeOf: (set: AttachmentSet, index: number) => AttachmentHome;
  close: () => void;
  /** The surface's current session; it stays through the close animation. */
  session: AttachmentSession | null;
  isOpen: boolean;
}

const AttachmentsContext = createContext<AttachmentsContextValue | null>(null);

export function useAttachments(): AttachmentsContextValue {
  const ctx = useContext(AttachmentsContext);
  if (!ctx) {
    throw new Error("useAttachments must be used within AttachmentProvider");
  }
  return ctx;
}

/** Non-throwing variant for components that render with or without it. */
export function useOptionalAttachments(): AttachmentsContextValue | null {
  return useContext(AttachmentsContext);
}

/** Below `sm` the sheet takes everything; see lib/policy.ts. */
const COMPACT = { base: true, sm: false } as const;

export function AttachmentProvider({ children }: { children: React.ReactNode }) {
  const theater = useOptionalTheater();
  const windows = useOptionalWindows();
  const router = useTransitionRouter();
  const { locale } = useLocale();
  const compact = useBreakpointValue(COMPACT);

  const [session, setSession] = useState<AttachmentSession | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const ctx = useMemo<HomeContext>(
    () => ({
      compact,
      theaterAvailable: theater?.theaterAvailable ?? false,
      windows: !!windows,
      locale,
    }),
    [compact, theater?.theaterAvailable, windows, locale],
  );

  const close = useCallback(() => setIsOpen(false), []);

  /** Send an attachment to a non-surface home. */
  const send = useCallback(
    (home: AttachmentHome, set: AttachmentSet, index: number) => {
      const media = set.items[index];
      if (!media) return;
      switch (home) {
        case "theater": {
          if (!theater) return;
          // The theater's album is the commit's playable media only, so the
          // item's index in the set is not its index in the album.
          const album = commitAlbum({ ...set, media: set.items });
          const trackIndex = set.items
            .slice(0, index)
            .filter(isTheaterMedia).length;
          theater.openAlbum(album, trackIndex);
          setIsOpen(false);
          return;
        }
        case "window": {
          if (!windows) return;
          windows.openUrl(linkTarget(media, locale), {
            title: set.title,
          });
          setIsOpen(false);
          return;
        }
        case "route": {
          router.push(linkTarget(media, locale));
          setIsOpen(false);
          return;
        }
        case "tab":
        default: {
          // The surface stays: coming back from the tab finds the page as it
          // was left, which is the point of an in-app sheet.
          window.open(linkTarget(media, locale), "_blank", "noopener,noreferrer");
          return;
        }
      }
    },
    [theater, windows, router, locale],
  );

  const open = useCallback(
    (set: AttachmentSet, index = 0) => {
      const media = set.items[index];
      if (!media) return;
      const home = homeFor(media, ctx);
      if (home === "surface") {
        setSession((prev) => ({ set, index, key: (prev?.key ?? 0) + 1 }));
        setIsOpen(true);
        return;
      }
      send(home, set, index);
    },
    [ctx, send],
  );

  const act = useCallback(
    (set: AttachmentSet, index: number) => {
      const media = set.items[index];
      if (!media) return;
      send(nativeHomeFor(media, ctx), set, index);
    },
    [ctx, send],
  );

  const homeOf = useCallback(
    (set: AttachmentSet, index: number) => {
      const media = set.items[index];
      return media ? homeFor(media, ctx) : "surface";
    },
    [ctx],
  );

  const value = useMemo<AttachmentsContextValue>(
    () => ({ open, act, homeOf, close, session, isOpen }),
    [open, act, homeOf, close, session, isOpen],
  );

  return (
    <AttachmentsContext.Provider value={value}>
      {children}
    </AttachmentsContext.Provider>
  );
}
