// =============================================================================
// Wallpaper play — Shuffle and Loop
//
// Apple and Nature can play the album instead of pinning one picture. The
// picker exposes both as tiles, the way iOS puts Photo Shuffle among the
// wallpaper types and macOS puts Change Picture on a folder:
//
//   shuffle  Photo Shuffle / Randomly — a fresh permutation of the album,
//            reshuffled when the last frame has been shown.
//   loop     Change Picture without Randomly — catalog order, then wrap.
//
// How often it advances is iOS Shuffle Frequency, mapped onto a site:
//
//   visit    On Lock — once per browser tab session
//   hourly   Hourly
//   daily    Daily
//
// On Tap has no lock screen to tap, so it is omitted. The current frame is
// still `wallpaperId`; play is a way of choosing the next one, not a second
// kind of background.
// =============================================================================

import {
  wallpapersInAlbum,
  type WallpaperPlay,
  type WallpaperPlayAlbum,
  type WallpaperPlayEvery,
} from "./wallpaper";

/** sessionStorage: this tab has already taken its On Visit step. */
export const WALLPAPER_PLAY_VISIT_KEY = "hux_wallpaper_play_visit";

export const WALLPAPER_PLAY_HOUR_MS = 60 * 60 * 1000;

export interface WallpaperPlayState {
  wallpaperPlay: Exclude<WallpaperPlay, "off">;
  wallpaperAlbum: WallpaperPlayAlbum;
  wallpaperId: string;
  wallpaperPlayIndex: number;
  wallpaperPlayOrder: string[];
  wallpaperPlayAt: number;
}

function albumIds(album: WallpaperPlayAlbum): string[] {
  return wallpapersInAlbum(album).map((wallpaper) => wallpaper.id);
}

/** Fisher–Yates. `random` is injected so the picker and the tests share one path. */
export function shuffleIds(ids: readonly string[], random: () => number = Math.random): string[] {
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Move `avoid` off the head so Shuffle does not open on the picture just showing. */
function rotateIfHead(order: string[], avoid: string): string[] {
  if (order.length > 1 && order[0] === avoid) {
    return [...order.slice(1), order[0]];
  }
  return order;
}

function snapshot(
  play: Exclude<WallpaperPlay, "off">,
  album: WallpaperPlayAlbum,
  order: string[],
  index: number,
  now: number
): WallpaperPlayState {
  return {
    wallpaperPlay: play,
    wallpaperAlbum: album,
    wallpaperId: order[index] ?? order[0],
    wallpaperPlayIndex: index,
    wallpaperPlayOrder: order,
    wallpaperPlayAt: now,
  };
}

/**
 * First frame after tapping Shuffle or Loop.
 *
 * Shuffle draws a new permutation and lands on a picture other than the one
 * already showing (when the album has more than one). Loop takes the next
 * picture in catalog order — tapping the tile changes the desktop, the same
 * as tapping Tahoe.
 */
export function startAlbumPlay(params: {
  play: Exclude<WallpaperPlay, "off">;
  album: WallpaperPlayAlbum;
  currentId: string;
  now: number;
  random?: () => number;
}): WallpaperPlayState {
  const ids = albumIds(params.album);
  if (params.play === "loop") {
    const from = ids.indexOf(params.currentId);
    const index = from === -1 ? 0 : (from + 1) % Math.max(ids.length, 1);
    return snapshot("loop", params.album, ids, index, params.now);
  }
  const order = rotateIfHead(
    shuffleIds(ids, params.random ?? Math.random),
    params.currentId
  );
  return snapshot("shuffle", params.album, order, 0, params.now);
}

/**
 * The next frame in an already-playing album.
 *
 * Loop walks catalog order. Shuffle walks the stored permutation and
 * reshuffles when it wraps, keeping the last frame off the new head so a
 * 19-picture album does not show the same still twice in a row.
 */
export function stepAlbumPlay(params: {
  play: Exclude<WallpaperPlay, "off">;
  album: WallpaperPlayAlbum;
  currentId: string;
  index: number;
  order: readonly string[];
  now: number;
  random?: () => number;
}): WallpaperPlayState {
  const ids = albumIds(params.album);
  const random = params.random ?? Math.random;

  if (params.play === "loop") {
    const from = ids.indexOf(params.currentId);
    const index = from === -1 ? 0 : (from + 1) % Math.max(ids.length, 1);
    return snapshot("loop", params.album, ids, index, params.now);
  }

  const allowed = new Set(ids);
  let order = params.order.filter((id) => allowed.has(id));
  if (order.length !== ids.length) {
    order = rotateIfHead(shuffleIds(ids, random), params.currentId);
    return snapshot("shuffle", params.album, order, 0, params.now);
  }

  let index = params.index + 1;
  if (index >= order.length) {
    order = rotateIfHead(shuffleIds(ids, random), order[order.length - 1] ?? params.currentId);
    index = 0;
  }
  return snapshot("shuffle", params.album, order, index, params.now);
}

/**
 * Whether this clock tick should show a new picture.
 *
 * On Visit fires once per tab session (`visitConsumed`). Hourly and Daily
 * compare `playAt` to `now` — a week away advances once, not seven times.
 * That is how iOS Photo Shuffle behaves on wake.
 */
export function shouldAdvancePlay(params: {
  every: WallpaperPlayEvery;
  playAt: number;
  now: number;
  visitConsumed: boolean;
}): boolean {
  if (params.every === "visit") return !params.visitConsumed;
  if (params.every === "hourly") {
    return params.now - params.playAt >= WALLPAPER_PLAY_HOUR_MS;
  }
  const then = new Date(params.playAt);
  const now = new Date(params.now);
  return (
    then.getFullYear() !== now.getFullYear() ||
    then.getMonth() !== now.getMonth() ||
    then.getDate() !== now.getDate()
  );
}

export function readVisitConsumed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(WALLPAPER_PLAY_VISIT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markVisitConsumed(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WALLPAPER_PLAY_VISIT_KEY, "1");
  } catch {
    // Private mode can throw; On Visit then behaves like every load.
  }
}
