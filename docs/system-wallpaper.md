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

## Image wallpaper treatments

Image wallpaper is two surfaces, after Apple's lock screen vs Notification
Center / Music now-playing:

| Route | Treatment | Why |
|-------|-----------|-----|
| `/` (desktop) | Sharp photo, light scrim (`bg-background/8–16`), **thin** glass | The wallpaper is the hero. Regular Liquid Glass fill is too milky / too inky on a photo. |
| Other pages (reading) | Photo is `scale-[1.12]` + `blur-[40px]`, then a veil + edge vignette | A sharp photo fights body text. Defocus + overlay separate figure from ground without boxing the article. |

Glass fill lives in `--glass*` tokens (`bg-glass`, `bg-glass-hover`, …).
Defaults match the old `bg-card/50` recipe. `html.wallpaper-image` thins them
to a Thin / Ultra Thin vibrancy wash (~20–26% fill). Blur stays ordinary
`backdrop-blur` — no specular highlights or lens distortion.

`WallpaperProvider` toggles `html.wallpaper-image` and `html.wallpaper-read`.

## Glass material

`--glass*` tokens paint **every** System UI frosted surface (homepage
widgets, FAB, dock, palette, sheets) — not per-widget. Two materials,
same names as iOS 26.1 Settings → Display & Brightness → Liquid Glass:

| Material | EN / 中文 | When image wallpaper is on |
|----------|-----------|----------------------------|
| `clear` | Clear / 透明 | Thin vibrancy (~20–26% fill). Default. |
| `tinted` | Tinted / 色调 | Original Regular fill (`bg-card/50`). |

`G` in ⌘K cycles them. Devtool **Wallpaper → Glass** sets them directly.
`html.glass-tinted` disables the Clear thinning. Weather wallpaper already
uses Regular fill, so the two materials look the same there.

Persisted on `localStorage.hux_wallpaper.glass`.

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
Photo pairs regenerate with `bash scripts/fetch-wallpapers.sh`. Official
graphic pairs (Monterey, Big Sur, iOS 14, iOS 13) come from
[PR #97](https://github.com/Huxpro/hux.pro/pull/97); provenance is in
`public/wallpapers/sources.json`.

**macOS:** Tahoe (2025), Sequoia (2024), Sonoma (2023), Ventura (2022),
Monterey (2021), Big Sur (2020)

**iOS:** iOS 27 (2026), iOS 18 (2024), iOS 17 (2023), iOS 14 (2020),
iOS 13 (2019)

The ⌘K picker tiles are macOS Settings pair cards: a 16:10 split of the
light and dark originals, sun / moon to lock a variant, a check when
selected, and `Name` + `macOS · 2020` underneath.

Images are Apple stock wallpapers, kept small (≈2.5 MB total) for the site.

## Commands

`W` (search or slash commands) opens a **secondary window** inside ⌘K — the
same pattern as Load Bundle. The picker:

1. Selects Weather (and Full / Widget / Off) **or** an image pair
2. Sets Auto / Light / Dark for the pair — or tap the sun / moon on a tile
3. Esc / ← returns to search without closing ⌘K

## Devtool

The Devtool **Wallpaper** section shows the resolved kind, pair, variant, and
src. It can edit the persisted settings or flip an ephemeral override to
preview a pair without writing `localStorage`.

## Persistence

`localStorage.hux_wallpaper` → `{ kind, imageId, appearance, glass }`

Override state in the Devtool is ephemeral (clears on refresh).
