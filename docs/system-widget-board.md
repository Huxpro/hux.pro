# Widget Board

The home screen's widget grid, shaped like an **Android home screen**: a
board of square **cells**, widgets that occupy a **rectangle** of them, and
a visitor who can put a widget on any cell and drag any corner to any size
its spec allows. Holes are legal. There are no size families.

Source of truth: `components/ui/widget-board.tsx` (the board, the drag, the
frame), `components/ui/widget-span.ts` (the continuum and the pack, pure),
`.widget-board` in `app/globals.css` (the cell).

This is the Android-shaped reading of the same problem #210 answered as
WidgetKit. The two PRs replace the same masonry; they are alternatives, not
layers.

---

## The model

Android App Widgets', taken seriously:

- **Size is a continuum, not a family.** A widget declares a min and a max
  in cells. Anything between is legal. There is no `small` / `medium` /
  `large` enum, and no second design that appears at a named step — the same
  card reflows into the box it was given. "The same rows, more of them" is
  the point of giving it more cells, not a reason to refuse the size.
- **The visitor places the rectangle.** A drop lands on a cell. Empty cells
  stay empty. Dense-packing is how an untouched board is *built*, not a
  constraint the visitor is held to.
- **Resize is a frame.** Long-press (or a mouse drag) enters edit mode and
  draws Android's bounding box: four corner handles. Drag a handle; the span
  follows in whole cells. A widget that has only one legal span shows no
  handles — that absence is information.
- **The box is the widget's height.** Cards no longer grow with their
  content. A list that does not fit scrolls inside the cell (what a finger
  does with that scroll is #208). A widget that wants more room is resized,
  or it opens its page.

Live Activities stay in the dock. A widget here never changes its own size.

### Against WidgetKit

| | Android (this board) | WidgetKit (#210) |
|---|---|---|
| Size | any (w, h) in `[min, max]` | `small` · `medium` · `large` · `xl` |
| Design | one card, reflow | a different design per family |
| Placement | free; holes stay | `row dense`; holes fill |
| Resize | corner frame, continuous | iOS 18 grip, snaps to a family |
| Phone | four cells across | two cells across |

### The cell

The cell is pure CSS, from the frame's width, so the board stays one
SSR-renderable container with nothing measured:

```css
.widget-board {
  --board-cols: 4;
  --cell: min(120px, calc((100% - (cols - 1) * 1rem) / cols));
  grid-template-columns: repeat(cols, var(--cell));
  grid-auto-rows: var(--cell);
}
```

`--board-cols` is what JS reads when it has to know the count (`readCols`).
CSS stays the source of truth.

| Breakpoint | Cells across | Frame | ≈ cell |
|---|---|---|---|
| — (phone) | 4 | 680px | 80–120px |
| `lg` | 6 | 1024px | ~150px |
| `roomy` | 8 | 1344px | ~150px |

Four cells on a phone is the Pixel launcher. A 2×2 widget is then a compact
tile; a 4×2 is the full-width row. At `sm` (680px, still four cells) a 2×2
is ~332px — the masonry card's width — so nothing already designed for that
column has to be retuned.

The 120px cap keeps a widget the tile it was designed as on a wide phone in
landscape; the grid centres in the frame.

### Placement

`packFirstFit` in `widget-span.ts` is **only** the untouched board: each
widget, in order, into the first cell — scanning row by row — where its
whole rectangle fits. After the visitor moves something, the stored
rectangles are the layout, holes included.

A drop or a resize is `resolveSpan`: clamp to the spec, keep it on the
board, and if the rectangle overlaps another widget walk back toward where
it started. Android will not let two widgets share a cell; it also will not
shuffle the rest of the board to make room.

The old order array (`hux_widget_order`) is still written, so a visitor who
only ever rearranged the masonry is not lost — it seeds the first pack.
Positions and sizes live in `hux_widget_layout` (`{ cols, spans }`). When
the column count changes (phone → desktop), sizes are clamped and the board
is packed again in visual order so a 4-wide widget still fits.

## The spans, per widget

| id | min | default | max |
|---|---|---|---|
| `apps` | 2×2 | 4×2 | 4×4 |
| `weather` | 2×1 | 2×2 | 4×2 |
| `music` | 2×1 | 2×2 | 4×2 |
| `blog` | 2×2 | 4×3 | 4×4 |
| `status` | 2×2 | 4×3 | 4×4 |
| `featured-talks` | 2×2 | 4×3 | 4×4 |
| `prompt` | 2×1 | 4×2 | 4×2 |
| `group-*` | 2×2 | 4×3 | 4×4 |

Defaults pack hole-free on four cells: the two 2×2 tiles share a row, every
4-wide widget is a row of its own. On six or eight cells the same spans sit
side by side — more widgets per row, not bigger ones.

### Designing for the box

- `WidgetShell` is a flex column that fills its cell. `WidgetBody` and
  `WidgetScrollBody` take the rest and clip. A body that pins its content
  (`justify-end`) is the glanceable posture.
- The board is a `@container`. A design that wants a line more once there is
  room uses a width query, not a guessed pixel height.
- The list bodies keep `WidgetScrollBody`, filling the cell rather than a
  fixed 256px. What that body does under a finger is #208.

## Rearranging

The masonry's hand-feel is kept whole: a mouse drag starts after 8px, touch
needs a 400ms long-press with the slow grow, a drag enters the jiggle edit
mode, and a tap on empty ground or **Done** leaves. What a drop *means*
changed:

1. The lifted widget's rectangle tracks the pointer in cell units.
2. On release it snaps to whole cells and, if that cell is taken, walks back
   to the last legal seat — the preview is the same function, so what you
   see is what you get.
3. Nothing else moves. A gap you left is still a gap.

### Resizing — the frame

In edit mode a widget whose min and max differ wears Android's frame:

- **Drag a corner.** The opposite corner stays pinned. The span is the
  pointer's distance in cells, clamped to the spec and to the board.
- A one-span widget has no handles.

The handle takes the pointer, so the board's move gesture, the page scroll
and the press-and-hold grow never see it.

### Edit mode

**Done** and **Reset** float above the command bar on desktop and take the
bottom of a phone screen while the bar fades out (`home-edit-store.ts`).
Reset restores spans and order (and the app folder's inner order).

## Decisions, against the issue's open list

- **Who picks the size.** The site declares a default rectangle per widget
  (the hole-free pack above). The visitor overrides it with the frame. The
  site never lets a widget become a size it did not declare a min/max for.
- **Where a size change lives.** In edit mode, on the widget, as the frame.
  Arranging and resizing are one activity.
- **Multi-column CSS.** Gone. Masonry existed to stack cards of any height
  with no JS; a board of cells is CSS Grid's native case, and it keeps one
  container / SSR / no measurement while expressing the thing masonry
  could not: two widgets sharing a row, and a hole between them.
- **The phone.** Four cells. Two 2×2 tiles share a row; everything 4-wide
  is the width of the screen.
- **Live Activities.** Stay in the dock.

## Working on it

- Change a widget's range: edit `WIDGET_SPECS` in `widget-span.ts`. The
  frame picks it up. Give the card a layout that survives the new box.
- Add a widget: a `BoardWidget` in `app/home-view.tsx` plus a spec. Ids are
  part of the persistence contract; do not rename one.
- Check a pack without a browser: `packFirstFit` / `defaultLayout` /
  `resolveSpan` in `widget-span.ts`.
