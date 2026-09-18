# Widget Grid — an Android-shaped home screen

The home screen's widget grid is a **launcher grid**: a lattice of cells, each
widget occupying a footprint of whole cells, and the footprint is the
**visitor's to change**. This is the Android App Widget model taken
seriously, as [issue #211](https://github.com/Huxpro/hux.pro/issues/211)
asked, and the deliberate opposite of the iOS direction in #210.

> **The user resizes the widget.** … As the user resizes the widget, the
> system provides the new sizes, and your app must adapt to those size
> ranges. — [App widgets overview](https://developer.android.com/develop/ui/views/appwidgets/overview)

Everything below follows from that sentence: the widget never sizes itself,
it declares a range and adapts; the grid is the system that hands sizes down.

| Piece | Where |
|---|---|
| The cell model — sizes, ranges, packing, pointer maths, persistence | `components/ui/widget-grid.ts` (pure, no React) |
| What a widget knows about its footprint | `components/ui/widget-size.tsx` (`useWidgetSize`) |
| The grid — placement, drag, resize, edit mode | `components/ui/sortable-grid.tsx` |
| The resize corner | `components/ui/resize-grip.tsx` |
| Column count in JS, mirroring the CSS breakpoints | `components/ui/use-column-count.ts` |

## The cell

A cell is **one grid column wide and 176px tall**, with a 16px gutter. The
column is the ~330px a widget has always been here — see the breakpoint
table in [design-system.md](./design-system.md#home-screen-grid) — so a 1×1
widget is exactly the card the grid used to show, and a 1×2 is the
near-square (332×368) a list widget needs.

Cells are **coarse on purpose**. Android's lattice is ~70dp; a phone is five
cells across. Here a widget's range is at most two cells wide and three tall,
because a size is only worth offering when the widget *says something
different* at it, and a finer lattice multiplies sizes without multiplying
meaning. "Fluid" therefore means *snapped*: the card stretches continuously
under the pointer, the footprint snaps to whole cells.

## Ranges — what each widget says at each size

Each widget exports a `WidgetSizeSpec` (Android's `minResizeWidth` /
`maxResizeHeight` / `targetCellWidth`): the smallest and largest footprint it
has a representation for, and the one it takes when first placed. Every
default is one cell wide, so the home screen looks exactly as it did until
the visitor touches it. The rule from the issue — *if widening just makes the
same rows longer, the range is wrong* — is the test each entry had to pass.

| Widget | Range | 1 tall | 2 tall | 3 tall | 2 wide |
|---|---|---|---|---|---|
| `apps` folder | 1×1 – 2×2, default 1×2 | one row of four | three rows (twelve per page) | — | eight per row. Page capacity **is** the footprint (`folderLayoutFor`). |
| `weather` | 1×1 – 2×1 | the readout | — | — | the *day*: feels-like / humidity / wind, and the sun's arc with the sun where it is now, sunrise and sunset at its feet |
| `blog` (writing) | 1×1 – 2×3, default 1×2 | a headline — the newest post with its excerpt | the list: latest, then featured under a hairline | rows carry their excerpt | latest and featured stop stacking and sit side by side, each under its own heading, every row with its excerpt (two headlines when 1 tall) |
| `music` | 1×1 – 2×1 | now playing | — | — | **up next**: the following playlist entries, each a tap away |
| `status` (projects) | 1×1 – 2×3, default 1×2 | the two newest projects, no port | the scrolling log | each row folds its description in | one column still (the tenure rail can't be split); each row spreads sideways, description **beside** the summary — `git log` with the body alongside the subject |
| `featured-talks` | 1×2 – 2×2 | — | carousel: one card, a peek, dots | — | a **shelf**, three abreast; dots only past three |
| `prompt` | 1×1 – 2×1 | the prompt | — | — | the prompt, and the rotation's next three as a queue |
| `group-*` H stack | 1×2 – 2×2 | — | carousel | — | shelf, three abreast |
| `group-*` V stack | 1×1 – 1×3, default 1×2 | list | list | list | — |

What earned *no* range, and why:

- **Weather, music, prompt have no height.** A taller weather is a forecast
  the ambient system doesn't fetch; a taller "now playing" is the playlist
  sheet, which the surface already opens; a longer quote is still one quote.
- **Talks has one height.** A thumbnail row under a tab row has exactly one
  height; width is where it changes (carousel → shelf).
- **Nothing is 3 wide.** Three columns is the whole desktop grid; a widget
  that wide is a page.

A widget reads its footprint with `useWidgetSize()` and branches on it; it
never sets it. The value is the **effective** size — the visitor's choice
clamped to the range *and to the columns the viewport has* — so a 2-wide
widget on a phone is told it is 1 wide, because that is what it must draw.

## The grid

### Placement is derived, never stored

Persisted state is the **order** (`hux_widget_order`, an array of ids,
unchanged from the masonry days — `status` is still `status`) plus the chosen
**footprints** (`hux_widget_sizes`, `{ id: [w, h] }`). `packGrid` turns those
into cells for a column count by dense, row-major first fit — the same rule
as CSS `grid-auto-flow: dense`, spelled out in JS so the pointer maths and
the server render agree bit for bit.

Deriving placement is what answers *"what do a visitor's saved sizes mean
when the viewport changes underneath them?"*: nothing changes. A phone packs
the same order into one column and clamps every width to it; widen the
window and the 2-wide widgets are 2 wide again. Nothing the visitor chose is
lost, and there is no per-breakpoint layout to keep in sync.

### CSS multicolumn did not survive, SSR did

Multicol cannot express a widget two columns wide, so the masonry had to go.
What stays is the property it was chosen for — one SSR-renderable container,
no JavaScript measurement at first paint. The server computes the packing
for **every** column count at once and emits each widget's cell per
breakpoint as CSS variables (`--gc1…4`, `--gr1…4`) that the `sm:` / `lg:` /
`roomy:` variants switch between. The grid is a plain CSS grid
(`auto-rows-[176px]`); no script decides where anything goes.

The cost, honestly: the masonry balanced columns by *content height*, so a
short card never left air under it. A cell grid gives every card its cell,
and a widget shorter than its cell (the app folder at 1×2, a "weather
unavailable" card) leaves the difference empty. The defaults were chosen so
this is rare; the folder is chrome-less, so its air is invisible.

The "same rows, only reflowed" behaviour has one more consequence: because
the packer is dense, resizing or moving one widget can let a *later* widget
backfill a hole that opened before it. The rule the visitor can rely on: **a
widget's cell depends only on the widgets before it in the order**, so
nothing ahead of the one they are holding ever moves. Android avoids the
question by storing absolute positions and allowing holes; on a viewport that
changes width that would be worse, so the reflow is animated instead of
avoided.

### Drag: the pointer picks the landing cell

Reordering still uses dnd-kit's sensors and `DragOverlay` — the tuned
pickup is untouched: mouse drags after 8px, touch after a 400ms hold with the
slow grow as the tell — but **not** its sort transforms, which assume
uniform items. A custom collision function maps the pointer to a landing
index on the lattice (`landingIndex`): over another widget, the lifted one
takes its place (pointer in the leading half) or the spot after it (trailing
half); over empty cells, after the last widget that starts before them. It
is pure in (pointer, order-without-the-lifted-widget), so a still pointer
always yields one answer and live reordering cannot oscillate. The order
updates on every move; Framer Motion `layout="position"` slides the other
cards to their new cells, and the slot the held widget will land in stays
visible as a dashed outline. That outline is the answer to "see where it
will land before releasing".

`layout="position"`, not `layout`: a size change (a resize commit, a
breakpoint) snaps rather than tweens, so text is never scaled mid-flight.

### Resize: the corner, and the arbitration with pickup

Android puts drag handles on a held widget's edges; iOS 17 grew a single
rounded corner at the bottom-right in jiggle mode. This grid has the corner
(`ResizeGrip`): a stroke that rides just outside the card's own rounded
corner, so it reads as *this corner is grabbable*, not as a control laid on
the widget. Drag it and the card's box stretches under the pointer, hanging
over its neighbours; its footprint snaps to whole cells (`snapPxToCells`),
the grid re-packs live, and the widget re-renders at each snap — so what it
*will become* is visible before release. On release the box eases onto its
cells (180ms) and the size is saved.

The gesture arbitration the issue called the hardest problem is settled by
**making resize a mode, not a gesture**:

- The corner **only exists in edit mode.** Outside it, every press on a
  widget is what it always was: a tap, a scroll, a long-press pickup. There
  is nothing to steal.
- In edit mode the corner **swallows its own press** (every activator
  dnd-kit listens to is stopped) and sets `touch-action: none`, so a finger
  on it never scrolls the page and never lifts the card. A press anywhere
  else on the card is a pickup, exactly as before.
- Widgets whose range collapses on the current viewport (2-wide on a phone)
  show a corner only if height still has range; a widget with a single size
  shows none.

Since a mouse had no way into edit mode without first dragging something, a
mouse press held **still** for the touch hold's duration now enters it (with
the same slow-grow tell — `usePressHold` opts the mouse in here), the way
click-and-hold does on an iPad with a trackpad. Movement before that hands
over to the 8px drag as before; release before it is the click it always
was.

The corner is also a keyboard control: focus it and the arrow keys change
the footprint one cell at a time.

### Phone

On a phone the grid is one column, so width has nothing to say — and the
issue guessed this might be the direction's strongest argument either way.
What survives: **height still resizes** (a taller writing widget shows the
excerpts, a taller projects log folds descriptions in; a one-cell writing
widget is a headline), and the saved widths are kept for the wide screen the
visitor will open next. What does not: half of every range is inert on the
device where most people will meet the grid. That is the honest cost of the
Android model on a page that scrolls vertically, and it is the reason the
height representations were designed as carefully as the wide ones.

## Departures from Android, knowingly

- **No widget picker / add flow.** The set of widgets is the site's; the
  visitor arranges and sizes, never adds. A picker is the natural next step
  if a widget ever earns being optional.
- **Snapped, not per-dp.** Android reports the size in dp and lets the app
  respond continuously (`onAppWidgetOptionsChanged`); here the cell is the
  unit, and representations are breakpoints — closer to
  `RemoteViews(Map<SizeF, RemoteViews>)`, and closer still to container
  queries, which is what this page's components are.
- **No holes.** Android keeps absolute positions and lets a launcher page
  have gaps; this grid packs. See "Placement is derived" for why.
- **Edit mode is shared with reordering** (the iOS jiggle), rather than
  Android's per-widget resize frame after a long-press release. One mode is
  easier to leave than two, and the corner-in-jiggle is what iOS 17 arrived
  at too.

## Relationship to #208 (widget scroll)

#208 reworks how a list body behaves under a finger and adds six modes. This
grid makes its list bodies fill their cell (`WidgetScrollBody fill`) rather
than fixing them at 256px, and adds heights at which the port is
unnecessary (1 tall) or roomy (3 tall). The two are compatible; the mode
switch would apply inside whatever height the cell gives.

## Testing

Headless Chromium against the dev server (`hux_music_mock = 1` for a
playlist), at 1280×900, 820×1000 and an iPhone 13 viewport with touch via
CDP:

- default packing at all three widths matches `packGrid` cell for cell
  (desktop: apps 1×2, weather, blog 1×2 across the top; music under weather;
  projects, talks, prompts below);
- mouse drag: edit mode enters, the placeholder shows the landing cell, the
  order re-packs and persists;
- still mouse press (650ms, no movement): edit mode without a lift, the
  release click swallowed; corners on every resizable widget;
- corner drag on the writing widget, +340px: the box follows the pointer,
  the footprint snaps to 2×2, the widget renders its two-column form live,
  the grid re-packs around it, `hux_widget_sizes` saved;
- dragging a 2-wide widget: the lifted clone is 2 wide; arrow keys on the
  corner change the footprint; Reset restores order and sizes and clears
  both keys; Escape leaves edit mode and a plain click navigates again;
- phone: a swipe scrolls the page and never enters edit mode; a 400ms
  touch hold shows the grow tell and enters edit mode; a touch drag on the
  corner resizes without scrolling the page; width-clamped widgets show no
  corner;
- every widget screenshotted at every footprint;
- `tsc --noEmit` and `eslint` clean on every touched file; `next build`.

Not verified here: the wide weather body (the sandbox has no network for
weather data).
