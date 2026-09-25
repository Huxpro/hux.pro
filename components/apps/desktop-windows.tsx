"use client";

import { WallpaperWindow, useWallpaper } from "@/systems/ambient";
import { MusicWindow, useMusic } from "@/systems/music";
import { TheaterWindow, useTheater } from "@/systems/theater";
import {
  SYSTEM_APPS,
  SystemAppsProvider,
  WindowLayer,
  useUnifiedWindows,
  useWindows,
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
      <UnifiedSwitchboard />
    </SystemAppsProvider>
  );
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
 * The theater is not a yes/no: it has a mode, and a window is one of them.
 * Every `open` (a cover's play button, a deck) brings the window forward;
 * closing the window ends the session; the window opened from a launcher with
 * nothing on the stage starts the curated albums, as the home widget would.
 */
function TheaterSwitch() {
  const { openApp } = useWindows();
  const { mode, openRequest, registeredAlbums, open, close } = useTheater();
  const id = SYSTEM_APPS.theater.id;
  const { exists } = useShown(id);

  useEffect(() => {
    if (openRequest > 0 && mode === "window") openApp(SYSTEM_APPS.theater);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  const existed = useRef(exists);
  useEffect(() => {
    const was = existed.current;
    existed.current = exists;
    if (was && !exists && mode === "window") close();
    if (!was && exists && mode === "closed" && registeredAlbums.length > 0) {
      open({ albums: registeredAlbums });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exists]);

  return null;
}
