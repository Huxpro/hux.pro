"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addAskContext } from "../lib/pending-context";
import { askStrings } from "../strings";

// =============================================================================
// "Ask about this" over words selected on the page: a small button under
// the selection that puts the words (with the page and section they are
// in, ../lib/pointed.ts) on the next question and opens Ask where it would
// open, the field ready for the question.
//
// Only for reading: words in the page's content, not in a field, not in
// Ask itself or the palette, and not one stray character. It follows the
// selection while the page scrolls and leaves when the selection does.
// Mounted once in the root layout; what it needs to read the page (the
// index) loads the first time it is pressed.
// =============================================================================

const MIN_CHARS = 2;
const MAX_CHARS = 5000;
/** Below the selection's last line. */
const GAP = 8;

/** Where words selected can be asked about: the page's own content. */
const OUTSIDE = "[data-ask-panel], [cmdk-root], [data-ask-center], [data-dock], input, textarea, [contenteditable=true]";

function selected(): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().trim();
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) return null;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node instanceof Element ? node : node.parentElement;
  if (!el?.closest("main, article") || el.closest(OUTSIDE)) return null;
  const rects = range.getClientRects();
  const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
  return { text, rect };
}

export function AskSelection() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { openAsk } = useCommand();
  const [at, setAt] = useState<{ text: string; x: number; y: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sel = selected();
        if (!sel) return setAt(null);
        const width = button.current?.offsetWidth ?? 140;
        const x = Math.min(Math.max(8, sel.rect.left + sel.rect.width / 2 - width / 2), window.innerWidth - width - 8);
        const below = sel.rect.bottom + GAP;
        // Off the bottom: above the selection instead.
        const y = below + 36 > window.innerHeight ? Math.max(8, sel.rect.top - GAP - 32) : below;
        setAt({ text: sel.text, x, y });
      });
    };
    // A selection being made with a mouse waits for the button's release.
    let pressing = false;
    const onDown = (e: PointerEvent) => {
      if (button.current?.contains(e.target as Node)) return;
      pressing = e.pointerType === "mouse";
      if (pressing) setAt(null);
    };
    const onUp = () => {
      if (!pressing) return;
      pressing = false;
      place();
    };
    const onChange = () => {
      if (!pressing) place();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("selectionchange", onChange);
    document.addEventListener("scroll", onChange, { passive: true, capture: true });
    window.addEventListener("resize", onChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("selectionchange", onChange);
      document.removeEventListener("scroll", onChange, { capture: true });
      window.removeEventListener("resize", onChange);
    };
  }, []);

  const ask = async () => {
    if (!at) return;
    const text = at.text;
    setAt(null);
    const [{ loadAskSearch }, { quoteContext }] = await Promise.all([
      import("../lib/search"),
      import("../lib/pointed"),
    ]);
    const site = await loadAskSearch().catch(() => null);
    if (!site) return;
    addAskContext(quoteContext(text, site));
    window.getSelection()?.removeAllRanges();
    openAsk();
  };

  return (
    <button
      ref={button}
      type="button"
      data-ask-selection=""
      // Keeps the selection: a press on the button would otherwise clear it
      // before the click.
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => void ask()}
      style={at ? { transform: `translate3d(${at.x}px, ${at.y}px, 0)` } : undefined}
      className={cn(
        "system-chrome pressable fixed left-0 top-0 z-[10040] flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
        "border border-border/50 bg-glass-popover text-foreground shadow-overlay backdrop-blur-xl",
        "transition-opacity duration-150",
        at ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!at}
      tabIndex={at ? 0 : -1}
    >
      <Sparkles className="size-3.5" />
      {s.askSelection}
    </button>
  );
}
