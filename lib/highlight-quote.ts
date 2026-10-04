"use client";

/**
 * Find words on the page and point at them: scroll the passage into view
 * and highlight the words (the CSS Custom Highlight API, `::highlight(quote)`
 * in globals.css; a wash on the paragraph where it is missing). For Ask's
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

function fold(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** The range of these words on the page now, or null. */
export function findQuote(quote: string): Range | null {
  const wanted = fold(quote.trim()).slice(0, PROBE).toLowerCase();
  if (wanted.length < 4) return null;
  const root = document.querySelector("article") ?? document.querySelector("main");
  if (!root) return null;
  // The content's text with whitespace folded, and where each folded
  // character came from.
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
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
  const at = flat.indexOf(wanted);
  if (at < 0) return null;
  const start = from[at];
  const end = from[at + wanted.length - 1];
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
}

/**
 * Wait (a route may still be rendering) for the words, then point at them.
 * Resolves whether they were found.
 */
export function highlightQuote(quote: string, timeoutMs = 4000): Promise<boolean> {
  const started = performance.now();
  return new Promise((resolve) => {
    const attempt = () => {
      const range = findQuote(quote);
      if (!range) {
        if (performance.now() - started > timeoutMs) resolve(false);
        else window.setTimeout(attempt, 150);
        return;
      }
      const block = (range.startContainer.parentElement?.closest("p, li, blockquote, h1, h2, h3, h4, pre") ??
        range.startContainer.parentElement) as HTMLElement | null;
      void (document.fonts?.ready ?? Promise.resolve()).then(() =>
        requestAnimationFrame(() => window.setTimeout(() => point(range, block), AFTER_LANDING_MS)),
      );
      resolve(true);
    };
    const point = (range: Range, block: HTMLElement | null) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      block?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
      const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
      if (registry && HighlightCtor) {
        registry.set(HIGHLIGHT, new HighlightCtor(range));
        window.setTimeout(() => registry.delete(HIGHLIGHT), HOLD_MS);
      } else if (block) {
        block.setAttribute("data-hash-target", "");
        block.addEventListener("animationend", () => block.removeAttribute("data-hash-target"), { once: true });
      }
    };
    attempt();
  });
}
