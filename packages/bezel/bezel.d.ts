// =============================================================================
// @hux/bezel — public API.
//
// This file is the contract. The implementation in ./src must match it exactly:
// ./src/contract.ts fails to type-check if an export is missing, extra, or has
// a different shape. Read this file to use the package; read ./src to change it.
//
// Three words, each meaning one thing:
//
//   bezel   the border drawn around the page: a band on each edge and rounded
//           inner corners, in one colour. Nothing else is called a frame or a
//           letterbox.
//   chrome  the BROWSER's own UI only — Safari's status bar and toolbar. The
//           package keeps it in the bezel's colour, or the page's ground when
//           the bezel is off.
//   scroll  where the page scrolls: the window, or a container inside a
//           document that never scrolls (ryOS's rule).
// =============================================================================

import type { CSSProperties, JSX, ReactNode } from "react";

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

/**
 * Where the page scrolls.
 *
 *   window     the document scrolls, as on any page.
 *   container  <html> and <body> are fixed and never scroll; the page scrolls
 *              inside the bezel's scroll container. On iOS Safari this keeps the
 *              toolbar from collapsing, so the chrome and the viewport hold
 *              still. Every full-screen `position: fixed` child of <body>, and
 *              every element marked with `BEZEL_LAYER_ATTRIBUTE`, becomes
 *              absolute, because Safari tints its chrome from fixed content at
 *              the viewport edge.
 */
export type BezelScroll = "window" | "container";

/** Everything the bezel is showing, resolved. What `useBezel()` returns. */
export interface BezelState {
  /** Whether the bezel is drawn. */
  enabled: boolean;
  /** The bezel colour. Any CSS colour. */
  color: string;
  /** Band thickness on the top and bottom edges, px. */
  band: number;
  /** Inner corner radius, px. */
  radius: number;
  /** Where the page scrolls. */
  scroll: BezelScroll;
  /** The colour the chrome takes while the bezel is off: the page's ground. */
  ground: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export interface BezelProps {
  /**
   * Whether the bezel is drawn. Live.
   *
   * `null` means "not known yet" — typically before the host has read its
   * settings on the client. The bezel then holds whatever the boot script
   * applied, so a page that loaded with a bezel keeps it until the host
   * decides. Without a boot script, `null` draws nothing.
   */
  enabled: boolean | null;
  /** The bezel colour. Any CSS colour. Live. */
  color: string;
  /** Band thickness on the top and bottom edges, px. Default `DEFAULT_BEZEL_BAND`. Live. */
  band?: number;
  /** Inner corner radius, px. Default `DEFAULT_BEZEL_RADIUS`. Live. */
  radius?: number;
  /** Where the page scrolls. Default `"window"`. Live. */
  scroll?: BezelScroll;
  /** The chrome colour while the bezel is off — the page's ground. Live. */
  ground: string;
  /**
   * Whether a chrome colour change is morphed onto the screen for a chrome
   * that samples the page. Default `true`. Set it `false` where the platform
   * does not need it — a chrome that follows `theme-color`, or none at all —
   * and the colour is set without the morph. It is 880ms of bands at the
   * viewport edges, and on a window nobody is sampling they are just bands.
   */
  chromeMorph?: boolean;
  /**
   * Layers painted behind the page and inside the bezel: a background, a
   * wallpaper. Give them `style={BEZEL_INSET}` and `BEZEL_LAYER_ATTRIBUTE`.
   */
  backdrop?: ReactNode;
  /** Class for the scroll container, which wraps `children`. */
  className?: string;
  /** Style for the scroll container, merged over its inset. */
  style?: CSSProperties;
  /** The page. */
  children?: ReactNode;
}

/**
 * The bezel, the chrome colour and the page's scroll container, in one.
 *
 * Render it once, around the page. It draws the bands and corners above
 * everything, writes the root attributes the stylesheet needs, keeps the
 * chrome in step whenever the colour it should show changes, and restores its
 * root attributes if something strips them (React 19 does, after a failed
 * hydration). It provides `useBezel()`.
 */
export declare function Bezel(props: BezelProps): JSX.Element;

/** The bezel's resolved state. Outside `<Bezel>`, a disabled default. */
export declare function useBezel(): BezelState;

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------

/** What a boot resolver returns: the first frame, before React runs. */
export interface BezelBootState {
  enabled: boolean;
  color: string;
  band: number;
  scroll: BezelScroll;
  ground: string;
}

/**
 * An inline script for the document <head> that paints the first frame right.
 *
 * `resolver` is the BODY of a function, as source, that returns a
 * `BezelBootState` — read your settings from `localStorage` there. It runs
 * before first paint, so it cannot import anything; interpolate constants into
 * it. The script installs the stylesheet, applies the state to <html>, creates
 * the `theme-color` meta, and records the state for `<Bezel>` and
 * `readBezelBoot()`.
 */
export declare function bezelBootScript(resolver: string): string;

/** The state the boot script applied, or `null` if none ran. */
export declare function readBezelBoot(): BezelBootState | null;

// -----------------------------------------------------------------------------
// Chrome
// -----------------------------------------------------------------------------

/** The bezel `syncChrome` morphs from and back to. */
export interface ChromeSyncOptions {
  /** The band showing now, px. Default 0. */
  band?: number;
  /** The inner corner radius showing now, px. Default 0. */
  radius?: number;
  /**
   * Morph the bezel so a chrome that samples the page can see the colour.
   * Default `true`. `false` sets `theme-color` and stops there, which is all a
   * chrome that follows it — or no chrome at all — ever needed.
   */
  morph?: boolean;
}

/**
 * Make the browser chrome show `color`, now.
 *
 * iOS 26 Safari reads the chrome colour from the root background only at load,
 * and ignores `theme-color`; it does follow `position: fixed` content at the
 * viewport edge, live, from `CHROME_SAMPLE_PX` thick. So the bezel morphs: a
 * fixed bezel in `color` grows from `band` to at least `CHROME_MORPH_PX`, holds
 * while Safari samples it, then eases back to `band` and is removed. A band
 * already that thick does not move. `theme-color` is set too, for iOS 18.
 * `<Bezel>` calls it whenever its chrome colour changes; call it yourself only
 * for a change `<Bezel>` cannot see. Pass `morph: false` where the platform
 * does not need the trick: `theme-color` is still set, and nothing is drawn.
 */
export declare function syncChrome(color: string, options?: ChromeSyncOptions): void;

// -----------------------------------------------------------------------------
// Scroll
// -----------------------------------------------------------------------------

/** Run `listener` on page scroll, wherever it happens, while mounted. */
export declare function usePageScroll(listener: () => void): void;

/** The element the page scrolls in, or `null` when the window scrolls. */
export declare function getScrollContainer(): HTMLElement | null;
/** How far the page is scrolled, px. */
export declare function pageScrollTop(): number;
/** The page's full scrollable height, px. */
export declare function pageScrollHeight(): number;
/** The height of the visible part of the page, px. */
export declare function pageViewportHeight(): number;
/** Where an element sits in the page's scrollable content, from its top, px. */
export declare function pageOffsetOf(element: Element): number;
/** Scroll the page to an absolute position, px. */
export declare function scrollPageTo(top: number): void;
/**
 * Subscribe to page scroll outside React. Survives a switch between scroll
 * modes. Returns the unsubscribe.
 */
export declare function onPageScroll(listener: () => void): () => void;
/** Fire page scroll listeners without scrolling, to force a re-measure. */
export declare function emitPageScroll(): void;
/**
 * Named scroll timeline on the element that actually scrolls the page.
 * `animation-timeline: scroll(root)` is silent in container scroll; bind
 * scroll-driven CSS to this instead (`animation-timeline: --page-scroll`).
 */
export declare const PAGE_SCROLL_TIMELINE: "--page-scroll";

// -----------------------------------------------------------------------------
// Layout
// -----------------------------------------------------------------------------

/**
 * The box inside the bezel, as inline style. Spread it onto layers that must
 * stop where the bezel begins. Reads the live band, so it can never disagree
 * with the bezel.
 */
export declare const BEZEL_INSET: CSSProperties;

/**
 * Mark a full-screen `position: fixed` layer that is not a direct child of
 * <body> with this attribute (any value). In `container` scroll it becomes
 * absolute, so it cannot tint the chrome.
 */
export declare const BEZEL_LAYER_ATTRIBUTE: "data-bezel-layer";

/** Thinnest fixed content, px, that iOS 26 Safari's chrome follows. */
export declare const CHROME_SAMPLE_PX: 6;
/** The band `syncChrome` morphs to: the sample threshold with a margin. */
export declare const CHROME_MORPH_PX: 8;

export declare const DEFAULT_BEZEL_BAND: 0;
export declare const DEFAULT_BEZEL_RADIUS: 16;
export declare const BEZEL_BAND_MIN: 0;
export declare const BEZEL_BAND_MAX: 64;
export declare const BEZEL_RADIUS_MIN: 0;
export declare const BEZEL_RADIUS_MAX: 64;

/** Round and clamp a band to the allowed range. */
export declare function clampBezelBand(px: number): number;
/** Round and clamp a radius to the allowed range. */
export declare function clampBezelRadius(px: number): number;
