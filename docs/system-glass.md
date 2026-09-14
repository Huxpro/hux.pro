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
| `GLASS_PANEL` (`lib/glass.ts`) | The lifted peek panel, shared by two callers |

Class-string recipes — the frosted track, the lifted pill, the clustered
toolbars, their on-dark twins — all live in **`lib/glass.ts`**. They used to sit
in `systems/theater/lib/chrome.ts`, because playback chrome needed them first,
but the same material now carries the music Live Activity, the widgets and the
wallpaper picker's categories. One module, whoever paints with it; the eslint
rule ignores that file and nothing else.

**Adding a surface:** use a glass token instead of `bg-card/NN`. That is the
whole contract — a surface that hardcodes its own alpha simply won't respond to
the setting, which is the bug this system exists to prevent.

And it is a *checked* contract, not a promise. This paragraph used to assert
that every floating surface already followed it, which had quietly become false
for eleven of them — theater chrome, minimized windows, the app folder, the
commit embed, the 404 card and more all stayed opaque slabs when you switched to
Clear. Prose cannot notice the twelfth, so `no-restricted-syntax` in
`eslint.config.mjs` bans `bg-card/` and `bg-popover/` outside `lib/glass.ts`.

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
| Everything else | **Defocused behind a veil.** Full-bleed; no card, no radius, no boxed article. |

An image wallpaper paints at opacity 1 — showing a photograph someone chose at
half strength is not restraint, it is a washed-out picture — so what varies is
drawn **over** it. `WALLPAPER_READING_VEIL` in `lib/wallpaper.ts` holds the
per-theme alpha; the number lives there and is deliberately not copied here.

`lib/reading-surface.ts` owns the predicate. The blur is painted on an inner
element of each layer (`gradient-stack.tsx`) so the soft-edge mask on the layer
stays crisp and unscaled, and `wallpaper-background.tsx` draws the veil over the
stack. Both parts are devtool switches (`Reading blur`, `Reading dim`) because it
is a taste call and the only way to settle one is to look at it. The weather
gradient opts out entirely — it has no detail to compete with.

Soft edging is not part of this treatment. It is the same top/bottom fade the
weather gradient has always had, applied to whichever kind is painting — see
[Placement](./system-ambient.md#placement).
