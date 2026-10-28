---
skills: [glow]
---

# Glow & Voice

One light for the whole site, and the voice it can answer. Every glow is one
WebGL shader on the edge of a rounded box (`systems/glow`), drawn by one
renderer, in one palette at a time. The voice system (`systems/voice`) hears
a microphone two ways, Gateway recording or the browser's own recogniser,
and feeds one meter to the light.

## What it looks like

![The About on a desk: the screen's edge lit in blue, violet, pink, amber and cyan, deepest at the corners and fading out before it reaches the words.](/img/docs/system-glow/about-ring.png)

The About (`/` then `O`), headless at 1280×860. A `ring` over the whole
screen (`<EdgeGlow>`): the light rides the edge and fades out before the
words, its depth a share of the gutter rather than a fixed number of px.

![The Glow Lab's "In production" row: a 16:10 screen ringed by the light on the left, a search field with the light rising from its bottom edge on the right.](/img/docs/system-glow/lab-ring-line.png)

`/lab/glow`: the same light as a `ring` on a screen-sized box and as a
`line` on a field. The line is the ring focused on one edge: the light
rises from it as a dome rather than lining all four sides.

Where it is wired today:

| where | shape | what it says |
|---|---|---|
| The About (`systems/about`) | ring, `<EdgeGlow>`, fixed over the screen | *hello*: the OS introducing itself |
| The About's "Reveal", on a first visit | ring, `motion="pulse"`, `inside={false}`, `bleed={14}` | *press me* |
| The palette and Ask's composer, listening | line, bottom, voice-driven | *I hear you* |
| The same, settling words or transcribing | line, `processing` | *working on it* |
| The in-app browser, loading (`systems/windows/components/web-frame.tsx`) | line, top, `processing` | *working on it* (replaces the spinner) |
| The Dock's Ask pill while a reply is written (desk) | ring, `processing` (a comet), `bleed={8}` | *working* |

## One light

The About rings the screen with Siri's glow. Once that existed, every other
place the site wanted to say *something is alive here* (a field listening, a
window loading) would either reuse it or invent a second light that almost
matches. Two lights that almost match read as a mistake. So there is one:

- **one palette at a time**: Siri's (`lib/palette.ts`: blue · violet · pink
  · amber · cyan, around a loop), or three hues in harmony with the
  wallpaper (`lib/harmony.ts`, below). It is the same for every glow on the
  page. The shader's `ring()` reads it from `uPal`; the CSS fallback keeps
  Siri's as `--glow-stops` (`GLOW_CSS_STOPS`), and the voice waveform reads
  `GLOW_STOPS`. A glow colour written anywhere else is a bug.
- **one shader** (`lib/shader.ts`): a field of light on the edge of a rounded
  box. Every glow is this shader over some box.
- **one renderer** (`lib/renderer.ts`): one WebGL context for the page.

A glow says *something is alive here*: listening, working, running, now. It
is never decoration.

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
| `shape` | `ring` (the whole edge, default) or `line` (one edge) |
| `edge` | a line's edge: `bottom` (a field, default) or `top` (a loading bar) |
| `level` | 0–1, a number (eased over 0.25 s) or a getter read every frame. Rest is 0.45 |
| `bands` | getter for low / mid / high, 0–1 each |
| `processing` | gather into a travelling beam: along the edge and back for a line, a comet around a ring |
| `motion` | how the light lives while on: `flow` (default), `rotate`, `pulse` (below) |
| `period` | seconds per turn (rotate, 2) or per breath (pulse, 2.3) |
| `inside` | `false` draws only the halo past the edge; with a `bleed`, a light blooming out from behind the host |
| `baseline` | *advanced*: the depth kept where no wave, arc or lobe is, 0–1 of the peak's (a trough against a crest). Each motion has its own (`GLOW_BASELINE`: flow 0.176, rotate 0.12, pulse 0.3); pass it only to override |
| `reach` | px the light reaches in; its visible tail ends ~4.45 reaches in (`GLOW_EXTENT_PER_REACH`). Sized to the host when omitted: a line 0.22 × its height, 5–14 px; a ring 0.038 × its shorter side, 3–38 px (18–38 when `fixed`) |
| `extent` | `{ x, y }` px where the light ends, off the left/right and top/bottom edges; `reach` in another unit (below). Overrides it, blended smoothly round the corners |
| `bleed` | px of halo past each side (default 0: inside only) |
| `radius` | px; read from the host's `border-top-left-radius` (or 0 when `fixed`). Drawn into the light rather than masked, and the corners' blend follows it, so a change redraws at once (a held frame too). Pass the same source of truth the box's own corners come from: over the page, `useWallpaper().screenRadius`, the number `<Vitre>` draws the bezel with. |
| `strength` | 0–1; the devtool's site-wide strength multiplies it |
| `fixed` / `layer` | over the viewport; a vitre bezel layer |
| `inDuration` / `outDuration` | seconds to arrive / leave: 0.6 / 0.35, or 1.1 / 0.52 when `fixed` |
| `onDone` | called once the light has fully left |
| `className` / `style` / `ref` | the glow's box, the rounded rectangle whose edge is lit |

The glow is a `<span>` shown as a block, so it can sit inside a word (a badge
in a paragraph) as well as a card. It is `absolute` over its host, `bleed`
px past each side, and takes no pointer.

### Reach and extent

A glow's depth has two units. `reach` is the beams' scale: a beam at full
height is 1.7 reaches thick, and its light falls off as
`exp(-(d/thick)^1.45)`. `extent` is where the light visibly ends. They are
the same number, related by `GLOW_EXTENT_PER_REACH` (lib/shader.ts), the
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
ring is framing. An edge glow's depth is a share of the **gutter**, the room
between its edge and its content:

| | |
|---|---|
| `content` | a ref, or several (their union). Each counts as laid out at rest (every scrolling ancestor at its top) and clipped by it: a long article counts only the window it starts in, and scrolling it never changes the gutter (measured as it shows, an article scrolled up touches the screen's top and takes the light to nothing). |
| gutter `x` / `y` | the narrower of the left and right gutters / of the top and bottom ones, from the glow's own box (the viewport, or what `style` insets it to, such as a bezel's screen). Measured while on, again whenever a size changes, and kept for the way out. |
| `depth` | where the light ends: `0.5` halfway to the content, `1` just touching it, `1.5` its tail half a gutter over it. **A number** is a share of the narrower gutter, and the light stands as high off every edge: a ring's usual look, reaching the content first where it is nearest. **`{ x, y }`** takes each axis's own gutter, so the light follows the content's shape (x off the sides, y off the top and bottom). |

Everything else is `<Glow>`'s (`active`, `motion`, `baseline`, `strength`,
`radius`, `layer`, `style`, `className`, durations). It is always `fixed`
and always a ring. With `{ x, y }` the extent eases from one axis's to the
other's round each corner.

## Rules

Each of these, broken, has a visible failure.

| Rule | Why | What breaks |
|---|---|---|
| Colours only in `lib/palette.ts` / `lib/harmony.ts` | One light; the devtool's rule and the wallpaper ease every glow at once | A glow that almost matches, and ignores the wallpaper's harmony |
| No WebGL context, canvas or CSS gradient of your own for a light: use `<Glow>` | A browser keeps only a handful of WebGL contexts alive, dropping the oldest | Glows (or the wallpaper) going blank as contexts are lost |
| The host is `relative`, and its corners are its own (or pass `radius`) | The glow is `absolute` over its parent and reads that parent's radius | The light on the wrong box, or square corners lit past a round host. The Dock pill's wrapper has no corners, so it passes `radius={CAPSULE / 2}` |
| A `bleed` needs room: the glow is not inside an `overflow: hidden` ancestor that hugs the host | The halo is drawn past the host's edge | The halo cut off flat. The Dock pill's glow is a sibling of the glass for this reason |
| `active={false}` when the host is hidden by anything but scrolling | Only scrolling off screen is detected (IntersectionObserver, 128px margin) | Frames spent on a glow nobody can see (the Dock pill turns off while hidden behind its panel) |
| A voice's `level` / `bands` are passed as getters, never called in render | They are read every frame by the renderer | A re-render per frame, or a glow frozen at one value |
| `useVoiceInput().start()` from a press | The microphone is granted only in a gesture, and Safari starts audio only in one (`primeAudio`) | A permission prompt that never comes; a meter on a suspended `AudioContext` reading 0 |
| Change the beams' thickness or falloff → update `GLOW_EXTENT_PER_REACH` | Extent and reach are one number in two units | The About's light ending in a hard line, or short of where it was told |
| Change `lib/tuning.ts`'s defaults → bump its key (`hux_glow_v2`) | Saved knobs would otherwise keep the old defaults | Old browsers never see the new look |

Free choices: `reach`, `bleed`, `strength`, `motion` and `period`, which edge
a line takes, `inDuration` / `outDuration`, and whether a field shows the
glow or the waveform (a visitor's DevTool choice; Glow by default).

## Adding a glow

1. Name what it says (*listening*, *working*, *running*, *now*). If it says
   nothing, it is decoration: stop.
2. Pick the shape: `ring` for a thing, `line` for a field or a bar. Pick the
   motion: `flow` by default, `rotate` for running, `pulse` for now /
   waiting, `processing` for working. A small element (a pill, a button)
   wants `bleed` and a small `reach` (3–4 px).
3. Put `<Glow>` inside a `relative` host whose own corners it should follow,
   with room for its halo (Rules).
4. Draw it in `/lab/glow` first, beside its neighbours, and judge it in both
   themes and over a wallpaper with the devtool's Glow · Colours.
5. Add it to "What it looks like"'s table above (and take it out of
   Candidates if it was one).

## How it works

### The shader

For each pixel the shader knows how far in from the box's rounded edge it
sits, and where around the edge it is; everything is built from those two
numbers.

| part | what it is |
|---|---|
| beams | four travelling waves around the ring, two each way, at harmonics 2 · 3 · 5 · 7, so their crests never line up the same way twice. A wave sets how far its light reaches in; the crests read as beams. |
| colour | the palette laid around the ring, drifting per beam so colours slide past each other, pushed back out from its luminance after averaging (further in the light theme). |
| core | a thin bright line on the edge itself, whiter in the dark. |
| halo | outside the box (`bleed`), a softer light spilling out: the bloom a small element needs. |
| falloff | `exp(-(d/thick)^1.45)`, `thick` = reach × 1.7 × the wave's height (floored at the baseline) × the band's drive: steeper than exponential, because a plain `exp`'s long tail sums, across a small element, into a wash over its face. |
| corners | the beams' depth is a **smooth** minimum (log-sum-exp) of the four edges, blended once more with the true rounded outline. A hard minimum of the edge distances folds the light along each diagonal: a crease from every corner once the light reaches deeper than the corner's radius (a 10px screen corner under a 38px ring). The smooth one keeps the contours round at every depth, lets two edges' light add up at a corner, and still follows a round host's curve (an avatar, a phone's 44px corners). Softness follows the reach; the core line stays on the true outline, crisp. Without a `bleed`, nothing past the rounded outline is drawn (antialiased at the canvas's resolution): a rounded host is not lit past its curve. |
| focus | the ring narrowed to an arc (`uFocus`, `uFocusAt`). A **line** is the ring focused on one edge; **processing** is that arc gathered small and moving. |
| energy | `uLevel` (rest 0.45) lengthens every reach (× `0.6 + 0.9 · level`, 1.0 at rest) and brightens; `uBands` (low / mid / high) drive their own beams (the first, the middle two, the fourth), so speech ripples rather than pumps. |
| reveal | the light arrives from the focus centre and spreads both ways, its front flaring, with a surge in reach as it lands (600 ms; 900 ms when `fixed`). |

A **line** is laid along its edge rather than around the centre: an angle
swings fast near a wide box's middle and would fan the beams into rays, so
the line's beams and focus run along the edge (`sx`, a quarter of the ring
from corner to corner), its distance is measured from that edge only, and
its reach swells toward the focus centre so the light rises as a dome
(voice-glow's *bend*). The arc's half-width is `0.085 + 0.07 · level`, so a
voice widens it as well as raising it; `processing` narrows it to 0.045 and
sweeps its centre 0.25 ± 0.085 along the edge, eased at each turn, 1.1 s a
pass, holding the level at 0.55 or more. `edge="top"` mirrors the box.

### Motions

How the light lives while it is on. `flow` is the field this shader was
built as; `rotate` and `pulse` are Libraries.dev border-beam's two families,
and they are **built in layers** instead (`layered` in `lib/shader.ts`), as
border-beam builds them. Its CSS is in `/lab/glow` beside ours (the
`border-beam` package, a lab-only dev dependency, MIT), each pair on the
same host in the same theme.

| motion | the light | says |
|---|---|---|
| `flow` | the field: four beams travelling, two each way | *hello*, *I hear you* |
| `rotate` | a lit arc (~40% of the ring) sweeping a fixed colour field at an even pace (`period`, 2 s a turn; border-beam's is 1.96), the colours swaying a little; the spark at its head | *running* |
| `pulse` | the whole ring in three soft lobes, each quarter breathing on its own cosine clock (1 · 1.23 · 0.89 · 1.37 × `period`, 2.3 s), the colour turning round in 14 s | *now*, *waiting for you* |
| `pulse` + `inside={false}` + `bleed` | only the bloom past the edge. No opaque child is needed; the shader draws nothing inside | *press me*: the About's Reveal on a first visit |

The layers: a crisp **1px stroke** (the definition: what a small element is
recognised by), a soft **inner** glow (the body), a **bloom** past the edge
(the atmosphere), and for a rotation a narrow **spark** near the front
(white on a dark ground, ink on a light one) with a hot point of bloom. The
colour field stays on the box: a rotation sweeps a light over it, so the
colour changes as the light travels. All of it is kept low and per theme: a
light on the edge, not a frame. The first cut derived both motions from the
flow (a window on the travelling beams; the beams frozen and breathing) and
read worse than border-beam for reasons no tuning could fix: a lamp sliding
rather than light sweeping a rim, no head, one falloff muddy at a card's
3–4 px, lumpy blotches pumping.

Where the light must end (an `extent`, like the About's depth), the layers
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

#### Baseline

The depth the light keeps where nothing is moving, **as a share of the depth
where the motion peaks**: a flow's trough against its crest, a rim against a
rotation's arc or a pulse's lobe. 0 is light only where the motion is; 1 is
a rim as deep as the peak, the motion no longer visible. The trough is
thinner, not dimmer, as a flow's is: its four beams summed stay bright at
the edge however thin their floor. Below a flow's own trough
(`GLOW_FLOW_TROUGH`, 0.3 / 1.7 = 0.176) the rim also dims, as the flow's
core line does, to nothing at 0.

| motion | baseline | what it means |
|---|---|---|
| flow | 0.176 | a trough 0.3 of the 1.7 reaches of a crest, the core line riding on it: the solid rim under the waves |
| rotate | 0.12 | a thin rim all round, the lit arc sweeping it deeper (0 is border-beam's rotation: nothing outside the arc) |
| pulse | 0.3 | a rim all round, the three lobes breathing it deeper |

In the shader: a flow's beam floor is `uBaseline` × 1.7 reaches; a rotation's
and a pulse's inner glow is `mix(uBaseline, 1, raw)` × the peak's depth,
where `raw` is the arc's or the lobes' height there; past the edge (a pulse
outside) the bloom keeps the same share of its light. `baseline` is advanced
on purpose: the defaults are a starting point to judge by eye, and the knob
is for that (the devtool's About · baseline, the lab's baseline override).

### Colours

Over a wallpaper the light can take its colours from the picture
(`lib/harmony.ts`). The picture's dominant colour sets a base hue: the
ambient profile's `tint`, a photograph's measured once, the Sky's read off
the live scene, published by `components/palette-bridge.tsx`. A colour-wheel
rule picks three hues from it, so the light belongs to the picture instead
of sitting on it.

| rule | hues (OKLCH, from the base) | reads as |
|---|---|---|
| analogous | −32°, 0°, +32° | the picture's own colour, lit (the calmest) |
| complementary | 0°, +24°, +180° | the picture's colour and its opposite (the strongest contrast) |
| split | 0°, +150°, +210° | the opposite's two neighbours (contrast without the clash) |
| triadic | 0°, +120°, +240° | evenly round the wheel (the liveliest) |
| **auto** | a colourful picture (chroma ≥ 0.08) → analogous; a muted one → split; a grey one (chroma < 0.03, or the plain page) → siri | |
| **siri** (default) | Siri's five stops, whatever the wallpaper | |

Every hue is drawn at one OKLCH lightness and chroma (0.74 / 0.16 in the
dark theme, 0.68 in the light), the chroma lowered until it fits sRGB, so
the three read as equals and none clips. They become the shader's five
stops as a loop (a b c b′ a′, the returns a touch lighter and darker) in
`uniform vec3 uPal[5]`, which `ring()` interpolates. The renderer reads the
palette every frame; after a change of wallpaper or rule it eases there over
1.5 s, held frames redrawn. Nothing re-renders. The wheel is OKLCH so that
"32° apart" is 32° as the eye sees it.

The rule is site-wide, so there is one light. It is in the devtool's Glow
module (`Colours`, with the wallpaper's hue and the five stops as swatches);
`/lab/glow` lays each rule out for wallpapers across the wheel. The CSS
fallback (no WebGL) and the voice waveform keep Siri's stops.

### The renderer

A browser keeps only a handful of WebGL contexts alive before dropping the
oldest, and a page can have many glows (badges). So there is one context, on a
canvas that is never in the document; each `<Glow>` is an *instance* (a 2D
canvas in the page), and the renderer draws the shader into the shared canvas
and copies it across (`drawImage`, in the same task, before the WebGL buffer
is presented). The shared canvas only grows, and each instance draws into its
bottom-left corner. A lost context is recreated on the next frame.

One `requestAnimationFrame` loop serves every instance, running only while
some instance is live (arriving, on, or leaving) and the tab is visible:

- **off screen**: an instance scrolled away is skipped (IntersectionObserver,
  128px margin; not for a `fixed` glow).
- **settled**: with reduced motion and nothing moving (no getter `level`, no
  `bands`, not processing), a frame is drawn once and held (`hold`).
- **pacing**: when frames arrive more than 22 ms apart for half a second the
  loop drops to every other frame, and probes full rate every 4 s. The
  glow's dynamics are far slower than 30 Hz, and a steady half rate reads
  better than a ragged full one.
- **resolution**: half the device ratio for a glow over 160,000 CSS px²
  (soft, costly), the full ratio for a smaller one (its core line needs
  every pixel); the ratio is capped at 2.
- **fallback**: no WebGL, so a still, blurred conic gradient in Siri's stops
  (`.glow-fallback` in `app/globals.css`; a line is masked to its bottom).

## Voice

`useVoiceInput({ lang, onInterim, onFinal })` chooses a recognition path and
feeds one microphone meter to the glow.

![The voice pipeline in three columns. Recognition: a press calls start(); the gateway path records with MediaRecorder and posts the clip to /api/voice; the browser path uses SpeechRecognition and opens a second stream for the meter. Meter: an AnalyserNode feeds RMS times gain 5, a 0.02 gate, a soft knee and a 120/550 ms envelope into level, and three bands through their own gain, gate, knee and envelope into bands. Glow: the state machine idle, listening, processing; level() and bands() floored by the idle breath 0.17 + 0.06 sin(2.4t); the line Glow; and the uniforms they set.](/img/docs/system-glow/voice-pipeline.svg)

Both paths end in the same two getters and the same `<Glow>`; only where
the words come from differs. The breath floor is what makes the glow move
at the press, before the microphone is open.

- **AI Gateway**: when Gateway credentials are available on the server
  (`VERCEL`, `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`), the browser
  supports `MediaRecorder` (webm/opus, mp4 or ogg/opus), and the DevTool's
  model is not Browser. Tap to start and tap stop, or hold to record and
  release inside the input field to finish. Sliding outside the field before
  release cancels the held recording. The completed clip goes through
  `/api/voice`. The DevTool's Voice module chooses `openai/whisper-1` (the
  default, `$0.36/hour`, `DEFAULT_VOICE_MODEL` in `systems/voice/models.ts`)
  or `spacexai/grok-stt` (`$0.10/hour`). Whisper stays the default until Grok
  has been tried on real English and Chinese dictation. In Ask, a held
  release sends the completed transcript as a message, while a tap and stop
  fills the field for editing; the palette always fills. The API key stays
  on the server. Recording stops after 60 seconds, clips are limited to
  5 MiB, and a clip under 300 ms is discarded. Set
  `VOICE_TRANSCRIPTION_MODEL=off` to disable Gateway transcription. A model
  whose recording or transcription fails falls back to browser recognition
  for the rest of the page's life (choosing another model uses that one).
- **browser fallback**: the Web Speech API (`SpeechRecognition`,
  `webkitSpeechRecognition`) supplies interim words and the final phrase
  when the speaker pauses. The browser does recognition; nothing goes
  through this site. Where neither path is available, the mic is hidden.
  The DevTool can choose Browser explicitly to compare it with the Gateway
  models; this uses the browser's original tap-to-listen interaction.
- **the voice itself**: a microphone stream through `lib/meter.ts`, for the
  glow. Where a second capture is refused, the level is synthesised from the
  recogniser's own sound / speech / result events, so the glow still answers.
- **idle**: from the press, the level and each band never drop below a slow
  breath (`IDLE` in `use-voice-input.ts`: 0.17 ± 0.06, 2.4 rad/s), so the
  glow and the waveform move at once, before the microphone opens and
  between words, rather than waking at the first syllable (the meter's gate
  reads silence as 0).

States: `idle → listening → processing` (the browser settles words, or
Gateway transcribes the clip) `→ idle`, or `denied` / `error`, each raising
a one-line notice (`voice-input-error`). The hook's `listening` is true in
both `listening` and `processing`, which is what the glow's `active` takes.

The meter shapes the raw signal the way voice-glow does: gain (× 5; a laptop
mic reads 0.03–0.2 RMS), a noise gate (0.02), a soft knee so a shout rounds
off, and an envelope, fast up (120 ms) and slow down (550 ms), so the glow
leaps with a syllable and settles between words. Three bands (80–300 Hz,
300–2000, 2000–6000), each on its own envelope, drive their own beams. One
`AudioContext` serves the page, nothing is connected to the speakers, and
the analysis runs only when a getter is read.

![Three search fields, top to bottom: a low, thin light along the bottom edge; a taller, wider light rising across most of the field; a short beam gathered to the left of centre.](/img/docs/system-glow/line-states.png)

The field's `line` in `/lab/glow` at the breath's floor (level 0.17), at a
loud voice (0.95), and `processing`: a voice raises the light and widens
its arc; processing gathers it into one beam travelling the edge.

### In the palette

A microphone in the field's trailing cluster, in both shells (the desktop
popover, the phone sheet), and in Ask's composer toolbar
(`systems/command/voice.tsx`: `VoiceButton`, `VoiceVisual`, `VoiceStatus`).
While it listens the field wears the `line` glow on its bottom edge
(`strength={0.95}`), rising and rippling with the voice. It comes up at the
press (`glowDelay` 0, `systems/ask/lib/config.ts`): its own reveal, a sweep
out from the centre, is the arrival. On a phone, a press that sent the
keyboard down in the last 800 ms waits `keyboardDelay` (320 ms; 0 on a desk)
more, since the keyboard's slide and the glow's first frames together drop
frames.

![The palette's field during Gateway recording, then transcribing: "Recording…" with a red stop button and a recording dot, the light along the bottom edge; then "Transcribing…" with a spinner, the light gathered into a beam.](/img/docs/system-glow/palette-gateway.png)

The palette on a desk with `GET /api/voice` stubbed on and a fake
microphone: recording (the input hidden and inline status in its place, the
stop button with its dot, the line glow) and transcribing (a spinner, the
beam travelling).

Gateway recording changes the button to a stop icon with a recording dot,
and a spinner while transcribing; the field shows recording, release and
cancel copy inline. In Ask the composer folds the textarea and model
controls into a single recording line (300 ms, ease-out), then unfolds after
transcription. In Gateway mode, supported browsers give short vibration
feedback on start, stop, and cancel.

The DevTool's Voice module can switch the visual style to **Waveform**
(`systems/voice/waveform.tsx`): 64 bars in Siri's stops fill the field row
beside the status and grow with the same meter's level and bands; a
travelling bump marks transcription. The two styles are mutually exclusive;
the saved default is Glow. When recording ends or browser speech pauses,
the glow gathers into the travelling beam until the phrase lands.

What is said is read as a query, not a sentence: "go to the writing", "open
works", "show me the wallpaper", "打开写作" arrive as `writing`, `works`,
`wallpaper`, `写作` (`toQuery`). A spoken question goes in whole, for Ask
(`toFieldText`).

Voice is an **action**, not a place and not a setting: in the palette's
`actions` section (do one thing, now) beside Ask, Music and Add to Home
Screen. It is `slashOnly`: in the slash list as `V`, never a search result,
since its control is already in the field. It is listed only where the
browser has a recogniser (`isVoiceSupported()`), even where Gateway would
work.

### Gestures

**Tap or hold to record with a Gateway model; browser mode keeps its original
gesture.** Dictation tools answer a tap and a hold: Wispr Flow's held Fn
(push-to-talk), macOS's Globe pressed twice, Windows' Win+H, Superwhisper's
⌥Space. The best of those keys are taken system-wide or invisible to a page
(a browser never sees Fn / Globe; Win+H is the OS's; ⌥Space belongs to such
tools and types a no-break space on a Mac). So the palette takes none of
them and gives the same two gestures inside its own space (`HOLD_MS`,
300 ms, is a hold):

| way in | Gateway model | Browser recognition |
|---|---|---|
| the microphone | tap to start, tap stop to transcribe; or hold, speak, release inside the field to transcribe (to send, in Ask), outside to cancel | tap to toggle, or hold ≥ 300 ms and release to stop |
| `/` `V` | tap to start and use the stop button; or hold V, speak, release to transcribe | tap to start, or hold ≥ 300 ms and release to stop |
| Space in the empty field (palette only) | hold ≥ 300 ms, speak, release to transcribe | hold ≥ 300 ms, speak, release to stop |

A browser tap's session ends when the speaker pauses; a hold's when the key or
pointer is released. `/` `V` knows it was a key because a command's `run`
receives the letter that ran it; a click on its slash row carries none, so a
"v" typed later can never end a session. The held key's repeats are
swallowed, so a hold never types into the field.

## Tuning

The devtool's **Glow** module turns the light up or down, saved in
localStorage (`hux_glow_v2`, `lib/tuning.ts`; the key's version moves with the
defaults, so a browser that saved the old ones starts from the new):

| knob | range | what |
|---|---|---|
| Colours | Siri / Auto / Analog / Compl / Split / Triad, on a line of its own | where every glow's colours come from: default Siri |
| Strength · all | 0–150% | every glow on the site. The renderer reads it each frame, so a drag changes every lit glow at once |
| About · motion | Flow / Rotate / Pulse | the About's ring's `motion`, to judge each on the ring that matters: default Flow. First of the About's knobs, since the others are read against it |
| About · strength | 0–150% | the About's ring, on top of the above |
| About · desk depth | 5–250% of the narrower gutter | the About's `<EdgeGlow depth>` on a desk (`sm` and up): default 140% |
| About · phone depth | 5–250% of the narrower gutter | the same on a phone: default 140% |
| About · baseline | 0–100% | advanced: the light the About's ring keeps where no wave, arc or lobe is, whatever the motion: default 5% |

Both layouts default to a depth of 140%: the light's tail ends 40% past the
narrower gutter, over the edge of the words but off most of them.

The module unfolds while the About is up (its `relevant`) and the panel
scrolls to it, where the light is judged. A blue `*` marks a knob off its
default; pressing it resets that knob. The module's own `*`, beside its
title, resets all of them (a `DebugSection` given `onReset`). `Show About`
brings the ring up to judge by eye. While the About is up the devtool rides
over it (`DEVTOOL_OVER_ABOUT_Z`, 10030: its pill, window and sheet; `zIndex`
on `SurfaceWindow` / `SurfaceSheet`), still under the command palette.

The **Voice** module chooses the transcription model (Browser / Whisper /
Grok, saved as `hux_voice_model`) and the audio visual (Glow / Waveform,
`hux_voice_visual`).

## Candidates

Drawn in `/lab/glow`'s "Could be" row so each can be judged by eye; none
wired yet (the rule is in [Adding a glow](#adding-a-glow)).

| where | shape | would say |
|---|---|---|
| The home command bar while ⌘K listens | line | the voice, seen from the page |
| An app tile whose window is open | ring, rotate | running |
| The HEAD commit on /works | ring, pulse | now |
| The identity card's photo while a talk plays | ring | speaking |

## From Libraries.dev

[border-beam](https://github.com/Jakubantalik/libraries.dev/tree/main/packages/border-beam)
and [voice-glow](https://github.com/Jakubantalik/libraries.dev/tree/main/packages/voice-glow)
are CSS-gradient components with a shared rAF driver; this system is a shader,
but took its structure from them:

| from | taken |
|---|---|
| border-beam's `line` type | the glow can live on one edge, the shape a field needs |
| border-beam / voice-glow drivers | one shared loop, paused off screen, adaptive half rate |
| border-beam `strength`, `active` + fade | `strength`, `active` with an animated reveal and leave |
| border-beam `pulse-outside` | the halo (`bleed`): a small element's light spills out; with `motion="pulse"` and `inside={false}`, the whole of it |
| border-beam's rotate family | `motion="rotate"`: its layers (stroke, inner, bloom, spark) and its fixed colour field, in the shader |
| border-beam's pulse family + its shared oscillator driver | `motion="pulse"`: lobes of colour, four quarters breathing on desynced cosine clocks, driven from the one renderer loop |
| voice-glow's analysis | gate → soft knee → attack/release envelope; three voice bands on their own envelopes |
| voice-glow's bands → lobes | bands drive separate beams, so a voice ripples |
| voice-glow's `bend` | a line's reach swells into a dome at its centre |
| voice-glow's `processing` | the light gathers into one beam that travels, eased at each turn |
| voice-glow's `idle` | the rest level (0.45), so it is never dead while on |

Not taken: per-instance generated stylesheets (one shader instead), the
tuned per-size palettes (one palette at a time, from the wallpaper or
Siri's), and voice-glow's SVG displacement warp (costly on WebKit, and the
shader's beams already move).

## Files

```
systems/glow/
├── index.ts
├── lib/
│   ├── palette.ts      # Siri's five stops, and the shader's ring() over uPal
│   ├── harmony.ts      # the light's colours from the wallpaper, by a colour-wheel rule
│   ├── shader.ts       # the field of light on the edge of a rounded box
│   ├── renderer.ts     # one WebGL context, one rAF loop, every instance
│   └── tuning.ts       # the devtool's knobs: strength, colours, the About's motion, depth, baseline
└── components/
    ├── glow.tsx        # <Glow>: shape, level, processing, reveal; GLOW_BASELINE
    ├── edge-glow.tsx   # <EdgeGlow>: a screen's ring, ending where its content begins
    └── palette-bridge.tsx  # publishes the wallpaper's dominant colour to harmony.ts

systems/voice/
├── index.ts            # VOICE_LANG, exports
├── lib/meter.ts        # microphone → level + three bands (gain, gate, knee, envelope)
├── use-voice-input.ts  # Gateway recording or Web Speech API + the meter + IDLE
├── waveform.tsx        # the alternative visual: 64 bars beside the status
├── models.ts           # allowed transcription models and the default
└── prefs.ts            # saved DevTool choices: model, visual

systems/command/voice.tsx   # the microphone, the visual, the status copy, gestures, toQuery
app/api/voice/route.ts      # Gateway availability (GET) and transcription (POST)
app/lab/glow/               # the lab: every scale, one set of controls, a real microphone
```
