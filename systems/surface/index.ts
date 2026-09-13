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
// =============================================================================

export { AdaptiveSurface, useSurfaceContext } from "./adaptive-surface";
export type { AdaptiveSurfaceProps } from "./adaptive-surface";
export {
  ADAPTIVE_PRESENTATION,
  DRAWER_PRESENTATION,
  SURFACE_BREAKPOINTS,
  useSurfaceMode,
} from "./presentation";
export type { SurfaceMode, SurfacePresentation } from "./presentation";
