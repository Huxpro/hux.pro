# Glass

The material every floating System UI surface is made of.

## Two materials

iOS 26 offers exactly two Liquid Glass materials, and so do we — same names, in
both languages (Apple's own, from Settings → Display & Brightness → Liquid
Glass):

| | English | 中文 | Fill |
|---|---------|------|------|
| Default | **Tinted** | **色调** | Enough card colour to read as a surface in its own right |
| | **Clear** | **透明** | A vibrancy wash — whatever is behind comes through as the colour |

Clear is not "more transparent Tinted". It is the difference between a surface
that has its own colour and a surface that borrows the wallpaper's. Under an
image wallpaper the difference is the whole point; over the plain background it
is subtle, which is correct.

The blur stays ordinary `backdrop-blur` in both: no specular highlights, no lens
distortion, nothing pretending to be a physical pane.

## How it works

One class on `<html>`, swapping CSS variables:

```css
:root       { --glass: color-mix(in oklab, var(--card) 50%, transparent); … }
html.glass-clear { --glass: color-mix(in oklab, var(--card) 20%, transparent); … }
html.dark.glass-clear { /* a touch more fill at the same perceived transparency */ }
```

Nothing re-renders to change material. Any surface that paints with a glass
token follows along for free:

| Token | For |
|-------|-----|
| `bg-glass` / `bg-glass-hover` | Widget cards, the FAB, living surfaces |
| `bg-glass-strong` / `-hover` | Live Activity pills |
| `bg-glass-overlay` | Live Activity panels |
| `bg-glass-sheet` | Adaptive surfaces (picker, playlist) |
| `bg-glass-popover` | Command palette, devtool panel |

**Adding a surface:** use a glass token instead of `bg-card/NN`. That is the
whole contract — a surface that hardcodes its own alpha simply won't respond to
the setting, which is the bug this system exists to prevent.

## Triggers

| Surface | How |
|---------|-----|
| Command palette | `Glass: Clear` (⌘K), or `/` then `G` |
| Devtool panel | Glass module — segmented Tinted / Clear |
| Anywhere in code | `useGlass()` → `{ material, setMaterial, toggle }` |

The choice persists to `localStorage` under `hux_glass` and defaults to Tinted.

## Reading surfaces

Orthogonal to the material, and only relevant under an **image** wallpaper: a
photo behind a 680px prose column is a competing figure.

| Route | Treatment |
|-------|-----------|
| `/` | **Full strength, sharp, untinted.** It *is* the content — the widgets are a springboard floating on a desktop. |
| Everything else | **Defocused behind a veil**, with an edge vignette that recedes it at the margins. Full-bleed; no card, no radius, no boxed article. |

The distinction is the point. An image wallpaper paints at opacity 1 — showing a
photograph someone chose at half strength is not restraint, it is a washed-out
picture — and the reading treatment is a veil *over* it rather than a dimming
*of* it.

| | Light | Dark |
|---|---|---|
| Wallpaper layer (image) | 1.00 | 1.00 |
| Home scrim (`Dim home`, on by default) | 0.08 | 0.14 |
| Reading veil | 0.28 | 0.34 |
| Reading vignette, at the far edges only | 0.22 | 0.28 |

The reading numbers are deliberately well under the ~0.45/0.55 this idea usually
gets built with, because **the blur is what protects legibility** — the veil
only has to stop the remaining colour from shouting. Spend it there and the
wallpaper survives the trip to an inner page instead of turning grey.

The home scrim is a different quantity, not a weaker application of the same
one: a whisper that takes the edge off a loud wallpaper and seats the widgets on
it rather than leaving them floating on raw artwork. Wiring both to one value
made "dim home" mean "make home look like a reading page", which is not what
anyone wants from it.

`lib/reading-surface.ts` owns the predicate; `wallpaper-background.tsx` applies
the blur, the veil and the vignette (the vignette's alpha arrives as the
`--wallpaper-vignette` custom property, so both strengths stay in
`lib/wallpaper.ts` with the rest of the numbers). All three parts are devtool switches
(`Dim home`, `Reading blur`, `Reading dim`) because it is a taste call and the
only way to settle one is to look at both. The weather gradient opts out
entirely — it has no detail to compete with.

## Light mode on a photograph

A light theme's ground is the **end** of its scale. Put a photo behind it and
the ground can only move one way — down — and the entire text ramp goes with
it. Measured on the home screen over Sonoma:

| | Ground | `--muted-foreground` |
|---|---|---|
| No wallpaper | rgb(255) | 4.74:1 |
| Light wallpaper | rgb(171) | **2.05:1** |
| Dark wallpaper (dark theme) | rgb(51 81 81) | 3.34:1 |

So the small text — app labels, dates, widget captions — simply stopped
existing in light mode, while dark mode was fine. Dark's ground is *already*
near its own extreme, and a dark wallpaper lands within a few points of it, so
the same tokens hold. This asymmetry is structural, not a tuning accident.

The fix is in the foreground, not the background. Bleaching the picture pale
enough to rescue a white-calibrated ramp costs the picture everything and still
lands short of AA; re-basing the ramp for the ground it is actually on costs
nothing visible and fixes it. The ambient provider puts `wallpaper-image` on
`<html>` whenever an image wallpaper paints full-page, and `globals.css` hangs
light-only overrides off it — a pair of **iOS vibrancy labels** taken from #96:

```css
--label:           oklch(0.2 0.016 260);   /* → foreground and friends */
--label-secondary: oklch(0.36 0.018 260);  /* → muted-foreground */
```

Not pure black: a label over glass picks up a trace of cool cast, and `#0a0a0a`
on a photograph reads as ink dropped on a print. The near-white `--border` /
`--input` / `--ring` hairlines go dark for the same reason a light surface
floating on a photo is edged by shadow rather than by a lighter line.

Result: **2.05:1 → 4.71:1** — full AA, on a ground the palette was never
designed for.

### Text with no card under it

The greeting and the springboard labels sit directly on the wallpaper. A token
re-base can only aim at the average ground, and a photograph has both bright
patches and dark ones, so these two need something more — but *not* more
shadow. A tight, opaque halo embosses the type and reads as a sticker; widening
and darkening it just turns it into a grey smudge box behind the word.

The greeting takes #96's **hero lift**, which is the shape that works: a
half-pixel white hairline separating the glyph edge, over a wide, faint bloom in
the page's own paper colour — the surface the text would have had if it had one.
Nothing about it touches the wallpaper.

```css
html.wallpaper-image:not(.dark) .ambient-hero {
  text-shadow:
    0 0.5px 0 color-mix(in oklab, white 50%, transparent),
    0 10px 32px color-mix(in oklab, var(--background) 40%, transparent);
}
```

The springboard labels turned out not to be a halo problem at all. They were
drawn in the *secondary* tier, and nothing at `0.36` survives landing on the
dark green of Sonoma's hillside. An app's name is not metadata, and on a photo
it has no card to sit on, so `.desktop-label` steps up to the primary label tier
and carries itself — which is what macOS does with desktop labels.

That leaves the shadow one job: separate the glyph edge from whatever pixel is
behind it. It has to stay **tight** — any blur wide enough to matter merges
between the glyphs and pools into a visible rectangle behind the word, which is
what 12px did. 2px does the job and cannot pool. It works in both themes,
because the paper colour it drops is white in light and near-black in dark.
