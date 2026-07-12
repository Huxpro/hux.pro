"use client";

import { makeStore } from "@/components/post/persisted-setting";

/**
 * Mobile video playback strategy — a persisted dev channel toggled from the
 * devtool "Video" panel. Only affects the mobile (< sm) in-place spotlight;
 * desktop always uses the centered modal.
 *
 *   · lock   — fixed viewport scrim + a real (iOS-safe) scroll lock. The page
 *              freezes while playing, so the clipped hole can never drift.
 *   · follow — an absolute, *document-space* scrim that scrolls in lockstep
 *              with the video on the compositor. The page stays scrollable and
 *              the dim tracks the player frame-perfectly (no JS scroll chase).
 *
 * Both avoid the one-frame lag of a fixed scrim chasing a scrolling element via
 * `scroll` events — see VideoSpotlight.
 */
export type MobileVideoMode = "lock" | "follow";

const store = makeStore<MobileVideoMode>(
  "hux_mobile_video_mode",
  "hux:mobile-video-mode",
  "lock",
  (raw) => (raw === "follow" ? "follow" : "lock"),
);

export const getMobileVideoMode = store.get;
export const setMobileVideoMode = store.set;
export const useMobileVideoMode = store.use;
