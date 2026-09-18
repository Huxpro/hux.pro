# Widget Board

The home screen's widget grid, shaped like an iOS / iPadOS home screen: a
board of square **cells**, and widgets that each occupy a declared
**footprint** of them — with a different design for each size they support.

Source of truth: `components/ui/widget-board.tsx` (the board, the drag
system, the grip), `components/ui/widget-size.ts` (the families and the
placement rule, pure), `.widget-board` in `app/globals.css` (the cell).

---

## The model

WidgetKit's, taken seriously:

- **Sizes are declared families, not a continuum.** A widget supports a
  small, fixed set of them — `small` (1×1), `medium` (2×1), `large` (2×2),
  `xl` (4×2) — and the visitor picks one from that set. Nothing else is
  possible: a widget cannot change its own size, and there is no API for it
  to ask.
- **Each size is a different design.** A size is only worth having if the
  widget says something different at that size. "The same rows, more of
  them" is the signal that the size should not exist, not that the design is
  done — so several widgets here have exactly one size, and one has three.
- **The box is fixed.** A widget designs for the cell footprint its size
  gives it; more content than fits means a bigger size, or the page. Never a
  taller card. (A card that grows with its content is a Live Activity
  behaviour, and lives in `systems/dock/`, not here.)
- **The system decides what fits the screen.** A phone is two cells across;
  an `xl` set on a desktop renders as that widget's `large` there, the way
  iPadOS-only families simply do not exist on an iPhone.

### The cell

The cell is pure CSS, from the frame's container width, so the board stays
one SSR-renderable container with nothing measured:

```css
.widget-board {
  --cell: min(200px, calc((100cqw - (cols - 1) * 1rem) / cols));
  grid-template-columns: repeat(cols, var(--cell));
  grid-auto-rows: var(--cell);
  grid-auto-flow: row dense;
}
```

Column count steps with the screen exactly where the masonry's did — two
cells is one of its columns:

| Breakpoint | Cells across | Frame | ≈ cell |
|---|---|---|---|
| — (phone) | 2 | 680px | 150–200px |
| `sm` | 4 | 680px | 136–160px |
| `lg` | 6 | 1024px | 150–160px |
| `roomy` | 6 (8 with `data-wide`) | 1152px (1344px) | 178px (154px) |

The 200px cap is what keeps a widget the card it was designed as on a wide
phone in landscape or a thin desktop window (the grid centres in the frame
instead). The eighth column, like the masonry's fourth, waits for enough
board to fill it: `data-wide` is set once the widgets add up to 24 cells —
three full rows of eight.

### Placement

`grid-auto-flow: row dense`, and nothing else: widgets go **in order**, each
into the first spot — scanning row by row from the top-left — where its
whole footprint fits. A widget that cannot finish its row starts the next
one; a smaller widget later in the order slides up into the gap that leaves
behind. The board never holds a hole a later widget could fill.

That is one sentence, and it is the whole rule. `placeInFlow` in
`widget-size.ts` is the same rule written out in TypeScript so the drag
system can know which widget sits under a cell without measuring one; the
two must agree, and a test of one is a test of the other.

The order is still an array of widget ids in `localStorage["hux_widget_order"]`,
unchanged since the masonry, so every visitor's saved order survives this
change. Sizes are stored beside it, in `localStorage["hux_widget_sizes"]`
(`{ id: size }`, only the ones that differ from the default), so a visitor
who never touched a size has nothing stored for it.

## The sizes, per widget

| id | sizes | default | what each size says |
|---|---|---|---|
| `apps` | small · medium (· large · xl once the catalog fills more than a medium page) | medium | **small** the folder glyph: a page of small icons, no labels, as an iOS folder shows its contents. **medium** a springboard row-pair, 4×2 labelled icons. **large** a 4×4 page. **xl** an 8×2 iPad page. |
| `weather` | small · medium | small | **small** the glance: city, then the temperature and the condition pinned to the bottom of the square. **medium** the readout: temperature with the condition and the day's light (sunrise / sunset) beside it — the body the dock's phase panel also renders. |
| `music` | small · medium | small | **small** the cover: art edge to edge, the label on it, one round play / pause at the bottom — the card's tap opens the playlist. **medium** the player: art beside title and artist, the full transport under them. |
| `blog` | medium · large | large | **medium** what's new: the newest post alone, with its description. **large** what's worth reading: the latest few, then under a hairline every `featured` post. |
| `status` | medium · large | large | **medium** now: the project in progress (no end date, else the newest), its team, what it is, and the pulsing dot — the "status" the id still carries. **large** the log: the minimized /works timeline. |
| `featured-talks` | medium · large · xl | large | **medium** one talk: cover beside title, one thing to press play on. **large** the albums: segmented control, horizontal carousel, dots. **xl** the gallery: four covers side by side without a carousel, eight in two rows once the cells are tall enough. |
| `prompt` | medium | medium | A quote needs a line's width and three lines' height to be read as a quote; a square clamps it to a fragment and a large box is the same quote with more air. One size. |
| `group-*` | large | large | The generic `content/log.json` stacks: a horizontal stack needs a cover's height plus a title, a vertical one a column of them. One size. |

The defaults are chosen so the **default board is hole-free on a desktop's
six cells**: 2 + 1 + 1 + 4 + 4 + 4 + 2 = 18 = three full rows. On a phone
the two smalls pair up into one row; the rest stack.

Sizes that a widget *could* fill but does not earn are left out on purpose:
the app folder's `large` and `xl` exist in the code but are only offered once
the catalog has more apps than a medium page holds (`appFolderSizes`), so a
mostly empty page is never a choice.

### Designing for the box

- `WidgetShell` is a flex column that fills its cell; `WidgetBody fill` (and
  `WidgetScrollBody fill`) takes the rest and clips. A body that pins its
  content to the bottom edge (`justify-end`) is the WidgetKit posture.
- Cells are square, so **a widget's width stands in for its height**. The
  board wraps every widget in a `@container`; a design that wants a line
  more once there is room uses a width query — `line-clamp-2
  @min-[360px]:line-clamp-3` — rather than guessing the cell in pixels.
- The list bodies (`blog` large, `status` large) keep `WidgetScrollBody`,
  now filling the cell rather than fixed at 256px. What that body does under
  a finger is a separate question with its own PR (#208) and doc; a fixed
  cell is compatible with every answer there, including the HIG's "widgets
  do not scroll", which would simply be `overflow: hidden` in the same box.

## Rearranging

The masonry's hand-feel is kept whole: a mouse drag starts after 8px, touch
needs a 400ms long-press with the slow grow, a drag enters the jiggle "edit
mode", the lifted card is a `DragOverlay` clone under the cursor, and a tap on
empty ground or the **Done** pill leaves. What changed is what a drop
*means*, because the board now understands footprints:

1. The lifted widget's footprint snaps to whole cells — its top-left corner
   rounded to the nearest cell, kept on the board.
2. That footprint is resolved against the **other widgets laid out without
   it** (`resolveDropIndex`): over a widget, the lifted one takes that
   widget's place in the order; over empty cells, it goes after the last
   widget that reads before that spot. The answer depends only on where the
   hand is, never on where the last answer moved things to — so the preview
   cannot oscillate, which is the failure mode a reflowing grid invites.
3. The other widgets **slide to their new cells live** (a FLIP on each
   wrapper's transform, 260ms; off under `prefers-reduced-motion`), and the
   footprint left in the flow is drawn as a faint dashed outline. What will
   happen is on screen before letting go.

Because placement is dense, a drop can land somewhere other than the cell
the widget was held over — a large held over a small at the end of a row
goes to the next row, and the small slides up beside it. That is iOS's
behaviour too, and the live preview is what makes it legible: the visitor
sees the result, not a promise.

Column count and cell size are read off the grid's resolved track list at
the start of a drag (`readMetrics`), never assumed, so CSS stays the single
source of truth for both.

### Resizing — the grip

In edit mode a widget with more than one size wears a **grip** at its
bottom-right corner, iOS 18's resize handle:

- **Drag** it to the footprint you want. The size asked for is the pointer's
  distance from the widget's top-left in cells, matched to the nearest
  supported footprint (`resolveResize`); the current size wins ties, so a
  wobble changes nothing. The widget switches its design the moment the grip
  crosses, and the board reflows around it, live.
- **Tap** it to step to the next size, wrapping. This is also what keyboard
  users get (the grip is a button).

The grip takes pointer capture, so nothing under it — the board's sensors,
the page scroll, the press-and-hold grow — ever sees the gesture. Only the
sizes that fit the current board are offered.

A widget with one size shows no grip. That absence is information: the
widget has exactly one shape, and it is the right one.

### Edit mode

Same as before: **Done** and **Reset** float above the command bar on
desktop and take the bottom of a phone screen while the bar fades out
(`home-edit-store.ts`). Reset now restores sizes as well as order (and the
app folder's inner order, as it did).

## On a phone

Two cells across is the strongest argument *for* this direction, not
against it. It is exactly the iPhone: every medium and large is full width,
two smalls sit side by side, and the board is a single column of rows with
one decision in it — which two things share a row. The masonry's phone
layout was a column of cards whose heights were whatever they happened to
be; this one is a column of rows that were designed.

## Decisions, against the issue's open list

- **Who picks the size.** Both: the site declares a default per widget (the
  hole-free board above), and the visitor overrides it per device from the
  grip. The site never offers a size the widget has no design for.
- **Where a size change lives.** In edit mode, as its own affordance on the
  widget — the grip — not as a gallery or a menu. Editing and resizing are
  one mode because they are one activity: arranging the board.
- **Multi-column CSS.** Gone. The masonry existed to stack cards of any
  height in a column with no JS; a board of fixed cells is CSS Grid's native
  case, and it keeps every property that mattered (one container, SSR, no
  measurement) while gaining the one masonry could never express — two
  widgets sharing a row.
- **The phone.** Above.
- **Live Activities.** Stay in the dock. A widget here never changes its own
  height; a visitor changes its size.

## Working on it

- Add a size to a widget: give it a design for that size in its component,
  add the size to its exported `*_WIDGET_SIZES`, and it appears on the grip.
  Nothing in the board changes.
- Add a widget: a `BoardWidget` in `app/home-view.tsx` — `id`, `sizes`,
  `defaultSize`, `render(size)`. Ids are part of the persistence contract;
  do not rename one.
- Check a layout without a browser: `placeInFlow(items, cols)` in
  `widget-size.ts` returns every widget's cell, and `boardRows` how many rows
  it takes.
