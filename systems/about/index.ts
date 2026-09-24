// =============================================================================
// About System — the surface a newcomer meets.
//
// Who made this and what it is, brief, in the middle of the screen, over a
// blurred page, with Siri's glow running around the screen's edge. It opens
// itself once for a first-time visitor; after that it is `O` from anywhere,
// `/` `O` in the palette, or the `/about` address.
//
//   const { open, close, toggle, isOpen } = useAbout();
//
// Mount <AboutProvider> inside the command provider, and <AboutSurface>
// once in the root layout with the copy rendered by AboutCopy
// (./components/about-copy, a server component — import it by path).
// =============================================================================

export { AboutProvider, useAbout, useOptionalAbout } from "./provider";
export { AboutSurface } from "./components/about-surface";
export type { AboutSurfaceProps } from "./components/about-surface";
export { EdgeGlow } from "./components/edge-glow";
export type { EdgeGlowProps } from "./components/edge-glow";
