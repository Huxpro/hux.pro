# Surface System

One secondary surface, three shapes.

```
systems/surface/
├── presentation.ts       # SurfaceMode, breakpoints, useSurfaceMode()
├── adaptive-surface.tsx  # <AdaptiveSurface> — the policy: viewport picks the shape
├── sheet.tsx             # <SurfaceSheet> — the one bottom sheet, detents, scrim
├── window.tsx            # <SurfaceWindow> — the one floating, draggable shell
├── chrome.tsx            # <SurfaceBody> — the title bar, scroll area and footer
├── stack.ts              # which sheets are open, so a sheet under another recedes
└── index.ts
```

## Two layers

Shape is usually the viewport's call, and `<AdaptiveSurface>` is that rule. But
it is a rule, not a law: the devtool's shape is something the developer chose
by pulling the sheet off the bottom edge. So the shells sit underneath it,
usable on their own:

```
primitives   <SurfaceSheet>   docked to an edge, detents, stacking
             <SurfaceWindow>  floating, draggable, morphs in
             <SurfaceBody>    the chrome all of them hold
policy       <AdaptiveSurface>  = viewport → primitive
             DevtoolFAB         = gesture  → primitive
```

Two features already compose the primitives directly: the command palette,
whose header is a search field rather than a title bar, and the devtool, whose
shape is a gesture's business (see [Devtool System](./system-devtool.md)).
Both still get the same shell, gaps, detents and stacking.

## The problem

The site keeps growing secondary surfaces — the music playlist, the wallpaper
picker, whatever comes next. Each wants a different shape at a different size,
and every one of them was re-deciding that on its own: its own `matchMedia`
listener, its own drawer wiring, its own glass shell, its own header. Copies
of one judgement call, free to drift apart.

The judgement is a property of the **viewport**, not of the feature. So it
lives here, once.

## The three shapes

| Mode | Where | Why |
|------|-------|-----|
| `sheet` | Bottom edge, drag-to-dismiss, grabber | Phone. Thumb reach. |
| `panel` | Trailing edge, full height | Tablet. Content beside content. |
| `window` | Floating, draggable, morphs in | Desktop. Move it out of the way. |

`window` is not a drawer. It springs in with the same curve
`systems/windows` uses to open an app from its shelf icon, and drags by its
header through the shared `useDraggable` hook — so it inherits the devtool's
per-instance drag settings like every other draggable thing on the site. It
rests near the top centre unless `windowPlacement` says otherwise; the devtool
asks for `top-right`, where it has always been and where it stays out of the
page it exists to watch.

No shape takes the page away. There is no scrim, the page stays interactive,
and touching it does not close the surface; its close button, Escape and a drag
do. The surfaces here are all about the page behind them, and a surface that
closed on every touch of a live page could not be used.

(This is what `modal={false}` means to Base UI, and it means it literally: it
touches neither `<body>`'s pointer events nor its position. A non-modal surface
also passes `disablePointerDismissal`, because a press on a live page belongs
to the page.)

The one exception is a launcher. The command palette's sheet is modal: the page
stops answering while it is up and a press on it dismisses, the click-away its
desktop popover has. See **The sheet primitive** below.

## Declaring a presentation

A feature states intent as a breakpoint map and stops thinking about it:

```tsx
<AdaptiveSurface
  id="surface-playlist"
  open={isOpen}
  onOpenChange={setOpen}
  presentation={ADAPTIVE_PRESENTATION}   // sheet → panel → window
  title="playlist"
  closeLabel={t(locale, "musicClosePlaylist")}
  windowWidth="min(94vw, 980px)"
>
  {content}
</AdaptiveSurface>
```

Anything omitted inherits the next breakpoint down, so `{ base: "sheet" }` is a
sheet everywhere, and moving a surface between shapes is a one-word change:

```ts
ADAPTIVE_PRESENTATION  // { base: "sheet", sm: "panel", lg: "window" }
DRAWER_PRESENTATION    // { base: "sheet", sm: "panel" } — never floats free
```

Breakpoints match Tailwind's (`sm` 640, `lg` 1024) so a surface and the content
inside it respond at the same widths rather than a few pixels apart.

`useSurfaceMode()` (a `useBreakpointValue()` typed to the three shapes — a
surface with a vocabulary of its own, like the command palette, uses the
generic one against the same breakpoints) starts at `base` so SSR and the first client render agree,
then settles on the real viewport in an effect, and tracks it live — a resize or
a rotation moves an **already-open** surface into its new shape rather than
waiting for a reopen.

## Content that adapts

Most content should not care which shape it landed in. When it genuinely does —
a 980px desktop window wants the track list in columns, a phone sheet does not —
read it rather than re-measuring the viewport:

```tsx
const { mode, isWindow, close } = useSurfaceContext();
```

## Props worth knowing

| Prop | For |
|------|-----|
| `id` | Draggable instance key in window mode. Register it in `DRAGGABLE_INSTANCES`. |
| `title` / `actions` | Header content. `actions` sits left of the close button. |
| `windowWidth` | Window mode only; drawers size against their edge. |
| `windowPlacement` | Where the window rests before a drag: `center` (default) or `top-right`. |
| `maxHeight` | Caps window and sheet height. |
| `snapPoints` | Detents for the sheet shape, lowest first; a drag carries it to the top. |
| `contentClassName` | Overrides the scroll area's padding, for content that bleeds wider. |
| `scrollRef` | The scroll container, for content that scrolls a row into view. |
| `footer` | A strip below the scroll area, in every shape. It does not scroll away. |

`<SurfaceSheet>` has one prop `<AdaptiveSurface>` does not pass on:

| Prop | For |
|------|-----|
| `onPullPastTop` | The drag that lifts a sheet off the edge it is docked to. |

**Pulling a sheet off the edge.** A drag may carry a sheet past its top edge,
and `onPullPastTop` fires when it is released more than `PULL_PAST_TOP_TRAVEL`
real pixels past it — a surface that has somewhere else to be can take that as
"come off the edge". The devtool does; nothing else needs to, and without the
prop the overshoot stays a rubber band.

It measures the **pointer**, not the popup. Base UI damps the overshoot with a
square root and its swipe-start threshold has already eaten ~17px of the
gesture: measured on an iPhone 13, a 207px pull from the 0.7 detent arrives as
1.6px of published movement. That number draws a good rubber band and is a
terrible reading of intent. What the finger says instead is `travelled up −
the offset the sheet had to climb through`, so one continuous pull both resizes
the sheet and, once it is against the ceiling, keeps counting.

The threshold is small (14px) because the budget is small: most of a pull is
spent resizing, and what is left is the distance from the grabber to the top of
the glass — about twenty pixels. A pull that stops at the top still snaps to
the full detent; only one that keeps going detaches, and the shell carries
`data-pull-armed` in between so the difference is visible.

## The sheet primitive

Every phone shape is one `<SurfaceSheet>` (`sheet.tsx`): a [Base UI
Drawer](https://base-ui.com/react/components/drawer), the glass shell, the
grabber, the edge gaps. `AdaptiveSurface` composes it for its sheet mode and
adds the title bar and scroll area. A surface whose header is not a title bar
composes it directly — the command palette, whose header is its search field —
and still gets the same shell, so a sheet is a sheet whatever it holds.

```tsx
<SurfaceSheet id="command" open={isOpen} onOpenChange={…}
  modal                       // scrim: page blocked, tap outside dismisses
  snapPoints={[0.7, 1]}       // detents; opens at the first
  activeSnapPoint={snap} onActiveSnapPointChange={setSnap}
  restoreFocus={false}        // a sheet stacked on one with a field: see below
  label="Command palette">    // sr-only dialog name (or render a Drawer.Title)
  {content}
</SurfaceSheet>
```

**Two boxes.** `Drawer.Popup` is a transparent positioning box the height of
the sheet's whole travel; the glass shell is the flex child inside it. Base UI
moves a sheet by translating the popup, so a one-box floating sheet would push
its own rounded bottom off screen at a lower detent. The popup carries the same
offset as bottom padding, so the shell stays planted a gap above the bottom edge
and grows and shrinks from the top — at rest and under the finger alike. Past
the lowest detent (`--surface-detent-floor`) the padding stops and the sheet
slides away whole, because that drag is a dismissal, not a resize.

**Detents.** `snapPoints` are fractions of the viewport, iOS's medium and large;
the site has one set, `SHEET_DETENTS` (`[0.7, 1]`), so sheets stacked on one
another stand level. A sheet with detents opens at the detent of the sheet
beneath it when that is one of its own (the stack publishes each sheet's
`level`; a fixed-height sheet names its with the `level` prop), and at the
first otherwise — so the wallpaper picker over the palette arrives level with
the palette, and can still be pulled to the top over it, as an iOS child sheet
can stand taller than its parent.
Base UI publishes the active one as `--drawer-snap-point-offset` and the live
drag as `--drawer-swipe-movement-y`, both on the popup; everything that reads
them is one block in `app/globals.css`, *Secondary surface motion*, on the
site's own curve (`SURFACE_EASING`, `SURFACE_TRANSITION_MS` in `stack.ts`).

**Modal.** The scrim is the viewport — `Drawer.Viewport` is already a
transparent, full-screen box containing the popup, so when `modal` is on it
takes the page away and a press on it dismisses; when it is off it is
`pointer-events: none` and only the popup takes pointers. Base UI's scroll lock
is safe under the bezel where Radix's was not: on iOS it only sets `overflow:
hidden` on whichever element scrolls the viewport, never `position: relative` on
`<body>`, and it stands down entirely when that element is already locked —
which is the state `@hux/bezel` leaves the page in during container scroll
(`<html>` hidden, `<body>` fixed at inset 0). Independently, the bezel keeps
`<body>` at `overflow: clip` rather than `hidden`: `hidden` is a scroll
container that `scrollIntoView` can still move, and a sheet resting below the
edge at a lower detent is exactly the overflow it would move it for.

**Content, not a handle.** Everything below the grabber is wrapped in
`Drawer.Content`. Without it a *mouse* press anywhere in a sheet starts a swipe,
the drawer takes the pointer, and the click never reaches the row that was
pressed. A touch drag still dismisses from anywhere; Base UI reads the scroll
containers so a drag inside a list scrolls the list.

**Focus on close.** A sheet returns focus to what opened it, unless
`restoreFocus={false}`. A sheet stacked on one with a text field turns it off:
focus handed back to a field is a focused field with no keyboard, and iOS opens
the keyboard on the next touch anywhere, whatever it was aimed at.

**Keyboard.** `Drawer.VirtualKeyboardProvider` wraps every sheet and publishes
`--drawer-keyboard-inset`; the shell takes it as a bottom margin, so a sheet
with a field in it rests on the keyboard rather than behind it. A sheet with no
fields never notices.

## Working with Base UI

The sheet's motion is written against Base UI Drawer's contract — the data
attributes and custom properties it publishes — and that contract lives in its
docs, its nested demo and its source, not in its types. Before changing
`sheet.tsx` or the *Secondary surface motion* block in `globals.css`, read the
numbered block at the top of `systems/surface/sheet.tsx`; it is the list of
what has already been got wrong. In short:

- `--drawer-swipe-progress` is the fraction of the way out only for a sheet
  without detents; with detents it is the position between them. A sheet whose
  parent must follow its swipe has no detents.
- The swipe variables are registered non-inheriting; a descendant opts in
  with `--name: inherit`.
- An exit is over when `popup.getAnimations()` is empty a frame after
  `data-ending-style`. A popup must never carry `transition: none` on that
  frame; drop the duration, keep the property.
- Nesting is React nesting; sheets in sibling subtrees use `stack.ts`.
- A closing dialog returns focus to its opener; where that is a field on a
  touch device, `restoreFocus={false}`.
- Test each gesture path on its own: click, touch tap, swipe release,
  programmatic focus.

Base UI: https://base-ui.com/react/components/drawer — nested demo under
`docs/src/app/(docs)/react/components/drawer/demos/nested/` in its repository.

## Stacking

iOS stacks sheets: presenting one from another sends the first back a step —
smaller, dimmer, a little higher, inert — and brings it forward again when the
one on top goes. That is a relationship between surfaces, not a property of
either, so it lives in `stack.ts`: a module-level store (the surfaces mount in
different subtrees, and a store needs no provider to reach them all) that every
open sheet registers with in order. A sheet with another opened after it reads
`behind` and recedes; it deregisters on close rather than on unmount, so the
one behind comes forward in step with the top sheet's exit. The recede takes
its own curve (`SURFACE_RECEDE_EASING`, ease-in-out): a sheet starts moving a
frame after its parent's depth changes, and on the travel curve that frame
would already be a third of the recede — the parent would flinch before the
child arrives.

Base UI has nested drawers of its own, with `data-nested-drawer-open` and
`--nested-drawers`, but a drawer is only nested when it is a React child of
another one. The wallpaper picker, the playlist and the palette all mount in
sibling subtrees of the root layout, so `stack.ts` stays for those. Where a
sheet *is* nested — the palette's slash sheet — the parent's depth comes from
Base UI instead: `--nested-drawers` less the child's `--drawer-swipe-progress`,
so the parent comes forward under the finger as the child is pulled down, with
transitions off while `data-nested-drawer-swiping` is set. Both feed the one
`--surface-depth` the shell is drawn from.

Every sheet over a sheet is a true stack: close the top one and the one
beneath comes forward. The palette under the wallpaper picker steps back one;
under the slash sheet and the picker, two — `depth` from the stack plus Base
UI's own count of nested sheets, one `--surface-depth` on the shell. See
[Command System](./system-command.md).

## Adopters

| Surface | Presentation | Notes |
|---------|--------------|-------|
| Music playlist | `ADAPTIVE_PRESENTATION` | macOS-sized window (980×620), track list breaks into columns |
| Wallpaper picker | `ADAPTIVE_PRESENTATION` | 3-column tile grid in window mode; `SHEET_DETENTS` as a sheet |
| Command palette | `{ base: "sheet", sm: "popover" }` via `useBreakpointValue` | `SurfaceSheet` directly, detents `[0.7, 1]`, modal; its wide shape is its own Spotlight popover, not an `AdaptiveSurface` |
| Devtool panel | primitives, not `AdaptiveSurface` | `SurfaceSheet` docked / `SurfaceWindow` floating, and which one is the developer's call, not the viewport's — it is pulled off the edge by hand. `onPullPastTop`, `placement="top-right"`, a `footer` for its status line. See [Devtool System](./system-devtool.md) |

Adding a second is: register a draggable id, pick a presentation, pass content.
