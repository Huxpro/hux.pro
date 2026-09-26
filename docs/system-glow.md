# Glow & Voice

One light for the whole site, and the voice it can answer.

```
systems/glow/
├── lib/
│   ├── palette.ts      # the five stops — the only place a glow colour is written
│   ├── shader.ts       # the field of light on the edge of a rounded box
│   ├── renderer.ts     # one WebGL context, one rAF loop, every instance
│   └── ground.ts       # what the light is laid on: the picture and the surfaces, measured
└── components/
    ├── glow.tsx        # <Glow> — shape, motion, level, processing, reveal
    ├── edge-glow.tsx   # <EdgeGlow> — a screen's ring, ending where its content begins
    └── ground-bridge.tsx  # publishes the wallpaper's profile to ground.ts

systems/voice/
├── lib/meter.ts        # microphone → level + three bands (gate, knee, envelope)
└── use-voice-input.ts  # Web Speech API words + the meter, one press

systems/command/voice.tsx   # the palette's microphone, field glow, `/` `V`
app/editor/glow/            # the lab: every scale, one set of controls
systems/glow/lib/tuning.ts  # the devtool's knobs: strength, the About's strength and depth
```

## One light

The About rings the screen with Siri's glow. Once that existed, every other
place the site wanted to say *something is alive here* — a field listening, a
window loading — would either reuse it or
invent a second light that almost matches. Two lights that almost match read
as a mistake. So there is one:

- **one palette** (`lib/palette.ts`): blue · violet · pink · amber · cyan,
  around a loop. The shader's `ring()` is generated from it and the CSS
  fallback reads it as `--glow-stops`. A glow colour written anywhere else is
  a bug.
- **one shader** (`lib/shader.ts`): a field of light on the edge of a rounded
  box. Every glow is this shader over some box.
- **one renderer** (`lib/renderer.ts`): one WebGL context for the page.

## The shader

For each pixel the shader knows how far in from the box's rounded edge it
sits, and where around the edge it is; everything is built from those two
numbers.

| part | what it is |
|---|---|
| beams | four travelling waves around the ring, two each way, at harmonics 2 · 3 · 5 · 7, so their crests never line up the same way twice. A wave sets how far its light reaches in; the crests read as beams. |
| colour | the palette laid around the ring, drifting per beam so colours slide past each other, pushed back out from its luminance after averaging (further on a light ground). |
| core | a thin bright line on the edge itself, whiter on a dark ground and on a busy one. |
| halo | outside the box (`bleed`), a softer light spilling out — the bloom a small element needs. |
| falloff | `exp(-(d/reach)^1.45)`: steeper than exponential, because a plain `exp`'s long tail sums, across a small element, into a wash over its face. |
| corners | the beams' depth is a **smooth** minimum (log-sum-exp) of the four edges, blended once more with the true rounded outline. A hard minimum of the edge distances folds the light along each diagonal — a crease from every corner once the light reaches deeper than the corner's radius (a 10px screen corner under a 38px ring). The smooth one keeps the contours round at every depth, lets two edges' light add up at a corner, and still follows a round host's curve (an avatar, a phone's 44px corners). Softness follows the reach; the core line stays on the true outline, crisp. Without a `bleed`, nothing past the rounded outline is drawn (antialiased at the canvas's resolution): a rounded host is not lit past its curve. |
| focus | the ring narrowed to an arc (`uFocus`, `uFocusAt`). A **line** is the ring focused on one edge; **processing** is that arc gathered small and moving. |
| energy | `uLevel` (rest 0.45) lengthens every reach and brightens; `uBands` (low / mid / high) drive their own beams, so speech ripples rather than pumps. |
| reveal | the light arrives from the focus centre and spreads both ways, its front flaring, with a surge in reach as it lands. |

A **line** is laid along its edge rather than around the centre: an angle
swings fast near a wide box's middle and would fan the beams into rays, so
the line's beams and focus run along the edge (`sx`), its distance is measured
from that edge only, and its reach swells toward the focus centre so the light
rises as a dome — voice-glow's *bend*. `edge="top"` mirrors it.

## `<Glow>`

```tsx
<div className="relative rounded-2xl">          {/* the host: its radius is read */}
  …
  <Glow active={on} />                           {/* ring */}
  <Glow active={on} shape="line" level={voice.level} bands={voice.bands} />
  <Glow active={loading} shape="line" edge="top" processing />
</div>
<Glow active={open} fixed radius={screenRadius} />  {/* over the viewport */}
```

| prop | |
|---|---|
| `active` | on: sweeps in and stays; off: sweeps out, then costs nothing |
| `shape` | `ring` (the whole edge) or `line` (one edge) |
| `edge` | a line's edge: `bottom` (a field) or `top` (a loading bar) |
| `level` | 0–1, a number or a getter read every frame |
| `bands` | getter for low / mid / high, 0–1 each |
| `processing` | gather into a travelling beam: along the edge and back for a line, a comet around a ring |
| `motion` | how the light lives while on: `flow` (default), `rotate`, `pulse` — below |
| `period` | seconds per turn (rotate, 6) or per breath (pulse, 2.3) |
| `inside` | `false` draws only the halo past the edge — with a `bleed`, a light blooming out from behind the host |
| `baseline` | *advanced* — the light kept where no wave, arc or lobe is, 0–1 of the peak. Each motion has its own (`GLOW_BASELINE`: flow 0.176, rotate 0, pulse 0.12), which is what to use; pass it only to override |
| `reach` | px the light reaches in (its visible light runs ~3× further); sized to the host when omitted |
| `extent` | `{ x, y }` px where the light ends, off the left/right and top/bottom edges — `reach` in another unit (below); overrides it, blended smoothly round the corners |
| `bleed` | px of halo past each side |
| `radius` | px; read from the host (or 0 when `fixed`). Drawn into the light, not masked — the corners' blend follows it — so a change redraws at once (a held frame too). Pass the same source of truth the box's own corners come from: over the page, `useWallpaper().screenRadius`, the number `<Vitre>` draws the bezel with. |
| `strength` | 0–1 |
| `over` | the surface the light is laid on, when it is not the host (a fixed glow's veil) — its ground is read from it (below) |
| `fixed` / `layer` | over the viewport; a vitre bezel layer |

The glow is a `<span>` shown as a block, so it can sit inside a word (a badge
in a paragraph) as well as a card.

### Reach and extent

A glow's depth has two units. `reach` is the beams' scale: a beam at full
height is 1.7 reaches thick, and its light falls off as
`exp(-(d/thick)^1.45)`. `extent` is where the light visibly ends. They are
the same number, related by `GLOW_EXTENT_PER_REACH` (lib/shader.ts) — the
depth at which the brightest crest at rest falls to 2% opacity:

```
1 − exp(−1.15 · g) = 0.02   →  g = 0.01757
exp(−(d / 1.7)^1.45) = g    →  d = 1.7 · 4.041^(1/1.45) = 4.45 reaches
```

So a glow told to end at 152px has a 34px reach and looks exactly like one
given it; the window that makes the end exact (the last fifth of the extent,
where the light is already under 6%) only trims the tail. Change the beams'
thickness or falloff and the constant must follow.

## `<EdgeGlow>`

```tsx
<EdgeGlow
  active={open}
  content={[wordsRef, footRef]}   // what the light frames
  depth={1.3}                     // where it ends, as a share of the gutter
/>
```

A screen-sized ring has no natural depth: a fixed number of px is a sliver on
a desk and a flood on a phone, and a share of the screen ignores what the
ring is framing. An edge glow's depth is a share of the **gutter** — the room
between its edge and its content:

| | |
|---|---|
| `content` | a ref, or several (their union). Each counts as laid out at rest — every scrolling ancestor at its top — and clipped by it: a long article counts only the window it starts in, and scrolling it never changes the gutter (measured as it shows, an article scrolled up touches the screen's top and takes the light to nothing). |
| gutter `x` / `y` | the narrower of the left and right gutters / of the top and bottom ones, from the glow's own box (the viewport, or what `style` insets it to — a bezel's screen). Measured while on, again whenever a size changes, and kept for the way out. |
| `depth` | where the light ends: `0.5` halfway to the content, `1` just touching it, `1.5` its tail half a gutter over it. **A number** is a share of the narrower gutter, and the light stands as high off every edge — a ring's usual look, reaching the content first where it is nearest. **`{ x, y }`** takes each axis's own gutter, so the light follows the content's shape (x off the sides, y off the top and bottom). |

Everything else is `<Glow>`'s (`active`, `strength`, `radius`, `layer`,
`style`, `className`, durations). It is always `fixed` and always a ring.
With `{ x, y }` the extent eases from one axis's to the other's round each
corner.

## Ground

The light used to know one thing about what it is laid on: the theme
(`uDark`, 0 or 1). But under a glow is the theme's page or a wallpaper, under
whatever surfaces the host is — the About's veil at 70%, Clear glass at 20%,
a card, a wallpaper tint — and the light has to read on that. The
[legibility system](./system-legibility.md) answers the same question for
text, in the same two halves, and the glow borrows both (`lib/ground.ts`):

| half | what | from |
|---|---|---|
| the picture | lightness by third of the screen, and how busy it is | the ambient provider's profile — the wallpaper's, measured once, or the Sky's read off the scene, or the plain page's — and legibility's `busy`, published by `<GlowGroundBridge>` (`setGlowGround`) |
| the surfaces | what the host is made of | every ancestor's **computed** background colour from `over` (or the host) up to the page, composited front to back until opaque — so Tinted and Clear glass, a tint, a veil, a card are measured, not listed. A backdrop blur on the way down calms the picture's texture (× 0.4). The body and `<html>` are not surfaces: they paint the bezel, or the page the profile already describes |

A glow's ground is one lightness per edge (right, bottom, left, top): the
surfaces' lightness over the picture's at that edge's height (the thirds'
means as a line through their centres), by how much of it they cover; and
the picture's busyness, by how much of it shows. `uGround` and `uBusy` in the
shader:

- **lightness → compositing**, by degrees: `dark = 1 − smoothstep(0.3, 0.75, ground)`
  takes the place of the theme bit everywhere it was used — the colour push,
  the core line's whiteness, the halo, the light's overall weight. The
  theme's page is the two ends (white 1.0 → 0; `#1a1a1a` 0.22 → 1), so the
  plain page draws exactly as before; a veil over a picture lands anywhere
  between.
- **busyness → relief**, as text on a busy picture earns a shadow: the core
  line whiter (+0.25 × busy) and the light a touch heavier (+30% × busy).

Measured when something changes — the picture, anything on `<html>` (the
theme's class, the glass mode, legibility's variables: one
`MutationObserver`), the host's size, the light arriving — never per frame;
a change redraws a held frame. Each glow writes its ground on its box as
`data-glow-ground` (`right bottom left top · busy`), and the devtool's Glow
module shows the picture's thirds and busyness.

For the About's ring (`over` = its veil), measured:

| | ground (edges) | busy |
|---|---|---|
| Sky, dark, Tinted | 0.21 | 0.01 |
| Sky, light, Tinted | 0.68 | 0.01 |
| Sky, light, Clear | 0.59 — more of the sky shows, the light adds up more | 0.02 |
| Zebra, light, Tinted | 0.66–0.71 | 0.23 |
| Zebra, dark, Clear | 0.35–0.40 | 0.29 |

The wallpaper's tint is not used: the palette is the light's identity, and a
glow the colour of the wallpaper is no longer the site's one light.

## Motions

How the light lives while it is on. `flow` is the field this shader was
built as; `rotate` and `pulse` are Libraries.dev border-beam's two families,
and they are **built in layers** instead (`layered` in `lib/shader.ts`), as
border-beam builds them — its CSS is in `/editor/glow` beside ours (the
`border-beam` package, a lab-only dev dependency, MIT), each pair on the
same host in the same theme.

The first cut derived both from the flow — a window on the travelling
beams, the beams frozen and breathing — and read worse than the reference
for reasons no tuning could fix:

| | border-beam, and now ours | the first cut |
|---|---|---|
| what moves (rotate) | a lit arc sweeps a colour field that stays on the box — the colour changes as the light travels | the colours rode along with the arc: a lamp sliding, not light sweeping a rim |
| its shape (rotate) | a long tail behind, a shorter fade ahead, a narrow **spark** near the front (white on a dark ground, ink on a light one) and a hot point of bloom | a symmetric window: no head, no direction |
| layers | a crisp **1px stroke** (the definition — what a small element is recognised by), a soft **inner** glow (the body), a **bloom** past the edge (the atmosphere) | one falloff doing all three: muddy or invisible at a card's 3–4px |
| pulse | soft patches of colour — three lobes round the ring — lifted by each quarter's breath while the colour turns round (14 s) | the flow's beams frozen mid-travel: lumpy blotches pumping |
| strength | low and per theme: a light on the edge, not a frame | a saturated frame |

| motion | the light | says |
|---|---|---|
| `flow` | the field: four beams travelling, two each way | *hello*, *I hear you* |
| `rotate` | a lit arc (~40% of the ring) sweeping a fixed colour field at an even pace (`period`, 2 s a turn — border-beam's 1.96), the colours swaying a little; the spark at its head | *running* |
| `pulse` | the whole ring in three soft lobes, each quarter breathing on its own cosine clock (1 · 1.23 · 0.89 · 1.37 × `period`, 2.3 s), the colour turning round in 14 s | *now*, *waiting for you* |
| `pulse` + `inside={false}` + `bleed` | only the bloom past the edge — no opaque child needed, the shader draws nothing inside | *press me* — the About's Reveal on a first visit |

Where the light must end (an `extent` — the About's depth), the layers
honour it as the flow does: the inner glow is capped so its own tail has
faded to 2% by the window's start (depth ≤ 0.232 × extent, a breath scaling
within that), and the window only makes the end exact. Uncapped, a pulse
was still at a tenth of its strength when the window reached it, and the
light ended in a line across it rather than fading out.

On a screen the layers' body grows with the box (× up to 2.4 for the inner
glow): border-beam has no screen size to borrow from, and a card's strength
is lost across a whole screen. A light gathered into the processing comet,
and a line, are always the flow. Under reduced motion a rotation stands
still and a pulse holds a middling breath, drawn once.

### Baseline

What the light keeps where nothing is moving: under a flow's troughs,
outside a rotation's arc, between a pulse's lobes. It is the difference
between *a ring that is always there with activity on it* and *light only
where the activity is*, and each motion has the one that suits it:

| motion | baseline | what it means |
|---|---|---|
| flow | 0.176 | a beam's trough keeps 0.3 of the 1.7 reaches of its crest, and the core line rides on that: the solid rim under the waves |
| rotate | 0 | nothing outside the arc — border-beam's rotation, which leans on the element's own border for a rim |
| pulse | 0.12 | a little light between the lobes |

`baseline` overrides it (0–1, one meaning across the three): a flow's
beam floor (and its core line, which fades out below the default), the
share of a rotation's stroke and glow kept outside its arc, the floor
between a pulse's lobes. It is advanced on purpose — the defaults are the
design; the knob is for judging it (the devtool's About · baseline, the
lab's baseline override).

Every glow is clipped to its rounded outline when it has no `bleed`: a
rounded host is never lit past its curve.

## Tuning

The devtool's **Glow** module turns the light up or down, saved in
localStorage (`hux_glow`, `lib/tuning.ts`):

| knob | range | what |
|---|---|---|
| Strength · all | 0–150% | every glow on the site — the renderer reads it each frame, so a drag changes every lit glow at once |
| About · strength | 0–150% | the About's ring, on top of the above |
| About · desk depth | 5–250% of the narrower gutter | the About's `<EdgeGlow depth>` on a desk (`sm` and up): default 130% |
| About · phone depth | 5–250% of the narrower gutter | the same on a phone: default 140% |
| About · baseline | 0–100%, *(default)* until moved | advanced: overrides the motion's own baseline on the About's ring; the star gives it back |
| About · motion | Flow / Rotate / Pulse | the About's ring's `motion` (below), to judge each on the ring that matters: default Flow |

The desk's default is the ring as it first shipped — a reach of 3.8% of the
screen's short side, clamped to 18–38px — restated: on a 1440×900 desk a
34px reach ends 152px in, 1.3× the narrower gutter (117px, top and bottom;
the sides have 456px). The first phone ring (the 18px floor, ending 80px in)
was 2.2× a 393×659 phone's 36px gutter, its tail well over the words; 140%
(50px) keeps it off most of them. Elsewhere the ring follows the words
rather than the screen.

The module unfolds while the About is up (its `relevant`) and the panel scrolls
to it (it has its place on the rail), where the light
is judged.

A blue `*` marks a knob off its default; pressing it resets that knob. The
module's own `*`, beside its title, resets all of them (a `DebugSection`
given `onReset`). `Show About`
brings the ring up to judge by eye. While the About is up the devtool rides
over it (z 10030 — its pill, window and sheet; `zIndex` on `SurfaceWindow` /
`SurfaceSheet`), still under the command palette.

## The renderer

A browser keeps only a handful of WebGL contexts alive before dropping the
oldest, and a page can have many glows (badges). So there is one context, on a
canvas that is never in the document; each `<Glow>` is an *instance* — a 2D
canvas in the page — and the renderer draws the shader into the shared canvas
and copies it across (`drawImage`, in the same task, before the WebGL buffer
is presented). The shared canvas only grows, and each instance draws into its
bottom-left corner.

One `requestAnimationFrame` loop serves every instance, running only while
some instance is live (arriving, on, or leaving) and the tab is visible:

- **off screen** — an instance scrolled away is skipped (IntersectionObserver,
  128px margin).
- **settled** — with reduced motion and nothing moving, a frame is drawn once
  and held (`hold`).
- **pacing** — when a device cannot hold 60 fps the loop drops to every other
  frame and probes full rate every 4 s: the glow's dynamics are far slower
  than 30 Hz, and a steady half rate reads better than a ragged full one.
- **resolution** — half the device ratio for a large glow (soft, costly),
  the full ratio for a small one (its core line needs every pixel).
- **fallback** — no WebGL: a still conic gradient in the same stops.

## Voice

`useVoiceInput({ lang, onInterim, onFinal })` — one press, two things:

- **words**: the Web Speech API (`SpeechRecognition`, `webkitSpeechRecognition`).
  The browser does the recognition; nothing goes through this site. Interim
  words as they are heard, the final phrase when the speaker pauses. Not in
  Firefox — `supported` is false there and the microphone is hidden.
- **the voice itself**: a microphone stream through `lib/meter.ts`, for the
  glow. Where a second capture is refused, the level is synthesised from the
  recogniser's own sound / speech / result events, so the glow still answers.

States: `idle → listening → processing` (the speaker paused; the final words
are on their way) `→ idle`, or `denied` / `error`.

The meter shapes the raw signal the way voice-glow does: gain (a laptop mic
reads 0.03–0.2 RMS), a noise gate, a soft knee so a shout rounds off, and an
envelope — fast up (120 ms), slow down (550 ms) — so the glow leaps with a
syllable and settles between words. Three bands (80–300 Hz, 300–2000,
2000–6000), each on its own envelope, drive their own beams.

### In the palette

A microphone in the field's trailing cluster, in both shells (the desktop
popover, the phone sheet). While it listens the field wears the `line` glow
on its bottom edge, rising and rippling with the voice; when the speaker
pauses it gathers into the travelling beam until the phrase lands. What is
said is read as a query, not a sentence: "go to the writing", "open works",
"show me the wallpaper", "打开写作" arrive as `writing`, `works`,
`wallpaper`, `写作` (`toQuery`).

Voice is an **action**, not a place and not a setting: the palette's third
section (`actions` — do one thing, now) beside Music and Add to Home Screen.
It is `slashOnly`: in the slash list as `V`, never a search result, since its
control is already in the field.

**Tap or hold, three ways in.** Dictation tools answer a tap and a hold —
Wispr Flow's held Fn (push-to-talk), macOS's Globe pressed twice, Windows'
Win+H, Superwhisper's ⌥Space — and the best of those keys are taken
system-wide or invisible to a page (a browser never sees Fn / Globe; Win+H
is the OS's; ⌥Space belongs to such tools and types a no-break space on a
Mac). So the palette takes none of them and gives the same two gestures
inside its own space:

| way in | tap | hold (≥ 300 ms, `HOLD_MS`) |
|---|---|---|
| the microphone | start (or stop, while listening) | talk; let go to send |
| `/` `V` | start | talk; let go to send |
| Space in the empty field | nothing (a leading space means nothing to a search) | talk; let go to send |

A tap's session ends when the speaker pauses; a hold's when the key or
pointer is released. `/` `V` knows it was a key because a command's `run`
receives the letter that ran it; a click on its slash row carries none, so a
"v" typed later can never end a session. The held key's repeats are
swallowed, so a hold never types into the field.

## Where it glows

| where | shape | what it says |
|---|---|---|
| The About | ring, fixed, over the screen | *hello* — the OS introducing itself |
| The palette, listening | line, bottom, voice-driven | *I hear you* |
| The palette, settling words | line, processing | *working on it* |
| The in-app browser, loading | line, top, processing | *working on it* — replaces the spinner |

### Candidates

Drawn in `/editor/glow` so each can be judged by eye; none wired yet. The
rule for adding one: the glow says *something is alive here* — listening,
working, running, now. Never decoration.

| where | shape | would say |
|---|---|---|
| The home command bar while ⌘K listens | line | the voice, seen from the page |
| An app tile whose window is open | ring, rotate | running |
| The dock's Live Activity while something works | ring, processing (comet) | working |
| The About's "Reveal" | ring, pulse outside | the first press |
| The HEAD commit on /works | ring, pulse | now |
| The identity card's photo while a talk plays | ring | speaking |

## From Libraries.dev

[border-beam](https://github.com/Jakubantalik/libraries.dev/tree/main/packages/border-beam)
and [voice-glow](https://github.com/Jakubantalik/libraries.dev/tree/main/packages/voice-glow)
are CSS-gradient components with a shared rAF driver; this system is a shader,
but took its structure from them:

| from | taken |
|---|---|
| border-beam's `line` type | the glow can live on one edge — the shape a field needs |
| border-beam / voice-glow drivers | one shared loop, paused off screen, adaptive half rate |
| border-beam `strength`, `active` + fade | `strength`, `active` with an animated reveal and leave |
| border-beam `pulse-outside` | the halo (`bleed`) — a small element's light spills out; with `motion="pulse"` and `inside={false}`, the whole of it |
| border-beam's rotate family | `motion="rotate"` — its layers (stroke, inner, bloom, spark) and its fixed colour field, in the shader |
| border-beam's pulse family + its shared oscillator driver | `motion="pulse"` — lobes of colour, four quarters breathing on desynced cosine clocks, driven from the one renderer loop |
| voice-glow's analysis | gate → soft knee → attack/release envelope; three voice bands on their own envelopes |
| voice-glow's bands → lobes | bands drive separate beams, so a voice ripples |
| voice-glow's `bend` | a line's reach swells into a dome at its centre |
| voice-glow's `processing` | the light gathers into one beam that travels, eased at each turn |
| voice-glow's `idle` | the rest level (0.45) — never dead while on |

Not taken: per-instance generated stylesheets (one shader instead), the
tuned per-size palettes (one palette, by design), and voice-glow's SVG
displacement warp (costly on WebKit, and the shader's beams already move).
