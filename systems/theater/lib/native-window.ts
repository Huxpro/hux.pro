// =============================================================================
// Theater System: the native window (Document Picture-in-Picture)
//
// Chromium on a desk can open a real, always-on-top window for any DOM
// (`documentPictureInPicture.requestWindow`). The player moves there when
// asked, and then it is a picture-in-picture that leaves the browser: it
// stays over the editor or the call the user switched to.
//
// Two things make it more than moving an element:
//
//   An iframe moved to another document reloads. The video would start from
//   the top, so a new player is made in the window instead, started where
//   the one on the page was, and the page's is paused. On the way back the
//   page's player is moved to where the window's got to.
//
//   The YouTube IFrame API talks to its iframe through `postMessage`, which
//   goes to the iframe's parent window. A player made from this tab's `YT`
//   in the other window's document would never hear back from it, so the
//   API is loaded again inside the window and the player made from that.
//
// Everything else the window shows is this page's own React tree, rendered
// into it through a portal (components/native-window.tsx), with the page's
// stylesheets and theme copied over.
// =============================================================================

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

/** The window's first size: a 16:9 picture, a little larger than the tile. */
const WIDTH = 480;
const HEIGHT = 270;

/** True where the browser can open a native picture-in-picture window. */
export function nativeWindowSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

/**
 * Open the window. Must be called in the click that asks for it: the API
 * refuses without a user gesture.
 */
export function requestNativeWindow(): Promise<Window> {
  const api = window.documentPictureInPicture;
  if (!api) return Promise.reject(new Error("Document Picture-in-Picture is unavailable"));
  return api.requestWindow({ width: WIDTH, height: HEIGHT });
}

/**
 * Give the window this page's look: its stylesheets, and the root's classes
 * and attributes (the theme is a class on <html>). The root is mirrored for
 * as long as the window is open, so a theme change follows it there. Returns
 * the teardown.
 *
 * Stylesheet links are re-made from their resolved `href`: the window's
 * document has no URL of its own to resolve a relative one against.
 */
export function adoptPageLook(win: Window): () => void {
  const doc = win.document;
  for (const node of Array.from(
    document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], style',
    ),
  )) {
    if (node instanceof HTMLLinkElement) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = node.href;
      doc.head.appendChild(link);
    } else {
      doc.head.appendChild(node.cloneNode(true));
    }
  }

  const mirror = () => {
    const from = document.documentElement;
    const to = doc.documentElement;
    for (const attr of Array.from(to.attributes)) to.removeAttribute(attr.name);
    for (const attr of Array.from(from.attributes)) to.setAttribute(attr.name, attr.value);
    doc.body.className = document.body.className;
  };
  mirror();
  doc.title = document.title;
  // The window is a picture: no margin, no scroll, black behind the video.
  doc.body.style.margin = "0";
  doc.body.style.overflow = "hidden";
  doc.body.style.background = "#000";

  const observer = new MutationObserver(mirror);
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}

type YTWindow = Window & { YT?: typeof YT; onYouTubeIframeAPIReady?: () => void };

/**
 * Load the YouTube IFrame API inside the window, once, and resolve with that
 * window's `YT` (see the note at the top on why not this tab's).
 */
export function loadYouTubeAPIIn(win: Window): Promise<typeof YT> {
  const w = win as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  return new Promise((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (w.YT) resolve(w.YT);
    };
    if (win.document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) return;
    const script = win.document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load the YouTube IFrame API"));
    win.document.head.appendChild(script);
  });
}
