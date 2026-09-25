// =============================================================================
// Where "Add to Home Screen" lives, per browser.
//
// There is no one API for it. Installing a site is a browser feature, and each
// browser puts the door somewhere else:
//
//   · Chromium (Chrome, Edge, Samsung Internet, Opera — Android and desktop)
//     fires `beforeinstallprompt` once the site qualifies (a manifest, icons,
//     HTTPS). Held on to, it can open the browser's own install dialog from a
//     button of ours — but only from a press, and only once per event.
//   · WebKit (every browser on an iPhone or iPad, and Safari on a Mac) has no
//     such event and never will. The only door is the browser's own menu, so
//     the most a page can do is say where the door is.
//   · Firefox on the desktop has no door at all (bar a Windows-only taskbar
//     pin), and an app's built-in browser — WeChat's, Instagram's — has none
//     either, only a way out to a browser that does.
//
// So the command cannot install anything by itself. What it can do is the
// same thing the tilt primer does for motion: put up a sheet first, showing
// what is about to happen and which buttons to press. Where the browser does
// give us a button, the sheet's own button is it; everywhere else the sheet
// is the directions.
//
// Detection is by user agent, and deliberately coarse: its only job is to
// pick which set of directions to show, and a wrong guess shows the wrong
// menu, not a broken page.
// =============================================================================

/**
 * Which set of directions the sheet shows. One per place the door actually
 * is, not one per browser — Chrome, Edge and Firefox on an iPhone differ only
 * in where their Share button sits, and that is a step, not a guide.
 *
 *   installed          already running from the home screen / dock.
 *   ios-safari         iPhone Safari 26+: Share moved behind the ⋯ button.
 *   ios-safari-legacy  iPhone Safari up to 18: Share in the bottom toolbar.
 *   ipados-safari      iPad Safari: Share in the top toolbar.
 *   ios-chrome         Chrome on iOS: Share in the address bar.
 *   ios-other          Edge, Firefox, … on iOS: Share inside their menu.
 *   in-app             an app's built-in browser (WeChat, …), on either
 *                      phone: it has no install at all, but it has "Open in
 *                      browser", and the browser does.
 *   android-chrome     Chrome (and Chromium browsers) on Android, ⋮ menu —
 *                      shown when the browser has not handed us its dialog.
 *   android-samsung    Samsung Internet, ≡ menu.
 *   android-firefox    Firefox on Android, ⋮ menu.
 *   desktop-chrome     Chrome (Opera, Brave, …) on a desktop.
 *   desktop-edge       Edge on a desktop.
 *   mac-safari         Safari 17+ on a Mac: File › Add to Dock.
 *   unsupported        a desktop browser that cannot install a site.
 */
export type InstallGuide =
  | "installed"
  | "ios-safari"
  | "ios-safari-legacy"
  | "ipados-safari"
  | "ios-chrome"
  | "ios-other"
  | "in-app"
  | "android-chrome"
  | "android-samsung"
  | "android-firefox"
  | "desktop-chrome"
  | "desktop-edge"
  | "mac-safari"
  | "unsupported";

/**
 * What installing is called where the visitor is, which is also what the
 * command says: a phone has a home screen, a Mac has a Dock, and everything
 * else "installs an app".
 */
export type InstallTarget = "home-screen" | "dock" | "app";

export function installTarget(guide: InstallGuide): InstallTarget {
  if (guide === "mac-safari") return "dock";
  if (guide === "desktop-chrome" || guide === "desktop-edge" || guide === "unsupported") {
    return "app";
  }
  return "home-screen";
}

/**
 * Is this page already running as an installed app? `display-mode` covers
 * every browser that launches a manifest app; `navigator.standalone` is the
 * older iOS flag for a home-screen web clip, and still the one iOS sets.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches
    )
  );
}

/** Pure, for the user agent alone — `detectInstallGuide` adds the page's own state. */
export function guideForUserAgent(
  ua: string,
  { touchMac = false }: { touchMac?: boolean } = {}
): InstallGuide {
  const iPad = /iPad/i.test(ua) || (touchMac && /Macintosh/.test(ua));
  const iPhone = /iP(hone|od)/i.test(ua);
  const android = /Android/i.test(ua);

  // An app's own web view. WeChat, QQ, Weibo, and the Facebook / Instagram /
  // LINE family announce themselves; on iOS any web view that is not a
  // browser also drops the "Safari/" token every real iOS browser keeps.
  const inApp =
    /MicroMessenger|QQ\/|Weibo|FBAN|FBAV|Instagram|Line\//i.test(ua) ||
    ((iPhone || iPad) && !/Safari\//.test(ua));
  if ((iPhone || iPad || android) && inApp) return "in-app";

  if (iPhone || iPad) {
    if (/CriOS/.test(ua)) return "ios-chrome";
    if (/EdgiOS|FxiOS|OPiOS|DuckDuckGo|YaBrowser/.test(ua)) return "ios-other";
    if (iPad) return "ipados-safari";
    // Safari 26 froze the OS in its UA at 18_6, but not its own version.
    const version = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    return version >= 26 ? "ios-safari" : "ios-safari-legacy";
  }

  if (android) {
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/Firefox\//.test(ua)) return "android-firefox";
    return "android-chrome";
  }

  // Order matters: Edge's UA also says "Chrome", and Chrome's says "Safari".
  if (/Edg\//.test(ua)) return "desktop-edge";
  if (/Chrome\/|Chromium\//.test(ua)) return "desktop-chrome";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Firefox\//.test(ua)) {
    // Add to Dock arrived in Safari 17 (macOS Sonoma). Before it, nothing.
    const version = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    return version >= 17 ? "mac-safari" : "unsupported";
  }
  return "unsupported";
}

export function detectInstallGuide(): InstallGuide {
  if (typeof window === "undefined") return "desktop-chrome";
  if (isStandalone()) return "installed";
  return guideForUserAgent(navigator.userAgent, {
    // An iPad asks for the desktop site by default and says it is a Mac; the
    // touch points give it away.
    touchMac: navigator.maxTouchPoints > 1,
  });
}

// -----------------------------------------------------------------------------
// beforeinstallprompt
// -----------------------------------------------------------------------------

/** Chromium's install event. Not in lib.dom, because it is not a standard. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * The event arrives once, early — often before React has hydrated, so a
 * listener added in an effect can miss it. It is caught here instead, when
 * this module is first evaluated on the client, and handed to whoever
 * subscribes later.
 */
let deferred: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the browser's own mini-infobar from showing on its own schedule:
    // the offer is made from the command, when somebody asked for it.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedThisSession = true;
    notify();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function wasInstalledThisSession(): boolean {
  return installedThisSession;
}

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Open the browser's own install dialog. Must be called straight from a
 * press. The event is single-use, so it is spent here whatever the answer;
 * Chromium sends a fresh one later if the site is still installable.
 *
 * "unavailable" means there was no event to spend — the browser never offered
 * one, or it has already been used.
 */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  }
}
