// =============================================================================
// Surface System — one secondary surface, three shapes.
//
// Where a secondary surface should live is a property of the viewport, not of
// the feature: a phone wants a bottom sheet, a tablet a side panel, a desktop a
// centred window it can drag out of the way. Every feature that opens one was
// re-deciding that on its own, so this system holds the decision once.
//
//   <AdaptiveSurface
//     id="wallpaper"
//     open={isOpen}
//     onOpenChange={setOpen}
//     presentation={ADAPTIVE_PRESENTATION}   // sheet → panel → window
//     title="wallpaper"
//     closeLabel="Close"
//   >
//     {content}
//   </AdaptiveSurface>
//
// Moving a surface between shapes is then a one-word change to `presentation`,
// and content that wants to adapt (column counts, density) reads the shape it
// landed in from `useSurfaceContext()` instead of re-measuring the viewport.
//
// A surface that belongs to one button rather than to the page takes a fourth
// shape — `ANCHORED_PRESENTATION`, a sheet on a phone and a popover hanging off
// that button above it — and passes `anchor`.
//
// Two layers, because shape is not always the viewport's call:
//
//   primitives   <SurfaceSheet> (sheet.tsx), <SurfaceWindow> (window.tsx) and
//                the chrome they hold (<SurfaceBody>, chrome.tsx). Shells that
//                know nothing about viewports.
//   policy       <AdaptiveSurface>, the rule above — viewport picks the shape.
//
// A feature composes the primitives directly when the rule is not its rule:
// the command palette, whose header is a search field rather than a title bar,
// and the devtool, whose shape is something the developer chose by pulling the
// sheet off the bottom edge. Both still get the same shell, gaps, detents and
// iOS-style stacking (stack.ts).
// =============================================================================

export { AdaptiveSurface, useSurfaceContext } from "./adaptive-surface";
export type { AdaptiveSurfaceProps } from "./adaptive-surface";
export { SurfaceBody } from "./chrome";
export type { SurfaceBodyProps } from "./chrome";
export {
  detentHeight,
  EDGE_GAP_PX,
  HEADER_BUTTON,
  SHEET_DETENTS,
  SurfaceSheet,
  SurfaceViewport,
  surfaceMotionVars,
} from "./sheet";
export { SurfaceWindow, WINDOW_SPRING } from "./window";
export type { SurfaceWindowProps } from "./window";
export {
  SURFACE_TRANSITION_MS,
  useSurfaceStack,
  useSurfaceStackEntries,
} from "./stack";
export type { SurfaceBand } from "./stack";
export {
  ADAPTIVE_PRESENTATION,
  ANCHORED_PRESENTATION,
  SURFACE_BREAKPOINTS,
  useBreakpointValue,
  useSurfaceMode,
} from "./presentation";
export type {
  BreakpointMap,
  SurfaceMode,
  SurfacePresentation,
} from "./presentation";
