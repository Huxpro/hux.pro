"use client";

import { useCommand, type AskPlacement } from "@/systems/command";
import { detentHeight, SurfacePanel, SurfaceSheet, useBreakpointValue } from "@/systems/surface";
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
//                the page while the panel stays. On a phone, the center
//                place instead: a bottom drawer of Ask's own, the screen's
//                height (no palette under it). A link followed there puts
//                Ask away so the page shows: minimized, which on a phone's
//                preset is closed (lib/config.ts); the Ask button brings the
//                conversation back.
//   AskDock      the top place and the pill: Ask as a Live Activity in the
//                Dock (components/activity.tsx), where the settings use them
//                (a desk's preset). Mounted inside <Dock>.
//   AskDragging  the overlay a drag between places draws (components/
//                placement.tsx).
//
// The center place on a desk is the palette's own (systems/command, AskChat). Which
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

type AskShape = "sheet" | "panel";

export function AskSide() {
  const { askPlacement, askStarted, closeAsk, minimizeAsk, askRequest } = useCommand();
  const router = useTransitionRouter();
  const pathname = usePathname();
  const shape = useBreakpointValue<AskShape>({ base: "sheet", sm: "panel" });
  // The place this surface is: the side on a desk, the center on a phone
  // (where the palette never holds Ask).
  const placement: AskPlacement = shape === "panel" ? "side" : "center";
  const open = askPlacement === placement;

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

  const onNavigate = useCallback(
    (href: string) => {
      router.push(href);
      // A drawer the screen's height covers the page it just opened: away
      // (into the Dock, where minimize goes there; closed, on a phone).
      if (shape === "sheet") minimizeAsk();
    },
    [router, shape, minimizeAsk],
  );

  // The home is a springboard, not a column to read beside: its grid keeps
  // its width and the panel stands over its trailing edge.
  const docked = open && shape === "panel" && pathname !== "/";
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute(DOCKED_ATTRIBUTE, docked);
    return () => root.removeAttribute(DOCKED_ATTRIBUTE);
  }, [docked]);

  if (!askStarted) return null;

  const body = (
    // `contents`: the panel's title bar, conversation and composer stay the
    // shell's own flex column.
    <div {...{ [CONTENT_ATTRIBUTE]: "" }} className="contents">
      <AskPanel
        placement={placement}
        // The question is this place's to send only while Ask is here.
        request={open ? askRequest : null}
        onClose={closeAsk}
        onNavigate={onNavigate}
      />
    </div>
  );

  return shape === "panel" ? (
    <SurfacePanel open={open} onOpenChange={onOpenChange}>
      {body}
    </SurfacePanel>
  ) : (
    <SurfaceSheet
      id="ask"
      open={open}
      onOpenChange={onOpenChange}
      height={detentHeight(1)}
      // Focus handed back to a field on a phone raises its keyboard on the
      // next touch, wherever it lands (sheet.tsx, item 5).
      restoreFocus={false}
    >
      {body}
    </SurfaceSheet>
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
