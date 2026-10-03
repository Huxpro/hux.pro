"use client";

import { useCommand } from "@/systems/command";
import {
  detentHeight,
  SurfacePanel,
  SurfaceSheet,
  useBreakpointValue,
} from "@/systems/surface";
import type { Drawer } from "@base-ui/react/drawer";
import { useTransitionRouter } from "next-view-transitions";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

// =============================================================================
// AskSurface: Ask as a panel that stays while you read.
//
// Docked against the trailing edge from `sm` up, full height, with no scrim:
// the page beside it stays live, and a link in an answer navigates the page
// while the panel, and the conversation in it, stays where it is. It is
// mounted once in the root layout, beside the palette, so it outlives every
// page it is opened on.
//
// On a phone there is no room beside the page, so the same contents arrive as
// a full-height sheet, and a link followed there puts the sheet away to show
// the page it opened. The conversation is the session's (lib/chat.ts), so the
// sparkle button brings it back as it was.
//
// Opened by ⌘J, `/` `J`, the palette's Ask row or Tab (which hand over what
// was typed and close the palette), and the sparkle button beside the
// palette's own (systems/command/fab.tsx). The open state is the command
// provider's, so all of them agree.
// =============================================================================

/** What the panel holds: loaded the first time Ask opens (AI Elements,
 *  streamdown and the AI SDK client are none of the page's business before). */
const AskPanel = dynamic(() => import("./components/panel"), { ssr: false });

/**
 * On `<html>` while the panel is docked, so the page can make room for it
 * (globals.css, "Ask panel"). The page owns its own layout; this only says
 * that the trailing edge is taken.
 */
const DOCKED_ATTRIBUTE = "data-ask-docked";

/** On the wrapper around the panel's contents: where a key press came from. */
const CONTENT_ATTRIBUTE = "data-ask-panel";

type AskShape = "sheet" | "panel";

export function AskSurface() {
  const { isAskOpen, closeAsk, askRequest } = useCommand();
  const router = useTransitionRouter();
  const pathname = usePathname();
  const shape = useBreakpointValue<AskShape>({ base: "sheet", sm: "panel" });

  const onOpenChange = useCallback(
    (open: boolean, details?: Drawer.Root.ChangeEventDetails) => {
      if (open) return;
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
    [closeAsk]
  );

  const onNavigate = useCallback(
    (href: string) => {
      router.push(href);
      // A full-height sheet covers the page it just opened.
      if (shape === "sheet") closeAsk();
    },
    [router, shape, closeAsk]
  );

  // The home is a springboard, not a column to read beside: its grid keeps
  // its width and the panel stands over its trailing edge.
  const docked = isAskOpen && shape === "panel" && pathname !== "/";
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute(DOCKED_ATTRIBUTE, docked);
    return () => root.removeAttribute(DOCKED_ATTRIBUTE);
  }, [docked]);

  const body = (
    // `contents`: the panel's title bar, conversation and composer stay the
    // shell's own flex column.
    <div {...{ [CONTENT_ATTRIBUTE]: "" }} className="contents">
      <AskPanel request={askRequest} onClose={closeAsk} onNavigate={onNavigate} />
    </div>
  );

  return shape === "panel" ? (
    <SurfacePanel open={isAskOpen} onOpenChange={onOpenChange}>
      {body}
    </SurfacePanel>
  ) : (
    <SurfaceSheet
      id="ask"
      open={isAskOpen}
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
