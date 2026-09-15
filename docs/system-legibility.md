# Legibility

How text stays readable on any wallpaper, under either glass material — and
the lab where every number in that sentence is a slider.

## The problem

The palette was grayscale: black text on white, white text on `#1a1a1a`, and
between them a few fixed greys — `oklch(0.556)` for secondary text,
`oklch(0.97)` for a hover wash, `oklch(0.922)` for a border. Each grey was a
*pre-computed alpha*: the colour black-at-53% happens to be on white. That
was fine while the page was only ever white or near-black.

Then the page became a wallpaper, and surfaces became glass. A fixed grey on a
photograph is no alpha at all: it is a paint chip that ignores what is behind
it, invisible over a mid-tone sky and glaring over a dark sea. Clear glass made
it worse — a 20% fill leaves text effectively on the picture.

## What Apple does

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
halo under dark text (`0 0 4px .22, 0 0 3px .12`).

## The system

Three layers, from static to live:

```
scripts/wallpaper-profile.ts      measure every wallpaper once  →  wallpaper-profiles.json
systems/ambient/lib/legibility.ts  policy: profile → six CSS variables      (pure, cheap)
app/globals.css                    the ladder: variables → every token       (no JS)
```

### 1. Ink at an alpha (`globals.css`)

Every text and wash token is now `--ink` at a percentage:

| Token | Is | Light | Dark |
|---|---|---|---|
| `--foreground` | the ink | `oklch(0.145)` | `oklch(0.93)` |
| `--muted-foreground` | ink at `--ink-alpha-secondary` (+ boost) | 54 % | 60 % |
| `--tertiary-foreground` | ink at `--ink-alpha-tertiary` (+ boost) | 32 % | 36 % |
| `--quaternary-foreground` | ink at `--ink-alpha-quaternary` (+ boost) | 20 % | 22 % |
| `--muted`, `--secondary` | ink at `--wash-alpha-muted` | 4 % | 6 % |
| `--accent` | ink at `--wash-alpha-accent` (+ tint) | 7 % | 10 % |
| `--border`, `--input` | ink at `--wash-alpha-border` | 9 % | 10 % |
| `--ring` | ink at `--ink-alpha-ring` (+ tint) | 45 % | 45 % |

`text-muted-foreground`, `bg-muted/50`, `border-border/50` and
`hover:bg-accent/25` all still work, and Tailwind's `/NN` modifier now
multiplies an alpha rather than fading a grey. But a modifier on *text* is
now a rung, not a tint: the ~160 `text-muted-foreground/NN` call sites (dates,
app labels, subtitles, hints) were migrated onto the ladder — `/75` and up to
`muted-foreground`, `/45`–`/70` to `tertiary-foreground`, below that to
`quaternary-foreground` — so each carries the wallpaper boost at its own
strength instead of multiplying it away. Do not write
`text-muted-foreground/NN` for new text; pick the rung. The alphas
were chosen to land within a channel or two of the old greys on the plain
page, so the site looks the same where it used to be right — and follows the
backdrop everywhere it used to be wrong. Two new utilities complete Apple's
ladder: `text-tertiary-foreground` (captions, timestamps) and
`text-quaternary-foreground` (watermarks). `bg-ink/5` is a wash on anything.

The tokens are derived in one block — "THE LADDER" in `globals.css` —
declared on `:root`, on a flipped `.ink-bare` zone and on a lab tile
(`.ink-scope`), because a custom property is computed where it is declared
and inherited as a value: a zone that changes `--ink` must redeclare what
depends on it.

### 2. Profiles (`scripts/wallpaper-profile.ts`)

```bash
pnpm wallpapers:profile          # measure, write systems/ambient/lib/wallpaper-profiles.json
pnpm wallpapers:profile:check    # CI: fail if the table is stale
```

Every committed picture is sampled on a 96×60 grid in OKLab; the **Classic**
weather palettes (six conditions by day and night, plus sunrise and sunset)
are synthesised from their three colours onto the same grid, so a gradient's
profile is comparable to a photograph's. Per asset:

| Field | Meaning |
|---|---|
| `lum` | mean lightness, 0..1 |
| `zones.top/mid/bottom` | mean lightness of each third — the identifier and greeting sit in the top third |
| `mean` | mean colour, sRGB, for the lab's contrast estimate |
| `contrast` | standard deviation of lightness |
| `edges` | mean local gradient of lightness: **how busy**. A gradient is 0.000; Zebra is 0.124 |
| `chroma` | mean OKLab chroma |
| `tint` | dominant chromatic colour (chroma-weighted hue histogram, peak ± 1 bin), or null when grey |

A profile is a fact about a file. Adding a wallpaper means running the script
and committing the table; nothing else needs to know the picture exists.

The **Sky** and the **Gradient** are not files. Their scene is derived every
minute from the sun, the moon and the weather (`lib/scene.ts`) and the shader
paints it — so there is nothing to measure at build time, and nothing to
sample at runtime either: the scene already *is* the description of the
picture. `profileFromScene` (in `legibility.ts`) reads the same profile shape
straight off it — the veiled zenith, middle and horizon composited at the
layer's opacity for the three bands; cloud cover × density, precipitation,
fog, stars and lightning as `edges` for the Sky (the Gradient is smooth, so
nil); the middle band's OKLab chroma and hue as the tint. A few dozen
multiplies, memoised on the scene; a storm's Sky reaches about half of
Zebra's busyness and gets relief and glass fill accordingly. Classic keeps
its measured table.

### 3. Policy (`legibility.ts`)

`resolveLegibility(profile, theme, reading)` returns eight numbers — all the
runtime ever computes, memoised on what can change:

| Output | From | Lands in |
|---|---|---|
| `inkBoost` | `max(busy, 0.7·conflict) × 14` alpha points | `--wp-ink-boost`, added to the secondary and tertiary alphas |
| `bareBoost` | `busy × 20` alpha points more, for bare zones only; 0 on reading routes | `--wp-bare-boost`, which `.ink-bare` / `.ink-bare-mid` take as their `--wp-zone-boost` — nothing but the picture helps that text, so its rungs climb toward solid on a busy one, as iOS paints Home Screen labels |
| `relief` | `max(need, busy × 0.85)`, where `need` grows as the ink-to-top-band gap shrinks below 0.55; × 0 on reading routes; under 0.1 → 0 | `--wp-relief`, scales the text shadow |
| `flip`, `flipMid` | per band (top for the header, middle for the app folder): the inverse ink clears the band by more than 0.15 more than the theme's ink, the light ink scored with a 0.25 head start because its drop is the stronger relief — so the light theme flips below ~0.59, the dark theme flips back above ~0.74 | `data-wallpaper-flip`, `data-wallpaper-flip-mid` |
| `glassAdd` | `busy × 14 + conflict × 22` fill points | `--wp-glass-add`, added to every glass fill (Clear takes all, Tinted half) |
| `veil` | `veilBase[theme] + busy × 0.18 + conflict × 0.2`, capped at 0.85 (base 0.45 light / 0.55 dark) | `--wp-veil`; the reading veil's alpha when Reading dim is on |
| `blur` | `40px + busy × 24px` | `--wp-blur`; the reading defocus radius when Reading blur is on |
| `tint` | the profile's tint clamped to L 0.50–0.66 (light) / 0.60–0.76 (dark), C 0.05–0.16; grey below chroma 0.03 | `--wp-tint-l/c/h` |

`busy` is `edges / 0.06`, clamped. `conflict` is how far the picture sits on
the wrong side of the card colour (a dark photograph under the light theme's
white card lands on mid grey, where dark ink has nothing to stand on): 0 at
lightness 0.62, 1 at 0.22 in the light theme; 0 at 0.45, 1 at 0.85 in dark.

The provider writes the outputs onto `<html>` in one effect (`applyLegibility`),
plus `data-wallpaper-kind` (`image` / `weather` / `none`),
`data-wallpaper-surface` (`desktop` / `reading`) and `data-wallpaper-relief`
(present only above zero). Nothing re-renders; the stylesheet does the rest.
On the plain page, the weather gradient, a calm picture and every reading
page the outputs are zero and the text shadow is `none` — not a transparent
shadow — so the main path costs nothing it did not cost before.

### 4. Relief and flip

Relief is a `text-shadow` in two shapes, chosen by the ink:

```css
--relief-drop: 0 1px 3px rgb(0 0 0 / .6·r), 0 0 2px rgb(0 0 0 / .45·r);   /* light ink */
--relief-halo: 0 0 4px rgb(255 255 255 / .55·r), 0 0 3px rgb(255 255 255 / .3·r); /* dark ink */
```

`text-shadow` inherits as a computed value, so it is declared once per kind
of ground: `body` (the wallpaper), the `bg-glass*` classes (× `--glass-relief-k`:
0.3 on Tinted, 1 on Clear) and the solid ones — sheet, popover, overlay — (× 0
on Tinted, 0.5 on Clear). `.ink-flat` opts an element out.

Only bare zones flip: `.ink-bare`, the home screen's header (the identifier
and greeting), decided on the picture's top band; and `.ink-bare-mid`, the app
folder at rest (the labels under the icons), decided on its middle band —
nothing behind either but the picture. Under `data-wallpaper-flip` /
`data-wallpaper-flip-mid` the zone swaps `--ink` for `--ink-inverse` and
re-derives its ladder, and picks the other relief shape. The comparison is
not symmetric: light text carries a dark drop, dark text a white halo, and a
drop reads on far more grounds (Aqua and the Lock Screen both reach for
white-with-shadow over a photograph), so `dropBias` gives the light ink a
head start and mid-tone pictures — the stones, the zen garden — go light in
the light theme rather than dark-with-halo. Glass surfaces never flip: they carry the card colour,
so their ink was right all along — they *adapt* through `glassAdd` instead,
which is Liquid Glass's distinction between small elements and big ones. A
zone that grows glass on demand stops being bare with it: the folder drops
`.ink-bare-mid` while editing, and `.ink-bare-rest` un-flips it under the hover
glass on a hover-capable pointer.

### 5. Typography roles (`lib/typography.ts`)

The ladder gives every text a rung; the roles give every *kind* of text its
whole recipe — size, family, tracking, rung — as one class string that
production components and the lab's specimens both import:

| Role | String | Where |
|---|---|---|
| `identifier` | mono xs tracking-wider secondary | λhux |
| `label` | mono xs uppercase tracking-wider secondary | widget titles, WEATHER, the sheet's section labels |
| `labelSm` | mono 10px uppercase tracking-wider tertiary | caption strips in peeks, tag rows |
| `labelWide` | mono xs uppercase tracking-wide secondary | a talk's venue under its title |
| `rowTitle` | sm ink | a post, a commit, a track in a list |
| `mediaTitle` | sm medium leading-snug ink | what is playing |
| `rowMeta` | mono xs tertiary | the date beside a row title, a topic line |
| `meta` | mono xs secondary | an article's header line, the artist, sun times |
| `hash` | mono xs quaternary | the hash column — the one mono role on the quaternary rung |
| `caption` / `captionQuiet` | xs secondary / tertiary, relaxed | a description under a title / an embed's blurb |
| `aside` | xs italic serif tertiary | commentary, a life event, "featured" |
| `body` | sm secondary relaxed | a widget's description, an empty state |
| `appLabel` | 11px leading-tight secondary | the label under an app icon |
| `nav` | mono xs tracking-wide secondary → ink on hover | the back link, `retry` |
| `linkQuiet` | tertiary → ink on hover | icon links that brighten on hover |
| `kbd` / `pill` | mono xs on `bg-muted/50` / mono 10px on `bg-muted` | keyboard hints / `featured`, `EN` |

That is the alignment guarantee the lab rests on: the specimen's date and the
writing widget's date are `TYPE.rowMeta`, one string, so the two cannot
diverge — however either is componentised. The lab deliberately mounts no
production component; a second rendering of the site would be a second thing
to keep in step. Anything a role does not cover is written inline at the call
site and, when it recurs, promoted here.

#### The rungs, by rule

- **Secondary** (`muted-foreground`): text that is the information where it
  stands — a section label, an article's header line, a description.
- **Tertiary** (`tertiary-foreground`): text that annotates a neighbour — the
  date beside a title, a subtitle under it, a caption, a life event in the
  timeline, an inactive filter, an icon link at rest.
- **Quaternary** (`quaternary-foreground`): only what carries no information of
  its own — separators (`·`, `@`), the hash column (`TYPE.hash`), placeholder
  glyphs, prose line numbers, hover-revealed chevrons. It is nearly invisible
  over a picture, which is right for decoration and wrong for text; the audit
  moved every informational use (language badges, the works meta line, event
  rows, author/role keys, tag rows, stats, the "featured" divider, the log's
  end marker) up to tertiary. It takes the full wallpaper boost.

Mono metadata therefore sits on two rungs by one rule, not two: beside a
title it annotates (`rowMeta`, tertiary); standing alone it is the
information (`meta`, secondary). `metaQuiet` is gone.

#### Decisions

Settled: palette group headings use `TYPE.label` (mono, like every other
section label); the works meta line and everything else informational left
quaternary (above); pills unified on `bg-muted`.

Still open, and reproduced verbatim in the lab:

1. **Three label sizes.** Widget labels are `text-xs`; the wallpaper sheet's
   section labels are `text-[11px]`; caption strips and the sheet's capsule are
   `text-[10px]`. The roles keep two (`label`, `labelSm`); the 11px sheet
   labels are not migrated and could go either way.
2. **The talks caption** is `tracking-wide`, widget labels `tracking-wider`.
   Kept as `labelWide`; it is a subtitle rather than a section label, and a
   hair tighter reads better under a title.

### 6. The reading treatment

A photograph behind a 680px prose column is a competing figure, so every route
but the home screen recedes it: a veil of the page colour over the picture and
a defocus under it (`docs/system-glass.md`, *Reading surfaces*). Both were one
number per theme; they are now policy outputs per wallpaper — Zen Garden's
raked sand gets more veil and more blur than Tahoe's gradient, and Earth under
the light theme gets the tone-conflict share on top. The two devtool switches
(`Reading blur`, `Reading dim`) still decide *whether*; the policy decides
*how much*. The lab's **reading specimen** is its own surface: it defocuses
and veils the wallpaper behind it at the policy's numbers and carries the
policy's reading resolution (no flip, relief × `reliefReading`), so the dim,
the blur and the rungs are judged on the wallpaper they will sit on, on the
same page as the desktop specimens — and the veil / blur sliders act on it
directly; a real route is checked by opening it.

Tuning made in the lab **stays for the session**: the policy goes to the
provider (`labPolicy`), which resolves every route with it, and the sheet
overrides stay inline on `<html>`, so a veil tuned on the specimen can be
checked on the real `/writing` before it is copied into code. The devtool's
Glass row shows `· lab` while any of it is active; **Reset all** in the lab
clears it, as does a reload. What leaves with the page is everything the lab
forced through the devtool — the condition, the clock, the `full` placement
override, the devtool being on — and the pins (scene-specific by nature); the
wallpaper, theme, material and tint it set are real settings, exactly as the
picker would have set them, and stay.

### 7. Tint

The neutral baseline is grey by construction: `--tint` is the profile's
colour, and `--tint-glass` / `--tint-accent` are the amounts, both 0. The
**Tint: Wallpaper** setting (Glass module, `useGlass().setTint`, stored under
`hux_glass_tint`) sets `data-tint="wallpaper"` on `<html>`, which raises them to
14 % on the glass base and 28 % on the accent wash, ring included. Ink stays
neutral — "apply color to the background rather than to symbols or text". A
grey wallpaper yields a grey tint, so the setting changes nothing where there
is nothing to borrow.

## The lab

**`/editor/legibility`** — hidden, `noindex`, linked from the devtool's Glass
module. Bilingual like the rest of the site; its strings live beside it in
`app/editor/legibility/i18n.ts`, not in the visitor dictionary. Not a mock: choosing a scene there selects it for real through the
same setters the picker and devtool use; the specimens are the production
components; the sliders write the same variables the provider and stylesheet
already read. The scene it sets (wallpaper, theme, material, tint) is the
real setting, exactly as the picker would have set it.

| Panel | What it turns |
|---|---|
| Scene | theme, material, tint, the weather style (Sky / Gradient / Classic) and every wallpaper — the six conditions by day and night plus sunrise and sunset, each a real scene at that hour for the visitor's coordinates, forced through the Sky module's own condition and clock overrides; **Live** returns to the real sky |
| Profile | the measured numbers for what is painting, read-only |
| Contrast | WCAG ratios of primary and secondary ink against the mean colour composited under each surface: bare top band, glass, sheet, reading veil |
| Policy | every knob of `LegibilityPolicy`; a star marks a value that differs from what ships and resets it |
| Resolved | the eight outputs (ink boost, relief, glass add, veil, blur, tint), pinnable directly for this scene |
| Sheet | the stylesheet's own inputs: the alpha ladder, washes, relief shape, the current material's glass fills, tint amounts — defaults read from the computed style, so the lab carries no second copy |
| Export | the JSON of everything changed, and the CSS of the sheet overrides, to paste into `DEFAULT_LEGIBILITY_POLICY` or `:root` |

The specimens are composed from the typography roles and the glass tokens,
never from production components (see *Typography roles* above for why): a
bare-text block, a widget, the Live Activity, the palette, a sheet, and the
reading surface.

Below the specimens, the **gallery** shows every wallpaper of a category at
once, each tile an `.ink-scope` carrying its own resolved variables — so one
policy slider moves forty tiles, and the wallpaper that reads badly is visible
in a row with the thirty-nine that read fine. Weather tiles derive their scene
at the tile's hour and paint the style's CSS gradient; under the Sky that is
the Gradient it falls back to, the same palette without the shader's texture.

Every slider in the lab, the icon studio and the devtool is one component,
`components/ui/slider.tsx`: a thin track in ink at a few percent with the
travelled part in ink, and the platform's own thumb — iOS Safari's flat white
pill stays native, tinted white by `accent-color`; only a hover-capable
pointer gets a styled 16px white disc, because the native desktop knob is
small and grey on some engines.

## Adding things

- **A wallpaper:** commit it as before (`docs/system-ambient.md`), then
  `pnpm wallpapers:profile`. Done.
- **A surface:** paint with a glass token and the ink tokens. It will follow
  the material, the tint, the boost and the relief without knowing any exist.
- **Text on the wallpaper itself** (nothing behind it): wrap it in `.ink-bare`
  (near the top of the page) or `.ink-bare-mid` (mid-page).
- **Text that must never carry a shadow** (an inverted chip, code): `.ink-flat`.
- **A number you want to try:** open the lab, move the slider, look, copy.

## Non-goals

No runtime sampling, no canvas, no `getImageData`. ryOS samples the wallpaper
live and caches; we have the files, so we measure them at build time and
commit the answer. A profile is twelve numbers; the policy is a dozen
multiplies; the rest is CSS.
