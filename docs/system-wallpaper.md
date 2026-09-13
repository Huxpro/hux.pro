# Wallpaper System

The wallpaper system is the **full-page background**. Weather gradients and
Apple image pairs are two mutually exclusive kinds of the same surface — only
one shows at a time.

Sunrise / sunset Live Activity is not a wallpaper. It stays on the Dock and
keeps working regardless of which wallpaper is active.

## Overview

```
systems/wallpaper/
├── provider.tsx                  # WallpaperProvider (kind + pair; appearance always Auto)
├── components/
│   ├── wallpaper-background.tsx  # Full-page image renderer (crossfade)
│   ├── wallpaper-panel.tsx       # ⌘K secondary picker
│   └── index.ts
├── lib/
│   ├── catalog.ts                # Built-in macOS / iOS pairs
│   ├── settings.ts               # localStorage persistence
│   ├── resolve.ts                # Pair variant follows the site theme
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

`WallpaperProvider` toggles `html.wallpaper-surface` (weather or image),
`html.wallpaper-image`, and `html.wallpaper-read`. Light living surfaces
remap System type to `--label*` and use a luma frost instead of white tissue.

## Glass material

`--glass*` tokens paint **every** System UI frosted surface (homepage
widgets, FAB, dock, palette, sheets) — not per-widget. Two materials,
same names as iOS 26.1 Settings → Display & Brightness → Liquid Glass:

| Material | EN / 中文 | When image wallpaper is on |
|----------|-----------|----------------------------|
| `clear` | Clear / 透明 | Light: dimming luma frost over media (HIG Clear + dimming). Dark: thin vibrancy. Default. |
| `tinted` | Tinted / 色调 | Regular fill. Light uses the same luma frost as System glass; dark keeps the original card mix. |

`G` in ⌘K cycles them. Devtool **Wallpaper → Glass** sets them directly.
`html.glass-tinted` disables the Clear thinning. Weather wallpaper already
uses Regular fill, so the two materials look the same there.

Persisted on `localStorage.hux_wallpaper.glass`.

## Light / Dark pairs

Every built-in wallpaper is a **pair**. Appearance is always **auto**:
the light image follows the light site theme, the dark image follows dark.
There is no Light / Dark lock in the picker or Devtool.

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

The ⌘K picker is one grid of 16:10 Settings cards. **Weather** is the
first tile — same size as Tahoe, with a live light/dark split of the
current condition. Image tiles split light / dark, with a check when
selected and `Name` + `macOS · 2020` underneath.

Images are Apple stock wallpapers, kept small (≈2.5 MB total) for the site.

## Commands

`W` (search or slash commands) opens a **secondary window** inside ⌘K — the
same pattern as Load Bundle. The picker:

1. Selects Weather (first tile) or an image pair
2. Esc / ← returns to search without closing ⌘K

## Devtool

The Devtool **Wallpaper** section shows the resolved kind, pair, variant, and
src. It can edit the persisted settings or flip an ephemeral override to
preview a pair without writing `localStorage`.

## Persistence

`localStorage.hux_wallpaper` → `{ kind, imageId, appearance, glass }`

Override state in the Devtool is ephemeral (clears on refresh).
