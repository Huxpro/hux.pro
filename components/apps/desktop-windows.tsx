"use client";

import { WallpaperWindow, useWallpaper } from "@/systems/ambient";
import { MusicWindow, useMusic } from "@/systems/music";
import { TheaterWindow, useTheater } from "@/systems/theater";
import { useTransitionRouter } from "next-view-transitions";
import {
  SYSTEM_APPS,
  SystemAppsProvider,
  WindowLayer,
  useUnifiedWindows,
  useWindows,
  type HuxOS,
  type SystemAppBodies,
} from "@/systems/windows";
import { useEffect, useRef } from "react";

// =============================================================================
// DesktopWindows — the window layer, with the site's built-ins in it
//
// The composition point between the window system and the features it can
// host. The window system knows how to frame "a system app"; this is where it
// learns that the music, the wallpaper and the theater are ones — so windows
// stays below those systems in the import graph, the way the dock learns its
// activities from the layout rather than importing them.
//
// With unified windows on, it is also the switchboard: every existing way
// into those features (the dock's playlist button, ⌘K's Wallpaper row, a
// cover's play button…) still asks the feature to open, and this turns the
// ask into its window. The features stay ignorant of windows beyond a flag
// that keeps their old surface shut.
// =============================================================================

const BODIES: SystemAppBodies = {
  music: MusicWindow,
  wallpaper: WallpaperWindow,
  theater: TheaterWindow,
};

export function DesktopWindows() {
  return (
    <SystemAppsProvider bodies={BODIES}>
      <WindowLayer />
      <OsBridge />
      <UnifiedSwitchboard />
    </SystemAppsProvider>
  );
}

/**
 * What the pages in windows may ask of this document (systems/windows/lib/
 * os.ts): anything past their own section. Published on `window` because the
 * asker is another document; always current, since the ref is re-pointed on
 * every render rather than the global re-published.
 */
function OsBridge() {
  const router = useTransitionRouter();
  const { openApp, openUrl, openBundleUrl } = useWindows();
  const { openVideo, openMedia } = useTheater();
  const latest = useRef({ router, openApp, openUrl, openBundleUrl, openVideo, openMedia });
  latest.current = { router, openApp, openUrl, openBundleUrl, openVideo, openMedia };

  useEffect(() => {
    const os: HuxOS = {
      navigate: (href) => latest.current.router.push(href),
      openApp: (app, opts) => latest.current.openApp(app, opts),
      openUrl: (url, opts) => latest.current.openUrl(url, opts),
      openBundleUrl: (url, opts) => latest.current.openBundleUrl(url, opts),
      openVideo: (input) =>
        latest.current.openVideo(input as Parameters<typeof openVideo>[0]),
      openMedia: (media, meta) =>
        latest.current.openMedia(
          media as Parameters<typeof openMedia>[0],
          meta as Parameters<typeof openMedia>[1],
        ),
    };
    window.__huxOS = os;
    return () => {
      if (window.__huxOS === os) delete window.__huxOS;
    };
  }, []);

  return null;
}

function UnifiedSwitchboard() {
  const unified = useUnifiedWindows();
  if (!unified) return null;
  return (
    <>
      <MusicSwitch />
      <WallpaperSwitch />
      <TheaterSwitch />
    </>
  );
}

/** Whether a window is on screen: open and not in the dock. */
function useShown(id: string): { exists: boolean; shown: boolean } {
  const { windows } = useWindows();
  const win = windows.find((w) => w.id === id);
  return { exists: !!win, shown: !!win && win.mode === "normal" };
}

/**
 * A feature whose surface is a yes/no ("is the playlist open") and a window
 * that is on screen or not are the same fact, kept equal in both directions:
 * the feature asked to open brings its window forward; the window put away
 * tells the feature its surface closed; the feature asked to close puts the
 * window in the dock. Each side reacts only to its own change, reading the
 * other through a ref, so neither echoes back.
 */
function useMirror(
  id: string,
  app: Parameters<ReturnType<typeof useWindows>["openApp"]>[0],
  open: boolean,
  setOpen: (open: boolean) => void,
) {
  const { openApp, minimize } = useWindows();
  const { shown } = useShown(id);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const openRef = useRef(open);
  openRef.current = open;

  // The feature moved.
  useEffect(() => {
    if (open && !shownRef.current) openApp(app);
    else if (!open && shownRef.current) minimize(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The window moved.
  useEffect(() => {
    if (shown !== openRef.current) setOpen(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
}

function MusicSwitch() {
  const { isPlaylistOpen, openPlaylist, closePlaylist } = useMusic();
  useMirror(SYSTEM_APPS.music.id, SYSTEM_APPS.music, isPlaylistOpen, (o) =>
    o ? openPlaylist() : closePlaylist(),
  );
  return null;
}

function WallpaperSwitch() {
  const { isPickerOpen, openPicker, closePicker } = useWallpaper();
  useMirror(SYSTEM_APPS.wallpaper.id, SYSTEM_APPS.wallpaper, isPickerOpen, (o) =>
    o ? openPicker() : closePicker(),
  );
  return null;
}

/**
 * The theater is not a yes/no: it has a mode, and on a desktop `window` is its
 * big view. The window and the mode are kept in step, each side reacting only
 * to its own change:
 *
 *   theater → window   every `open` in window mode brings the window forward;
 *                      minimized (the switch's audio view) puts it in the dock;
 *                      moved to PiP or closed, the window goes — handed off,
 *                      not ended: the stage morphs on to where it is going.
 *   window → theater   closed by hand ends the session; put in the dock by
 *                      hand is the audio view; brought back is the window
 *                      again; opened from a launcher with nothing on the stage
 *                      starts the curated albums (and on a phone, where the
 *                      theater is PiP, hands straight off to it).
 */
function TheaterSwitch() {
  const { openApp, minimize: minimizeWindow, close: closeWindow } = useWindows();
  const theater = useTheater();
  const { mode, minimized, openRequest, registeredAlbums } = theater;
  const id = SYSTEM_APPS.theater.id;
  const { exists, shown } = useShown(id);
  const handedOff = useRef(false);

  const windowRef = useRef({ exists, shown });
  windowRef.current = { exists, shown };
  const theaterRef = useRef(theater);
  theaterRef.current = theater;

  // The theater moved.
  useEffect(() => {
    const w = windowRef.current;
    if (mode === "window") {
      if (!minimized) openApp(SYSTEM_APPS.theater);
      else if (w.shown) minimizeWindow(id);
    } else if (w.exists) {
      handedOff.current = true;
      closeWindow(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, minimized, openRequest]);

  // The window moved.
  const was = useRef({ exists, shown });
  useEffect(() => {
    const prev = was.current;
    was.current = { exists, shown };
    const t = theaterRef.current;
    if (prev.exists && !exists) {
      if (handedOff.current) handedOff.current = false;
      else if (t.mode === "window") t.close();
      return;
    }
    if (!prev.exists && exists) {
      if (t.mode === "closed" && registeredAlbums.length > 0) t.open({ albums: registeredAlbums });
      else if (t.mode !== "window") t.toTheater();
      return;
    }
    if (t.mode !== "window") return;
    if (prev.shown && !shown && !t.minimized) t.minimize();
    if (!prev.shown && shown && t.minimized) t.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exists, shown]);

  return null;
}
