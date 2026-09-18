import type { SyntheticEvent } from "react";

/**
 * What counts as a widget's *own surface*.
 *
 * A widget is one object: its title, padding and static text belong to the
 * card, while a row, link, tab or field inside it belongs to itself. Two
 * separate gestures need that same line drawn, and they must agree —
 * otherwise a region can be pickup-able but not tappable, or vice versa:
 *
 *   - tap    → open the widget's page / run its action  (`WidgetShell`)
 *   - hold   → lift the card for reordering            (`BoardItem`)
 *
 * So the list lives here once. The press wash in `globals.css`
 * (`.widget-surface`) mirrors it as a `:has()` argument — keep the two in
 * sync; CSS cannot import this module.
 */
const OWN_ACTION_SELECTORS = [
  "a",
  "button",
  "[role='button']",
  "[role='tab']",
  "input",
  "textarea",
  "select",
  "summary",
  "[contenteditable='true']",
  "[data-widget-inert]",
];

export const OWN_ACTION_SELECTOR = OWN_ACTION_SELECTORS.join(", ");

/**
 * True when the event landed on a descendant that owns its own action, so the
 * widget as a whole should stay out of the way.
 *
 * The match must be a *strict descendant*: both call sites sit on elements
 * that can themselves match the list — the masonry's sortable wrapper carries
 * dnd-kit's `role="button"` — and an element must never veto its own gesture.
 */
export function landsOnOwnAction(e: SyntheticEvent): boolean {
  const hit = (e.target as Element | null)?.closest(OWN_ACTION_SELECTOR);
  return !!hit && hit !== e.currentTarget && e.currentTarget.contains(hit);
}
