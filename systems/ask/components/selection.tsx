"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addAskContext } from "../lib/pending-context";
import { selectionPosition } from "../lib/selection-layout";
import { showNotice } from "@/systems/dock";
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

/** Where words selected can be asked about: the page's own content. */
const OUTSIDE = "[data-ask-panel], [cmdk-root], [data-ask-center], [data-dock], input, textarea, [contenteditable=true]";

function selected(): { text: string; rect: DOMRect; source: Element } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().trim();
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) return null;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node instanceof Element ? node : node.parentElement;
  if (!el?.closest("main, article") || el.closest(OUTSIDE)) return null;
  const rect = range.getBoundingClientRect();
  const start = range.startContainer;
  return { text, rect, source: start instanceof Element ? start : start.parentElement! };
}

export function AskSelection() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { openAsk } = useCommand();
  const [at, setAt] = useState<{ text: string; x: number; y: number; source: Element } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sel = selected();
        if (!sel) return setAt(null);
        const width = button.current?.offsetWidth ?? 140;
        const view = window.visualViewport;
        const viewport = { left: view?.offsetLeft ?? 0, top: view?.offsetTop ?? 0, width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight };
        if (sel.rect.bottom < viewport.top || sel.rect.top > viewport.top + viewport.height) return setAt(null);
        const position = selectionPosition(sel.rect, viewport, width, button.current?.offsetHeight ?? 32, window.matchMedia("(pointer: coarse)").matches);
        setAt({ text: sel.text, source: sel.source, ...position });
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
    window.visualViewport?.addEventListener("resize", onChange);
    window.visualViewport?.addEventListener("scroll", onChange);
    // Preserve the selection's identity even when its text happens to be a
    // URL, or when the reader drops after scrolling to another section.
    const onDrag = (e: DragEvent) => {
      const sel = selected();
      if (!sel || !e.dataTransfer || !(e.target instanceof Node) || !window.getSelection()?.containsNode(e.target, true)) return;
      const heading = [...document.querySelectorAll("[data-heading-link][id]")].filter((h) => h.contains(sel.source) || !!(h.compareDocumentPosition(sel.source) & Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);
      const entry = sel.source.closest("[data-rail-row][id], .prompt-item[id]");
      const anchor = entry?.id ?? heading?.id;
      e.dataTransfer.setData("application/x-ask-quote", JSON.stringify({ text: sel.text, title: document.title, href: `${location.pathname}${anchor ? `#${encodeURIComponent(anchor)}` : ""}` }));
      e.dataTransfer.setData("text/plain", sel.text);
      e.dataTransfer.effectAllowed = "copy";
    };
    document.addEventListener("dragstart", onDrag);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("selectionchange", onChange);
      document.removeEventListener("scroll", onChange, { capture: true });
      window.removeEventListener("resize", onChange);
      window.visualViewport?.removeEventListener("resize", onChange);
      window.visualViewport?.removeEventListener("scroll", onChange);
      document.removeEventListener("dragstart", onDrag);
    };
  }, []);

  const ask = async () => {
    if (!at) return;
    const { text, source } = at;
    setAt(null);
    const [{ loadAskSearch }, { quoteContext }] = await Promise.all([
      import("../lib/search"),
      import("../lib/pointed"),
    ]);
    const site = await loadAskSearch().catch(() => null);
    if (!site) return;
    if (!addAskContext(quoteContext(text, site, source))) showNotice({ id: "ask-context-full", icon: Sparkles, title: s.contextFull });
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
