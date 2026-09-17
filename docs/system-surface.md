# Surface System

One secondary surface, three shapes.

```
systems/surface/
├── presentation.ts       # SurfaceMode, breakpoints, useSurfaceMode()
├── adaptive-surface.tsx  # <AdaptiveSurface>, useSurfaceContext()
├── sheet.tsx             # <SurfaceSheet> — the one bottom sheet, detents, scrim
├── stack.ts              # which sheets are open, so a sheet under another recedes
└── index.ts
```

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
| `window` | Centred, draggable, morphs in | Desktop. Move it out of the way. |

`window` is not a drawer. It springs in with the same curve
`systems/windows` uses to open an app from its shelf icon, and drags by its
header through the shared `useDraggable` hook — so it inherits the devtool's
per-instance drag settings like every other draggable thing on the site.

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
| `maxHeight` | Caps window and sheet height. |
| `snapPoints` | Detents for the sheet shape, lowest first; a drag carries it to the top. |
| `contentClassName` | Overrides the scroll area's padding, for content that bleeds wider. |
| `scrollRef` | The scroll container, for content that scrolls a row into view. |

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

**Arriving.** A sheet should rise, and rise at the size it is going to be. Two
things get in the way, both handled in `sheet.tsx` and the motion block:

- Base UI resolves a detent's offset from measurements — the popup's height and
  the viewport's — so on the first painted frame the offset is `0`, which *is*
  the top detent: the sheet lands full height and then slides down into its
  detent. The offset is no mystery though (`popupHeight - detentHeight`), so
  the popup carries the same sum in CSS as `--surface-snap-fallback` and stands
  on it for the length of the entrance (`data-surface-entering`); Base UI's own
  value lands underneath, identical, before the mark comes off.
- A `keepMounted` sheet is hidden with `display: none` while closed, and
  nothing transitions out of `display: none` — there is no painted "before" to
  travel from, so Base UI's starting style does nothing and the sheet simply
  appears. `data-surface-arriving` gives it one painted frame at the bottom
  edge (set from the render that opens the sheet, released two frames later —
  a rAF callback runs *before* its own frame is painted) and the sheet travels
  up from there.

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

**Content height.** `height="auto"` (or `fit-content`) makes the sheet exactly
as tall as what it holds, up to the screen — an action sheet rather than a
surface with a size of its own; the window menu on touch
(`systems/windows/components/window-chrome.tsx`) is one. Only a sheet without
detents can do it: with detents the popup's height *is* the travel the padding
above is subtracted from. The popup gives up its fixed height and the shell
gives up `flex-1` (a basis of zero in a box sizing to its own content is a race
the content loses), so the height comes from the rows.

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

**Keeping a sheet alive.** `keepMounted` leaves a closed sheet's DOM in place
(Base UI hides the popup instead of unmounting it), for content that must keep
running while it is put away: an app window on a phone
([system-windows.md](./system-windows.md)) is a sheet, and closing one would
otherwise reload its iframe and lose the app's state.

**A grip of its own.** `grip` replaces the grabber for a sheet whose handle
says more than "drag me" — the window grip, which is also the window's menu
button. It renders where the grabber does, above `Drawer.Content`, so a mouse
press on it still starts a drag. `gripOverlay` floats it over the content
instead of giving it a row, for a sheet holding something that is not a
document: an app window's chrome has always been a pill over its content, never
a title bar. Two things bite anything built there: Base UI
never starts a swipe from a `<button>` (or `a`, `input`, `label`,
`[role="button"]`), and once a press becomes a swipe it captures the pointer,
so no further move, up or click arrives. Items 7 and 8 of the list at the top
of `sheet.tsx`.

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

Adding a second is: register a draggable id, pick a presentation, pass content.
