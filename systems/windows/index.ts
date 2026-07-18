// =============================================================================
// Window System — draggable/resizable "chrome" windows for apps
//
// Opens app tiles (from the home-screen shelf) as macOS/iPadOS-style windows.
// Web apps load in an iframe; Lynx apps load in a Lynx Player (<lynx-view>).
// The runtime badge on each icon is exported here too, since it's the same
// app-runtime concept surfaced on the shelf.
// =============================================================================

export {
  WindowProvider,
  useWindows,
  useOptionalWindows,
} from "./provider";
export { WindowLayer, AppBadge, AppBadgeFor } from "./components";
export * from "./lib";
