// =============================================================================
// Dock System — shared "Live Activity" pill ⇄ panel surface
//
// A coordination layer (DockProvider/useDock) + a reusable morph primitive
// (LiveActivity) + the top-of-screen layout (Dock). Activities from other
// systems (music, ambient) plug in by rendering a <LiveActivity /> as a child
// of <Dock />.
// =============================================================================

export { Dock, LiveActivity } from "./components";
export { DockProvider, useDock } from "./provider";
