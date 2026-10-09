# Ambient easter eggs

What the weather wallpaper does when you touch it. On a thunder day a click
throws a bolt, on a clear night a shooting star; while it rains or snows a
drag stirs up a gust, on a foggy day a drag wipes the mist clear; and in any
weather, pulling the home screen down turns the phone into a window onto the
real sky. None is announced. Part of the [Ambient System](./system-ambient.md);
how the sky itself is drawn is [The Sky](./ambient-sky.md).

## What they share

| Egg | Weather | Gesture | Answer |
|---|---|---|---|
| [The strike](#the-strike-thunder) | thunder | tap | a forked bolt to the point you tapped |
| [The shooting star](#the-shooting-star-clear-night) | a dark, open night | tap | a meteor through the point you tapped |
| [The gust](#the-gust-rain-and-snow) | rain or snow | drag | the rain and snow lean with your hand, then settle |
| [The fog wipe](#the-fog-wipe-fog) | fog | drag (on touch: hold, then drag) | the mist clears along the path and closes back |
| [The sky window](#the-sky-window-any-weather) | any | pull the home down from the top | the view turns with the phone; the sun and moon are where they really are |

Every gesture is distinct, so no two eggs are armed for the same hand on the
same sky: a tap, a drag, a hold (the fog wipe, or on a rainy day the
[tilt primer](./ambient-sky.md#the-tilt-primer), never both), and the pull,
which moves the page itself.

**Every egg belongs to the Sky.** Under the Gradient and Classic styles they
do not exist, and that is the decision rather than an omission. A wash has no
geometry to draw a channel on, no star field for a meteor to belong to, no
particles to blow and no fog layer to thin, so the most it could offer is a
lesser find dressed as the same one. An egg is worth having at full strength;
where it cannot be, it is absent. A Sky that fell back to the Gradient for want
of WebGL2 is disarmed with it.

**"Did that land on the sky?"** is one function, `isBackgroundClick` in
`lib/poke.ts` (with `isBackgroundPress` as its pointer-event form). It walks
from the target up to `<body>`, and the press counts only when nothing on the
way paints (no background colour or image, no backdrop filter) and nothing is
interactive. That is the question the visitor already answered with their eyes,
so the two cannot disagree. Every egg asks it, so a widget card, a link, the
Dock or an open sheet is never the sky. Mark a transparent layer that should
still swallow pokes with `data-no-poke`.

**Not under `prefers-reduced-motion`.** None of them, and the renderer refuses
too, so nothing routes round the check. **Nothing persists**: an egg is found,
not set, and is gone on reload.

## The strike (thunder)

Click the page background on a thunder day and a forked channel is drawn
top-down out of the cloud base over ~70 ms, landing exactly on the point,
flickering through two return strokes and gone inside 1.2 s
(`POKE_MS.strike`). Its flash lights the cloud decks the way the weather's own
`lightning()` does.

- **Click, not pointerdown.** The listener lives on the document in
  `wallpaper-background.tsx`, because the wallpaper layer is
  `pointer-events-none` and must stay so. A click is a press and release on the
  same spot, so scrolling with a thumb on the sky never fires one.
- **Never a strobe.** One poke per `POKE_COOLDOWN_MS` (500 ms), so clicking as
  fast as you can is two flashes a second (WCAG allows three).
- **Only where the sky is**: the weather kind, painting full-page, with the
  shader as the engine. `armedPoke` in `lib/poke.ts` says which egg the scene
  arms.
- Entry point: `WallpaperRenderer.poke("strike", x, y)`; in the shader,
  `uPokeKind == 1` drives `strike()`.

To see it: devtool → Sky → force **Thunder**, click the background.

## The shooting star (clear night)

On a dark, open night, clicking the star field sends a meteor in off the edge
of the screen and **through** the point clicked. It works like the strike (a
tap, a point, a second) in the opposite tone: the thunder day answers with
violence, the clear night with a wish.

**When.** `meteorPossible()` asks two independent questions:

| | Rule | Whose business |
|---|---|---|
| Dark enough? | the sun more than 12° below the horizon (`METEOR_SUN_MAX_DEG`) | the clock's |
| Anything in the way? | `scene.clarity` over 0.35 (cover and fog, nothing else) | the weather's |

−12° is the end of nautical twilight, where meteor observing conventionally
begins. Civil (−6°) puts meteors over a sky still bright enough to read by;
astronomical (−18°) takes the egg away for 59 summer nights in London. The
moon is deliberately not in the rule: it cuts the rate you would see, not the
possibility. Nor is `condition === "clear"`: a real broken-cloud night reports
low cover and is armed. (Forcing **Cloudy** in the devtool uses the profile's
0.7 cover, where clarity is 0; pull Tune → Cloud down to 20 % to see a cloudy
night armed.)

**How it is drawn** (`meteor()` in `shader.ts`, `uPokeKind == 3`):

- **It passes through the click** rather than launching from it: the path is
  backed up from the point to an entry just off whichever edge it meets, and
  carried on past it. The head crosses the point 0.06–0.73 s in (median
  0.23 s), never under a third of its peak brightness there.
- **Re-rolled per click**: side, pitch (20°–70°, so never horizontal or
  vertical), bow, hue and **grade**. One skewed roll (`pow(hash, 1.8)`) sets
  brightness, coma, run length, pace, train and whether it flares
  (`meteorBurst`), so most clicks are modest and now and then a fireball comes
  apart. The grade is the reason to click again.
- **A slight bow**, as a wide field bends a great circle: a circular arc
  (cheap to measure against), always steepening as it falls, clipped to the
  room the pitch has (`METEOR_PITCH_FLOOR` / `_CEIL`).
- **Constant pace** (`METEOR_SPEED`): a meteor does not slow down, it stops
  giving off light. One asymmetric light curve per roll (`meteorGlow`)
  climbs and is spent faster than it climbed. Flight is bounded by
  `METEOR_MIN_FLIGHT` / `METEOR_MAX_FLIGHT`; gone inside 1.7 s
  (`POKE_MS.meteor`, which the shader's `METEOR_LIFE` must match).
- **A small head, a short bright wake, a faint train.** What the eye sees of a
  meteor is a dash and a ghost, not the photograph's full path. The wake
  (`METEOR_WAKE_TAU`) is never shorter than about two frames of travel, read
  from the renderer's measured frame time (`uFrameSec`), so a slow machine
  gets a longer dash instead of a strobe. Each point of the train decays on its
  own clock, steeper than exponential (`METEOR_TRAIN_FALL`), so it never reads
  as a rigid stick on a dimmer.
- **Colour by the age of the air** (`meteorTint`): near-white head,
  sodium-orange metal just behind it, then the green oxygen line in the train.
  Each roll gets its own hue from a draw independent of the grade.
- **Costed by one test**: everything it draws lies on its arc's circle, so
  `abs(length(p - centre) - radius) > METEOR_REACH` skips the rest for almost
  every pixel.
- Drawn over the stars and under the cloud decks, so a drifting deck hides a
  lingering trail; brightness scales with `scene.stars`.

To see it: force **Clear**, drag the clock into the night, click the
background.

## The gust (rain and snow)

While it is raining or snowing, drag a hand across the background and you stir
up a breeze; stop or let go and it dies away. **A hand adds a term to the
wind**, and everything the sky does with wind it already knew how to do
([Where the weather falls](./ambient-sky.md#where-the-weather-falls)), so there
is no second physics and nothing to hand back.

| | |
|---|---|
| A hand that stops moving stops making wind | its stir goes stale within a breath (`GUST.stirTau`, 0.1 s); resting a finger does nothing |
| A flick raises a puff, a long sweep a gust | the gust rises over `GUST.attack` (0.13 s), so a short gesture never quite reaches full strength |
| Letting go needs no announcement | the stir stops arriving and the gust passes over `GUST.release` (1.6 s) |

Rise and fall differ by more than ten times: a gust arrives all at once and
then passes, and the rate is chosen on rising or falling, not on stirring or
not (a hand that reverses whips it up fast). `GUST.max` is 1.1, above the
forecast's own top (50 km/h ⇒ 1.0): a gust may be briefly harder than any
weather on screen. Against one 0.5 s swipe, the rain's lean peaks with the
gust; the snow's goes on rising for two seconds after, then comes home with no
overshoot. That gap is what reads as weight.

| Piece | Job |
|-------|-----|
| `lib/wallpaper/stir.ts` (`attachWindStir`) | Recognises the gesture and reports the hand's horizontal speed in CSS px/s. |
| `WallpaperRenderer.stirWind()` | The air: staleness, rise and fall, and how each field is re-aimed. |
| `shader.ts` | Draws it, through the four fall uniforms only. |

What it does not do:

- **No `preventDefault`, no style touched.** Every listener is passive;
  scrolling, tapping and selecting behave as without it.
- **Only the horizontal component counts.** A vertical scroll leaves the
  weather alone.
- **Touch events, not pointer events.** A touch drag that becomes a scroll
  fires `pointercancel` and stops sending `pointermove`, cutting the gesture
  off where it is most fun.
- **Off** when the sky is dry, in the picker's preview tile, and under
  Gradient / Classic.

To see it: force **Rain** or **Snow**, drag across the background.

## The fog wipe (fog)

On a foggy day, dragging across the wallpaper wipes the mist clear along the
path, and the fog closes back over it within a few seconds. Fog is the one
condition where the medium is literally between you and the view, so it is
the one with a gesture already attached.

- **Tap**: one soft mark, about 5.6 % of the viewport height across, with no
  edge. **Drag**: the swath follows the path. **Write**: a short word, and then
  the hand has had enough.
- **Close**: every point gives back from the instant it is made, on an
  exponential with a long tail (`WIPE_DECAY`), gone inside `WIPE_LIFE_MS`
  (8 s). No hold: mist never lets you watch a finished mark.

**A path, not a point.** A fragment shader has no memory, so
`WallpaperRenderer.wipe(x, y)` keeps a bounded ring of the path's recent
**corners**, and `fogWipe()` sweeps the swath along the polyline. No FBO, no
second pass, no texture.

- Every coalesced pointer sample goes in, in order, so a fast curve is not the
  chords between frames.
- Corners are committed by **shape**: when the distance travelled since the
  last corner drifts from the straight-line distance by `WIPE_SLACK`. A
  straight run spends one per `WIPE_MAX_GAP`; a letter spends what its curves
  ask for.
- Strokes are separate (each corner says whether it continues the last), and
  a move longer than `WIPE_JUMP` starts a new one.
- The live corners' bounding box goes to the shader as `uWipeBox`; outside it
  a pixel costs one box test.

**What it uncovers.** The point of wiping is that there is a real sky up
there. But on a fog day the scene has already hidden it: cover 0.75 zeroes the
stars and fog 0.9 leaves the moon at 0.07. So the scene also hands over
`scene.behind` (the stars and moon with neither the fog nor its deck in
front), and the shader lerps toward it by how much murk a fragment has lost.
Gated on `uFog`, three things yield together: the fog, the deck (on a fog day
the deck *is* the murk), and the night sky (`uStarsBehind`, `uMoonBehind`) at
the brightness a clear sky would give it. Clear air scatters less, so the
swath sits a shade darker than the mist.

**No circles, no edges.** A circle in fog reads as a lens: the field is looked
up through a domain warp of the fog's own noise, the width pushed round by two
more scales, with streaks of mist left standing. And the falloff is a
Gaussian, which has no shoulder at any width and so no outline; an outlined
stroke is the most pen-like thing there is. The swath drifts downwind and
settles as it ages, resolved against gravity like a fall (`aimWipe`), so a
tilted phone leans the drift too.

**The hand tires** (`lib/wipe.ts`). Rubbing a misted window for real, the
finger soon stops bringing anything up; rest a moment and it works again. That
is what separates a wallpaper that answers you from a drawing board.

- Spent by distance rubbed (`WIPE_DRAIN`) down to a floor (`WIPE_SPENT`), so a
  tired hand still smears a little. One sweep across leaves about a quarter;
  the budget is meant to be felt inside the first stroke.
- Recovered by time off the glass (`WIPE_RECOVER`, after a gap longer than
  `WIPE_REST_S`). Lifting between letters does not refill it; waiting does.
- Each corner keeps the charge the hand had, so the falloff runs *along* the
  path. It rides in the sign-and-magnitude of `uWipe[i].w`.

**It does not fight the page.** On a mouse it waits for the slop, so a click,
double-click and word-select on the sky work as before. Once it is a wipe,
text selection is suppressed for the stroke. It never starts on a widget
(dnd-kit's sorting is untouched) and stands down in the home grid's edit mode,
where a tap on the background means Done.

### Touch, where scroll has first claim

A finger on the sky could be a scroll, and that cannot be settled by watching
which way it goes: only a non-passive `touchmove` stops a scroll, and only
before it starts, which on iOS is before the finger has moved. So **a long
press arms it**, on the same 400 ms as the widget grid (`TOUCH_HOLD_MS`,
`TOUCH_ACTIVATION`).

- Nothing is bound until the hold is good; the page scrolls on the browser's
  fast path. The non-passive listener is attached when a stroke arms and
  removed when it ends.
- Drifting past `WIPE_ARM_SLOP_PX` first means it was the scroller's; nothing
  was taken.
- Arming opens the mist under the finger: the only "ready" tell, and it is the
  effect itself.
- **Writing is letters**: for `WIPE_RESUME_MS` (1.2 s) after a stroke, a touch
  landing within `WIPE_RESUME_NEAR` of where it ended arms at once.
- A second finger is a pinch or a new scroll; the gesture is given back.

Checked under touch emulation: a plain swipe scrolls 245 px and draws nothing;
a hold then a drag straight down scrolls 0 px and draws; the next stroke
inside the resume window draws with no hold.

To see it: force **Fog**, drag across the background (on a phone, hold first).

## The sky window (any weather)

Pull the home screen down and the stage becomes a **window**: the compass says
which way you face, the pitch how far up you look, the roll which way is
level. The sun and the moon are where the ephemeris puts them: turn round and
they are behind you, tip the phone down and there is a horizon with ground
under it. Swipe up and it is a wallpaper again. `lib/sky-window.ts`.

It is the reading of the gyroscope that [the tilt](./ambient-sky.md#gyroscope-tilt)
deliberately is not: there the stage stays a composition with a gravity in it;
here the view turns, so the gradient, the bodies, the stars, the clouds and
the fog all turn with it.

### Frames and the compass

The world is East-North-Up, azimuths clockwise from north as `lib/solar.ts`
gives them. A view is three unit vectors: the screen's right, its top, and
where it looks (out of the back of the phone), from the W3C angles
`R = Rz(α)·Rx(β)·Ry(γ)` turned by `screen.orientation.angle`. Gravity read off
the view matches `gravityFromOrientation`, so the window's horizon and the
rain's fall never disagree.

| Browser | Where north comes from |
|---|---|
| Chrome / Android | `deviceorientationabsolute`; while it streams, the relative event is ignored |
| Firefox | `deviceorientation` with `absolute: true` |
| Safari / iOS | alpha is relative to where listening started; `webkitCompassHeading` rides beside it, and the offset is estimated only while the phone's top edge lies level enough to point anywhere |
| No compass | the first reading is anchored onto the stage's own heading (south; north in the south); the devtool marks the heading with `~` |

**True north, not magnetic.** Every browser compass is magnetic, and the
declination is often over 10° (+13° in San Francisco, −12.5° in New York). So
each heading is turned by the declination at the observer's place and time
from the World Magnetic Model (`lib/magnetic.ts`: WMM2025 coefficients, valid
2025–2030, held at the nearest end outside), carried on the scene as
`celestial.declination` and 0 without coordinates. It is checked against the
model's 100 published test values. No global model removes a steel desk or a
case magnet.

### Through the glass

The renderer does the geometry, the shader the pixels. `uWindow` eases 0 → 1
over `WINDOW_TAU` and every line that reads the window's uniforms sits behind a
test of it, so at 0 the stage is bit-identical to a build without the window.

- **The sky is coloured by elevation**: each pixel is a ray, and the gradient
  reads `HORIZON_Y + 0.9·sin(elevation)`, the mapping the stage uses to place
  the sun.
- **The bodies are projected**: a pinhole, `WINDOW_FOV_DEG` (80°) along the
  screen's longer side. A body behind you is parked off-screen in its
  direction, so its glow falls away as it swings round.
- **They fly there**: they hold where the stage had them, then after
  `BODY_FLY_DELAY` (0.25 s) fly over `BODY_FLY_SEC` (1.2 s) on a slight arc
  to where they really are. A moon behind you flies off the edge you would
  turn toward.
- **Edge hints** (`<SkyBodyHints />`, glyphs from `components/body-glyph.tsx`):
  a body up but off the glass gets its solid glyph and a chevron at the screen
  edge, on the line toward it, at 60 %. The sun has rays and the moon never
  does. Through a sunrise or sunset window the sun's hint is a
  `SunEventGlyph` pointing at its light (`sun.light` on `WindowBodies`): the
  sun while up, the horizon under it once down. The renderer publishes bodies
  each frame (`lib/sky-bodies.ts`); the hints move their own elements, with no
  React render per frame.
- **The crescent faces the sun** along the great circle between them, whatever
  the roll.
- **Cloud decks are planes overhead**, converging on the horizon and giving way
  near it to what they average to, which is what a real overcast does there.
- **Stars sit on a sphere turning with the sidereal clock** (`celestial`:
  latitude and local sidereal time), each at least a pixel wide so it does not
  pop as the view moves.
- **Below the horizon is ground**: the horizon's colour, darker toward your
  feet.
- **Rain leans by the wind across your line of sight** (`windWorld`) and falls
  along real gravity whatever the tilt switch says, because a window has a
  world in it.

In screen space still: the rain and snow fields themselves, lightning, the
strike, the meteor and the fog wipe, which are things in front of the glass.

**Session-only**, and paused (eased back to the stage) away from the home. Off
under reduced motion; the picker's Sky tile never follows it.

### The pull

The home composition sits low, sky above. **Pull it down from the top and it
sinks: the eyes lift.** Past a line, letting go opens the window and the home
carries on out of the bottom of the frame. **Swipe up** (`RETURN_SWIPE_PX`) to
bring it back. `lib/sky-pull.ts`.

Why a pull: down on the page is up with the eyes; everybody pulls the top of a
page down out of habit, so it is found the way an egg should be; it shares
nothing with the hands-on-wallpaper eggs; and it needs no permission to
detect.

**Something is up there.** A pull with no answer stops halfway, so as the
page comes down the body that is above the horizon descends from above the top
edge (`<SkyPullCue />`), drawn as **light** (a white body with a bloom) over
"keep pulling to look up", becoming "let go to look up" at the line, with a
tick where `navigator.vibrate` exists. Through a sunrise or sunset it is the
event's glyph. The sky's gradient lifts under it (`uLift`, up to 0.16 of a
screen); the bodies, clouds and stars hold still until the window opens.

**No React per frame.** The recognizer writes three CSS variables on what
follows the finger (`[data-sky-exits]`: the home content and the search button;
and `.sky-pull-cue`), not on `<html>`, so a move repaints those instead of
restyling the document through inheritance. It sets the pulling / armed /
returning attributes on `<html>` and calls `WallpaperRenderer.previewWindow()`;
`wallpaper-background.tsx` sets `data-sky-window` once the window opens. CSS
("The sky pull" in `app/globals.css`) does the moving.

| Variable | Meaning |
|---|---|
| `--sky-pull` | how far the page has followed (with rubber-band resistance) |
| `--sky-pull-progress` | how far to the line |
| `--sky-pull-reveal` | how much of the hint shows: nothing for the first `REVEAL_FROM_PX` (46 px of page, ~8 mm of finger), then a smoothstep all the way to the line |

| Attribute | The home |
|---|---|
| `[data-sky-pulling]` | follows the finger, fading a little |
| `[data-sky-armed]` | past `PULL_ARM_PX` (104 px), disarmed only below `PULL_DISARM_PX` (96), so a trembling finger does not flicker the caption |
| `[data-sky-window]` | accelerates out of the bottom and becomes untouchable |
| `[data-sky-returning]` | eases back after a short pull or when the window closes |

At rest there is no transform at all, since one on `<main>` would make it the
containing block of everything fixed inside it.

**It claims the touch on its first move**, because a browser that has begun
scrolling will not let a `touchmove` be cancelled, and cancelling is the only
way to stop iOS's rubber band and Chrome's pull-to-refresh. So the claim is
narrow: at the top of the page, moving down more than sideways, on
`.system-surface` (the home; see
[Four voices](./design-system.md#four-voices-chrome-surface-voice-document)),
within `CLAIM_BEFORE_MS` (320 ms) of landing, measured on the events'
timestamps, since a finger that rested first is picking up a widget. In the
window every move over the sky is cancelled; a sheet or the Dock keeps its own
touches, and taps still reach the strike and the meteor.

### Asking for the window

On WebKit motion is behind `DeviceOrientationEvent.requestPermission()`, so
while that gate stands **the pull brings up what the window does, with a
button that asks** (`SkyWindowSheet`). Past the gate, or where there is none,
the pull simply opens the window. It is offered every time the gate stands: a
pull past the line is deliberate enough that answering it is not a nag. A yes
also turns the tilt's wish on, so a rainy day has nothing left to offer.

- **The picture** is a phone panning across a faint sky, the same sky drawn in
  full inside it and holding still while the phone moves; the sun comes into
  the window and goes. CSS, nested so the inner world undoes the phone's
  travel; paused at 0% under reduced motion.
- **The outcome**: granted (1.4 s, "hold the phone up and turn around", the
  window already opening behind), refused (3.0 s, parked between the sun and
  the moon, and where to undo it), neither (the buttons come back). A pull
  after an earlier refusal opens straight onto the refusal.
- **The place in the same breath.** A window true to north over the wrong city
  has failed, and the IP guess is often a city off. So while the place in use
  is only that guess (`locationStatus` is `askable`), the sheet says it will
  ask for the location too, and one tap asks for both through
  `usePermissions` ([Permissions](./system-ambient.md#permissions)). The
  location offer is made once a session (`skyLocationOffered`); the pull and
  the sheet decide whether to ask with one function, `skyAsksPlace`, so the
  sheet never says something the pull did not mean.

**Devtool.** Sky → Window toggles it (on a desktop too) and reads out heading ·
pitch; while it is on, Heading and Pitch sliders drive the view by hand until
the row's star hands it back to the sensor. The **Motion** fold shows what the
sensor says: where north came from (`absolute`, `flagged`, `webkit`,
`anchored`, `simulated`), the event rate, raw α β γ, the screen angle, WebKit's
compass heading and accuracy, the offset and declination applied, the view's
heading, pitch and roll, and which settle reasons stand.
