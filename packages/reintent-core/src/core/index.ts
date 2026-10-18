/**
 * Values, not signals: the core's execution model (React's semantics, without React's runtime).
 *
 *   - A render is a function: (element, source, contexts, overrides) → (host tree, trace). The
 *     same inputs give the same outputs, and nothing in a render writes anything.
 *   - A component is a function of its props. It keeps no state of its own: every intent's value
 *     comes from the source, read by path. Its hooks are reads known by name, not by call order,
 *     so any control flow is allowed (a guard is a branch).
 *   - useChoice returns a value (T | Unresolved<T> | Unknown), not a getter or a signal: read twice
 *     in one render, it is the same value. To see a new value, render again.
 *   - Change propagates by rendering again. `watch` re-runs a render when a write touches something
 *     it read, and skips the rest; no dependency graph outlives a render but its trace.
 *   - Many worlds at once: renders over other contexts or other overrides (whatIf) are just more
 *     calls, and never disturb one another.
 *   - A host consumes values: the host tree and the trace are plain data. A view (React, a layout
 *     solver) reads them; it never subscribes to an intent.
 *
 * Reintent core. Host-neutral: nothing here knows about slides, screens or layouts, and nothing
 * here is a visual primitive. What it owns:
 *   - elements and their expansion (h, Fragment, host, scope)
 *   - contexts in scope, with numeric axes a decision can be piecewise on
 *   - one intent's value from its writers: a person (about this intent > about every intent of
 *     its name in the deck) > a sure model > code, partial values
 *     falling through, Unresolved and Unknown as values
 *   - the trace of a render, rendering as if decided (whatIf), re-running on what was read (watch)
 *   - results stamped with the values they were made under (cache)
 */
export {
  h,
  host,
  Fragment,
  scope,
  childrenOf,
  isHostNode,
  type Child,
  type Component,
  type Element,
  type HostNode,
  type Rendered,
} from './jsx';
export { createContext, type Context } from './context';
export {
  TAU,
  UNKNOWN,
  isUnresolved,
  isPiecewise,
  isNot,
  isGiven,
  margin,
  argmax,
  type Dist,
  type Given,
  type Belief,
  type Piecewise,
  type Segment,
  type Not,
  type Said,
  type Writer,
  type Scope,
  type By,
  type Unresolved,
  type Unknown,
} from './value';
export { createSource, type Source, type WritableSource, type Entry, type Change } from './source';
export {
  render,
  whatIf,
  watch,
  useChoice,
  useCtx,
  useKey,
  usePath,
  type Read,
  type Trace,
  type Result,
  type RenderOptions,
  type ChoiceOptions,
} from './render';
export { createCache, under, stale, type Stamped } from './cache';

/** For exhaustive switches: a case left unhandled is a type error. */
export function absurd(x: never): never {
  throw new Error(`unhandled: ${JSON.stringify(x)}`);
}
