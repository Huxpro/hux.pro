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
| `/` | The photo stays **sharp**. It *is* the content — the widgets are a springboard floating on a desktop. |
| Everything else | The photo is **defocused behind a veil**, with an edge vignette that recedes it at the margins. Full-bleed; no card, no radius, no boxed article. |

`lib/reading-surface.ts` owns that one predicate; `wallpaper-background.tsx`
applies the blur and the vignette. The weather gradient needs none of it — it
has no detail to compete with.
