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
| Asset generation (Node) | `lib/icon/generate.ts` |
| Generated assets | `public/icons/icon.svg`, `public/icons/apple-icon.svg` |
| Editor ("Icon Studio") | `app/editor/icon` (hidden URL) |
| Dev save API | `app/api/icon` |
| CLI generator | `scripts/icon-generate.ts` |
| Wired into `<head>` | `app/layout.tsx` → `metadata.icons` |

## The editor

Open **`/editor/icon`** (not linked anywhere, `noindex`). The right panel
exposes the levers; the left canvas previews live, at multiple sizes, and under
round / square / app-tile masks. The preview inlines the SVG into the DOM so it
renders with the site's actual font families — WYSIWYG against the shipped asset.

**Typography:** wordmark text (+ quick presets), typeface (Sans / Serif / Mono),
case, weight, size, tracking, X/Y nudge, italic, color.
**Background:** texture (Solid / Dots / Grid / Lines / Noise / Gradient), base
color, texture color + opacity, density, angle.
**Shape:** baked corner radius (leave at 0 — most OSes apply their own mask).

**Save** (dev only) writes `content/icon.json` *and* regenerates
`public/icons/*` in one step. Commit both. **SVG** downloads the current render.

## Regenerating from the CLI

```bash
pnpm icon:generate   # render public/icons/* from content/icon.json
pnpm icon:check      # CI: fail if the committed assets are stale
```

The generator embeds a glyph-subset of the wordmark's font (via the Google
Fonts `text=` API) so the SVG is self-contained — the favicon renders in its own
font even though it loads outside the page. Embedding is best-effort: offline,
the assets still generate and fall back to a platform font. `icon:check` ignores
font-only differences (it compares the structural SVG) so a network blip in CI
doesn't flag false drift.

## Why this shape

Mirrors the OG-snapshot discipline already in the repo: one framework-agnostic
core (`lib/icon/render.ts`, like `lib/og-core.ts`) used identically by the
editor, the dev save route, and the build CLI — so "what you preview" and "what
ships" are produced by the same code path. No runtime dependency, no native
image libraries; the committed SVGs are the production artifacts.
