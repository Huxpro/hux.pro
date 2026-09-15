"use client";

// The two side-effect imports that (a) register the <lynx-view> custom element
// and its background-thread runtime and (b) bring in element styles. Both spin
// up Web Workers at import time, so this module must only ever load in the
// browser — it's reached exclusively through the `ssr: false` dynamic import in
// lynx-frame.tsx.
import "@lynx-js/web-elements/index.css";
import "@lynx-js/web-core/client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LynxViewElement } from "@lynx-js/web-core/client";
import { LYNX_SHADOW_CSS } from "../lib/lynx-shadow-css";

// Monotonic per-instance group id so concurrent Lynx windows never share (and
// collide on) a background Worker.
let GROUP_COUNTER = 41;

// =============================================================================
// LynxPlayer — a Lynx Player: renders a `.web.bundle` via <lynx-view>
//
// This is the Lynx-runtime analogue of the web iframe. `@lynx-js/web-core`
// runs the bundle's script on a background Web Worker and paints its element
// tree into the <lynx-view> host on the main thread — the same dual-thread
// model Lynx uses on-device, faithfully reproduced in the browser.
//
// Shadow-CSS fix: web-core injects the web-elements layout CSS by Blob-ing a
// `?inline` CSS import into a <link> inside each shadow root. Under Turbopack
// that import resolves to `undefined`, so the shadow root gets no layout CSS
// and flex defaults (e.g. `flex-direction: column`) silently break. We inject
// the real, flattened CSS (`LYNX_SHADOW_CSS`, from `pnpm lynx:shadow-css`)
// ourselves — see scripts/lynx-shadow-css-bundle.mjs for the full write-up.
// =============================================================================

/**
 * Put the flattened web-elements layout CSS into the element's shadow root.
 * Inserted as the shadow's *first* child so a card's own styles (and web-core's
 * `injectStyleRules`) still win over these defaults. Idempotent.
 */
function injectShadowCss(el: LynxViewElement): boolean {
  const root = el.shadowRoot;
  if (!root) return false;
  if (root.querySelector("style[data-lynx-shadow]")) return true;
  const style = document.createElement("style");
  style.setAttribute("data-lynx-shadow", "");
  style.textContent = LYNX_SHADOW_CSS;
  root.insertBefore(style, root.firstChild);
  return true;
}

export default function LynxPlayer({ url }: { url: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ref = useRef<LynxViewElement | null>(null);
  const groupRef = useRef(0);
  if (!groupRef.current) groupRef.current = (GROUP_COUNTER += 1);
  const [error, setError] = useState<string | null>(null);
  // Delay mounting <lynx-view> until the window has a real box. SystemInfo
  // defaults to window.screen, which parks screen-sized cards (逗猫棒) off
  // the portrait window; browser-config overrides it to this container.
  const [browserConfig, setBrowserConfig] = useState<string | null>(null);

  // Serve local built-in bundles from our origin; remote (online) URLs pass
  // through untouched. Same-origin keeps the Worker fetch off the CORS path.
  const src = url.startsWith("/") ? window.location.origin + url : url;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = window.devicePixelRatio || 1;
      const next = JSON.stringify({
        pixelRatio: dpr,
        pixelWidth: Math.round(w * dpr),
        pixelHeight: Math.round(h * dpr),
      });
      // SystemInfo is snapshotted when the bundle evaluates — only the first
      // box matters. Later resizes would rewrite the attribute without
      // reloading the card.
      setBrowserConfig((prev) => prev ?? next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Inject the shadow CSS as soon as the shadow root exists. The custom element
  // upgrades synchronously on connect, but the root can lag a frame, so poll a
  // few animation frames before giving up.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (injectShadowCss(el)) return;
    let raf = 0;
    let tries = 0;
    const tick = () => {
      if (injectShadowCss(el) || tries++ > 120) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [browserConfig, src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onError = (e: Event) => {
      // The element fires a CustomEvent on load/runtime failure.
      const detail = (e as CustomEvent).detail;
      setError(
        typeof detail === "string"
          ? detail
          : (detail?.message ?? "The Lynx bundle failed to load."),
      );
    };
    el.addEventListener("error", onError);
    return () => el.removeEventListener("error", onError);
  }, [browserConfig, src]);

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-foreground/80">
          Couldn&apos;t start the Lynx app
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="h-full w-full">
      {browserConfig ? (
        <lynx-view
          ref={ref}
          key={src}
          url={src}
          lynx-group-id={groupRef.current}
          browser-config={browserConfig}
          transform-vh
          transform-vw
          // Fill the window body and make Lynx's rpx / vh / vw units resolve against
          // this container (not the page), so a real Lynx card scales to the window
          // instead of the viewport — matching go-web's responsive mode.
          style={
            {
              display: "block",
              height: "100%",
              width: "100%",
              containerType: "size",
              "--rpx-unit": "calc(100cqw / 750)",
              "--vh-unit": "1cqh",
              "--vw-unit": "1cqw",
            } as CSSProperties
          }
        />
      ) : null}
    </div>
  );
}
