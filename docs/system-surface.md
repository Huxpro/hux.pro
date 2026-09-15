# Surface System

One secondary surface, three shapes.

```
systems/surface/
├── presentation.ts       # SurfaceMode, breakpoints, useSurfaceMode()
├── adaptive-surface.tsx  # <AdaptiveSurface>, useSurfaceContext()
├── sheet.tsx             # <SurfaceSheet> — the one bottom sheet, detents, scrim
├── stack.ts              # which sheets are open, so a sheet under another recedes
├── live-page.ts          # keeps the page interactive under a drawer
└── index.ts
```

## The problem

The site keeps growing secondary surfaces — the music playlist, the wallpaper
picker, whatever comes next. Each wants a different shape at a different size,
and every one of them was re-deciding that on its own: its own `matchMedia`
listener, its own vaul wiring, its own glass shell, its own header. Copies of
one judgement call, free to drift apart.

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

(Radix turns the page's pointer events off under every dialog, and vaul turns
them back on only for opens it triggered itself, not for a controlled `open`
prop. `useLivePage` puts them back a frame later, so the contract above holds.)

The one exception is a launcher. The command palette's sheet is modal: a
transparent scrim of its own blocks the page and a tap on it dismisses, the
click-away its desktop popover has. See **The sheet primitive** below.

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

`useSurfaceMode()` starts at `base` so SSR and the first client render agree,
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
| `contentClassName` | Overrides the scroll area's padding, for content that bleeds wider. |
| `scrollRef` | The scroll container, for content that scrolls a row into view. |

## The sheet primitive

Every phone shape is one `<SurfaceSheet>` (`sheet.tsx`): the vaul drawer, the
glass shell, the grabber, the edge gaps. `AdaptiveSurface` composes it for its
sheet mode and adds the title bar and scroll area. A surface whose header is not
a title bar composes it directly — the command palette, whose header is its
search field — and still gets the same shell, so a sheet is a sheet whatever it
holds.

```tsx
<SurfaceSheet id="command" open={isOpen} onOpenChange={…}
  modal                       // scrim: page blocked, tap outside dismisses
  snapPoints={[0.7, 1]}       // detents; opens at the first
  activeSnapPoint={snap} onActiveSnapPointChange={setSnap}
  label="Command palette">    // sr-only dialog name (or render a Drawer.Title)
  {content}
</SurfaceSheet>
```

**Detents.** `snapPoints` are fractions of the viewport, iOS's medium and large.
vaul moves the whole drawer by translating it, which would push the sheet's
bottom edge off screen at the lower detent; the shell inside lifts by the same
amount (vaul's own `--snap-point-height`) so the sheet floats above the bottom
edge at every detent, as it does without snap points. A sheet with detents is
flush with the bottom of the screen underneath, because vaul moves `bottom` and
`height` itself while the keyboard is up.

**Modal.** The scrim is ours, not vaul's. A modal Radix dialog locks scroll by
forcing `position: relative` on `<body>`, which collapses the bezel's
container-scroll layout (`@hux/bezel` keeps `<body>` fixed at inset 0 on an
iPhone). So the drawer is always non-modal to Radix, and the scrim alone decides
what the page gets. For the same family of reasons the bezel keeps `<body>` at
`overflow: clip` rather than `hidden`: `hidden` is a scroll container that
`scrollIntoView` can still move, and a sheet resting below the edge at a lower
detent is exactly the overflow it would move it for.

## Stacking

iOS stacks sheets: presenting one from another sends the first back a step —
smaller, dimmer, a little higher, inert — and brings it forward again when the
one on top goes. That is a relationship between surfaces, not a property of
either, so it lives in `stack.ts`: a module-level store (the surfaces mount in
different subtrees, and a store needs no provider to reach them all) that every
open sheet registers with in order. A sheet with another opened after it reads
`behind` and recedes, on vaul's own curve; it deregisters on close rather than
on unmount, so the one behind comes forward in step with the top sheet's exit.

A sheet that opens a sheet decides for itself what happens next. The wallpaper
picker over the playlist is a true stack: close the picker and the playlist
comes forward. The command palette is a launcher and hands off instead: it
recedes while the picker arrives, then goes, and closing the picker returns to
the page. See [Command System](./system-command.md).

## Adopters

| Surface | Presentation | Notes |
|---------|--------------|-------|
| Music playlist | `ADAPTIVE_PRESENTATION` | macOS-sized window (980×620), track list breaks into columns |
| Wallpaper picker | `ADAPTIVE_PRESENTATION` | 3-column tile grid in window mode |
| Command palette | `{ base: "sheet", sm: "window" }` | `SurfaceSheet` directly, detents `[0.7, 1]`, modal; its "window" is its own Spotlight popover, not an `AdaptiveSurface` |

Adding a second is: register a draggable id, pick a presentation, pass content.
