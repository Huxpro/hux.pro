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

A material is seven numbers on `<html>`; the roles turn them into colours, once:

```css
:root {
  --glass-fill: 50%;          /* an ordinary floating surface */
  --glass-hover-step: 20%;    /* one offset for every deepening */
  --glass-dark-add: 0%;
  --glass: color-mix(in oklab, var(--card)
           calc(var(--glass-fill) + var(--glass-dark-add)), transparent);
  --glass-hover: /* …fill + step + add */;
}
html.glass-clear      { --glass-fill: 20%; --glass-hover-step: 12%; … }
html.dark.glass-clear { --glass-dark-add: 6%; }
```

Dark Clear was always Clear plus six points on every token, so it is one number
now rather than a third copy of the ladder, and Clear sets only what a material
owns: how much colour each role carries.

Nothing re-renders to change material. Any surface that paints with a glass
role follows along for free:

| Role | Is | For |
|------|----|-----|
| `bg-glass` / `bg-glass-hover` | an ordinary floating surface | Widget cards, the FAB, living surfaces, the Live Activity |
| `bg-glass-raised` | one stacked above other glass | The open app-folder tile, a minimized window chip |
| `bg-glass-solid` | the most solid glass — legible over anything, and where rest and raised land under the finger | The Done chip over the board, the prev/next orb over video, the dark selected stamp |
| `bg-glass-panel` | a lifted panel | The Live Activity expanded, the selected pill |
| `bg-glass-popover` | a menu (over `--popover`) | Command palette, devtool panel, window menu |
| `bg-glass-sheet` | a sheet that owns the screen | Adaptive surfaces (picker, playlist) |

The names say what a surface **is**, not how opaque it happens to be. The old
ladder was numbered — `bg-glass-strong-hover` was the 80% rung — so three
resting fills painted themselves with a hover token and a recipe carried a
comment apologising that there was no 75% rung. A role can be retuned; a number
can only be renamed.

Class-string recipes — the frosted track, the lifted pill, the clustered
toolbars, their on-dark twins — all live in **`lib/glass.ts`**. They used to sit
in `systems/theater/lib/chrome.ts`, because playback chrome needed them first,
but the same material now carries the music Live Activity, the widgets and the
wallpaper picker's categories. One module, whoever paints with it.

## Fills and washes

A role is for a fill that *is* the surface. An **ink wash** is not: a recessed
track (`bg-foreground/[0.06]`), a hover deepening, a press. Those are drawn
relative to the content in front of them so they read on any card under either
material — a card-coloured fill at the same alpha would simply disappear — and
they stay raw. The same goes for a chip on artwork, which borrows the picture's
dark, and for the always-dark theater stage.

**Adding a surface:** use a glass role instead of `bg-card/NN`. That is the
whole contract — a surface that hardcodes its own alpha simply won't respond to
the setting, which is the bug this system exists to prevent.

And it is a *checked* contract, not a promise. This paragraph used to assert
that every floating surface already followed it, which had quietly become false
for eleven of them — theater chrome, minimized windows, the app folder, the
commit embed, the 404 card and more all stayed opaque slabs when you switched to
Clear. Prose cannot notice the twelfth, so `no-restricted-syntax` in
`eslint.config.mjs` bans, outside `lib/glass.ts`:

- `bg-card/` and `bg-popover/` — the alpha ladder the roles replaced;
- a raw `bg-white/`, `bg-black/`, `bg-foreground/` or `bg-neutral-N/` fill in
  the same class string as a `backdrop-blur`, because a blurred raw fill is a
  floating surface by definition. A wash that genuinely wants to be raw says so
  with a one-line `eslint-disable` and a reason;
- the retired `bg-glass-strong` / `bg-glass-overlay` names, which Tailwind would
  otherwise drop on the floor in silence.

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
