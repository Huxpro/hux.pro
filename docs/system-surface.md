# Surface System

One secondary surface, three shapes.

```
systems/surface/
├── presentation.ts       # SurfaceMode, breakpoints, useSurfaceMode()
├── adaptive-surface.tsx  # <AdaptiveSurface>, useSurfaceContext()
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

## Adopters

| Surface | Presentation | Notes |
|---------|--------------|-------|
| Music playlist | `ADAPTIVE_PRESENTATION` | macOS-sized window (980×620), track list breaks into columns |
| Wallpaper picker | `ADAPTIVE_PRESENTATION` | 3-column tile grid in window mode |

Adding a second is: register a draggable id, pick a presentation, pass content.
