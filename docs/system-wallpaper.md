# Wallpaper System

The wallpaper system is the **full-page background**. Weather gradients and
Apple image pairs are two mutually exclusive kinds of the same surface — only
one shows at a time.

Sunrise / sunset Live Activity is not a wallpaper. It stays on the Dock and
keeps working regardless of which wallpaper is active.

## Overview

```
systems/wallpaper/
├── provider.tsx                  # WallpaperProvider (kind + pair + appearance)
├── components/
│   ├── wallpaper-background.tsx  # Full-page image renderer (crossfade)
│   ├── wallpaper-panel.tsx       # ⌘K secondary picker
│   └── index.ts
├── lib/
│   ├── catalog.ts                # Built-in macOS / iOS pairs
│   ├── settings.ts               # localStorage persistence
│   ├── resolve.ts                # Auto / light / dark resolution
│   └── index.ts
└── index.ts
```

## Kinds

| Kind | What it paints | Notes |
|------|----------------|-------|
| `weather` | Ambient OKLCH gradient | Existing full / widget / off modes still apply |
| `image` | A built-in light/dark pair | Full-page only; weather widget overlay is independent |

`AmbientSurface` picks exactly one full-page renderer:

- `kind === "weather"` and gradient mode is `full` → weather gradient
- `kind === "image"` → image wallpaper
- otherwise → solid `bg-background`

## Light / Dark pairs

Every built-in wallpaper is a **pair**. Appearance:

| Appearance | Result |
|------------|--------|
| `auto` | Follows the site theme (light image in light mode, dark in dark mode) |
| `light` | Lock the light variant |
| `dark` | Lock the dark variant |

`auto` is the macOS-style automatic wallpaper.

## Built-in catalog

Compressed into `public/wallpapers/<id>/{light,dark}.jpg` (+ thumbs).
Regenerate with `bash scripts/fetch-wallpapers.sh`.

**macOS:** Tahoe (26), Sequoia (15), Sonoma (14), Ventura (13), Big Sur (11)

**iOS:** iOS 27, iOS 18, iOS 17

Images are Apple stock wallpapers, kept small (≈2 MB total) for the site.

## Commands

`W` (search or slash commands) opens a **secondary window** inside ⌘K — the
same pattern as Load Bundle. The picker:

1. Selects Weather (and Full / Widget / Off) **or** an image pair
2. Sets Auto / Light / Dark for the pair
3. Esc / ← returns to search without closing ⌘K

## Devtool

The Devtool **Wallpaper** section shows the resolved kind, pair, variant, and
src. It can edit the persisted settings or flip an ephemeral override to
preview a pair without writing `localStorage`.

## Persistence

`localStorage.hux_wallpaper` → `{ kind, imageId, appearance }`

Override state in the Devtool is ephemeral (clears on refresh).
