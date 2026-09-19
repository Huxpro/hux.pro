"use client";

import { afterFirstPaint, useArmed } from "@/lib/deferred";
import { useDevtool } from "@/systems/devtool/provider";
import {
  useBreakpointValue,
  type BreakpointMap,
} from "@/systems/surface/presentation";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useCommand } from "./provider";

// =============================================================================
// CommandPalette — one palette, two shells.
//
// Which shell is a property of the viewport, decided against the same
// breakpoints every secondary surface uses (systems/surface): a sheet on a
// phone, and above that the palette's own floating popover — a Spotlight card
// rather than a titled window, so it is not an AdaptiveSurface and has a
// vocabulary of its own here.
//
// The devtool's Command module can ask for the popover on a phone too. That is
// the palette as it was before the sheet, kept whole: the popover never lost
// its phone accommodations, so the switch is one presentation map, not a
// second code path.
//
// Neither shell is in the initial bundle. The provider owns ⌘K / the FAB;
// the first open (or an idle prefetch) loads cmdk + the matching chrome.
// =============================================================================

type CommandShellShape = "sheet" | "popover";

/** Sheet on a phone; the popover from `sm` up. */
const COMMAND_PRESENTATION: BreakpointMap<CommandShellShape> = {
  base: "sheet",
  sm: "popover",
};

/** The popover everywhere — the devtool's "Popover" choice. */
const POPOVER_PRESENTATION: BreakpointMap<CommandShellShape> = { base: "popover" };

const CommandSheet = dynamic(
  () => import("./sheet").then((m) => ({ default: m.CommandSheet })),
  { ssr: false },
);

const CommandPopover = dynamic(
  () => import("./popover").then((m) => ({ default: m.CommandPopover })),
  { ssr: false },
);

export function CommandPalette() {
  const { isOpen } = useCommand();
  const { phonePalette } = useDevtool();
  const armed = useArmed(isOpen);
  const shape = useBreakpointValue(
    phonePalette === "popover" ? POPOVER_PRESENTATION : COMMAND_PRESENTATION,
  );

  // Warm the shells after TTI so the first ⌘K does not wait on the chunk.
  useEffect(() => {
    return afterFirstPaint(() => {
      void import("./sheet");
      void import("./popover");
    });
  }, []);

  if (!armed) return null;
  return shape === "sheet" ? <CommandSheet /> : <CommandPopover />;
}
