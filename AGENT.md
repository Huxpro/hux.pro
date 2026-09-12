# Agent.md — AI Context for Hux.Pro

> This file provides context for AI assistants working on this codebase.

## 1. Documentation Map

> This file is an index.

| Topic | Source of Truth |
|-------|-----------------|
| **Design Philosophy** | [docs/design-philosophy.md](./docs/design-philosophy.md) (Core principles) |
| **Design System** | [docs/design-system.md](./docs/design-system.md) (Typography, colors) |
| **Navigation** | [docs/navigation.md](./docs/navigation.md) (Command palette) |
| **Architecture** | [docs/architecture.md](./docs/architecture.md) (Implementation details) |
| **Wallpaper** | [docs/system-wallpaper.md](./docs/system-wallpaper.md) (Weather + image backgrounds) |
| **OG Images (ours)** | [docs/og-images.md](./docs/og-images.md) (Social cards we publish for our pages) |
| **Link Previews (OG)** | [docs/og-previews.md](./docs/og-previews.md) (Crawling *others'* OG for /works cards) |
| **App Icon** | [docs/app-icon.md](./docs/app-icon.md) (Generative favicon + `/editor/icon` studio) |
| **App Folder** | [docs/app-shelf.md](./docs/app-shelf.md) (Home-screen snap-paged app folder) |

## 2. Quick Start Context

**Hux.Pro** is a personal website functioning as a "Personal Operating System". It prioritizes a **System UI** aesthetic (tools, command palettes) over traditional marketing design.

### Key Constraints
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 (OKLCH colors)
- **Navigation**: Command Palette (`⌘K`) is the primary nav; no visible navbar.
- **Portability**: Static export compatible; NO API routes or server actions.

### File Locations

| Feature | Location |
|---------|----------|
| Global styles | `app/globals.css` |
| Command palette | `components/layout/command-palette.tsx` |
| Global state | `components/providers.tsx` |
| Translations | `lib/i18n.ts` |
| Blog posts | `content/blog/*.mdx` (at /writing) |

### Design Tokens

```css
/* Fonts */
--font-sans: Inter
--font-serif: Newsreader
--font-mono: JetBrains Mono

/* Layout */
max-width: 680px (content)

/* Key transitions */
duration-200 (quick interactions)
duration-300 (morphing transitions)
```

### Before Coding
1.  **Check the Docs**: If modifying UI, check `design-system.md` for token usage.
2.  **Respect the Vibe**: Maintain the "Dual Aesthetic" (Prose vs System).
3.  **Keyboard First**: Ensure new features are accessible via Command Palette.

## 3. Common Tasks

### Adding Content
- Blog posts go in `content/blog/` (displayed at /writing).
- Must include frontmatter (title, date, description, language).

### Modifying Design
- Use `app/globals.css` for global variables.
- Use Tailwind utility classes for component styling.
- Avoid introducing new colors; stick to the grayscale system.

### Testing the Music System Offline
- Set `localStorage.hux_music_mock = "1"` **before app scripts run** (e.g. Playwright `context.addInitScript()`), or flip "Mock player" in the Devtool panel → Music section.
- The flag makes `MusicProvider` skip the YouTube IFrame API and drive every music surface (home widget, Live Activity, playlist sheet) from the committed fixture in `systems/music/lib/mock.ts` — play/pause/skip/select all work with zero network.
- Use this for headless-browser verification in sandboxes where `youtube.com` is unreachable. Never enabled by default; real visitors always get the real player.
