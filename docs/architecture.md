# Architecture Overview

This document describes the architectural structure of the hux.pro codebase, organized around **systems**, **services**, and **shared** components.

## Directory Structure

```
project/
├── app/                          # Next.js App Router pages
│   ├── writing/[slug]/[lang]/    # Per-locale static blog pages
│   └── docs/[...slug]/           # Docs (locale as last catch-all segment)
├── middleware.ts                  # Bare URL → /{cookie locale} redirect
├── systems/                      # Complex subsystems (UI + State + Logic)
│   ├── ambient/                  # Weather-based ambient UI
│   ├── command/                  # Command palette navigation
│   └── devtool/                  # Developer tools for debugging
├── services/                     # Simple state providers (no UI)
│   ├── theme.tsx                 # Light/dark theme
│   ├── locale.tsx                # i18n locale + translations (+ cookie sync)
│   ├── visitor.tsx               # Returning visitor tracking
│   └── index.ts                  # Barrel exports
├── shared/                       # Shared orchestration
│   └── providers.tsx             # Root provider composition
├── components/                   # Shared UI components
│   ├── post/                     # Blog post components
│   ├── home/                     # Homepage widgets
│   ├── ui/                       # Generic UI components
│   └── motion-primitives/        # Animation primitives
├── lib/                          # Pure utilities (no React state)
│   ├── content.ts                # Content helpers (getPostHref, etc.)
│   ├── data.ts                   # Static data
│   ├── query.ts                  # React Query config
│   ├── utils.ts                  # General utilities
│   └── mdx*.ts                   # MDX processing
└── docs/                         # Architecture documentation
```

## Design Principles

### 1. Systems vs Services vs Shared

| Category | Has UI? | Has State? | Has Logic? | Example |
|----------|---------|------------|------------|---------|
| **Systems** | ✅ | ✅ | ✅ | Ambient, Command, Devtool |
| **Services** | ❌ | ✅ | ❌ | Theme, Locale, Visitor |
| **Shared** | ✅ | ❌ | ❌ | PostList, SystemNav |

### 2. Co-location

Each system is a **self-contained feature** that bundles:
- `provider.tsx` - React Context for state management
- `components/` - UI components that consume the context
- `lib/` - Pure utilities and data fetching
- `index.ts` - Barrel exports for clean imports

### 3. Data Flow

```
Services (simple state)
    ↓
Systems (complex subsystems)
    ↓
Components (shared UI)
```

The `shared/providers.tsx` orchestrates all providers in the correct order:

1. **QueryClientProvider** - React Query for data fetching
2. **ThemeProvider** - Light/dark theme
3. **LocaleProvider** - i18n locale management
4. **VisitorProvider** - Returning visitor tracking
5. **CommandProvider** - Command palette state
6. **DevtoolProvider** - Debug FAB and panel state
7. **AmbientProvider** - Weather/location/time state

## Subsystems

### [Ambient System](./system-ambient.md)
Weather-based ambient UI that creates a living, breathing interface.

### [Command System](./system-command.md)
Command palette for keyboard-first navigation.

### [Devtool System](./system-devtool.md)
Developer tools for debugging ambient state.

### Home Widget Grid (`components/ui/sortable-masonry.tsx`)

The homepage widget grid is an iPad-springboard surface where **placement is
explicit**: the layout is one list of widget IDs *per column* (`string[][]`),
not one flat sequence, and columns are plain flex children.

- A column is exactly as tall as what the visitor put in it. The middle column
  can be the tallest, a column can be left empty, and nothing reflows into a
  neighbour on its own. (It used to be CSS `columns`, which auto-balances
  column heights — a widget's column was *derived* from the running height,
  never chosen, so "make the middle column taller" wasn't expressible.)
- Each column's empty tail is a drop target (columns stretch to the grid's
  height), which is how a widget is dropped past the end of a short column or
  into an emptied one.
- Drop resolution prefers the widget under the pointer; in the gaps between
  cards it falls back to the *nearest widget in the hovered column* rather
  than to the column itself, so hovering a gap never yanks the held card to
  the column's end. Order flips only once the held card crosses a neighbour's
  midpoint.
- Layouts persist per column count under `localStorage["hux_widget_order"]`
  (`{ v: 2, cols: { "1" | "2" | "3": string[][] } }`; the legacy flat v1 array
  is still read). An unvisited width inherits the widest arranged one rather
  than snapping back to the default.
- Before hydration (and with JS off) the grid renders as a plain CSS
  multi-column in declaration order — no measurement, correct at every width.

## Import Conventions

```typescript
// Services (simple state)
import { useLocale, useTheme, t } from "@/services";

// Systems (complex subsystems)
import { AmbientProvider, useWeather } from "@/systems/ambient";
import { CommandPalette, FloatingActionButton } from "@/systems/command";
import { DevtoolFAB, useDevtool } from "@/systems/devtool";

// Shared components
import { Providers } from "@/shared/providers";

// Pure utilities
import { cn } from "@/lib/utils";
```

## Adding New Features

### Adding a new Service

1. Create `services/my-service.tsx` with provider and hook
2. Export from `services/index.ts`
3. Add to provider chain in `shared/providers.tsx`

### Adding a new System

1. Create `systems/my-system/` directory with:
   - `provider.tsx` - Context and state
   - `components/` - UI components
   - `lib/` - Utilities (optional)
   - `index.ts` - Barrel exports
2. Export from `systems/index.ts`
3. Add to provider chain in `shared/providers.tsx`

### Adding a shared component

1. Create in `components/` directory
2. Import services/systems as needed
3. Use `"use client"` for client-side interactivity
