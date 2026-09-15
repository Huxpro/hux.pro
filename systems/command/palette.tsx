"use client";

import { useDevtool } from "@/systems/devtool";
import { useSurfaceMode, type SurfacePresentation } from "@/systems/surface";
import { CommandPopover } from "./popover";
import { CommandSheet } from "./sheet";

// =============================================================================
// CommandPalette — one palette, two shells.
//
// Which shell is a property of the viewport, decided the way every secondary
// surface decides it (systems/surface): a sheet on a phone, and above that the
// palette's own floating popover — the palette's "window", though it is a
// Spotlight card rather than a titled window, so it is not an AdaptiveSurface.
//
// The devtool's Command module can ask for the popover on a phone too. That is
// the palette as it was before the sheet, kept whole: the popover never lost
// its phone accommodations, so the switch is one presentation map, not a
// second code path.
// =============================================================================

/** Sheet on a phone; the popover from `sm` up. */
const COMMAND_PRESENTATION: SurfacePresentation = { base: "sheet", sm: "window" };

/** The popover everywhere — the devtool's "Popover" choice. */
const POPOVER_PRESENTATION: SurfacePresentation = { base: "window" };

export function CommandPalette() {
  const { phonePalette } = useDevtool();
  const mode = useSurfaceMode(
    phonePalette === "popover" ? POPOVER_PRESENTATION : COMMAND_PRESENTATION
  );
  return mode === "sheet" ? <CommandSheet /> : <CommandPopover />;
}
