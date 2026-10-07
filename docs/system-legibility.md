# Legibility

> The checklist form of this page is the skill `.claude/skills/ui-tokens`.

How text stays readable on any wallpaper under either glass material, and the
lab that turns every number involved into a slider.

## What it looks like done well

Every text colour is the ink at an alpha, so it composites over whatever is
behind it: white, a glass fill, a photograph. On a calm picture the rungs sit
where the old greys did; on a busy one they climb, take a shadow, and the bare
zone flips to the other ink.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-legibility/ladder-tahoe.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The lab's bare specimen on Tahoe in the light theme: dark ink, the four rungs stepping down evenly, and an injected line in the old fixed grey that sits close to the secondary rung." />
  <img src="/img/docs/system-legibility/ladder-zebra.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same specimen on Zebra in the light theme: the zone has flipped to light ink with a dark drop shadow, the rungs still step down and read; the fixed-grey line is lost on the stripes." />
</div>

The bare specimen of `/lab/legibility` on Tahoe (calm, `edges` 0.018) and on
Zebra (the busiest picture, 0.124), both in the light theme. The last line,
`oklch(0.556)`, the old secondary grey, is injected for this screenshot. On
Tahoe it sits next to `muted-foreground`, which is the point: the ladder
looks the same where the page used to be right. On Zebra the ladder flips to
the light ink, its secondary rung climbs from 54 % to 88 % (ink boost +14,
bare boost +20), and the relief is a dark drop; the fixed grey belongs to
neither ink and goes under.

The palette was grayscale: black text on white, white text on `#1a1a1a`, and
between them a few fixed greys: `oklch(0.556)` for secondary text,
`oklch(0.97)` for a hover wash, `oklch(0.922)` for a border. Each grey was a
*pre-computed alpha*: the colour black-at-53% happens to be on white. That
holds while the page is only ever white or near-black. A wallpaper and clear
glass break it: a fixed grey ignores what is behind it, so it disappears over
a mid-tone sky and glares over a dark sea.

## How it works

Three layers, from static to live:

```
scripts/wallpaper-profile.ts       measure every wallpaper once  →  wallpaper-profiles.json
systems/ambient/lib/legibility.ts  policy: profile → CSS variables on <html>   (pure, cheap)
app/globals.css                    the ladder: variables → every token         (no JS)
```

### 1. Ink at an alpha (`globals.css`)

Every text and wash token is `--ink` at a percentage:

| Token | Is | Light | Dark |
|---|---|---|---|
| `--foreground` | the ink | `oklch(0.145)` | `oklch(0.93)` |
| `--reading-foreground` | ink at `--ink-alpha-reading`, for running text rather than labels | 85 % | 85 % |
| `--muted-foreground` | ink at `--ink-alpha-secondary` (+ boost) | 54 % | 60 % |
| `--tertiary-foreground` | ink at `--ink-alpha-tertiary` (+ boost) | 32 % | 36 % |
| `--quaternary-foreground` | ink at `--ink-alpha-quaternary` (+ boost) | 20 % | 22 % |
| `--muted`, `--secondary` | ink at `--wash-alpha-muted` | 4 % | 6 % |
| `--accent` | ink at `--wash-alpha-accent` (+ tint) | 7 % | 10 % |
| `--border`, `--input` | ink at `--wash-alpha-border` | 9 % | 10 % |
| `--ring` | ink at `--ink-alpha-ring` (+ tint) | 45 % | 45 % |
| `--ink-line` | the line under text (a link's underline); an input, written out (below) | 40 % | 40 % |

"+ boost" is `--wp-ink-boost`, plus `--wp-zone-boost` in a bare zone, plus
`--wp-lift-*` on a reading route (the quaternary rung takes no lift).

`text-muted-foreground`, `bg-muted/50`, `border-border/50` and
`hover:bg-accent/25` all work, and Tailwind's `/NN` modifier multiplies an
alpha rather than fading a grey. On a wash that is fine. On *text* a
modifier is a rung of its own that scales the wallpaper boost down with it,
so text picks a rung instead: `text-tertiary-foreground` (captions,
timestamps) and `text-quaternary-foreground` (separators) complete Apple's
ladder. The alphas were chosen to land within a channel or two of the old
greys on the plain page, so the site looks the same where it used to be
right and follows the backdrop where it used to be wrong. `bg-ink/5` is a
wash on anything.

**Lines under text are the one rung that is not mixed.** Every other token is
a `color-mix()` of the ink. Safari paints those in `color`, fills and
borders, but not in `text-decoration-color`, where a mixed colour is not
drawn at all: an underline written as `decoration-<token>/NN` is invisible
on an iPhone. So `--ink-line` is an input: the ink at 40 % written out per
theme (`--ink-line-theme` / `--ink-line-inverse`), swapped by a flipped zone
the way `--ink` is. `decoration-ink-line` is how an underline is written:
the article's links, a magic link (`.prose-link`), the greeting, the prompt
page, the languages chart. Being written out, it takes no wallpaper boost: a
line under text is decoration on the text's own rung.

![Inputs on :root and .dark, and the wallpaper inputs on html, feed THE LADDER block, which mixes each text and wash token from --ink; utilities read the derived tokens; --ink-line bypasses the ladder. A flipped .ink-bare zone redeclares --ink, --ink-line and the relief primitives, and re-derives because it is in the ladder's selector list.](/img/docs/system-legibility/ladder.svg)

The tokens are derived in one block ("THE LADDER" in `globals.css`), declared
on `:root`, `.ink-scope` (a lab tile), `.ink-flip`, `.ink-bare` and
`.ink-bare-mid`. A custom property is computed where it is declared and
inherited as a value, so a zone that changes `--ink` must also be in that
selector list, or its `--muted-foreground` arrives already mixed from the
root's ink. The swap itself redeclares three things together: `--ink`,
`--ink-line`, and the relief primitives (`--relief-rgb`, `-a1`, `-a2`, `-y`,
`-b1`, `-b2`).

### 2. Profiles (`scripts/wallpaper-profile.ts`)

```bash
pnpm wallpapers:profile          # measure, write systems/ambient/lib/wallpaper-profiles.json
pnpm wallpapers:profile:check    # exit 1 if the table is stale (not in CI; run it by hand)
```

Every committed picture is sampled on a 96×60 grid in OKLab; the **Classic**
weather palettes (six conditions by day and night, plus sunrise and sunset)
are synthesised from their three colours onto the same grid, so a gradient's
profile is comparable to a photograph's. Per asset:

| Field | Meaning |
|---|---|
| `lum` | mean lightness, 0..1 |
| `zones.top/mid/bottom` | mean lightness of each third; the identifier and greeting sit in the top third |
| `mean` | mean colour, sRGB, for the lab's contrast estimate and the reading lift |
| `contrast` | standard deviation of lightness |
| `edges` | mean local gradient of lightness: **how busy**. A Classic gradient is about 0.001; Zebra is 0.124 |
| `chroma` | mean OKLab chroma |
| `tint` | dominant chromatic colour (chroma-weighted hue histogram, peak ± 1 bin), or null when grey |

A profile is a fact about a file. Adding a wallpaper means running the script
and committing the table; nothing else needs to know the picture exists.

The **Sky** and the **Gradient** are not files. Their scene is derived every
minute from the sun, the moon and the weather (`systems/ambient/lib/scene.ts`)
and the shader paints it. There is nothing to measure at build time and
nothing to sample at runtime: the scene already describes the picture.
`profileFromScene` (in `legibility.ts`) reads the same profile shape straight
off it: the veiled zenith, middle and horizon composited at the layer's
opacity for the three bands; cloud cover × density, precipitation, fog, stars
and lightning as `edges` for the Sky (the Gradient is smooth, so nil); the
middle band's OKLab chroma and hue as the tint. A few dozen multiplies; a
storm's Sky reaches about half of Zebra's busyness and gets relief and glass
fill accordingly. Classic keeps its measured table.

### 3. Policy (`legibility.ts`)

`resolveLegibility({ profile, theme, reading, veiled, policy })` returns these
numbers (`policy` defaults to `DEFAULT_LEGIBILITY_POLICY`). They are all the
runtime ever computes, memoised on what can change:

| Output | From | Lands in |
|---|---|---|
| `inkBoost` | `max(busy, 0.7·conflict) × 14` alpha points | `--wp-ink-boost`, added to the secondary, tertiary and quaternary alphas |
| `bareBoost` | `busy × 20` alpha points more, for bare zones only; 0 on reading routes | `--wp-bare-boost`, which `.ink-bare` / `.ink-bare-mid` take as their `--wp-zone-boost`. Nothing but the picture helps that text, so its rungs climb toward solid on a busy picture, as iOS paints Home Screen labels |
| `relief` | `max(need, busy × 0.85)`, where `need` grows as the ink-to-top-band gap shrinks below 0.55; × 0 on reading routes; under 0.1 → 0 | `--wp-relief`, scales the text shadow |
| `flip`, `flipMid` | per band (top for the header, middle for the app folder): the inverse ink clears the band by more than 0.15 more than the theme's ink, the light ink scored with a head start of `0.25 × √busy` because its drop is the stronger relief and a halo only fails on texture. At full busyness the light theme flips below ~0.59 and the dark theme flips back above ~0.74, while a calm mid-tone picture (the dew drop) keeps the theme's ink | `data-wallpaper-flip`, `data-wallpaper-flip-mid` |
| `glassAdd` | `busy × 14 + conflict × 22` fill points | `--wp-glass-add`, added to every glass fill (Clear takes all, Tinted half) |
| `veil` | `veilBase[theme] + busy × 0.15 + conflict × 0.15`, capped at 0.7 (base 0.32 light / 0.40 dark) | `--wp-veil`; the reading veil's alpha when Reading dim is on, under any kind (the Sky included) |
| `blur` | `28px + busy × 16px` | `--wp-blur`; the reading defocus radius when Reading blur is on (pictures only) |
| `tint` | the profile's tint clamped to L 0.50–0.66 (light) / 0.60–0.76 (dark), C 0.05–0.16; grey below chroma 0.03 | `--wp-tint-l/c/h` |
| `lift` | reading routes only: the alpha points secondary and tertiary need, on top of `inkBoost`, to reach 4.5:1 and 3:1 on the veiled picture (its mean and its worst band), capped at 80 % / 60 % so the rungs stay rungs | `--wp-lift-secondary`, `--wp-lift-tertiary` |

`busy` is `edges / 0.06`, clamped. `conflict` is how far the picture sits on
the wrong side of the card colour (a dark photograph under the light theme's
white card lands on mid grey, where dark ink has nothing to stand on): 0 at
lightness 0.62, 1 at 0.22 in the light theme; 0 at 0.45, 1 at 0.85 in dark.

The provider writes the outputs onto `<html>` in one effect (`applyLegibility`),
plus `data-wallpaper-kind` (`image` / `weather` / `none`),
`data-wallpaper-surface` (`desktop` / `reading`) and `data-wallpaper-relief`
(present only above zero). A write of what is already there is skipped.
Nothing re-renders; the stylesheet does the rest. On the plain page, the
weather gradient, a calm picture and every reading page the outputs are zero
and the text shadow is `none` (not a transparent shadow), so the main path
costs nothing it did not cost before.

### 4. Relief and flip

Relief is a `text-shadow` in two shapes, and the shape is a property of the
ink:

```css
/* light ink */  0 1px 3px rgb(0 0 0 / .6·r), 0 0 2px rgb(0 0 0 / .45·r)
/* dark ink  */  0 0 4px rgb(255 255 255 / .55·r), 0 0 3px rgb(255 255 255 / .3·r)
```

Each theme declares the pair for its own ink (`--relief-theme-*`: colour,
the two alphas, offset, blurs) and the pair for the inverse
(`--relief-inverse-*`); the ladder builds `--text-relief` from whichever an
element carries, so the one rule that flips a zone's `--ink` swaps its shape
in the same breath, and no selector ever asks "which theme, and is it
flipped?" twice.

`text-shadow` inherits as a computed value, so it is declared once per kind
of ground: `body` (the wallpaper) and the zones that change their inputs
(`.ink-bare`, `.ink-bare-mid`, `.ink-scope`); the `bg-glass` /
`bg-glass-strong` classes and their hovers (× `--glass-relief-k`: 0.3 on
Tinted, 1 on Clear); and `bg-glass-overlay` / `-sheet` / `-popover`
(× `--glass-relief-solid-k`: 0 on Tinted, 0.5 on Clear). `.ink-flat` opts
an element out.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-legibility/relief-on.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="Secondary, tertiary and quaternary in light ink over Zebra's stripes with the dark drop shadow: the words on the white stripe keep a dark edge." />
  <img src="/img/docs/system-legibility/relief-flat.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same lines with .ink-flat: on the white stripe the letters of tertiary and quaternary dissolve into it." />
</div>

The flipped ladder on Zebra with relief at 0.85 (left) and the same zone with
`.ink-flat` added (right), enlarged. Look at "tertiary" and "quaternary"
where they cross the white stripe: with the drop the letters keep an edge;
without it they melt into the fur. `.ink-flat` is for text that brings its own ground (an inverted chip,
code), never for text on the picture.

Only bare zones flip: `.ink-bare`, decided on the picture's top band (the
home screen's header, plus the sky's hints, pull cue and settle spinner);
and `.ink-bare-mid`, the app folder at rest (the labels under the icons),
decided on its middle band. Nothing is behind either but the picture. Under
`data-wallpaper-flip` / `data-wallpaper-flip-mid` the zone swaps `--ink` for
`--ink-inverse`, re-derives its ladder, and picks the other relief shape.
The comparison is not symmetric: light text carries a dark drop, dark text a
white halo, and a drop reads on far more grounds (Aqua and the Lock Screen
both reach for white-with-shadow over a photograph), so `dropBias` gives the
light ink a head start that grows with busyness (a halo only fails on
texture). Busy mid-tone pictures (the stones, the zen garden) therefore go
light in the light theme rather than dark-with-halo, while a calm one (the
dew drop) keeps the theme's ink. Glass surfaces never flip: they carry the
card colour, so their ink was already right. They *adapt* through `glassAdd`
instead, which is Liquid Glass's distinction between small elements and big
ones. A zone that grows glass on demand stops being bare with it: the folder
drops `.ink-bare-mid` while editing, and `.ink-bare-rest` un-flips it under
the hover glass on a hover-capable pointer.

### 5. Typography roles (`lib/typography.ts`)

Roles are the recurring recipes in `lib/typography.ts`: each `TYPE.*` is one
class string (size, family, tracking) pinned to a rung of the ladder, which
production components and the lab's specimens both import. The full role →
rung map lives in [design-system.md → Roles](./design-system.md#roles); the
rules that decide which rung a role sits on are below.

The shared string is the alignment guarantee the lab rests on: the specimen's
date and the writing widget's date are `TYPE.rowMeta`, one string, so the two cannot
diverge, however either is componentised. The lab deliberately mounts no
production component; a second rendering of the site would be a second thing
to keep in step. Anything a role does not cover is written inline at the call
site and, when it recurs, promoted into `lib/typography.ts`.

#### The rungs, by rule

- **Reading** (`reading-foreground`, `TYPE.reading`): running text, such as an
  article's body, a /prompt entry's reasoning, the voices under a statement.
  Reading content keeps a hierarchy of its own: what hangs off the prose (a
  /prompt entry's instances, an influence's one-line context, a citation's
  source) stays a rung below it, on secondary. Text read line after line is
  not a label, and Apple sets it in the label colour, not the secondary one.
  The label rungs are tuned for chrome: a paragraph on secondary is 4.3:1 on
  white and about 3.5:1 on a veiled wallpaper, where the same paragraph on
  this rung is about 7.
- **Secondary** (`muted-foreground`): text that is the information where it
  stands: a section label, an article's header line, a description.
- **Tertiary** (`tertiary-foreground`): text that annotates a neighbour: the
  date beside a title, a subtitle under it, a caption, a life event in the
  timeline, an inactive filter, an icon link at rest.
- **Quaternary** (`quaternary-foreground`): only what carries no information of
  its own: separators (`·`, `@`), the hash column (`TYPE.hash`), placeholder
  glyphs, prose line numbers, hover-revealed chevrons. It is nearly invisible
  over a picture, which is right for decoration and wrong for text: language
  badges, the works meta line, event rows, tag rows, stats and the like sit
  on tertiary. It takes the full wallpaper boost.

Mono metadata therefore sits on two rungs by one rule, not two: beside a
title it annotates (`rowMeta`, tertiary); standing alone it is the
information (`meta`, secondary).

#### Decisions

Settled: palette group headings use `TYPE.label` (mono, like every other
section label); labels are set as written, not in capitals, because
lowercase mono is already the machine layer's voice (`jul 2020`, `retry`,
`cd ~`), and capitals were a second, louder one over it (the devtool keeps
its own readout voice). `/writing` prints provenance (译 / 知乎) as `rowMeta`
words and does not badge `featured`.

Still open, and reproduced verbatim in the lab:

1. **Three label sizes.** Widget labels are `text-xs`; the wallpaper sheet's
   section labels are `text-[11px]`; caption strips and the sheet's capsule are
   `text-[10px]`. The roles keep two (`label`, `labelSm`); the 11px sheet
   labels are not migrated and could go either way.

### 6. The reading treatment

A photograph behind a 680px prose column is a competing figure, so every route
but the home screen recedes it: a veil of the page colour over the picture and
a defocus under it (`docs/system-glass.md`, *Reading surfaces*). Both are
policy outputs per wallpaper: Zen Garden's raked sand gets more veil and more
blur than Tahoe's gradient, and Earth under the light theme gets the
tone-conflict share on top. The two devtool switches (`Reading blur`,
`Reading dim`; settings `wallpaperReadingBlur` / `wallpaperReadingDim`)
decide *whether*; the policy decides *how much*.

**The lift.** Apple's ladder is tuned for an opaque ground: on white the
secondary rung is 4.3:1 and the tertiary 2.2:1. A reading column's ground
is the picture through a veil, a few points worse. So on a reading route each
label rung is lifted to a target contrast on the ground it will actually sit
on (`readingLift` in `legibility.ts`): the profile has the picture's mean
colour and its bands' lightness, the veil is ours, and the defocus is what
makes the mean honest: at 28px and up a line of text sits on a region's
average rather than its detail. It is arithmetic; nothing is sampled. The
lift stops at a ceiling per rung (80 % / 60 %): a secondary rung lifted to the
ink is not a rung, and where the target needs more than that, the ground is
what is wrong and the veil is what should change. The plain page lifts too:
tertiary on white needs about 12 points to reach 3:1.

The lab's **reading specimen** is its own surface: it defocuses and veils the
wallpaper behind it at the policy's numbers and carries the policy's reading
resolution (no flip, relief × `reliefReading`), so the dim, the blur and the
rungs are judged on the wallpaper they will sit on, on the same page as the
desktop specimens. A real route is checked by opening it.

### 7. Tint

The neutral baseline is grey by construction: `--tint` is the profile's
colour, and `--tint-glass` / `--tint-accent` are the amounts, both 0. The
**Tint: Wallpaper** setting (Glass module, `useGlass().setTint`, stored under
`hux_glass_tint`) sets `data-tint="wallpaper"` on `<html>`, which raises them to
14 % on the glass base and 28 % on the accent wash, ring included. Ink stays
neutral: "apply color to the background rather than to symbols or text". A
grey wallpaper yields a grey tint, so the setting changes nothing where there
is nothing to borrow.

## Rules

Constraints, and what breaks without them:

| Rule | Why / what breaks |
|---|---|
| Text picks a rung; never `text-<token>/NN` | A modifier multiplies the rung, wallpaper boost included, so the text sinks exactly where it needs the boost. |
| Underlines are `decoration-ink-line`; never `decoration-<token>/NN` | Safari draws no `color-mix()` in `text-decoration-color`: the line is invisible on an iPhone. |
| No fixed greys (`oklch(0.556)`, `text-neutral-500`) for text or washes | A fixed grey is an alpha for one backdrop; on a picture it is no alpha at all (first figure). |
| A zone that changes `--ink` is in THE LADDER's selector list and redeclares `--ink-line` and the `--relief-*` primitives with it | The derived tokens are inherited as finished colours; without re-derivation the zone keeps the root's greys, a dark underline and the wrong shadow shape. |
| Text with nothing but the picture behind it is in `.ink-bare` (top of the page) or `.ink-bare-mid` (mid-page) | Only those zones get the bare boost and the flip. Outside them, light-theme text over a dark photograph stays dark. |
| A bare zone that grows glass stops being bare (drop the class, or `.ink-bare-rest` for hover glass) | Glass carries the card colour; a flipped ink on it is the wrong ink. |
| Keep `INK_LIGHTNESS`, `INK_ALPHA` and `INK_RGB` in `legibility.ts` in step with `--ink` and `--ink-alpha-*` in `globals.css`; keep `--ink-line-*`'s lightness in step with `--ink` | The flip and the reading lift compute from the TS copies; the stylesheet paints from the CSS. A change to one alone makes the policy reason about a ladder that is not on screen. |
| After adding or re-encoding a wallpaper, `pnpm wallpapers:profile` and commit the JSON | A picture with no profile gets no boost, relief, flip or tint. Nothing in CI catches a stale table. |
| The relief rule keys on `data-wallpaper-relief`, not on a zero strength | At zero the shadow must be `none`, not a transparent shadow, or every text node rasterises one on the plain page. |

Free choices: every number in `DEFAULT_LEGIBILITY_POLICY` and every
`--ink-alpha-*`, `--wash-alpha-*`, relief and glass-fill input is a taste,
tuned in the lab. The roles' sizes and the open label-size question above
are taste too.

## The lab

**`/lab/legibility`** is `noindex`, reached from the `/lab` index, the home
screen's Lab widget, and the devtool's Glass module (the row that prints the
current `busy · relief · +boost · glass`). It is bilingual like the rest of
the site; its strings live beside it in `app/lab/legibility/i18n.ts`, not in
the visitor dictionary. Choosing a scene there selects it for real through
the same setters the picker and devtool use, and the sliders write the same
variables the provider and stylesheet already read. The scene it sets
(wallpaper, theme, material, tint) is the real setting, exactly as the picker
would have set it.

| Panel | What it turns |
|---|---|
| Scene | theme, material, tint, the weather style (Sky / Gradient / Classic) and every wallpaper: the six conditions by day and night plus sunrise and sunset, each a real scene at that hour for the visitor's coordinates, forced through the Sky module's own condition and clock overrides; **Live** returns to the real sky |
| Profile | the measured numbers for what is painting, read-only |
| Contrast | WCAG ratios of primary and secondary ink against the mean colour composited under each surface: bare top band, glass, sheet, reading veil |
| Policy | every knob of `LegibilityPolicy`, the reading ones in their own section; a star marks a value that differs from what ships and resets it |
| Resolved | the two flips and the outputs (ink boost, bare boost, relief, glass add, veil, blur, tint L/C/H), pinnable directly for this scene |
| Sheet | the stylesheet's own inputs: the alpha ladder, washes, relief shape, the current material's glass fills, tint amounts; defaults are read from the computed style, so the lab carries no second copy |
| Export | the JSON of everything changed, and the CSS of the sheet overrides, to paste into `DEFAULT_LEGIBILITY_POLICY` or `:root` |

The specimens (`specimens.tsx`) are composed from the typography roles and
the glass tokens, never from production components (see *Typography roles*
for why): a bare-text block, a widget, the Live Activity, the palette, a
sheet, and the reading surface.

Below the specimens, the **gallery** shows every wallpaper of a category at
once (weather 14, Apple 17, Nature 19), each tile an `.ink-scope` carrying
its own resolved variables. One policy slider moves every tile, and a
wallpaper that reads badly shows up in a row with the ones that read fine.
Weather tiles derive their scene at the tile's hour and paint the style's
CSS gradient; under the Sky that is the Gradient it falls back to, the same
palette without the shader's texture.

Tuning made in the lab **stays for the session**: the policy goes to the
provider (`labPolicy`), which resolves every route with it, and the sheet
overrides stay inline on `<html>`, so a veil tuned on the specimen can be
checked on the real `/writing` before it is copied into code. The devtool's
Glass row shows `· lab` while any of it is active; **Reset all** in the lab
clears it, as does a reload. What leaves with the page is everything the lab
forced through the devtool (the condition, the clock, the `full` placement
override, the devtool being on) and the pins (scene-specific by nature).

Every slider in the lab, the icon studio and the devtool is one component,
`components/ui/slider.tsx`: a thin track in ink at a few percent with the
travelled part in ink, and the platform's own thumb. iOS Safari's flat white
pill stays native, tinted white by `accent-color`; only a hover-capable
pointer gets a styled 16px white disc, because the native desktop knob is
small and grey on some engines.

## Adding things

- **A wallpaper:** follow `.claude/skills/wallpapers`, then
  `pnpm wallpapers:profile` and commit `wallpaper-profiles.json`.
- **A surface:** paint with a glass token and the ink tokens. It will follow
  the material, the tint, the boost and the relief without knowing any exist.
- **Text on the wallpaper itself** (nothing behind it): wrap it in `.ink-bare`
  (near the top of the page) or `.ink-bare-mid` (mid-page).
- **Text that must never carry a shadow** (an inverted chip, code): `.ink-flat`.
- **A new zone that swaps the ink:** add its selector to THE LADDER and to
  the flipped-ink rule (or reuse `.ink-flip`); see the diagram.
- **A number you want to try:** open the lab, move the slider, look, copy.
- **Looking at a wallpaper without the picker:** ⌘K → Wallpaper, or set
  `localStorage.hux_ambient_settings` to
  `{"wallpaperKind":"image","wallpaperId":"zebra"}` and reload (theme:
  `hux_theme`, material: `hux_glass`).

## Background: what Apple does

Two ideas, thirty years apart, carry the whole system.

**Label colours are ink at an alpha.** iOS's `label` / `secondaryLabel` /
`tertiaryLabel` / `quaternaryLabel` are near-black or near-white at 100 / 60 /
30 / 18 %; macOS's ladder is 85 / 50 / 25 / 10 % (dark-mode secondary is bumped
to 55 % because white at an alpha reads weaker). They are alphas *so that the
same semantic colour composites over white, over grouped grey, over a blurred
material*. Vibrancy is the same principle in blend modes: "regardless of the
material you choose, use vibrant colors on top of it."

**Text over a picture gets relief, or flips.** Aqua labelled desktop icons in
white with a dark drop shadow. The iOS Home Screen adds a shadow under labels
on a bright wallpaper and flips them to black on a light one; the Lock Screen
extracts the wallpaper's dominant colour for the clock. Liquid Glass makes it
a rule: small elements *flip* between light and dark with the content beneath;
bigger surfaces *adapt* but do not flip; the Clear variant "does not have
adaptive behaviors … it needs a dimming layer to darken the underlying content".

ryOS, which recreates Aqua, is the reference for the numbers: its Aqua Glass
menu bar samples the top 15 % of the wallpaper (threshold 0.62 luminance) and
swaps a dark drop under light text (`0 1px 3px .6, 0 0 2px .45`) for a white
halo under dark text (`0 0 4px .22, 0 0 3px .12`). Our halo is stronger
(`.55` / `.3`).

## Non-goals

No runtime sampling, no canvas, no `getImageData`. ryOS samples the wallpaper
live and caches; we have the files, so we measure them at build time and
commit the answer. A profile is thirteen numbers; the policy is a dozen
multiplies; the rest is CSS.
