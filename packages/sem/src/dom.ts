// DOM and SVG: retained, so the platform already knows where things are.
// The adapter only reads it.

import type { Layer } from "./layer";
import type { SemNode, Shape } from "./types";

/** A node's declaration, less what an element can answer for itself. */
export type ElementDecl = Omit<SemNode, "measure" | "visible" | "backend"> & {
  backend?: SemNode["backend"];
};

const isSvgGraphics = (el: Element): el is SVGGraphicsElement =>
  typeof SVGGraphicsElement !== "undefined" && el instanceof SVGGraphicsElement && !(el instanceof SVGSVGElement);

/**
 * Where an element is. An SVG shape is its own box carried through its screen
 * transform, so a rotated rect stays a rotated outline; anything else is its
 * client rect.
 */
export function measureElement(el: Element): Shape | null {
  if (!el.isConnected) return null;
  if (isSvgGraphics(el)) {
    const box = el.getBBox();
    const m = el.getScreenCTM();
    if (m) {
      const corners = [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x + box.width, box.y + box.height],
        [box.x, box.y + box.height],
      ];
      return { poly: corners.flatMap(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]) };
    }
  }
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { rect: [r.left, r.top, r.width, r.height] };
}

/** Seen, not merely laid out: not display:none, not hidden, not faded to nothing. */
export function elementVisible(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
  if (check && !check.call(el, { opacityProperty: true, visibilityProperty: true })) return false;
  // checkVisibility counts opacity 0 only; a fade's last few percent is not seen either.
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (Number(getComputedStyle(e).opacity) < 0.02) return false;
  }
  return true;
}

/** A node for an element: its place and visibility come from the element. */
export function elementNode(el: Element, decl: ElementDecl): SemNode {
  return {
    ...decl,
    backend: decl.backend ?? (isSvgGraphics(el) ? "svg" : "dom"),
    measure: () => measureElement(el),
    visible: () => elementVisible(el),
  };
}

/**
 * Markup only: every `[data-sem-id]` under `root` becomes a node, with
 * `data-sem-kind`, `data-sem-intent` and `data-sem-parent` (or the nearest
 * marked ancestor). Returns a disposer for all of them.
 */
export function scan(layer: Layer, root: ParentNode = document): () => void {
  const disposers: (() => void)[] = [];
  root.querySelectorAll<Element>("[data-sem-id]").forEach((el) => {
    const id = el.getAttribute("data-sem-id")!;
    const parent =
      el.getAttribute("data-sem-parent") ?? el.parentElement?.closest("[data-sem-id]")?.getAttribute("data-sem-id") ?? undefined;
    disposers.push(
      layer.node(
        elementNode(el, {
          id,
          kind: el.getAttribute("data-sem-kind") ?? "element",
          intent: el.getAttribute("data-sem-intent") ?? "",
          ...(parent ? { parent } : {}),
        }),
      ),
    );
  });
  return () => disposers.forEach((dispose) => dispose());
}
