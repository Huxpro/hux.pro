"use client";

import { useDevtool } from "@/systems/devtool";
import { FloatingActionButton } from "./fab";
import { CommandTabBar } from "./tab-bar";
import { useCompactViewport } from "./use-compact-viewport";

// =============================================================================
// CommandLauncher — what stands at the bottom of the screen, and opens the
// palette when it is pressed.
//
// Two shapes, the way the palette itself has two shells (`palette.tsx`): the
// floating button everywhere, or — on a phone, and only behind the devtool's
// Command → Phone nav switch — the tab bar. The switch lives in the devtool
// because the tab bar is a proposal about navigation, not a setting: the
// palette is still the way around this site, and until that is settled the
// button is what a visitor gets.
//
// A desktop is untouched by the choice. The bar is a phone shape (below `md`,
// the same width the button changes shape at), so a wide window shows the
// button whatever the switch says.
// =============================================================================

export function CommandLauncher() {
  const { phoneNav } = useDevtool();
  const compact = useCompactViewport();
  return compact && phoneNav === "tabs" ? <CommandTabBar /> : <FloatingActionButton />;
}
