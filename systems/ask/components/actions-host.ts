"use client";

import { followHref } from "@/lib/follow-href";
import { highlightQuote } from "@/lib/highlight-quote";
import { LOG } from "@/lib/log-client";
import { useLocale } from "@/services";
import { attachmentSetFor, useOptionalAttachments } from "@/systems/attachments";
import { useCommand } from "@/systems/command";
import { useCommandActions } from "@/systems/command/actions";
import { validCommandValue } from "@/systems/command/catalog";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect } from "react";
import { siteActionHref } from "../lib/action-policy";
import { setAskActions } from "../lib/actions";
import { askPlatformNow } from "../lib/config";

// =============================================================================
// The agent's hands (../lib/actions.ts): what open_page and play do.
//
//   open_page  goes to the page, at the spot (lib/follow-href.ts: a link into
//              the page already open travels too), and with a quote, scrolls
//              to the passage and highlights it. The conversation stays in
//              view: from the center (the palette, which would cover the
//              page) Ask moves to the side; on a phone the drawer goes down
//              so the page shows.
//   play       opens a work's recording (or its slides, photos, link) the way
//              /works does, through systems/attachments, Ask at the side.
//              A recording on a phone skips that sheet: the stage is already
//              a PiP there, so the tool opens it directly.
// =============================================================================

export function useAskActionsHost() {
  const router = useTransitionRouter();
  const { locale } = useLocale();
  const { askPlacement, moveAsk, minimizeAsk } = useCommand();
  const attachments = useOptionalAttachments();
  const commands = useCommandActions();

  useEffect(() => {
    const aside = () => {
      if (askPlacement === "center" && askPlatformNow() === "desk") moveAsk("side");
    };
    setAskActions({
      commands,
      async runCommand(id, value) {
        const command = commands.find((c) => c.id === id);
        if (!command || !validCommandValue(id, value)) throw new Error("This command is unavailable.");
        const opensSurface = command.kind === "surface" && !(id === "wallpaper" && value && value !== "picker");
        if (command.kind === "navigate" || opensSurface) {
          aside();
          if (askPlatformNow() === "phone") minimizeAsk();
          (document.activeElement as HTMLElement | null)?.blur();
        }
        // Gesture-only actions come from the card click itself, preserving
        // user activation. Ask's automatic path checks the catalog policy.
        await command.run({ value });
      },
      visible: askPlacement === "center" || askPlacement === "side" || askPlacement === "top",
      async open({ href: inputHref, quote }, canContinue) {
        const href = siteActionHref(inputHref, window.location.origin);
        if (!href) {
          return { error: "Only pages on this site, as a path (/writing/…, /works#…, /prompt#…)." };
        }
        aside();
        followHref(href, (to) => router.push(to));
        if (askPlatformNow() === "phone") minimizeAsk();
        if (!quote) return { opened: href };
        return { opened: href, highlighted: await highlightQuote(quote, { href, canContinue }) };
      },
      play({ id, kind }) {
        const commit = /^work:[^:]+:(en|zh)$/.test(id) ? LOG.commits.find((c) => c.id === id.split(":")[1]) : undefined;
        const set = commit && attachmentSetFor(commit, locale);
        if (!set || !attachments) return { error: `Nothing to play for "${id}". Use a work's doc id.` };
        const order = kind ? [kind] : ["video", "slides", "image", "link"];
        const index = order.map((k) => set.items.findIndex((m) => m.kind === k)).find((i) => i >= 0) ?? -1;
        if (index < 0) return { error: `"${set.title}" has no ${kind ?? "recording or slides"} to open.` };
        const item = set.items[index];
        aside();
        // The stage has the keyboard now (Escape closes it, not Ask).
        (document.activeElement as HTMLElement | null)?.blur();
        const phone = askPlatformNow() === "phone";
        if (phone) minimizeAsk();
        // A phone opens every attachment in the sheet, and the sheet's button
        // is what reaches the stage. A recording asked for by the play tool
        // skips that step: `act` is the native home, and on a phone the stage
        // is PiP. Slides, photos and links still come up in the sheet.
        if (phone && item.kind === "video") attachments.act(set, index);
        else attachments.open(set, index);
        return { playing: set.title, kind: item.kind };
      },
    });
    return () => setAskActions(null);
  }, [router, locale, askPlacement, moveAsk, minimizeAsk, attachments, commands]);
}
