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

In a few places we still do that intentionally (e.g. hydration-safe "mounted" flags, or syncing to browser-only values).
When needed:

- Prefer a **state initializer** (`useState(() => initialValue)`) if possible.
- Otherwise, keep the effect minimal and add a **single-line eslint disable** with a short comment.
- Do **not** introduce `setTimeout(..., 0)` just to bypass the rule (it adds noise and can create timing edge cases).

#### Valid Use Cases for setState in Effects

1. **Hydration-safe mounted flags**: When rendering must differ between SSR and client
   ```tsx
   useEffect(() => {
     // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: mounted flag
     setMounted(true);
   }, []);
   ```

2. **Reading from browser-only APIs**: localStorage, window.location, etc.
   ```tsx
   useEffect(() => {
     // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: reading localStorage
     setLocale(getStoredLocale());
   }, []);
   ```

3. **Reading from DOM after render**: When you need DOM measurements or text content
   ```tsx
   useEffect(() => {
     if (headingRef.current) {
       // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM: extracting text content
       setId(generateHeadingId(headingRef.current.textContent));
     }
   }, [children]);
   ```

4. **Keeping stale values during async reloads**: For iOS-widget-like behavior
   ```tsx
   useEffect(() => {
     if (!cityLabel) return;
     // eslint-disable-next-line react-hooks/set-state-in-effect -- UX: keep stale value during reload
     setStaleCity(cityLabel);
   }, [cityLabel]);
   ```

## Client-only APIs and static prerendering

Avoid hooks/APIs that force a client-only bailout on statically-rendered pages unless you also add proper Suspense boundaries.

Example:
- `useSearchParams()` can require a Suspense boundary in Next.js and can break static prerendering for `/`.
- Prefer reading `window.location.search` inside an effect for dev-only debug flags.

## Data Fetching with TanStack Query

This project uses TanStack Query (React Query) for server state management. Key patterns:

### Stale-While-Revalidate

TanStack Query provides stale-while-revalidate automatically via `placeholderData`:

```tsx
// lib/ambient/queries.ts
export function useLocationQuery(mode: LocationMode) {
  return useQuery({
    queryKey: ['location', mode],
    queryFn: () => fetchLocation(mode),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    // Keep previous data visible while fetching new
    placeholderData: (previousData) => previousData,
  });
}
```

Components use `isLoading` vs `isFetching` to distinguish states:

| State | `isLoading` | `isFetching` | What to show |
|-------|-------------|--------------|--------------|
| Initial load | `true` | `true` | Spinner, no data |
| Has cached data | `false` | `false` | Data |
| Background refetch | `false` | `true` | Data + small spinner |

### Query Key Design

Query keys include variables that affect the fetch:

```tsx
// Location query keyed by mode - changing mode triggers refetch
queryKey: ['location', mode]

// Weather query keyed by coordinates (rounded for cache hits)
queryKey: ['weather', lat.toFixed(2), lon.toFixed(2)]
```

### Cache Persistence

The query cache is persisted to localStorage:

```tsx
// lib/query.ts
export const queryPersister = createSyncStoragePersister({
  storage: localStorage,
  key: 'hux_query_cache',
});
```

This means returning visitors see cached data immediately, even before any network request.

See [Ambient System](./system-ambient.md) for the full data flow.

## Provider Architecture

This project uses a **three-tier architecture** for React Context:

- **Systems**: Complex subsystems with UI + State + Logic
- **Services**: Simple state providers with no UI
- **Shared**: Orchestration and reusable components

See [Architecture Overview](./architecture.md) for the complete structure.

### Directory Structure

```
systems/                      # Complex subsystems (UI + State + Logic)
├── ambient/                  # Weather-based ambient UI
├── command/                  # Command palette navigation
└── devtool/                  # Developer tools

services/                     # Simple state providers (no UI)
├── theme.tsx                 # Light/dark theme
├── locale.tsx                # i18n locale + translations
├── visitor.tsx               # Returning visitor tracking
└── index.ts

shared/
└── providers.tsx             # Root provider composition
```

### Design Principles

1. **Systems vs Services**: Complex features with UI go in `systems/`, simple state-only providers go in `services/`

2. **Co-location**: Each system bundles its provider, components, and utilities:
   ```
   systems/ambient/
   ├── provider.tsx           # Context + state
   ├── components/            # UI components
   ├── lib/                   # Utilities
   └── index.ts               # Barrel exports
   ```

3. **Thin orchestrator**: `shared/providers.tsx` composes all providers:
   ```tsx
   export function Providers({ children }) {
     return (
       <QueryClientProvider>
         <ThemeProvider>
           <LocaleProvider>
             <VisitorProvider>
               <CommandProvider>
                 <DevtoolWrapper>
                   <AmbientWrapper>{children}</AmbientWrapper>
                 </DevtoolWrapper>
               </CommandProvider>
             </VisitorProvider>
           </LocaleProvider>
         </ThemeProvider>
       </QueryClientProvider>
     );
   }
   ```

4. **Clean imports**: Each module has barrel exports:
   ```tsx
   // Services (simple state)
   import { useLocale, useTheme, t } from "@/services";
   
   // Systems (complex subsystems)
   import { useWeather, AmbientProvider } from "@/systems/ambient";
   import { useCommand, CommandPalette } from "@/systems/command";
   import { useDevtool, DevtoolFAB } from "@/systems/devtool";
   ```

### Subsystem Breakdown

| Category | Location | Has UI? | Has State? | Examples |
|----------|----------|---------|------------|----------|
| **Systems** | `systems/` | ✅ | ✅ | Ambient, Command, Devtool |
| **Services** | `services/` | ❌ | ✅ | Theme, Locale, Visitor |
| **Shared** | `components/` | ✅ | ❌ | PostList, SystemNav |

### Adding New Features

**Adding a new Service** (simple state, no UI):
1. Create `services/my-service.tsx`
2. Export from `services/index.ts`
3. Add to `shared/providers.tsx`

**Adding a new System** (complex feature with UI):
1. Create `systems/my-system/` with provider.tsx, components/, index.ts
2. Export from `systems/index.ts`
3. Add to `shared/providers.tsx`

### Benefits

- **Clear categorization**: Systems vs Services vs Shared
- **Discoverability**: `systems/ambient/` contains everything ambient-related
- **Testability**: Test individual systems in isolation
- **Bundle efficiency**: Systems can be code-split with their features
- **Reduced cognitive load**: Each file is focused on one concern
