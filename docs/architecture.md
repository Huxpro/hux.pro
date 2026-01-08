# Technical Architecture

## Stack

| Layer           | Technology              |
| --------------- | ----------------------- |
| Framework       | Next.js 16 (App Router) |
| Language        | TypeScript              |
| Styling         | Tailwind CSS v4         |
| Animations      | tw-animate-css          |
| Command Palette | cmdk                    |
| MDX             | next-mdx-remote         |
| Data Fetching   | TanStack Query          |
| Package Manager | pnpm                    |

### Portability Rules

✅ **Always:**
- Server components (build-time)
- `generateStaticParams` for dynamic routes
- `"use client"` for interactivity
- Static export compatible

❌ **Avoid:**
- API routes, Server Actions, Middleware
- ISR, image optimization
- Vendor-specific features

## Project Structure

```
cursor/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Homepage
│   └── globals.css         # Tailwind + custom styles
├── components/
│   ├── ambient/            # Weather widget, gradient background
│   ├── debug/              # DevTool FAB and panel
│   ├── layout/             # Command palette, FAB, page surface
│   ├── providers.tsx       # Global state providers
│   └── mdx-components.tsx  # MDX component overrides
├── content/
│   ├── blog/               # MDX blog posts
│   └── talks/              # MDX talk content
├── lib/
│   ├── ambient/            # Location, weather, gradient logic
│   ├── query.ts            # TanStack Query setup
│   ├── content.ts          # Content utilities
│   ├── i18n.ts             # Translations
│   └── utils.ts            # cn() and helpers
└── docs/                   # This documentation
```

## State Management

All global state is managed via React Context in `components/providers.tsx`:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CONTEXT HIERARCHY                               │
├─────────────────────────────────────────────────────────────────────┤
│  QueryClientProvider (TanStack Query)                               │
│  └── PersistQueryClientProvider                                     │
│      └── ThemeContext (light/dark, system preference)               │
│          └── LocaleContext (en/zh, localStorage)                    │
│              └── VisitorContext (returning visitor tracking)        │
│                  └── AmbientProviders                               │
│                      ├── LocationContext (coordinates, mode)        │
│                      ├── WeatherContext (weather, gradient)         │
│                      └── DebugContext (DevTool FAB, panel)          │
│                          └── CommandPaletteContext (open/close)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Context Summary

| Context | Purpose | Persistence |
|---------|---------|-------------|
| Theme | Light/dark mode | System preference |
| Locale | en/zh language | localStorage |
| Visitor | Returning visitor detection | localStorage |
| Location | GPS or IP-based coordinates | TanStack Query cache |
| Weather | Weather data + gradient | TanStack Query cache |
| Debug | DevTool FAB and panel visibility | localStorage |
| CommandPalette | Open/close state | None (ephemeral) |

### Data Architecture

Server state (fetched data) and client state (preferences) are separated:

```
┌─────────────────────────────────────────────────────────────────────┐
│           TanStack Query Cache (Server State)                       │
│  • Location data (lat, lon, city)                                   │
│  • Weather data (temp, condition, isDay)                            │
│  • Auto-persisted to localStorage                                   │
├─────────────────────────────────────────────────────────────────────┤
│           React Context (Client State)                              │
│  • User preferences (locationMode, gradientEnabled)                 │
│  • UI state (DevTool panel open)                                    │
│  • Manually persisted to localStorage                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Rendering Strategy

| Page | Strategy |
|------|----------|
| `/` | Client-side (locale, time, visitor context) |
| `/blog` | Client-side (filtering, hover states) |
| `/blog/[slug]` | Static generation + client hydration |
| `/career` | Client-side |
| `/talks` | Client-side |

## Homepage

The homepage (`app/page.tsx`) creates an AI-native OS experience:

### AmbientGreeting

Time-aware greeting that speaks to the user:
- Detects time of day (morning/afternoon/evening/night)
- Shows contextual message based on visitor history
- Uses serif font for warmth

### Widget System

Bento-style CSS Grid with glassmorphic widgets:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       WIDGET GRID                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────┐ ┌─────────────────────────┐  │
│  │                                   │ │      WeatherWidget      │  │
│  │          BlogWidget               │ │  ┌───────────────────┐  │  │
│  │  ┌─────────────────────────────┐  │ │  │ BEIJING           │  │  │
│  │  │ Recent posts with dates     │  │ │  │ 23°          ⛅   │  │  │
│  │  │ • Post title 1      Jan 5   │  │ │  │              Clear│  │  │
│  │  │ • Post title 2      Jan 3   │  │ │  └───────────────────┘  │  │
│  │  │ • Post title 3      Jan 1   │  │ └─────────────────────────┘  │
│  │  └─────────────────────────────┘  │                              │
│  │                        2x1 span   │ ┌─────────────────────────┐  │
│  └───────────────────────────────────┘ │      StatusWidget       │  │
│                                        │  ┌───────────────────┐  │  │
│  ┌───────────────────────────────────┐ │  │ 🟢 Available      │  │  │
│  │          TalkWidget               │ │  │    for work       │  │  │
│  │  ┌─────────────────────────────┐  │ │  └───────────────────┘  │  │
│  │  │ Latest talk with event      │  │ └─────────────────────────┘  │
│  │  └─────────────────────────────┘  │                              │
│  └───────────────────────────────────┘                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Widget | Content | Size |
|--------|---------|------|
| BlogWidget | 3 recent posts with dates | Large (2x1) |
| WeatherWidget | Location + temperature + condition | Medium (1x1) |
| StatusWidget | Current availability with ping | Medium (1x1) |
| TalkWidget | Latest talk with event | Medium (1x1) |

### ConversationalPrompt

Inline button that opens the command palette:
- Replaces FAB on homepage
- "what brings you here?" placeholder
- Shows ⌘K hint on desktop

## Key Systems

### Ambient System

Environment-aware location + weather experience with gradient backgrounds.

See [Ambient System](./ambient-system.md).

### Content System

Bilingual MDX content with static generation.

See [Content System](./content-system.md).

### DevTool

Floating debug panel for development and weather testing.

See [DevTool](./devtool.md).

### i18n System

Bilingual support (English/Chinese):
- UI text: centralized in `lib/i18n.ts`
- Content: filename-based language detection (`*.en.mdx`, `*.zh.mdx`)
- Locale switching: persisted to localStorage

### Command Palette

Built on `cmdk` library:
- **Dual-mode**: Search mode and action mode
- **Keyboard-first**: ⌘K to open, single-letter shortcuts
- **Grouped results**: Navigation, Settings, Blog, Talks

### CSS Architecture

Using Tailwind CSS v4:
- `@import "tailwindcss"` syntax
- `@custom-variant dark` for dark mode
- CSS Grid animations for smooth height transitions

## Related Documentation

- [Ambient System](./ambient-system.md) - Location, weather, and gradient
- [Content System](./content-system.md) - MDX, i18n, and static generation
- [DevTool](./devtool.md) - Debug panel and weather testing
- [React Engineering](./react-engineering.md) - React patterns and conventions
- [Design System](./design-system.md) - Visual design language
- [Design Philosophy](./design-philosophy.md) - Product design rationale
