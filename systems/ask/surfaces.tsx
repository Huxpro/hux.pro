"use client";

import { useCommand } from "@/systems/command";
import { SurfacePanel } from "@/systems/surface";
import type { Drawer } from "@base-ui/react/drawer";
import { useTransitionRouter } from "next-view-transitions";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

// =============================================================================
// Ask's places outside the palette, mounted once in the root layout.
//
//   AskSide      the side place: a panel docked at the trailing edge, beside
//                the page, which stays live; a link in an answer navigates
//                the page while the panel stays.
//   AskDock      the top place and the pill: Ask as a Live Activity in the
//                Dock (components/activity.tsx). Mounted inside <Dock>.
//   AskDragging  the overlay a drag between places draws (components/
//                placement.tsx).
//
// The center place is the palette's own (systems/command, AskChat). Which
// one is showing is the command provider's `askPlacement`; moving between
// them moves nothing but that, because the conversation is the session's
// (lib/chat.ts). None of it loads until Ask is first called (`askStarted`).
// =============================================================================

const AskPanel = dynamic(() => import("./components/panel"), { ssr: false });
const Activity = dynamic(() => import("./components/activity"), { ssr: false });
const DragOverlay = dynamic(
  () => import("./components/placement").then((m) => m.AskDragOverlay),
  { ssr: false },
);

/**
 * On `<html>` while the side panel is docked, so the page can make room for
 * it (globals.css, "Ask panel"). The page owns its own layout; this only says
 * that the trailing edge is taken.
 */
const DOCKED_ATTRIBUTE = "data-ask-docked";

/** On the wrapper around the panel's contents: where a key press came from. */
const CONTENT_ATTRIBUTE = "data-ask-panel";

export function AskSide() {
  const { askPlacement, askStarted, closeAsk, askRequest } = useCommand();
  const router = useTransitionRouter();
  const pathname = usePathname();
  const open = askPlacement === "side";

  const onOpenChange = useCallback(
    (next: boolean, details?: Drawer.Root.ChangeEventDetails) => {
      if (next) return;
      // Escape is the panel's only while it has the keyboard. Pressed on the
      // page, or in the palette over it, it belongs there: a panel that left
      // with every Escape could not stay while you read.
      if (
        details?.reason === "escape-key" &&
        !(details.event.target as Element | null)?.closest?.(`[${CONTENT_ATTRIBUTE}]`)
      ) {
        details.cancel();
        return;
      }
      closeAsk();
    },
    [closeAsk],
  );

  // The home is a springboard, not a column to read beside: its grid keeps
  // its width and the panel stands over its trailing edge.
  const docked = open && pathname !== "/";
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute(DOCKED_ATTRIBUTE, docked);
    return () => root.removeAttribute(DOCKED_ATTRIBUTE);
  }, [docked]);

  if (!askStarted) return null;

  return (
    <SurfacePanel open={open} onOpenChange={onOpenChange}>
      {/* `contents`: the panel's title bar, conversation and composer stay
          the shell's own flex column. */}
      <div {...{ [CONTENT_ATTRIBUTE]: "" }} className="contents">
        <AskPanel
          // The question is this place's to send only while Ask is here.
          request={open ? askRequest : null}
          onClose={closeAsk}
          onNavigate={(href) => router.push(href)}
        />
      </div>
    </SurfacePanel>
  );
}

export function AskDock() {
  const { askStarted } = useCommand();
  return askStarted ? <Activity /> : null;
}

export function AskDragging() {
  const { askStarted } = useCommand();
  return askStarted ? <DragOverlay /> : null;
}
