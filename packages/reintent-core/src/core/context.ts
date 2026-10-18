/* eslint-disable @typescript-eslint/no-explicit-any -- ported as written (Huxpro/airtalk#845) */
/**
 * Evaluation context: what an intent is read in (a screen, a display mode, a deadline). The core
 * knows a context only as a value in scope and as named numeric axes over it, which a decision
 * can be piecewise on; what a context holds is the host's.
 */
import type { Child, Component } from './jsx';

export type Context<C> = {
  readonly name: string;
  /** Numeric readings of the value, by name: what a piecewise decision is piecewise on. */
  readonly axes: Record<string, (value: C) => number>;
  /** Names a value in traces and caches. */
  readonly key: (value: C) => string;
  readonly Provider: Component<{ value: C; children?: Child }>;
};

export function createContext<C>(
  name: string,
  opts: { axes?: Record<string, (value: C) => number>; key?: (value: C) => string } = {},
): Context<C> {
  const ctx = {
    name,
    axes: opts.axes ?? {},
    key: opts.key ?? ((v: C) => (v as any)?.id ?? JSON.stringify(v)),
  } as Context<C>;
  const Provider: Component = () => null;
  Object.defineProperty(Provider, '$$context', { value: ctx });
  (ctx as any).Provider = Provider;
  return ctx;
}

export const contextOfProvider = (t: unknown): Context<unknown> | undefined => (t as any)?.$$context;
