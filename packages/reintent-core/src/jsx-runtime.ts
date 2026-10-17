// =============================================================================
// The JSX runtime for programs (`/** @jsxImportSource reintent-core */`).
// No React: an element is its component called with its props, so a program
// in TSX evaluates straight to the data it declares (program.ts).
// =============================================================================

import type { Decl } from "./program";

type Component = (props: never) => Decl;

export function jsx(type: Component, props: Record<string, unknown>, key?: string): Decl {
  void key;
  return (type as (p: Record<string, unknown>) => Decl)(props);
}

export const jsxs = jsx;

export function Fragment({ children }: { children?: Decl }): Decl {
  return children ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-namespace -- the JSX namespace TypeScript looks up for this runtime
export namespace JSX {
  export type Element = Decl;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  // No intrinsic elements: a program is made only of components.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface IntrinsicElements {}
}
