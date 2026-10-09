# Motion

The site's motion language: three curves, a few durations, what moves and
what only fades, and what reduced motion turns each into. The mechanisms
themselves (sheets, the Dock panel, page transitions, the palette) live in
their own docs; the table at the end points to each. This page is what they
share, and what a new animation should match.

Motion is functional, not expressive: it says where something came from,
where it went, or that a state changed. If motion doesn't explain something,
remove it.

## What it looks like done well

- A sheet leaves at speed and settles long, with no overshoot. Two thirds of
  the way there in the first fifth of its time, it reads as answering the
  tap rather than performing.
- A sheet stepping back behind a new one starts gently, so it never
  flinches before the new sheet arrives.
- Content that changes inside a surface that stays (a primer's steps, the
  palette's modes, the floating button's label) crossfades while the box
  eases to its new size. Nothing cuts; nothing slides in from nowhere.
- A page change crossfades the page; only `λhux` and the Ask ball travel,
  because they are the same thing on both pages.
- Hover and press are colour, short. A press lands on the touch-down frame
  and eases out on release.
- Under reduced motion every state still changes, at once.

## The curves

![A plot of distance covered over time for three curves. Travel, blue, rises steeply and is at 66% by a fifth of the time; Fade, green, is at 50%; Standard, orange, starts flat and is at 13%. A legend below gives each curve's value, the constant or class that carries it, and what it is for.](/img/docs/motion/curves.svg)

The dashed line is the first 100ms of a 500ms sheet. Travel has covered two
thirds of the distance by then, which is why a surface feels immediate on
it; Standard has barely started, which is why the recede uses it: the step
back trails the arriving sheet by a frame, and on Standard that frame is
invisible.

- **Travel**, `cubic-bezier(0.32, 0.72, 0, 1)`: iOS's fast start and long
  settle, for something that goes somewhere or changes size. Sheets
  arriving, leaving and changing detent; the Dock panel and its pills; the
  floating button's morph; `SurfaceMorph`'s height; a window minimising; the
  signature's clip on `/works`; the hash-landing scroll; Vitre's chrome
  morph. Spelled `SURFACE_EASING` (`systems/surface/stack.ts`, exported from
  `@/systems/surface`), `--surface-easing` on a surface's popup,
  `ease-[cubic-bezier(0.32,0.72,0,1)]` in a class, `ease: [0.32, 0.72, 0, 1]`
  in Motion.
- **Standard**, `cubic-bezier(0.4, 0, 0.2, 1)`: for answering a pointer
  (colour, opacity, press release) and for motion behind another (the sheet
  recede, the `site-identifier` and `ask-ball` view-transition groups).
  Spelled `SURFACE_RECEDE_EASING` / `--surface-recede-easing`; it is also
  Tailwind's default for any `transition-*` without an `ease-*` class, and
  its `ease-in-out`, so `transition-colors duration-200` is already on it.
- **Fade**, `ease-out`: for opacity alone (the page crossfade, the
  signature's lines). Tailwind's `ease-out` is `cubic-bezier(0, 0, 0.2, 1)`;
  the CSS keyword is
  `cubic-bezier(0, 0, 0.58, 1)`. The palette popover also runs its
  mode changes, size included, on it (`duration-300 ease-out`).
- **Spring**: a desktop window arriving (`WINDOW_SPRING` in
  `systems/surface/window.tsx`: stiffness 520, damping 34, mass 0.7), and
  anything a hand let go of settling inside the viewport (`useDraggable`,
  500 / 30).

The travel curve has no single CSS token outside a surface: each site
spells it in full (`--sig-ease`, `MOVE` in `systems/dock/components/dock.tsx`,
the class string in `systems/dock/components/use-band-occupant.ts`). Spell it
exactly; a near miss is a second curve. From TypeScript, import
`SURFACE_EASING` where a string will do.

A handful of local curves exist for one gesture each (the press-and-hold
grow and the widget lift in `globals.css`, a window's snap, the tilt primer).
They belong to their mechanism and are not a palette to pick from.

## Durations

Longer for farther, and nothing a visitor waits on past 500ms.

| Duration | For | On the site |
|----------|-----|-------------|
| 100–150ms | Small things appearing at a pointer | Menus, tooltips, hover cards, selects (`components/ui`, `duration-100`); Ask's placement target while it is dragged (`duration-150`); a window closing (0.15s) |
| 200ms, `duration-200` | Colour, opacity, a small transform answering a pointer | `transition-colors duration-200` on rows and chrome; the page crossfade; the palette card's `zoom-in-95` arrival |
| 300ms, `duration-300` | A change of layout in place: width, height, grid rows, padding | The palette popover's modes; a band occupant's width; `PinnedSlot`; the `λhux` and Ask-ball travel; the Dock panel's pop (`--dock-pop-duration`) and its pills (`MOVE`, 0.32s) |
| 400–500ms | Travel across the screen | `SURFACE_TRANSITION_MS` (500): every sheet's arrival, exit, detent change and recede; the floating button's morph (0.4s); `SurfaceMorph`'s height (420ms); a window minimising (0.42s) |
| 500–700ms | Ambient change nobody is waiting on | Wallpaper and theme fades (`duration-500`, `duration-700`) |

`SURFACE_TRANSITION_MS` is also a clock: code that has to wait for a sheet to
finish (`window-menu.tsx` running an action after the sheet closes,
`window-sheet.tsx` unmounting, `stack.ts` re-reading a band) waits that long.
Change it in `stack.ts` and the surface CSS (through `--surface-duration`)
and the waits follow, except one copy: the page making room for Ask at the
side (`#vitre-scroll`, a literal `500ms` in `globals.css`). The Dock panel's
pop is deliberately shorter and has its own `--dock-pop-duration`.

## What moves, what fades

- **Moves** (a transform along a path) when it has a place it comes from and
  a place it goes: a sheet from its edge, `λhux` and the Ask ball between
  pages, the Dock's pills reflowing, a window from its shelf icon.
- **Fades** when the box stays and what is in it changes: the page body,
  the palette's modes, `SurfaceMorph`'s steps, the floating button's label.
  Leaving is quicker than arriving, and the new content comes in a beat
  after the old has gone (`SurfaceMorph`: out 180ms, in 280ms after 90ms).
- **Scales** when there is nothing to travel from: the Dock panel pops from
  0.94 because its pill sits just above it; menus and the palette card
  `zoom-in-95`. A receding sheet steps 8px up and 5% smaller per sheet in
  front of it.
- **Height to `auto`** is either `grid-template-rows` between `0fr` and `1fr`
  (the palette popover) or a measured height eased on the travel curve
  (`SurfaceMorph`). Neither runs on the compositor: keep the content light.
- **A finger beats the curve.** While a sheet, the Dock panel or a window is
  dragged, it follows the pointer with no easing (`transition-duration: 0ms`
  on a drawer, never `transition: none`; the base-ui-drawer skill says why);
  the curve resumes on release, and a harder flick leaves faster
  (`--drawer-swipe-strength`).
- **Not on blur.** A transform on a `backdrop-filter` surface makes the
  compositor re-blur every frame, so the home's search bar presses with a
  colour wash and no scale (`systems/command/fab.tsx`). Chrome buttons that
  are not glass press with `active:scale-95`; media covers dim instead
  (`COVER_WASH`, [Design System](./design-system.md#touch)).
- **Not on small mono text.** A transformed layer re-rasterises 12px mono, so
  it shimmers and settles a pixel late. The signature on `/works` reveals
  each line with a `clip-path`, never a transform.

## Reduced motion

Every motion carries its reduced path next to it, and under
`prefers-reduced-motion: reduce` the state still changes; only the travel
goes. Nothing on the site does this globally:

- **CSS**: a `@media (prefers-reduced-motion: reduce)` block right after the
  rule, with `transition: none` or `animation: none` (the surface, Dock and
  view-transition blocks in `globals.css` are the models).
- **Tailwind**: `motion-reduce:` on the class (`motion-reduce:!transition-none`
  and `motion-reduce:animate-none` in `systems/surface/morph.tsx`,
  `motion-reduce:active:scale-100` for a press scale). `tw-animate-css`'s
  `animate-in` does not check the setting itself.
- **Motion** (`motion/react`): `useReducedMotion()`, then a zero duration or
  no animation (`lib/use-hash-landing.ts`, `components/ui/use-notice-yield.ts`).
  There is no `MotionConfig` at the root, so a `motion.*` element animates
  regardless unless its component asks.

What to turn it into:

- **Instant**, by default.
- **`0.01ms`, not `none`**, for an animation something waits on: the
  heading and commit washes (`[data-hash-target]`, `[data-commit-target]`)
  are removed on `animationend`, and `animation: none` never fires it.
- **A static cue** when the motion carried the meaning: Ask's handoff pulse
  becomes a steady `--ring` outline.
- **Paused**, for a looping demonstration (the tilt and sky primers): its
  first frame still explains.

## Adding motion

1. Say what it explains. If nothing, leave it out.
2. Pick the curve by what is moving (travel, standard, fade) and the
   duration by how far, from the sections above.
3. Spell the curve exactly, from `SURFACE_EASING` where you can.
4. Write the reduced path in the same place, and decide which of the four
   it is.
5. If a finger can drag it, switch the transition off while it does.
6. No transforms on glass or on small mono text.
7. If it is a sheet, the Dock panel or a page transition, it is already
   written: change it in its own block (below), not beside it.

## Where each mechanism lives

| Mechanism | Doc | Code |
|-----------|-----|------|
| Page transitions: the `root` crossfade, `site-identifier`, `ask-ball`, and their reduced motion | [Navigation](./navigation.md#page-transitions) | `app/globals.css`, "View Transition API Styles" |
| Sheets: arriving, leaving, detents, drag, the stack's recede, `SurfaceMorph` | [Surface System](./system-surface.md); skill `.claude/skills/base-ui-drawer` | `app/globals.css`, "Secondary surface motion"; `systems/surface/sheet.tsx`, `stack.ts`, `morph.tsx` |
| The Dock panel's pop and the pills | [Dock System](./system-dock.md) | `app/globals.css`, "Dock panel motion"; `systems/dock/components/live-activity.tsx`, `dock.tsx` |
| The palette's modes and the floating button's morph | [Command System](./system-command.md) | `systems/command/popover.tsx`, `fab.tsx` |
| Desktop windows | [Window System](./system-windows.md) | `systems/windows/components/window.tsx`, `systems/surface/window.tsx` |
| Press, cover wash, press-and-hold | [Design System](./design-system.md#touch) | `.pressable`, `.press-hold`, `COVER_WASH` |
| The iOS chrome morph and the status-bar tap | skill `.claude/skills/vitre` | `packages/vitre/src/chrome.ts`, `status-tap.ts` |
