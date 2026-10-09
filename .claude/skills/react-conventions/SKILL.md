---
name: react-conventions
description: The React rules hux.pro holds itself to - the react-hooks lint rules and their sanctioned escapes, hydration-safe reads of localStorage / window, makeStore for a persisted preference, the query cache, provider order. Use when writing or reviewing a component, hook or provider, adding a saved setting, silencing a react-hooks lint error, or debugging a hydration mismatch.
---

# React conventions

- **No React Compiler** (nothing in `next.config.ts`), but its lint rules are
  on as errors (`eslint-plugin-react-hooks` 7 via `eslint-config-next`). Memoise
  context values and props a library compares by identity yourself.
- **`set-state-in-effect`**: reports the first sync `setState` per effect. The
  escape is `// eslint-disable-next-line react-hooks/set-state-in-effect -- <why>`
  on the line before it, with a reason (`hydration-safe: localStorage read`).
  A disable for `exhaustive-deps` does not cover it. No `setTimeout(…, 0)`.
- **State that follows a prop**: adjust it during render behind an
  `if (prev !== prop)` guard, not in an effect.
- **`refs`**: no `ref.current` in render, even through an object a hook
  returns. Latest-value refs are assigned in an effect, or use `useEffectEvent`.
- **Browser-only values** (localStorage, `matchMedia`, platform, time): never
  in a lazy `useState` initializer (hydration mismatch, and lint misses it).
  Use `useSyncExternalStore` (`makeStore`, `useMounted()`), else default state
  plus the sanctioned effect.
- **A saved preference** is `makeStore(key, event, fallback, parse)` from
  `components/post/persisted-setting.ts`: string values only, `parse` maps
  null / junk to a valid value, no provider.
- **Query cache** persists to `hux_query_cache`: change a query's payload shape,
  bump the version segment in its `queryKeys` entry (`lib/query.ts`).
- **Providers**: one that reads another sits inside it in `shared/providers.tsx`.
- Check with `pnpm lint`; CI does not run it, so compare against main.
  More: `docs/react-engineering.md`.
