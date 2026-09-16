"use client";

import { useSyncExternalStore } from "react";

// Below `md` — mirrors Tailwind's `md:` breakpoint (768px) and the command
// FAB's compact layout switch.
const COMPACT_QUERY = "(max-width: 767px)";

let compactMql: MediaQueryList | null = null;
const getCompactMql = () => (compactMql ??= window.matchMedia(COMPACT_QUERY));
const subscribeCompact = (onChange: () => void) => {
  const mql = getCompactMql();
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};
const getCompact = () => getCompactMql().matches;
const getCompactServer = () => false;

/** True when the viewport is below Tailwind `md` (phone-width). */
export function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribeCompact, getCompact, getCompactServer);
}
