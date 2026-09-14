# Agent.md — AI Context for Hux.Pro

> This file provides context for AI assistants working on this codebase.

## 1. Documentation Map

> This file is an index.

| Topic | Source of Truth |
|-------|-----------------|
| **Design Philosophy** | [docs/design-philosophy.md](./docs/design-philosophy.md) (Core principles) |
| **Design System** | [docs/design-system.md](./docs/design-system.md) (Typography, colors) |
| **Navigation** | [docs/navigation.md](./docs/navigation.md) (Command palette) |
| **Secondary Surfaces** | [docs/system-surface.md](./docs/system-surface.md) (sheet / panel / window, per viewport) |
| **Glass** | [docs/system-glass.md](./docs/system-glass.md) (Clear / Tinted material, reading surfaces) |
| **Ambient / Wallpaper** | [docs/system-ambient.md](./docs/system-ambient.md) (Weather + Apple wallpaper pairs, `pnpm wallpapers:check`) |
| **Architecture** | [docs/architecture.md](./docs/architecture.md) (Implementation details) |
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

### Testing the Bezel

`systems/bezel` — the frame that surrounds the page on a phone, after ryOS. The
component takes props and knows nothing about settings; the ambient system maps
these keys onto it. They live in `hux_ambient_settings`:

| Key | Values | Default |
|---|---|---|
| `wallpaperLetterbox` | `true` / `false` / `null` = the kind's default, on iOS only | `null` |
| `wallpaperLetterboxTint` | `"black"` / `"dark"` / `"#rrggbb"` | `"black"` |
| `wallpaperLetterboxBand` | px, 0 to 64, or `null` = the kind's default | `null` |
| `wallpaperLetterboxRadius` | px, 0 to 64, or `null` = the kind's default | `null` |

`null` means "follow the wallpaper kind", and the two kinds want opposite
things (`WALLPAPER_KIND_DEFAULTS` in `systems/ambient/lib/settings.ts`):

| Kind | Soft edge | Frame | Band | Radius |
|---|---|---|---|---|
| `weather` | on | off | — | — |
| `image` | off | on | 0px | 16px |

Both are gated on iOS: a desktop window gets neither treatment.

**The frame is live; its colour is not.** The provider resolves whether the
frame is up from `WALLPAPER_KIND_DEFAULTS` and `wallpaperLetterbox`, and
`<Bezel>` puts the `bezel` class, the lock and the colour on `<html>` or takes
them off as that changes — switching wallpaper kind or toggling Letterbox in
the Devtool applies immediately, and the scroll position moves between the
window and `#scroll-root`. The COLOUR is resolved once per page load by the
boot script in `app/layout.tsx`, so `wallpaperLetterboxTint` takes effect on
the next load. Band and radius are live. Do not reintroduce anything that
re-resolves the frame colour after load (a theme-following tint, say): that is
what made the chrome change on a real phone.

**On an iOS phone with the frame up, the document does not scroll.** `<body>`
is fixed and the page scrolls in `#scroll-root`. Anything that reads or drives
page scroll must use the helpers in `systems/bezel/page-scroll.ts`
(`pageScrollTop`, `onPageScroll`, `scrollPageTo`, `pageOffsetOf`, …) — never
`window.scrollY`, `window.scrollTo` or a `window` scroll listener, which read 0
and do nothing there. A desktop browser will not show you this breakage.

Two things only a real WebKit shows (measured on iOS 26.5), both load-bearing:

- **Safari tints its chrome from `position: fixed` content at the viewport
  edge** — even a transparent full-screen fixed overlay makes it sample
  whatever is composited beneath — and otherwise from the root background.
  `theme-color` is ignored. On a locked page, `globals.css` turns every
  full-screen layer into an absolutely positioned child of the fixed body so
  nothing fixed spans the edge. A new overlay portalled into `<body>` is
  covered automatically; a new full-screen layer that is NOT a direct child of
  `<body>` needs `data-bezel-layer`.
- **Safari reads the root background for its chrome at load, and does not look
  again when it changes.** Turning the frame on or off live left the status bar
  and toolbar in the old colour until `systems/bezel/boot.ts` started briefly
  putting 8px `position: fixed` strips of the new colour at the top and bottom
  edge, which Safari does follow live. Keep that nudge if you touch the
  on/off path.
- **Safari reports every safe-area inset as zero in portrait.** The band is the
  only thing giving the frame any thickness there.
