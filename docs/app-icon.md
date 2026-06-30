# App Icon System

A **generative** app icon: the favicon / app tile is a pure function of a small
config, not a hand-drawn one-off. Edit the levers in a hidden studio, save, and
the committed SVG assets regenerate. The design stays *stable* (deterministic
from config) while remaining *editable*.

> Per the design language: a quiet wordmark — "mostly just the name of the
> site" — over a subtle texture. Grayscale only, no accent colors.

## Where things live

| Piece | Location |
|-------|----------|
| Config (source of truth) | `content/icon.json` |
| Config type + defaults + validation | `lib/icon/config.ts` |
| Pure SVG renderer (`buildIconSvg`) | `lib/icon/render.ts` |
| Glyph-subset font embedding | `lib/icon/fonts.ts` |
| SVG → PNG / ICO rasterizer | `lib/icon/raster.ts` |
| Asset generation (Node) | `lib/icon/generate.ts` |
| Generated assets | `public/icons/{icon.svg,apple-icon.png,icon-192.png,icon-512.png}`, `app/favicon.ico` |
| Editor ("Icon Studio") | `app/editor/icon` (hidden URL) |
| Dev save API | `app/api/icon` |
| CLI generator | `scripts/icon-generate.ts` |
| Web manifest | `app/manifest.ts` → `/manifest.webmanifest` |
| Wired into `<head>` | `app/layout.tsx` → `metadata.icons` |

## Home-screen coverage

Getting onto the home screen needs more than an SVG — each platform wants its
own format, all generated from the one config:

| Platform | What it uses | Asset |
|----------|--------------|-------|
| Browser tab (modern) | `<link rel=icon>` SVG | `public/icons/icon.svg` |
| Browser tab (legacy) | `/favicon.ico` (16/32/48) | `app/favicon.ico` |
| iOS "Add to Home Screen" | `apple-touch-icon` PNG (180) | `public/icons/apple-icon.png` |
| Android / Chrome PWA install | web manifest → PNG 192/512 (+ maskable) | `app/manifest.ts` + `public/icons/icon-{192,512}.png` |

PNGs and the `.ico` are rasterized from the SVG with **resvg** (`@resvg/resvg-js`,
a dev-only dependency — the committed assets mean the deployed runtime never
imports it). The wordmark font is handed to resvg as a buffer (its file loader
doesn't decode woff2). The icon is a full-bleed background with a small centered
mark, so the 512 doubles as the `maskable` icon — it survives platform masking
without a separate safe-area render.

## The editor

Open **`/editor/icon`** (not linked anywhere, `noindex`). The right panel
exposes the levers; the left canvas previews live, at multiple sizes, and under
round / square / app-tile masks. The preview inlines the SVG into the DOM so it
renders with the site's actual font families — WYSIWYG against the shipped asset.

**Typography:** wordmark text (+ quick presets), weight, size, tracking, X/Y
nudge, italic, color. The wordmark is always set in the site's mono family and
drawn verbatim — the icon is a terminal-style system mark, so typeface and
casing are intentionally not levers.
**Background:** texture (Solid / Dots / Grid / Lines / Noise / Gradient) and a
shared base color. Each texture owns its *own* color / opacity / density / angle
(and gradient end color), so switching styles never inherits another texture's
tuning.
**Shape:** baked corner radius (leave at 0 — most OSes apply their own mask).

**Save** (dev only) writes `content/icon.json` *and* regenerates
`public/icons/*` in one step. Commit both. **SVG** downloads the current render.

## Regenerating from the CLI

```bash
pnpm icon:generate   # render public/icons/* from content/icon.json
pnpm icon:check      # CI: fail if the committed assets are stale
```

The generator embeds a glyph-subset of the wordmark's font — JetBrains Mono, via
the Google Fonts `text=` API — so the SVG is self-contained: the favicon renders
in its own font even though it loads outside the page. Embedding is best-effort: offline,
the assets still generate and fall back to a platform font. `icon:check` ignores
font-only differences (it compares the structural SVG) so a network blip in CI
doesn't flag false drift.

## Why this shape

Mirrors the OG-snapshot discipline already in the repo: one framework-agnostic
core (`lib/icon/render.ts`, like `lib/og-core.ts`) used identically by the
editor, the dev save route, and the build CLI — so "what you preview" and "what
ships" are produced by the same code path. No runtime dependency, no native
image libraries; the committed SVGs are the production artifacts.
