---
skills: [react-conventions]
---

# React Conventions

The React rules this codebase holds itself to, beyond React's own: which
lint rules are on and their sanctioned escapes, how a browser-only value is
read without a hydration mismatch, where a persisted preference lives, how
server state is cached, and the order of the providers.

## What it looks like done well

- `pnpm lint` reports nothing new in the files you touched.
- The server HTML and the first client render agree: anything only the
  browser knows (localStorage, `matchMedia`, the platform, the time) shows
  up after hydration, never in it.
- A visitor's preference is one `makeStore` line, read with its `use` hook,
  with no effect and no provider.
- A provider that reads another sits inside it in `shared/providers.tsx`.

## The React Compiler is not on; its lint rules are

There is no `reactCompiler` in `next.config.ts` and no
`babel-plugin-react-compiler` installed (it appears in `pnpm-lock.yaml` only
as Next's optional peer). Components are not auto-memoised, so `useMemo` /
`useCallback` still matter where identity is observed:

- a context value (the providers wrap theirs in `useMemo`; the ambient
  provider splits into five contexts, location / weather / time / solar
  theme / wallpaper, so a consumer re-renders only for what it reads);
- a prop a library compares by identity (`detents` in
  `systems/windows/components/window-sheet.tsx`: Base UI re-reads the list by
  identity, and a fresh array mid-drag made it recompute).

What is on: `eslint-config-next` 16 loads `eslint-plugin-react-hooks` 7,
whose recommended preset includes the compiler's diagnostics. All errors
except `exhaustive-deps`, `incompatible-library` and `unsupported-syntax`
(warnings). Check the live list with
`npx eslint --print-config shared/providers.tsx`.

| Rule | Refuses | Sanctioned escape |
|------|---------|-------------------|
| `set-state-in-effect` | a synchronous `setState` in an effect body | one of the shapes in [Browser-only values](#browser-only-values); or state adjusted during render (below) |
| `refs` | reading or writing `ref.current` during render, including through an object a hook returns that holds refs | assign in an effect with no deps (`useEffect(() => { ref.current = value; })`), or `useEffectEvent` |
| `purity` | `Date.now()`, `Math.random()` and the like during render | read them in an effect or an event handler |
| `set-state-in-render` | an unconditional `setState` in render | guard it: `if (prev !== prop) { setPrev(prop); … }` |

How they report, which matters when reading or silencing them:

- `set-state-in-effect` reports once per effect, at the first synchronous
  `setState`. The disable goes on the line before that call and covers the
  rest of the effect (`services/glass.tsx` sets two states under one).
- The compiler rules stop at the first error in a component. Fixing one can
  surface the next.
- A disable names the rule it silences. `// eslint-disable-line
  react-hooks/exhaustive-deps` on an effect's deps does not silence
  `set-state-in-effect` inside it (`components/home/prompt-widget.tsx`).
- No `setTimeout(…, 0)` to step around the rule. It moves the update a
  task later and adds a timing edge.

CI does not run lint (`.github/workflows/ci.yml`), so main can carry
errors; compare against main before assuming you caused one.

### Adjusting state during render

When state follows a prop (a sheet closing closes its menu; a step change
starts the old step leaving), set it during the render that brings the
change, not in an effect a paint later. React's documented pattern, used in
`systems/windows/components/window-sheet.tsx`,
`systems/surface/morph.tsx` and `systems/dock/components/dock-notice.tsx`:

```tsx
const [wasOpen, setWasOpen] = useState(open);
if (wasOpen !== open) {
  setWasOpen(open);
  if (!open) setMenuOpen(false);
}
```

## Browser-only values

Pages are statically prerendered, so the server renders without
`window`. A value only the browser knows must not change the first client
render, or hydration mismatches. Three shapes, in order of preference:

1. **`useSyncExternalStore`**, with the server snapshot as the fallback.
   React renders the fallback while hydrating and the real value straight
   after, with no effect. `makeStore` (below) is this for a persisted
   string; `useMounted()` (`components/ui/use-mounted.ts`) is this for "has
   hydrated", in place of a `mounted` state set in an effect.
2. **Default state, then an effect** that reads the browser and sets it,
   with the sanctioned comment naming why:

   ```tsx
   useEffect(() => {
     // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
     setMaterialState(readStored());
   }, []);
   ```

   The reasons in use: `hydration-safe: localStorage read`,
   `hydration-safe: platform read`, `browser-only WebGL probe after mount`,
   `sync: clear a stale readout`. Write the reason; a bare disable says
   nothing to the next reader.
3. **Never a lazy `useState` initializer** that reads `localStorage` or
   `window`. It runs on the client during hydration and returns something
   the server did not, and lint does not catch it.

`useSearchParams()` on a statically rendered route needs a `<Suspense>`
above it (the build fails without one), and everything under that boundary
renders on the client. Each view that reads it is wrapped at its route,
with nothing else inside: `app/works/layout.tsx`, `app/prompt/page.tsx`,
`app/writing/page.tsx`.

## Persisted preferences: `makeStore`

`makeStore` in `components/post/persisted-setting.ts` is a localStorage
value, a change event and a `useSyncExternalStore` hook:

```ts
const store = makeStore<RulerSide>(
  "hux_ruler_side",   // localStorage key
  "hux:ruler-side",   // window event that set() dispatches
  "right",            // server snapshot, and the value when storage fails
  (raw) => (raw === "left" ? "left" : "right") // parse: any string or null to a valid T
);
export const useRulerSide = store.use; // also store.get, store.set
```

- **Values are strings** (`T extends string`). `get` runs on every render
  and change; a string compares equal to itself, an object parsed fresh does
  not, and `useSyncExternalStore` would loop.
- **`parse` is the validator.** It maps `null` and any stale or foreign
  value to a valid one.
- It also listens to `storage`, so another tab's change arrives.
- No provider: import the store where it is used. Several stores can share
  one event (`hux-ask-prefs` in `systems/ask/lib/prefs.ts`).

In use: reading settings (`components/post/reading-settings.ts`), ruler side
(`ruler-settings.ts`), the works shelf (`components/log/project-shelf.tsx`),
Ask's model and effort (`systems/ask/lib/prefs.ts`), voice model and visual
(`systems/voice/prefs.ts`). A setting with structure is not a `makeStore`:
the ambient settings are one JSON object, `hux_ambient_settings`
(`systems/ambient/lib/settings.ts`), read by their provider.

## Server state: TanStack Query

Only the ambient system's location and weather use it
(`systems/ambient/lib/queries.ts`: `useLocationQuery`, `useWeatherQuery`).
The client and persister are in `lib/query.ts`:

- defaults: `staleTime` 5 min, `gcTime` 24 h, `retry: 1`,
  `refetchOnWindowFocus: false` (the two ambient queries turn focus and
  reconnect refetching back on);
- the whole cache is persisted to localStorage under `hux_query_cache`
  (`PersistQueryClientProvider` in `shared/providers.tsx`), so a returning
  visitor sees the last weather before any request;
- keys come from `queryKeys`. **When a persisted payload changes shape,
  bump the version segment** in its key (`["weather", "v4", lat, lon]`), or
  an old entry is served from storage as if it were complete;
- both queries keep the previous answer while a new key loads
  (`placeholderData: (previousData) => previousData`).

Freshness, polling and permissions are in
[Ambient System, Freshness](./system-ambient.md#freshness).

## The provider tree

`shared/providers.tsx` is the whole tree; `app/layout.tsx` mounts it around
the page and every app-level surface (Dock, sheets, `CommandPalette`, …).

![The nesting in shared/providers.tsx, outermost first, with what each provider owns and which outer provider it reads.](/img/docs/react-engineering/providers.svg)

The boxes nest as the JSX does, outermost first. The blue `↑` lines are why
the order is what it is: each is a hook that provider calls on one above
it. `GlowPaletteBridge` is not a wrapper but a child of `AmbientProvider`
that renders nothing.

- **A provider that reads another sits inside it.** Moving one up past what
  it reads throws (`use… must be used within …`), or, through a
  `useOptional…` hook, silently gets `undefined`.
- **When a provider needs another's value as a prop**, a small wrapper in
  `shared/providers.tsx` reads it and passes it down: `AmbientWrapper`
  (`useTheme()` to `AmbientProvider theme`) and `DevtoolWrapper`
  (`useCommand()` to `DevtoolProvider isCommandOpen closeCommand`).
- **A provider whose state only one subtree needs is mounted there.**
  `DockProvider` is mounted by `<Dock>` (`systems/dock/components/dock.tsx`),
  not here.
- Simple global state with no UI goes in `services/` (exported from
  `services/index.ts`); a feature with UI, state and logic is a folder in
  `systems/`. See [Architecture](./architecture.md).
