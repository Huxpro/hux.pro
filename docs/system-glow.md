# Glow & Voice

One light for the whole site, and the voice it can answer.

```
systems/glow/
├── lib/
│   ├── palette.ts      # the five stops — the only place a glow colour is written
│   ├── shader.ts       # the field of light on the edge of a rounded box
│   └── renderer.ts     # one WebGL context, one rAF loop, every instance
└── components/
    └── glow.tsx        # <Glow> — shape, level, processing, reveal

systems/voice/
├── lib/meter.ts        # microphone → level + three bands (gate, knee, envelope)
└── use-voice-input.ts  # Web Speech API words + the meter, one press

systems/command/voice.tsx   # the palette's microphone, field glow, `/` `V`
app/editor/glow/            # the lab: every scale, one set of controls
```

## One light

The About rings the screen with Siri's glow. Once that existed, every other
place the site wanted to say *something is alive here* — a field listening, a
window loading, a thing I made under the pointer — would either reuse it or
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
| colour | the palette laid around the ring, drifting per beam so colours slide past each other, pushed back out from its luminance after averaging (further in the light theme). |
| core | a thin bright line on the edge itself, whiter in the dark. |
| halo | outside the box (`bleed`), a softer light spilling out — the bloom a small element needs. |
| falloff | `exp(-(d/reach)^1.45)`: steeper than exponential, because a plain `exp`'s long tail sums, across a small element, into a wash over its face. |
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
<Glow active={open} fixed radius={44} />         {/* over the viewport */}
```

| prop | |
|---|---|
| `active` | on: sweeps in and stays; off: sweeps out, then costs nothing |
| `shape` | `ring` (the whole edge) or `line` (one edge) |
| `edge` | a line's edge: `bottom` (a field) or `top` (a loading bar) |
| `level` | 0–1, a number or a getter read every frame |
| `bands` | getter for low / mid / high, 0–1 each |
| `processing` | gather into a travelling beam: along the edge and back for a line, a comet around a ring |
| `reach` | px the light reaches in; sized to the host when omitted |
| `bleed` | px of halo past each side |
| `radius` | px; read from the host (or 0 when `fixed`) |
| `strength` | 0–1 |
| `fixed` / `layer` | over the viewport; a vitre bezel layer |

The glow is a `<span>` shown as a block, so it can sit inside a word (a badge
in a paragraph) as well as a card.

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
popover, the phone sheet), and `/` `V` from the slash list (`kind: "stay"` —
the palette stays and goes back to its field). While it listens the field
wears the `line` glow on its bottom edge, rising and rippling with the voice;
when the speaker pauses it gathers into the travelling beam until the phrase
lands. What is said is read as a query, not a sentence: "go to the writing",
"open works", "show me the wallpaper", "打开写作" arrive as `writing`, `works`,
`wallpaper`, `写作` (`toQuery`).

## Where it glows

| where | shape | what it says |
|---|---|---|
| The About | ring, fixed, over the screen | *hello* — the OS introducing itself |
| The palette, listening | line, bottom, voice-driven | *I hear you* |
| The palette, settling words | line, processing | *working on it* |
| The in-app browser, loading | line, top, processing | *working on it* — replaces the spinner |
| A badge under the pointer | ring, 2.5px reach, 6px halo | *this is something I made* |

### Candidates

Drawn in `/editor/glow` so each can be judged by eye; none wired yet. The
rule for adding one: the glow says *something is alive here* — listening,
working, running, now. Never decoration.

| where | shape | would say |
|---|---|---|
| The home command bar while ⌘K listens | line | the voice, seen from the page |
| An app tile whose window is open | ring, halo | running |
| The dock's Live Activity while something works | ring, processing (comet) | working |
| The About's "Look around" | ring, halo | the first press |
| The HEAD commit on /works | ring | now |
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
| border-beam `pulse-outside` | the halo (`bleed`) — a small element's light spills out |
| voice-glow's analysis | gate → soft knee → attack/release envelope; three voice bands on their own envelopes |
| voice-glow's bands → lobes | bands drive separate beams, so a voice ripples |
| voice-glow's `bend` | a line's reach swells into a dome at its centre |
| voice-glow's `processing` | the light gathers into one beam that travels, eased at each turn |
| voice-glow's `idle` | the rest level (0.45) — never dead while on |

Not taken: per-instance generated stylesheets (one shader instead), the
tuned per-size palettes (one palette, by design), and voice-glow's SVG
displacement warp (costly on WebKit, and the shader's beams already move).
