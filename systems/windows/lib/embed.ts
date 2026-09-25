// =============================================================================
// Embedded — this document is a page shrunk into one of the site's windows
//
// A page window (`runtime: "page"`) is a same-origin frame of a route. Inside
// it the site is the *page*, not the OS: the dock, the palette, the devtool,
// the wallpaper and the bezel all belong to the top document, which is already
// drawing them around the window. So the frame is named, and a document that
// finds itself in a frame by that name marks <html> before first paint and
// draws none of them.
//
// The name rather than a query parameter, because a frame's name survives
// every navigation inside it — follow a link in the Writing window and the
// article it lands on still knows where it is — and a URL is the page's to
// change. The top check keeps the name from meaning anything in a real tab.
// =============================================================================

/** The `name` every page-window frame carries. */
export const PAGE_FRAME_NAME = "hux-window";

/** The attribute on <html> while embedded (value `"window"`). */
export const EMBEDDED_ATTRIBUTE = "data-embedded";

/**
 * Runs in <head> before anything paints (app/layout.tsx), so the OS chrome the
 * server rendered is hidden by CSS from the first frame rather than flashing
 * in and being unmounted after hydration.
 */
export const EMBED_BOOT_SCRIPT = `try{if(window.top!==window&&(window.name||"").indexOf(${JSON.stringify(
  PAGE_FRAME_NAME,
)})===0)document.documentElement.setAttribute(${JSON.stringify(EMBEDDED_ATTRIBUTE)},"window")}catch(e){}`;

export function isEmbeddedWindow(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute(EMBEDDED_ATTRIBUTE) === "window";
}
