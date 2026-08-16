// =============================================================================
// Music Mock Mode — offline stand-in for the YouTube IFrame player.
//
// Enabled by setting `localStorage.hux_music_mock = "1"`. Intended for
// development and headless-browser verification where youtube.com is
// unreachable (sandboxed CI, offline dev): the provider skips the IFrame API
// entirely and drives the same UI state machine from this fixture, so every
// surface (widget, live activity, playlist sheet) can be exercised without
// network access. Never enabled by default — real visitors always get the
// real player.
// =============================================================================

import type { PlaylistEntry } from "./types";

export const MOCK_FLAG_KEY = "hux_music_mock";

export function isMusicMockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MOCK_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Deterministic gradient "album art" so mock rows read like real thumbnails. */
function mockThumbnail(index: number): string {
  const hue = (index * 47) % 360;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='hsl(${hue},45%,55%)'/>` +
    `<stop offset='1' stop-color='hsl(${(hue + 60) % 360},50%,30%)'/>` +
    `</linearGradient></defs>` +
    `<rect width='320' height='180' fill='url(%23g)'/>` +
    `<circle cx='160' cy='90' r='34' fill='rgba(255,255,255,0.25)'/>` +
    `<circle cx='160' cy='90' r='10' fill='rgba(0,0,0,0.35)'/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${svg.replace(/#/g, "%23")}`;
}

const MOCK_TRACKS: Array<{ title: string; author: string }> = [
  { title: "Weightless (Ambient Mix)", author: "Marconi Union" },
  { title: "Midnight City", author: "M83" },
  { title: "Nightcall", author: "Kavinsky" },
  { title: "Intro", author: "The xx" },
  { title: "Teardrop", author: "Massive Attack" },
  { title: "Breathe", author: "Télépopmusik" },
  { title: "Porcelain", author: "Moby" },
  { title: "Kiara", author: "Bonobo" },
  { title: "Open Eye Signal", author: "Jon Hopkins" },
  { title: "Avril 14th", author: "Aphex Twin" },
  { title: "Saturday", author: "Nujabes" },
  { title: "Resonance", author: "HOME" },
];

export const MOCK_PLAYLIST: PlaylistEntry[] = MOCK_TRACKS.map((t, i) => ({
  videoId: `mock-${i}`,
  title: t.title,
  author: t.author,
  thumbnailUrl: mockThumbnail(i),
}));

/** Fixed fake duration (seconds) for every mock track. */
export const MOCK_DURATION = 213;
