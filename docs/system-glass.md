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
| Home scrim (`Dim home`, off by default) | 0.08 | 0.14 |
| Reading veil | 0.28 | 0.34 |
| Reading vignette, at the far edges only | 0.22 | 0.28 |

The reading numbers are deliberately well under the ~0.45/0.55 this idea usually
gets built with, because **the blur is what protects legibility** — the veil
only has to stop the remaining colour from shouting. Spend it there and the
wallpaper survives the trip to an inner page instead of turning grey.

The home scrim is a different quantity, not a weaker application of the same
one: a whisper that takes the edge off a loud wallpaper. Wiring both to one
value made "dim home" mean "make home look like a reading page", which is not
what anyone wants from it.

`lib/reading-surface.ts` owns the predicate; `wallpaper-background.tsx` applies
the blur, the veil and the vignette. All three parts are devtool switches
(`Dim home`, `Reading blur`, `Reading dim`) because it is a taste call and the
only way to settle one is to look at both. The weather gradient opts out
entirely — it has no detail to compete with.
