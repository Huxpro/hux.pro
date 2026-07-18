/**
 * Ambient shims for @lynx-js/go-web under React 19 + Next.
 * go-web ships TS source assuming Vite + React 18 global JSX.
 */
import type * as React from "react";

declare global {
  interface ImportMetaEnv {
    readonly SSG_MD?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // go-web still references global JSX.Element (React 18 style).
  namespace JSX {
    type Element = React.ReactElement;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "lynx-view": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "lynx-group-id"?: number;
          "transform-vh"?: boolean;
          "transform-vw"?: boolean;
          url?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
