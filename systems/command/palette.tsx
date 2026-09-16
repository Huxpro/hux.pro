"use client";

import { useDevtool } from "@/systems/devtool";
import { useBreakpointValue, type BreakpointMap } from "@/systems/surface";
import { CommandPopover } from "./popover";
import { CommandSheet } from "./sheet";

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
// =============================================================================

type CommandShellShape = "sheet" | "popover";

/** Sheet on a phone; the popover from `sm` up. */
const COMMAND_PRESENTATION: BreakpointMap<CommandShellShape> = {
  base: "sheet",
  sm: "popover",
};

/** The popover everywhere — the devtool's "Popover" choice. */
const POPOVER_PRESENTATION: BreakpointMap<CommandShellShape> = { base: "popover" };

export function CommandPalette() {
  const { phonePalette } = useDevtool();
  const shape = useBreakpointValue(
    phonePalette === "popover" ? POPOVER_PRESENTATION : COMMAND_PRESENTATION
  );
  return shape === "sheet" ? <CommandSheet /> : <CommandPopover />;
}
