# Glass

> The checklist form of this page is the glass bullet of the skill `.claude/skills/ui-tokens`.

The material every floating System UI surface is made of, and the one setting
that changes all of them at once. Also here: how the wallpaper recedes behind
a reading page.

## What it looks like done well

iOS 26 offers exactly two Liquid Glass materials, and so does this site, with
the same names in both languages (Apple's own, from Settings → Display &
Brightness → Liquid Glass):

| | English | 中文 | Fill |
|---|---------|------|------|
| Default | **Tinted** | **色调** | Enough card colour to read as a surface in its own right |
| | **Clear** | **透明** | A vibrancy wash: whatever is behind comes through as the colour |

Tinted is a surface with its own colour; Clear borrows the wallpaper's, so it
is not a more transparent Tinted. Under an image wallpaper the two look very
different. Over the plain background they are close, as they should be.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-glass/palette-tinted.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The command palette on a desk over the Sonoma wallpaper under Tinted: a pale, nearly white card; the wallpaper shows only as a faint wash behind the list." />
  <img src="/img/docs/system-glass/palette-clear.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same palette under Clear: the card takes the wallpaper's red and green, and the widgets behind it show through the blur." />
</div>

The ⌘K palette on a desk (`bg-glass-popover`) over Sonoma, Tinted then Clear.
Same surface, same blur, same text: only the fill changed, and the widgets
behind it changed with it.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-glass/sheet-tinted.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The command palette as a bottom sheet on a phone under Tinted: a near-opaque white sheet over the wallpaper." />
  <img src="/img/docs/system-glass/sheet-clear.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same sheet under Clear: the wallpaper's pink and green come through the whole sheet, and the widget text behind it is faintly visible near the bottom." />
</div>

The same palette on a phone, where it is a sheet (`bg-glass-sheet`). The
sheet is the most solid rung, 85 % on Tinted, and still drops to 46 % on Clear.

The blur stays ordinary `backdrop-blur` in both: no specular highlights, no lens
distortion, nothing pretending to be a physical pane.

## How it works

One class on `<html>`, swapping a handful of numbers. A material is seven of
them, and the roles are derived once:

![Two material blocks at the top, :root for Tinted and html.glass-clear for Clear, feed the ladder in app/globals.css; Tint: Wallpaper and the legibility system's --wp-glass-add feed it from the right. Below, each bg-glass token with its Tinted and Clear fill as a pair of bars, and the kind of surface it paints.](/img/docs/system-glass/tokens.svg)

The material picks the fill; the ladder turns each fill into a colour; the
table is which token goes on which kind of surface. Bars are the fill before
`--glass-add`, which only grows them.

```css
:root {
  --glass-fill: 50%;  --glass-fill-raised: 60%;  --glass-fill-panel: 70%;
  --glass-fill-popover: 75%;  --glass-fill-sheet: 85%;
  --glass-hover-step: 20%;  --glass-dark-add: 0%;
}
html.glass-clear      { --glass-fill: 20%; /* … Clear's numbers */ }
html.dark.glass-clear { --glass-dark-add: 6%; }

/* The ladder: declared once, on every element that can change an input. */
--glass: color-mix(in oklab, var(--glass-base) calc(var(--glass-fill) + var(--glass-add)), transparent);
/* …one line per role */
```

Two more things feed `--glass-add` and `--glass-base`, both from the
legibility system ([docs/system-legibility.md](./system-legibility.md)): a
busy or wrong-toned wallpaper adds fill (`--wp-glass-add`, the dimming layer
Liquid Glass Clear requires under text; Clear takes all of it, Tinted half,
by `--glass-add-k`), and the **Tint: Wallpaper** setting
(`data-tint="wallpaper"` on `<html>`) mixes the picture's colour into the
base at `--tint-glass: 14%`. Dark mode under Clear adds 6 points, which reads
as the same transparency as light.

Nothing re-renders to change material. `services/glass.tsx` toggles the
class; the `@theme` block maps each `--glass*` variable to a `--color-glass*`
so Tailwind has `bg-glass…`, and any surface that paints with one follows
along for free:

| Token | Surfaces |
|-------|----------|
| `bg-glass` / `bg-glass-hover` | Widget cards, the FAB, the Live Activity panel, the PiP bar, the 404 link, the app folder's hover |
| `bg-glass-strong` / `bg-glass-strong-hover` | The app folder while editing, the Done and Edit widgets pills, the theater's orbs, press washes (the FAB, the living surface's hover) |
| `bg-glass-overlay` | The lifted peek panel (`GLASS_PANEL`), the playback chrome's selected pill (`GLASS_PILL_FLAT`, `systems/theater/lib/chrome.ts`) |
| `bg-glass-popover` | The command palette on a desk, Ask's selection pill and placement menu |
| `bg-glass-sheet` | Every sheet and window (`SHELL` in `systems/surface/sheet.tsx`: the palette on a phone, Ask, the devtool, the wallpaper picker, playlists), the widget-picker menu, the raised playback pill (`GLASS_PILL`) |
| `GLASS_PANEL` (`lib/glass.ts`) | The lifted peek panel: `media-peek.tsx` and `magnetic-preview.tsx` |
| `GLASS_CAPSULE` (`lib/glass.ts`) | One line of chrome on `bg-glass`: Live Activity pills, the Dock's notice and count ball, minimized windows, the pinned /works and /prompt bars |

**Text on glass** needs nothing: the ink tokens are alphas, so they composite
with the fill. Under an image wallpaper the relief text-shadow lands on glass
at the material's strength: `bg-glass` and `bg-glass-strong` (and their
hovers) take `--glass-relief-k` (0.3 Tinted, 1 Clear); the solid rungs,
overlay, sheet and popover, take `--glass-relief-solid-k` (0 Tinted, 0.5
Clear).

## Rules

| Rule | Why | What breaks |
|---|---|---|
| A floating surface paints with a glass token, never `bg-card/NN` or `bg-popover/NN` | Only the tokens move with the setting | The surface stays an opaque slab beside washed-out neighbours when someone picks Clear. `no-restricted-syntax` in `eslint.config.mjs` makes it a lint error everywhere but `lib/glass.ts` |
| A recipe goes in `lib/glass.ts` only when more than one surface uses it | One-offs inline `bg-glass…`; shared ones must not drift apart | Two capsules a shade apart floating over each other, which reads as a lesser thing |
| No opacity modifier on a token, as a rule | The fill is the token's job; `/NN` multiplies it and hides the role | A surface that is neither rung. The page-wide veils are the exceptions: `THEATER_BACKDROP` (`bg-glass/80`) and the About veil (`bg-glass/70`) |
| Opaque `bg-card` / `bg-popover` (no `/NN`) is for things that are not floating glass | Menus from `components/ui`, a pressed pill's solid state | Nothing; the lint allows it |

## What is free to choose

- **The rung**, by what the surface is: a card or capsule
  is `bg-glass`, something lifted over it `-strong` or `-overlay`, a surface
  you read in `-sheet` or `-popover`.
- **The blur radius.** `backdrop-blur-sm` on the home cards, `-xl` on most
  chrome. At 20 % fill, whatever is legible behind a surface is legible
  through it on Clear, so a surface with text over text wants one.
- **Border and shadow.** `border-border/50` and `shadow-raised` /
  `shadow-overlay` are the usual pair; `GLASS_PANEL` leaves the shadow to the
  caller on purpose.

## Settings

| Where | How |
|-------|-----|
| Command palette | The `Glass: Tinted` row (toggles; the label shows the current material), or `/` then `G`. `Tint: Neutral` is `/` then `T` |
| Devtool | Glass module: segmented Tinted / Clear, and Tint: Neutral / Wallpaper |
| In code | `useGlass()` (`services/glass.tsx`) → `{ material, setMaterial, toggle, tint, setTint }` |

The material persists to `localStorage` under `hux_glass` and defaults to
Tinted; the tint under `hux_glass_tint`, defaulting to Neutral.

## Adding a surface

1. Paint it with a glass token from the table, usually with a `backdrop-blur-*`.
2. If another surface already has the same recipe, import it from
   `lib/glass.ts`; if yours is the second, move it there.
3. Look at it under Clear over an image wallpaper (devtool Glass module), in
   both themes.
4. `pnpm lint`.

## Reading surfaces

Orthogonal to the material: a photo behind a 680px prose column is a
competing figure.

| Route | Treatment |
|-------|-----------|
| `/` (and `/lab/legibility`, which simulates the reading page in a specimen) | **Full strength, sharp, untinted.** It *is* the content: the widgets are a springboard floating on a desktop. |
| Everything else | **Receded:** a veil of the page colour over the wallpaper, and a defocus under it if it is a picture. Full-bleed; no card, no radius, no boxed article. |

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-glass/home-desktop.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The home screen on a phone over Sonoma: the wallpaper sharp and at full strength behind the app icons and glass widgets." />
  <img src="/img/docs/system-glass/writing-reading.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The writing page over the same wallpaper: the picture defocused into soft colour fields and veiled lighter, the list of posts sitting on it without a card." />
</div>

The same wallpaper on `/` and on `/writing`. Home shows the picture; the
reading page veils and defocuses it, and the prose sits on it directly.

An image wallpaper paints at opacity 1, because a photograph someone chose,
shown at half strength, is only a washed-out picture. What varies is drawn
**over** it. How much veil and how much defocus are outputs of the legibility
policy per wallpaper (`veilBase` per theme, grown by busyness and tone
conflict; see [docs/system-legibility.md](./system-legibility.md)), tuned on
the reading specimen at `/lab/legibility`.

`systems/ambient/lib/reading-surface.ts` owns the predicate
(`isReadingSurface`). `wallpaper-background.tsx` draws the veil, a
`bg-background` layer at the policy's alpha, over every kind (the Sky and the
Gradient recede too). The blur is for a picture only, the one kind with
detail to defocus: it is painted on an inner element of each layer
(`gradient-stack.tsx`, radius `--wp-blur`) so the soft-edge mask on the layer
stays crisp and unscaled. Both parts are devtool switches (`Reading dim`,
`Reading blur`) because it is a taste call and the only way to settle one is
to look at it.

Neither the bezel nor soft edging is part of this treatment. Both belong to the
edge of the page, not the picture (see [Placement](./system-ambient.md#placement)).

## History

The token contract used to be a sentence: "every floating surface paints with
glass". It had become false for eleven of them (theater chrome, minimized
windows, the app folder, the commit embed, the 404 card and more), which all
stayed opaque when you switched to Clear. Prose cannot notice the twelfth, so
the lint rule replaced it.
