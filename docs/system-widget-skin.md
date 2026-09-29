# Widget Skin

How every widget card on the site is dressed. Two skins:

| Skin | What it is |
|---|---|
| **Apple** (default) | The card as a WidgetKit widget: a full-colour tile, 16px margins, continuous corners in proportion to the cell, the system font, one accent colour per widget, and the widget's name under it on the home board. |
| **Classic** | The card as it was: frosted glass, 20px margins, mono lowercase labels — the site's own System UI voice. Kept whole, not approximated. |

Source of truth: `services/widget-skin.tsx` (the setting), the "Widget skin"
block in `app/globals.css` (tokens and rules), `components/ui/widget.tsx`
(the primitives' hooks). Switch it from ⌘K (**Widgets: Apple / Classic**,
`/` then `K`) or the DevTool's **Widget skin** row. It persists as
`localStorage["hux_widget_skin"]`, written only when it differs from the
default.

---

## Where the rules come from

Apple's Human Interface Guidelines, read for this — Widgets, Color,
Typography, Materials, Layout. What each one says, and what the skin does
with it:

| HIG | Says | The skin |
|---|---|---|
| Widgets › Margins | "Use the standard margin width for widgets — 16 points for most widgets … setting margins of 11 points can work well" for tighter groupings | `--widget-pad: 1rem`, `--widget-pad-tight: 0.6875rem` |
| Widgets › Text | "Prefer using the system font, text styles, and SF Symbols … It often works well to use a custom font for the large text in a widget and SF Pro for the smaller text." "display text using fonts at 11 points or larger" | `--font-widget`: `-apple-system` first (SF, and PingFang for Chinese, on Apple devices), the site's Inter elsewhere. Mono becomes the system font with tabular figures; the serif stays for large statements. Nothing under 11px. |
| Widgets › Color | "Use color to enhance a widget's appearance without competing with its content." "Convey meaning without relying on specific colors." | One accent per widget, from the system palette, on the title and one key glyph only. Body text stays on the ink ladder. |
| Widgets › Full-color | "Prefer light backgrounds for the light appearance and dark backgrounds for the dark appearance" | The tile is the theme's card colour (white / ≈ `#1C1C1E`) at 94% |
| Widgets › Appearances | Clear: "the system desaturates the widget and adds translucency, highlights, and the Liquid Glass material" | Under **Glass: Clear** the tile is translucent with a specular edge, and the accent falls back to label ink |
| Widgets › Full-color images | "Consider reserving full-color images to represent media content, such as album art" | Album art and talk covers keep their colour in every appearance |
| Widgets › Margins | "Coordinate the corner radius of your content with the corner radius of the widget" | The corner is `0.14 × cell` (22px on a 158px small widget, Apple's own proportion); `corner-shape: superellipse()` draws it continuous where supported |
| Widgets › Specifications | On a 390pt iPhone a small widget is 158pt, a medium 338×158, a large 338×354 | The board's row gap is wider than its column gap under Apple (`--board-row-gap`), so a large is taller than it is wide — the extra height is where the name label lives, as on the Home Screen |
| Materials | "Don't use Liquid Glass in the content layer." | Default is full-colour, not glass. Glass is the Clear appearance, which the visitor chooses. |
| Color › System colors | The system palette, with light and dark values | `--apple-red` … `--apple-pink`, redefined under `.dark` |

## The two appearances

The skin reads the site's existing **Glass** setting rather than adding a
third one, because the two already mean the same thing Apple's Home Screen
appearances do:

| Glass | Apple appearance | Tile |
|---|---|---|
| Tinted (default) | Light / Dark (full-colour) | `--widget-fill: 94%` of the card colour, no hairline, the accent on the title |
| Clear | Clear | The material's own fill + 4%, a 1px specular edge (`--widget-highlight`), the accent as label ink |

Both keep the glass contract: the tile is mixed from `--glass-base` and
`--glass-add`, so a busy wallpaper still adds fill and **Tint: Wallpaper**
still colours it. Nothing hardcodes an alpha.

## Accents

`<WidgetShell accent="…">` — a name, not a colour:

| Widget | Accent | Why |
|---|---|---|
| writing | orange | Books |
| projects | blue | the system's default accent — the work |
| talks | purple | Podcasts |
| music | pink | Music |
| prompts | teal | a quiet colour for a quiet card |
| log groups | indigo | |
| weather | — | the city is the title; Weather's own widget has no accent |

The accent is the title and, at most, one glyph. It never colours body text,
and under Clear it is label ink.

## How it is built

- **Apple is "not classic".** The variants are
  `skin-apple: → :where(html:not([data-widget-skin="classic"]) *)` and
  `skin-classic:`. The server renders no attribute, so the first paint is
  already Apple; only a visitor who chose Classic sees the swap, once, after
  hydration. `:where()` keeps the specificity of a plain utility.
- **Spacing is a variable, not a variant.** The primitives pad with
  `px-(--widget-pad)`, so a widget's own `pb-2` still wins in both skins
  (a `skin-apple:pb-*` would have beaten it on variant order).
- **Stable hooks.** `data-widget` on the shell (font, mono override, corner
  shape, accent), `data-widget-accent`, `data-widget-link` (the header arrow:
  Apple's widgets have none, so it shows only under keyboard focus).
- **`--cell` is a registered `<length>`.** Unregistered, a widget inherited
  its `100cqw` expression and resolved it against its own container, so
  everything sized from the cell collapsed. See the `@property` above
  `.widget-board`.

## On the board

- **Names under widgets.** `BoardWidget.label`, drawn by the Apple skin in
  the widened row gap, in the app folder's label voice and read off the same
  wallpaper band (`ink-bare-mid`), so both kinds of label flip together. The
  app folder has none — its icons are labelled.
- **The grip is iOS 18's handle**: no button, a white arc a few pixels
  outside the widget's own corner, concentric with it at every cell size.
  Same gesture as before (drag to a footprint, tap to step).
- **Done / Reset** in the system font, Done semibold — iOS's jiggle-mode
  controls, still where the thumb is.

## Adding a widget

Use the primitives (`WidgetShell`, `WidgetHeader`, `WidgetTitle`,
`WidgetBody`) and it is skinned. Give the shell an `accent` if a system
colour belongs to it. Pad anything custom with `--widget-pad`, never `px-5`.
If a size needs a different *layout* under Apple, branch with
`skin-apple:` / `skin-classic:` utilities — never with a hook, so the server
and the client render the same markup.
