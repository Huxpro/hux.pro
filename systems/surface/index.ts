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
// A surface that belongs to one button rather than to the page takes the
// fourth shape instead — `ANCHORED_PRESENTATION`, a sheet on a phone and a
// popover hanging off that button above it — and passes `anchor`.
//
// Underneath, every phone shape is one <SurfaceSheet> (sheet.tsx), a Base UI
// Drawer. A surface whose header is not a title bar — the command palette,
// whose header is its search field — composes that primitive directly and
// still gets the same shell, gaps, detents and iOS-style stacking (stack.ts).
// =============================================================================

export { AdaptiveSurface, useSurfaceContext } from "./adaptive-surface";
export type { AdaptiveSurfaceProps } from "./adaptive-surface";
export {
  detentHeight,
  HEADER_BUTTON,
  SHEET_DETENTS,
  SurfaceSheet,
  SurfaceViewport,
  surfaceMotionVars,
} from "./sheet";
export { SURFACE_TRANSITION_MS, useSurfaceStack } from "./stack";
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
