# App Icon System

> The icon row of the skill `.claude/skills/content-snapshots` is the checklist form of this page.

A **generative** app icon: the favicon and home-screen tile are a pure
function of a small config, not a hand-drawn one-off. Edit the levers in
`/lab/icon`, save, and the committed assets regenerate. The design stays
*stable* (the same config gives the same SVG) while remaining *editable*.

> Per the design language: a quiet wordmark ("mostly just the name of the
> site") over a low-contrast texture. Grayscale only, no accent colors.

## What it looks like done well

![The Icon Lab at desk width: the bar with the live readout "λHUX · Grid · r 0.00" and SVG, Reset and Save; the stage with the 256 app tile and the size ladder; the panel of Typography and Background controls on the right.](/img/docs/app-icon/lab-desk.png)

`/lab/icon` at 1280 wide. The panel on the right holds every lever; the
stage previews the config live, and Save stays grey until something changed.

![The five generated files at 1:1 pixels: icon.svg and icon-512.png side by side at 512, then icon-192.png, apple-icon.png at 180, and favicon.ico's 48, 32 and 16 frames.](/img/docs/app-icon/outputs.png)

What `pnpm icon:generate` writes, drawn at 1:1 pixels. The browser's
rendering of `icon.svg` (top left) and resvg's `icon-512.png` (top right)
match glyph for glyph: both use JetBrains Mono at weight 300, embedded in
one and handed to the rasterizer in the other. The ICO's 16px frame is a
smudge; it is only for browsers that cannot use the SVG.

## How it works

![content/icon.json is written by the lab's Save through POST /api/icon and read by pnpm icon:generate; both call generateIconAssets, which normalizes the config, renders buildIconSvg with an embedded woff2 font into icon.svg, and rasterizes with resvg and a TTF into apple-icon.png, icon-192.png, icon-512.png and app/favicon.ico. pnpm icon:check re-renders the SVG and compares it with the committed one, minus the font block.](/img/docs/app-icon/pipeline.svg#bleed)

One config, two writers, one generator. Read the diagram left to right.

| Piece | Location |
|-------|----------|
| Config (source of truth) | `content/icon.json` |
| Config type, defaults, `normalizeIconConfig` (clamps every field) | `lib/icon/config.ts` |
| Pure SVG renderer (`buildIconSvg`) | `lib/icon/render.ts` |
| Glyph-subset fonts (`fetchEmbeddedFontFace`, `fetchFontBuffer`) | `lib/icon/fonts.ts` |
| SVG to PNG (`rasterizeSvgToPng`, resvg) and `.ico` (`encodeIco`) | `lib/icon/raster.ts` |
| Asset generation (`generateIconAssets`, Node only) | `lib/icon/generate.ts` |
| Icon Lab | `app/lab/icon` (`/lab/icon`) |
| Dev save API (GET / POST, 403 in production) | `app/api/icon/route.ts` |
| CLI (`icon:generate`, and `icon:check` with `--check`) | `scripts/icon-generate.ts` |
| Web manifest | `app/manifest.ts` → `/manifest.webmanifest` |
| Wired into `<head>` | `app/layout.tsx` → `metadata.icons` |

### Home-screen coverage

Each platform wants its own format; all of them come from the one config:

| Platform | What it uses | Asset |
|----------|--------------|-------|
| Browser tab (modern) | `<link rel=icon>` SVG | `public/icons/icon.svg` (512) |
| Browser tab (legacy) | `/favicon.ico` (16/32/48) | `app/favicon.ico` |
| iOS "Add to Home Screen" | `apple-touch-icon` PNG (180) | `public/icons/apple-icon.png` |
| Android / Chrome PWA install | web manifest → PNG 192/512 (+ maskable) | `app/manifest.ts` + `public/icons/icon-{192,512}.png` |

`app/favicon.ico` is linked by Next's file convention; `layout.tsx` adds the
SVG and the apple-touch-icon on top. The manifest lists the 512 twice, the
second time as `purpose: "maskable"`: the icon is a full-bleed ground with a
centered mark, so no separate safe-area render is needed.

### Fonts

The wordmark is always JetBrains Mono, at the config's weight and italic,
fetched from the Google Fonts css2 API with `text=` set to the wordmark's
glyphs only. It is fetched twice, in two formats:

- **SVG:** a woff2 subset, inlined as an `@font-face` data URI in a `<style>`
  block, so the favicon renders in its own font outside the page.
- **PNG / ICO:** a static TTF (Google serves it to a legacy user agent),
  because resvg renders the woff2 subset at the wrong weight. resvg ignores
  inline `@font-face` and its `fontBuffers` option silently loads system fonts
  instead, so the TTF is written to a temp file, passed as `fontFiles` with
  system fonts off, and the raster SVG asks for the font's real family name
  (for weight 300, `JetBrains Mono Light`).

Both fetches are best-effort. Offline, the SVG is written without the
`<style>` block and the rasters fall back to a system monospace; the
command still succeeds (see the rules below).

resvg (`@resvg/resvg-js`) is a devDependency, imported dynamically by the
generator only. The assets are committed, so the deployed site never runs it.

## The lab

Open **`/lab/icon`** (from the `/lab` index; `noindex`). Below `lg` the panel
is folded away behind the bar's sliders button (Controls), and Save and
Reset are not drawn: writing the icon is a wide-screen job. The bar's
readout is `wordmark · texture · r <cornerRadius>`.

**Stage.** The 256 app tile, a size ladder (128, 64, 32, 16) and two masks
(round, square). The tile and ladder are clipped to a 22% CSS radius, the way
an OS mask would. Each preview is one 512 render inlined into the DOM (not an
`<img>`) and scaled by CSS, with its own `idPrefix` so the inlined copies'
`url(#…)` defs do not cross-wire. The preview sets `font-family` to
`var(--font-mono)`, the JetBrains Mono that `next/font` loads site-wide, so it
matches the embedded font in the shipped SVG.

![The lab's stage below the app tile: the Sizes ladder at 128, 64, 32 and 16, and the Masks row with the icon cut to a circle and to a square.](/img/docs/app-icon/lab-sizes-masks.png#bleed)

The ladder and the masks. The round mask is the one to watch: the wordmark
has to clear the circle with room to spare.

**Typography:** Wordmark (text field and five presets: `λHUX`, `hux`,
`λhux`, `λ`, `hux.pro`), Weight, Size, Tracking, Nudge Y, Nudge X, Italic,
Wordmark colour. Typeface and casing are not levers: the wordmark is always
mono and drawn verbatim, a terminal-style system mark.

**Background:** Texture (Solid / Dots / Grid / Lines / Noise / Grad) and a
shared Base colour. Each texture keeps its own settings in the config, so
switching styles never inherits another texture's tuning. Which controls
show depends on the texture:

- Dots, Grid, Lines, Noise: Texture colour, Texture opacity, Density.
- Lines and Grad: Angle.
- Grad: Gradient end (it runs from the base colour to this one).
- Solid: nothing beyond the base colour.

**Shape:** Corner radius, baked into the SVG. Leave it at 0.

**Actions.** **Save** (`next dev` only) POSTs the config to `/api/icon`,
which normalizes it, writes `content/icon.json` and regenerates all five
assets; a notice says whether the rasters were written. It is disabled until
the config differs from the last save. **Reset** loads the default config
without saving. **SVG** downloads the current render as `icon.svg`, without
the embedded font.

## Rules

- **Commit the config and all five outputs together:** `content/icon.json`,
  `public/icons/icon.svg`, `apple-icon.png`, `icon-192.png`, `icon-512.png`
  and `app/favicon.ico`. Save and `pnpm icon:generate` write the same set.
- **Regenerate online, and read the output.** Offline, the command still
  exits 0, but the SVG loses its font (a tab shows the platform's mono) and
  the PNGs and ICO are drawn in a system monospace. Look for
  `✓ Wordmark font embedded in SVG` and `✓ PNG + favicon.ico rasterized`
  before committing, and look at the PNGs: git shows them only as binary.
- **CI does not check the icon.** `.github/workflows/ci.yml` runs only
  `pnpm og:complete` and `pnpm badges:check`. Run `pnpm icon:check` yourself.
  It re-renders `icon.svg` in memory and compares it with the committed file
  with the `<style>` block stripped from both, so a font-only difference
  passes. It does not look at the PNGs or the ICO (their bytes vary with the
  resvg version): a stale raster passes.
- **Keep the mark inside the maskable safe zone.** The 512 doubles as the
  maskable icon, and Android may crop it to the centre circle of 80% of the
  edge (radius 205px). Today the wordmark's corners sit about 194px from the
  centre. A longer word, a bigger Size or wider Tracking pushes them out;
  the round mask on the stage shows it.
- **Corner radius stays 0.** Most platforms apply their own mask (the
  stage previews it); a baked radius would be cut twice.
- **Grayscale.** The icon follows the design language: no accent colour.

## Changing the icon

1. `pnpm dev`, open `/lab/icon` at `lg` width or wider, tune, and Save. Or
   edit `content/icon.json` by hand and run `pnpm icon:generate`.
2. Check the two `✓` lines (Save's notice says only whether rasters were
   written).
3. `pnpm icon:check`.
4. Open the PNGs and `app/favicon.ico`; check the round mask in the lab.
5. Commit the six files.

## Reference: `content/icon.json`

`normalizeIconConfig` fills a missing field from `DEFAULT_ICON_CONFIG` and
clamps every number, so a hand-edited file always renders. Sizes and offsets
are fractions of the canvas edge.

| Field | Clamp | Lab control | Draws |
|-------|-------|-------------|-------|
| `text` | first 24 characters | Wordmark | the wordmark, verbatim, centered |
| `fontWeight` | 100–900 (lab: steps of 100) | Weight | the font weight fetched and set |
| `fontSize` | 0.1–0.95 | Size | font size = `fontSize × edge` |
| `letterSpacing` | −0.2–0.5 em | Tracking | letter-spacing = `letterSpacing × font size` |
| `italic` | boolean | Italic | italic font fetched and set |
| `textColor` | any string | Wordmark colour | the wordmark fill |
| `offsetX`, `offsetY` | −0.5–0.5 (lab slider: −0.3–0.3) | Nudge X / Y | moves the text centre |
| `background.style` | one of `solid dots grid lines noise gradient` | Texture | which overlay is drawn |
| `background.color` | any string | Base colour | the full-bleed base fill |
| `background.<texture>` | `textureColor`, `textureOpacity` (0–1), `scale` (0–1), `angle` (0–360), `gradientColor` | per texture | see below |
| `cornerRadius` | 0–0.5 | Corner radius | `rx` of the base, clip and gradient |

How each texture uses its settings (`buildBackground` in `render.ts`):

| Style | Shape |
|-------|-------|
| `dots`, `grid`, `lines` | a pattern tile of `max(8, round(edge × (0.18 − 0.13 × scale)))` px: denser as `scale` grows. Dots: a circle of radius 12% of the tile. Grid: a 4%-wide stroke on two edges. Lines: an 18%-wide bar, the tile rotated by `angle`. Drawn in `textureColor` at `textureOpacity`. |
| `noise` | `feTurbulence` fractal noise, `baseFrequency = 0.4 + 1.4 × scale`, desaturated, filled with `textureColor` at `textureOpacity`. `angle` is unused. |
| `gradient` | a linear gradient from `background.color` to `gradientColor` along `angle`. `textureColor`, `textureOpacity` and `scale` are unused. |

## Why this shape

It follows the OG-snapshot discipline: one framework-agnostic renderer
(`lib/icon/render.ts`, like `lib/og-core.ts`) used by the lab preview, the
dev save route and the CLI, so what you preview and what ships come from the
same code. The committed files are the production artifacts; the deployed
site needs no image library at runtime.
