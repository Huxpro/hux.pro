import type { ReactNode } from "react";

// =============================================================================
// Widget scroll prototypes
//
// Writing and projects both clip a vertical list inside a home card. On a
// phone that list and the page share one axis, so a pan on the card is
// ambiguous: did they mean to move the list, or the page?
//
// These modes are the prototypes for that question. Nested is today's
// behaviour. The others each pick a different way to remove the ambiguity
// — clip the list, grow it into the page, require an explicit grab, move
// the motion onto the other axis, or lift the list into a sheet.
//
// Options considered and not built (yet), so they stay in the design
// conversation rather than disappearing:
//   · edge-chain     keep nested scroll, only hand the pan to the page at
//                    the list's ends (`overscroll-behavior: auto`). Helps
//                    at the boundary, not in the middle of the list.
//   · two-finger     inner list needs a two-finger pan. Unfamiliar on the
//                    web, and fights accessibility zoom.
//   · first-pan-wins a short gesture always moves the page; a second pan
//                    on the same card captures the list. Timing is magic
//                    and easy to get wrong.
// =============================================================================

export const WIDGET_SCROLL_MODES = [
  "nested",
  "peek",
  "expand",
  "lock",
  "rail",
  "pages",
  "sheet",
] as const;

export type WidgetScrollMode = (typeof WIDGET_SCROLL_MODES)[number];

export const DEFAULT_WIDGET_SCROLL_MODE: WidgetScrollMode = "nested";

export const WIDGET_SCROLL_STORAGE_KEY = "hux_widget_scroll_mode";
export const WIDGET_SCROLL_QUERY_KEY = "widgetScroll";

export function isWidgetScrollMode(value: string): value is WidgetScrollMode {
  return (WIDGET_SCROLL_MODES as readonly string[]).includes(value);
}

export function parseWidgetScrollMode(
  value: string | null | undefined,
): WidgetScrollMode | undefined {
  if (!value) return undefined;
  return isWidgetScrollMode(value) ? value : undefined;
}

/** Split a list into screens of `pageSize` for the horizontal-pages mode. */
export function pageItems<T>(items: readonly T[], pageSize: number): T[][] {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size) as T[]);
  }
  return pages;
}

export function pageChildren(
  nodes: ReactNode[],
  pageSize: number,
): ReactNode[][] {
  return pageItems(nodes, pageSize);
}
