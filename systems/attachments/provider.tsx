"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useTransitionRouter } from "next-view-transitions";
import { showCustomToast } from "@/components/ui/system-sonner";
import { SystemToast } from "@/components/ui/system-toast";
import { getDomainLabel } from "@/lib/og-core";
import { t, useLocale } from "@/services";
import { ArrowUpRight } from "lucide-react";
import { useBreakpointValue } from "@/systems/surface";
import { useOptionalTheaterStage } from "@/systems/theater";
import { useOptionalWindows } from "@/systems/windows";
import {
  homeFor,
  leavesSite,
  linkTarget,
  nativeHomeFor,
  type HomeContext,
} from "./lib/policy";
import type { AttachmentHome, AttachmentSet } from "./lib/types";

// =============================================================================
// AttachmentProvider — one door for everything a commit attaches.
//
// Every affordance on a commit row — a cover on the contact strip, the player
// in the expanded body, the icon in the folded rail — calls `open(set, index)`
// and stops thinking. The provider applies the policy (lib/policy.ts): on a
// phone the attachment surface comes up at that item; on a desktop the item
// goes straight to its native home — the theater, the lightbox, an in-app
// browser window, the router — and the surface only appears for the kinds
// that have none.
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

/** What the lightbox shows: one still, under its commit's name. */
export interface LightboxSession {
  set: AttachmentSet;
  index: number;
  /** Bumped per open, so the viewer lands back at fit. */
  key: number;
}

export interface AttachmentsContextValue {
  /** Open the attachment at `index` — per the policy, wherever it belongs. */
  open: (set: AttachmentSet, index?: number) => void;
  /** Perform the attachment's native action: play it, open its page… */
  act: (set: AttachmentSet, index: number) => void;
  /** Where `open` would send the attachment right now. */
  homeOf: (set: AttachmentSet, index: number) => AttachmentHome;
  /** Where `act` would send it — its native home, from any surface. */
  nativeHomeOf: (set: AttachmentSet, index: number) => AttachmentHome;
  close: () => void;
  /** The surface's current session; it stays through the close animation. */
  session: AttachmentSession | null;
  isOpen: boolean;
  /** The lightbox's current still; it stays through the close animation. */
  lightbox: LightboxSession | null;
  lightboxOpen: boolean;
  closeLightbox: () => void;
  /** A phone-sized viewport — the one fact of the policy's context a row
   *  lays itself out by (the feed plays a video where it is there). */
  compact: boolean;
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
  const theater = useOptionalTheaterStage();
  const windows = useOptionalWindows();
  const router = useTransitionRouter();
  const { locale } = useLocale();
  const compact = useBreakpointValue(COMPACT);

  const [session, setSession] = useState<AttachmentSession | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Only the facts the policy branches on, and only the callbacks `send`
  // calls: the theater's context value is rebuilt on every playback tick,
  // and depending on the object would re-publish this context — and
  // re-render every row on /works — twice a second while a video plays.
  const hasWindows = !!windows;
  const openMedia = theater?.openMedia;
  const openUrl = windows?.openUrl;
  const ctx = useMemo<HomeContext>(
    () => ({ compact, windows: hasWindows }),
    [compact, hasWindows],
  );

  const [lightbox, setLightbox] = useState<LightboxSession | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  /** Send an attachment to a non-surface home. */
  const send = useCallback(
    (home: AttachmentHome, set: AttachmentSet, index: number) => {
      const item = set.items[index];
      if (!item) return;
      // The attachment's own commit, which on an ordinary set is the set's
      // and on a squashed row is whichever member actually attached this.
      // Nothing here has to ask the set for a name any more.
      const { media, origin } = item;
      switch (home) {
        case "theater": {
          if (!openMedia) return;
          if (media.kind !== "video" && media.kind !== "slides") return;
          // The stage picks the library: a recording lands among the talks,
          // a deck among the decks — and it is announced as the commit it
          // is of, not as the row it was sitting on.
          openMedia(media, {
            id: `${set.id}#${index}`,
            title: origin.title,
            subtitle: origin.venue,
            href: origin.href,
          });
          setIsOpen(false);
          return;
        }
        case "lightbox": {
          if (media.kind !== "image") return;
          setLightbox((prev) => ({ set, index, key: (prev?.key ?? 0) + 1 }));
          setLightboxOpen(true);
          // The lightbox is a modal of its own; the sheet under it would
          // hold focus and scroll-lock against it, so it steps aside the way
          // it does for the stage.
          setIsOpen(false);
          return;
        }
        case "window": {
          if (!openUrl) return;
          openUrl(linkTarget(media, locale), { title: origin.title });
          // On a phone the window is a sheet, and it stacks on the attachment
          // sheet: putting the page away lands back on the commit's
          // attachments, the way a mobile app's in-app browser returns to
          // the screen it was opened from. Elsewhere the window is its own
          // thing and the surface has nothing left to say.
          if (!compact) setIsOpen(false);
          return;
        }
        case "route": {
          router.push(linkTarget(media, locale));
          setIsOpen(false);
          return;
        }
        case "tab":
        default: {
          const url = linkTarget(media, locale);
          // The surface stays: coming back from the tab finds the page as it
          // was left, which is the point of an in-app sheet.
          window.open(url, "_blank", "noopener,noreferrer");
          // A page that could have had a window but refused to be framed
          // says why it left: the reader asked the site to open something
          // and the browser took it, which reads as a glitch unless named.
          // On a phone the sheet's own button already says so (its mark is
          // the arrow out, and the page notes it) — no toast under a tab
          // that has just covered the screen.
          if (!compact && leavesSite(media)) {
            const host = getDomainLabel(url);
            showCustomToast(
              <SystemToast
                icon={ArrowUpRight}
                title={t(locale, "linkOpensInTab")}
                note={t(locale, "linkFrameDenied").replace("{host}", host)}
              />,
              { id: `frame-denied:${host}`, duration: 4000 },
            );
          }
          return;
        }
      }
    },
    [openMedia, openUrl, router, locale, compact],
  );

  const open = useCallback(
    (set: AttachmentSet, index = 0) => {
      const media = set.items[index]?.media;
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
      const media = set.items[index]?.media;
      if (!media) return;
      send(nativeHomeFor(media, ctx), set, index);
    },
    [ctx, send],
  );

  const homeOf = useCallback(
    (set: AttachmentSet, index: number) => {
      const media = set.items[index]?.media;
      return media ? homeFor(media, ctx) : "surface";
    },
    [ctx],
  );

  const nativeHomeOf = useCallback(
    (set: AttachmentSet, index: number) => {
      const media = set.items[index]?.media;
      return media ? nativeHomeFor(media, ctx) : "tab";
    },
    [ctx],
  );

  const value = useMemo<AttachmentsContextValue>(
    () => ({
      open,
      act,
      homeOf,
      nativeHomeOf,
      close,
      session,
      isOpen,
      lightbox,
      lightboxOpen,
      closeLightbox,
      compact,
    }),
    [
      open,
      act,
      homeOf,
      nativeHomeOf,
      close,
      session,
      isOpen,
      lightbox,
      lightboxOpen,
      closeLightbox,
      compact,
    ],
  );

  return (
    <AttachmentsContext.Provider value={value}>
      {children}
    </AttachmentsContext.Provider>
  );
}
