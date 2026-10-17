/**
 * The automatic JSX runtime (`/** @jsxImportSource reintent-core *\/`): the same elements `h`
 * makes, for a toolchain that compiles JSX to `jsx(type, props, key)` (Vite, Next). The JSX
 * namespace lives here, scoped to the files that ask for this runtime, so it never meets React's.
 */
import { Fragment, type Component, type Element } from './jsx';

export { Fragment };

export function jsx(type: Element['type'], props: Record<string, unknown>, key?: string | number): Element {
  return { $$element: true, type, props: props ?? {}, key: key == null ? undefined : String(key) };
}
export const jsxs = jsx;

// eslint-disable-next-line @typescript-eslint/no-namespace -- the namespace TypeScript looks up for this runtime
export namespace JSX {
  export type Element = import('./jsx').Element;
  export type ElementType = Component | typeof Fragment;
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface ElementChildrenAttribute {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    children: {};
  }
  // No intrinsic elements: every element is a component, the host's included.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface IntrinsicElements {}
}
