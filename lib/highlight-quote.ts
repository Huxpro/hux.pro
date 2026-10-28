"use client";

/**
 * Find words on the page and point at them: scroll the passage into view
 * and highlight the words (the CSS Custom Highlight API, `::highlight(quote)`,
 * a rule added here because the build's CSS parser does not know the
 * pseudo-element; a wash on the paragraph where the API is missing). For Ask's
 * open_page, which lands on a passage of a post rather than its heading.
 *
 * The words are matched with their whitespace folded, in the page's content
 * (`main`, `article`); a long quote is matched by its opening, which is
 * enough to be unique and survives the model trimming the end.
 */

const PROBE = 80;
const HIGHLIGHT = "quote";
const HOLD_MS = 6000;
/** A link's own landing (lib/use-hash-landing.ts: fonts, a frame, a 460ms
 *  travel) goes first: the passage is pointed at after it, from the section
 *  to the words, rather than the two scrolls fighting. */
const AFTER_LANDING_MS = 560;

/** The highlight's look, added to the page once. */
function ensureStyle() {
  if (document.getElementById("quote-highlight")) return;
  const style = document.createElement("style");
  style.id = "quote-highlight";
  style.textContent = `::highlight(${HIGHLIGHT}) { background-color: var(--accent-wash); }`;
  document.head.appendChild(style);
}

function fold(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** The range of these words on the page now, or null. */
export function findQuote(quote: string): Range | null {
  const full = fold(quote.trim()).toLowerCase();
  const wanted = full.slice(0, PROBE);
  if (wanted.length < 4) return null;
  const root = document.querySelector("article") ?? document.querySelector("main");
  if (!root) return null;
  // The content's text with whitespace folded, and where each folded
  // character came from.
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (parent && !parent.closest("script, style, [hidden], [aria-hidden=true], [data-ask-panel], [data-ask-center]") && parent.getClientRects().length) nodes.push(n as Text);
  }
  let flat = "";
  const from: { node: Text; offset: number }[] = [];
  let space = false;
  for (const node of nodes) {
    const text = node.data;
    for (let i = 0; i < text.length; i++) {
      const isSpace = /\s/.test(text[i]);
      if (isSpace && space) continue;
      space = isSpace;
      flat += isSpace ? " " : text[i].toLowerCase();
      from.push({ node, offset: i });
    }
  }
  const fullAt = flat.indexOf(full);
  const at = fullAt >= 0 ? fullAt : flat.indexOf(wanted);
  if (at < 0) return null;
  const start = from[at];
  const end = from[at + (fullAt >= 0 ? full.length : wanted.length) - 1];
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
}

/**
 * Wait (a route may still be rendering) for the words, then point at them.
 * Resolves whether they were found.
 */
export async function highlightQuote(quote: string, {
  href,
  canContinue,
  timeoutMs = 12000,
}: { href: string; canContinue: () => boolean; timeoutMs?: number }): Promise<boolean> {
  const target = new URL(href, window.location.href);
  const started = performance.now();
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  // A reader taking over the page outranks a delayed agent scroll.
  window.addEventListener("wheel", cancel, { passive: true });
  window.addEventListener("touchstart", cancel, { passive: true });
  window.addEventListener("pointerdown", cancel, { passive: true });
  const active = () => !cancelled && canContinue() && performance.now() - started < timeoutMs;
  const onTarget = () => location.pathname === target.pathname && location.search === target.search && location.hash === target.hash;
  const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  try {
    while (active()) {
      if (!onTarget() || !findQuote(quote)) { await pause(150); continue; }
      // Font loading is bounded too; a stalled font must not hang the tool.
      await Promise.race([document.fonts?.ready ?? Promise.resolve(), pause(1000)]);
      await pause(AFTER_LANDING_MS);
      if (!active() || !onTarget()) return false;
      // Re-read after landing instead of using a range from a previous route.
      const range = findQuote(quote);
      if (!range || !range.startContainer.isConnected) continue;
      const block = range.startContainer.parentElement?.closest("p, li, blockquote, h1, h2, h3, h4, pre") ?? range.startContainer.parentElement;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      block?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
      const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
      if (registry && HighlightCtor) {
        ensureStyle();
        const mark = new HighlightCtor(range);
        registry.set(HIGHLIGHT, mark);
        window.setTimeout(() => { if (registry.get(HIGHLIGHT) === mark) registry.delete(HIGHLIGHT); }, HOLD_MS);
      } else if (block) {
        block.setAttribute("data-hash-target", "");
        block.addEventListener("animationend", () => block.removeAttribute("data-hash-target"), { once: true });
      }
      return true;
    }
    return false;
  } finally {
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    window.removeEventListener("pointerdown", cancel);
  }
}
