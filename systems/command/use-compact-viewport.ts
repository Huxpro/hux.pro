"use client";

import { useMediaQuery } from "@/components/ui/use-media-query";

// Below `md`. Mirrors Tailwind's `md:` breakpoint (768px) and the command
// FAB's compact layout switch.
const COMPACT_QUERY = "(max-width: 767px)";

/** True when the viewport is below Tailwind `md` (phone-width). */
export function useCompactViewport(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}
