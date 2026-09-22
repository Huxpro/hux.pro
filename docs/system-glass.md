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

One class on `<html>`, swapping a handful of numbers. A material is seven of
them, and the roles are derived once:

```css
:root {
  --glass-fill: 50%;  --glass-fill-raised: 60%;  --glass-fill-panel: 70%;
  --glass-fill-popover: 75%;  --glass-fill-sheet: 85%;
  --glass-hover-step: 20%;  --glass-dark-add: 0%;
  --glass: color-mix(in oklab, var(--glass-base) calc(var(--glass-fill) + var(--glass-add)), transparent);
  /* …one line per role */
}
html.glass-clear      { --glass-fill: 20%; /* … Clear's numbers */ }
html.dark.glass-clear { --glass-dark-add: 6%; }
```

Two more things feed `--glass-add` and `--glass-base`, both from the
legibility system ([docs/system-legibility.md](./system-legibility.md)): a
busy or wrong-toned wallpaper adds fill (`--wp-glass-add` — the dimming layer
Liquid Glass Clear requires under text; Clear takes all of it, Tinted half),
and the **Tint: Wallpaper** setting mixes the picture's colour into the base.

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

**Text on glass** needs nothing: the ink tokens are alphas, so they composite
with the fill, and under an image wallpaper the relief text-shadow lands on
`bg-glass*` surfaces at the material's strength (`--glass-relief-k`).

## Selection

The one surface that is *not* made of this material: the chip that says "this
one" — the lifted pill in a segmented control, the lit button in a transport
cluster.

iOS keeps a single rule in its segmented control and its tab bar, and keeps it
in both themes: **the selected thing is the lighter thing.** White pill on a
grey track in light; grey pill on a near-black track in dark. Nothing else in
either control carries the state — no accent colour, no outline — so the moment
the chip goes the other way, the control is lying about which one you picked.

Ours did, in dark mode, everywhere: the album tabs on the Talks widget, the
play button in the music widget and its Live Activity, the surface switch in
the theater and PiP. The cause was upstream of any one of them. A glass role is
built from `--card`, and in this theme `--card` (0.19) is *darker* than the page
(0.2178), so the chip came out as the darkest thing in a control whose track was
`white/8%` — a hole punched in the track rather than a tile lifted off it.

So selection gets its own three tokens, and they are built from white in both
themes:

| Token | For |
|-------|-----|
| `bg-selected` | The pill on a raised track (theater, PiP, Live Activity) |
| `bg-selected-flat` | The pill on a flat track (home widgets), at rest |
| `bg-selected-lit` | The same pill while its track is hovered or pressed |

`--select-fill` / `-flat` / `-lit` are the per-theme numbers (globals.css). In
light they are the sheet / panel / card fills the chips already painted with, so
light mode did not move; in dark they drop to alphas, because white at 85% over
a dark track is a slab, not a lift. White at 22% over the raised track lands at
`#5a5a5a` against its `#2c2c2c`, which is within a point or two of iOS's own
dark pair.

Two things these tokens deliberately do **not** do and one they do:

- They do not thin out with Clear. Selection is a relationship, not a material:
  the pair (track, chip) has to keep its contrast step whatever the setting is.
  The tracks are fixed alphas already (`GLASS_TRACK` in
  `systems/theater/lib/chrome.ts`), so a chip that thinned would only drift
  toward its track and blur the answer.
- They do not follow the ink ladder into a flipped zone. Like every other
  surface here, the lift direction is toward light in both themes.
- They do take `--glass-add` and `--tint-glass`. The first only ever *adds*
  fill — the dimming a busy wallpaper needs — so it pushes the chip the way
  selection already wants to go; the second is colour, not contrast.

**Adding a control:** a selected chip must not reach for `--card`, `bg-black/*`,
or any other fill that sinks. If it needs a fourth depth, add a fourth
`--select-fill-*` rather than borrowing a glass role.

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
| Devtool panel | Glass module — segmented Tinted / Clear, and Tint: Neutral / Wallpaper |
| Anywhere in code | `useGlass()` → `{ material, setMaterial, toggle }` |

The choice persists to `localStorage` under `hux_glass` and defaults to Tinted;
the tint under `hux_glass_tint`, defaulting to Neutral (`Tint: …` in ⌘K).

## Reading surfaces

Orthogonal to the material, and only relevant under an **image** wallpaper: a
photo behind a 680px prose column is a competing figure.

| Route | Treatment |
|-------|-----------|
| `/` | **Full strength, sharp, untinted.** It *is* the content — the widgets are a springboard floating on a desktop. |
| Everything else | **Defocused behind a veil.** Full-bleed; no card, no radius, no boxed article. |

An image wallpaper paints at opacity 1 — showing a photograph someone chose at
half strength is not restraint, it is a washed-out picture — so what varies is
drawn **over** it. How much veil and how much defocus are outputs of the
legibility policy per wallpaper (`veilBase` per theme, grown by busyness and
tone conflict; see [docs/system-legibility.md](./system-legibility.md)) and
are tuned in the lab with **Surface: Reading**, which applies them to the lab
page itself.

`lib/reading-surface.ts` owns the predicate. The blur is painted on an inner
element of each layer (`gradient-stack.tsx`) so the soft-edge mask on the layer
stays crisp and unscaled, and `wallpaper-background.tsx` draws the veil over the
stack. Both parts are devtool switches (`Reading blur`, `Reading dim`) because it
is a taste call and the only way to settle one is to look at it. The weather
gradient opts out entirely — it has no detail to compete with.

Neither the bezel nor soft edging is part of this treatment. Both belong to the
edge of the page, not the picture — see [Placement](./system-ambient.md#placement).
