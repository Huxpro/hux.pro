# React Engineering Practices

This doc captures the engineering conventions used in this codebase for writing React UI safely and consistently.

## React Compiler

This project uses the **React Compiler**, so most manual memoization is unnecessary:

- Prefer **plain values** over `useMemo` for simple derived computations.
- Prefer **plain functions** over `useCallback` unless you have a concrete perf/identity reason.
- Use `React.memo` only with measurements and a clear reason.

The goal is to keep components readable and let the compiler optimize the common cases.

## Effects

General rule: use effects only to **synchronize React with an external system** (DOM APIs, browser APIs, subscriptions).

- Good uses:
  - attaching/removing event listeners
  - calling browser APIs like geolocation
  - imperative focus
- Avoid effects for simple derived state.

### About `react-hooks/set-state-in-effect`

This repo enables a lint rule that warns about calling `setState()` directly inside effects.

In a few places we still do that intentionally (e.g. hydration-safe “mounted” flags, or syncing to browser-only values).
When needed:

- Prefer a **state initializer** (`useState(() => initialValue)`) if possible.
- Otherwise, keep the effect minimal and add a **single-line eslint disable** with a short comment.
- Do **not** introduce `setTimeout(..., 0)` just to bypass the rule (it adds noise and can create timing edge cases).

## Client-only APIs and static prerendering

Avoid hooks/APIs that force a client-only bailout on statically-rendered pages unless you also add proper Suspense boundaries.

Example:
- `useSearchParams()` can require a Suspense boundary in Next.js and can break static prerendering for `/`.
- Prefer reading `window.location.search` inside an effect for dev-only debug flags.

## Ambient systems

Ambient systems should be:

- **Modular**: data fetching, storage, and rendering split into independent modules.
- **Composable**: route-level surfaces can opt into features like gradient backgrounds.
- **Permission-aware**: request browser permissions only in explicit user actions.
