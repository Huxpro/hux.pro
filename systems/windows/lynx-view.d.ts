import type { LynxViewElement } from "@lynx-js/web-core/client";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

// =============================================================================
// <lynx-view> JSX typing
//
// `@lynx-js/web-core` registers the `<lynx-view>` custom element at runtime but
// ships no JSX augmentation. React 19 keeps JSX types under the `react`
// module's `JSX` namespace, so we teach TSX about the element (and the handful
// of attributes we set) here.
// =============================================================================

type LynxViewProps = HTMLAttributes<LynxViewElement> & {
  url?: string;
  height?: "auto" | string;
  width?: "auto" | string;
  "global-props"?: string;
  "init-data"?: string;
  /** Share one background Worker across cards; unique per player here. */
  "lynx-group-id"?: string | number;
  /** Map Lynx vh/vw units onto our container-query units. */
  "transform-vh"?: boolean | string;
  "transform-vw"?: boolean | string;
  /**
   * Overrides `SystemInfo` (pixelWidth / pixelHeight / pixelRatio). We pass
   * the window's CSS box so cards that size to the screen (逗猫棒) layout
   * inside the player instead of `window.screen`.
   */
  "browser-config"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "lynx-view": DetailedHTMLProps<LynxViewProps, LynxViewElement>;
    }
  }
}
