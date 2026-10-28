---
skills: [content-snapshots]
---

# App Folder: the home-screen folder for external projects

The homepage widget grid includes an **app folder**: an iPad-style springboard
of icons for apps (React, Lynx, Flappy Bird, Vue Lynx). Each icon is the
artwork the target site *itself* declares for home-screen use, committed at
build time. A small **runtime badge** (web, or Lynx tinted by flavour) hangs
off the corner on hover, focus and in edit mode.

Tapping a tile opens the app in a **chrome window** (see the
[Window System](./system-windows.md)): web apps in an iframe, Lynx apps in a
Lynx Player. ⌘/Ctrl/Shift/Alt-click and middle-click still open the app's
`url` in a new tab: the tile is a real anchor.

When the featured catalog outgrows one page (8 icons by default), the folder
**snap-scrolls** into pages, horizontal (`axis: "x"`, default, like iOS
folders) or vertical (`axis: "y"`).

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/app-shelf/folder-rest.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The app folder at rest on a phone: four icons and their labels sit straight on the wallpaper with no card behind them." />
  <img src="/img/docs/app-shelf/folder-edit.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same folder in edit mode: a strong glass platter with a border and shadow has appeared behind the icons, and every icon shows its globe runtime badge." />
</div>

At rest (left) the folder is chrome-less: icons and labels sit on the
wallpaper, flush with the edges of the cards below. In edit mode (right,
entered by dragging an icon) the platter appears (`bg-glass-strong`, a
border, `shadow-raised`) and every runtime badge shows. Lynx is a padded
favicon, so it sits on a white plate; the other three are square art at
160px or more and fill the tile. iPhone 15 Pro width, headless.

- One page needs no paging: a natural-height grid, no snap, no dots.
- Dragging an icon moves only that icon; dragging the folder's empty area
  moves the whole folder among the widgets.
- A dropped icon does not open its app.
- Every icon is a local static file. Nothing is crawled or hotlinked at
  runtime.

## How it works

![content/apps.json is read by pnpm apps:snapshot, which discovers each app's icon over the network and writes public/app-icons and content/app-icons.json; pnpm apps:check validates those offline; at runtime lib/apps.ts imports both JSON files and AppTile renders the folder and the command palette strip.](/img/docs/app-shelf/pipeline.svg)

The author edits one file; a hand-run command crawls and commits the icons; the
runtime only reads committed files. `apps:check` is the offline guard, and CI
does not run it.

### Authoring

Apps live in `content/apps.json`. The type is
`AppLink` in `lib/app-icon-core.ts`.

```json
{
  "apps": [
    { "id": "react", "title": "React", "runtime": "web", "url": "https://react.dev" }
  ]
}
```

- `id`: stable identifier, `[a-z0-9-]` only (the snapshot script rejects
  anything else and duplicates); names the icon file under
  `public/app-icons/`.
- `title`: the English label under the tile.
- `titleZh` *(optional)*: Chinese label; falls back to `title`. Cat Wand /
  逗猫棒 is the one bilingual entry today.
- `url`: canonical destination (the iframe for web apps, the "open
  externally" target for both runtimes, and what the icon snapshot resolves
  tile art from).
- `runtime` *(optional)*: `"web"` (default) or `"lynx"`; picks the window
  body. `flavor` (`"react"` / `"vue"`, the badge tint) and `bundleUrl`
  extend this for Lynx apps (see the [Window System](./system-windows.md)).
- `size` *(optional)*: the window preset it opens at, `"portrait"`,
  `"landscape"` or `"max"`. Defaults to portrait for Lynx, landscape for web
  (`defaultPreset` in `systems/windows/lib/geometry.ts`).
- `icon` *(optional)*: manual override when the site's declared icon is wrong
  or unfetchable. A site-local `/…` path is used as-is (it must exist under
  `public/`); an `https://…` URL is downloaded instead of running
  discovery. Same recovery philosophy as og-snapshot's manual `preview`.
  Vue Lynx, Cat Wand and BusyWeek all point at a committed
  `/app-icons/<id>.png`. Vue Lynx needs it because
  `vue.lynxjs.org/icon-512.png` is a pre-masked iOS squircle (transparent
  corners) that would double-frame against the tile's own rounded clip; the
  committed file is that art flattened onto opaque white.
- `featured` *(optional)*: show on the home-screen folder. Defaults to `true`.
  `false` keeps the app in the ⌘K strip without featuring it on the
  springboard (BusyWeek and Cat Wand / 逗猫棒 are command-only this way).
- `keywords` *(optional)*: extra ⌘K search terms on top of title, Chinese
  title, id and runtime.

### Icon pipeline (build time, static-export friendly)

```
pnpm apps:snapshot   # crawl each app URL, download icons, write snapshot
pnpm apps:check      # filesystem-only validation (no network)
```

`scripts/app-icon-snapshot.ts` resolves each app with `discoverAppIcon` in
`lib/app-icon-core.ts`. Candidates are ranked by source, then by declared
size (largest first), and downloaded in that order; the first response that
sniffs as a real image wins:

1. web-app manifest `icons[]` (minus `purpose: "monochrome"`);
2. `<link rel="apple-touch-icon">`, then the undeclared
   `/apple-touch-icon.png` probe;
3. `<link rel="icon">` (never `mask-icon`);
4. `/favicon.ico`.

The winning file is written to `public/app-icons/<id>.<ext>` and described in
`content/app-icons.json` (`url`, `file`, `source`, `iconUrl`, `width`,
`height`). A site-local manual `icon` is recorded as `source: "manual"` with
its sniffed size and no `iconUrl`.

- A crawl failure never deletes a good prior icon. An app with no fetchable
  icon, no prior icon and no manual `icon` fails the run (exit 1).
- Files in `public/app-icons/` that no entry points at are pruned.
- `apps:check` fails when an app has no entry, its `url` changed since the
  snapshot, its icon file is missing, or the snapshot has an id that is no
  longer in `apps.json`. It never re-crawls (server re-encoding would make it
  flaky). CI runs only `og:complete` and `badges:check`, so run it yourself.

At runtime `resolveAppIconSrc` picks the snapshot `file`, then the manual
`icon`, then the Lynx mark for a Lynx app. `iconFillsTile` decides the tile
shape from the snapshot size: square and at least 160px fills edge to edge;
anything else is a glyph, padded on a white plate (like Safari's
add-to-home-screen), so transparent dark glyphs stay visible in dark mode.

### The folder in the home grid

`AppFolder` (`components/apps/app-folder.tsx`) is the `"apps"` item of the
home `SortableMasonry` (`app/home-view.tsx`), so it drags alongside widgets
and the widget picker can hide it. It renders `FEATURED_APPS` at `lg` (64px
tiles) and returns nothing when that list is empty. Icons inside are a
*nested* dnd-kit sortable with its own persisted order
(`localStorage["hux_app_order_v2"]`), reconciled against the catalog on
mount: removed apps drop out, added ones join at the end.

- An inner drag enters the masonry's shared jiggle edit mode (via
  `useMasonryEdit()`). In edit mode the item wrapper swallows clicks, which
  is what stops the post-drop click from opening the dropped icon's app.
- The shared **Reset** control restores the icon order too: the folder
  registers itself as a masonry *section* under id `"app-shelf"`.
- The platter: at rest the folder is `border-transparent` with
  `ink-bare-mid ink-bare-rest` (its labels are a bare zone that may flip ink
  on the wallpaper's middle band; see [Legibility](./system-legibility.md)).
  Hover adds `bg-glass` and a faint border; edit mode, and the lifted clone
  when the whole folder is dragged, use `bg-glass-strong shadow-raised
  backdrop-blur-sm`.

### Pages

![Eleven featured apps in a 4 by 2 layout chunk into two pages, eight and three; each page is the scroller's full width and snaps at its start; pageIndex is scrollLeft divided by clientWidth, rounded.](/img/docs/app-shelf/paging.svg)

The ordered ids are chunked by `chunkAppPages` (`lib/apps.ts`) into pages of
`columns × rows`; the last page may be short and left-aligned. Each page is
a full-width, `snap-start snap-always` grid in a `snap-x snap-mandatory`
scroller, and the dots read and set `scrollLeft` in page widths. The shipped
catalog has four featured apps, so the site shows one page today; there is
no screenshot of two.

| Featured apps (4 × 2) | Behaviour |
|-----------------------|-----------|
| 8 or fewer | Natural-height grid: no snap, no page dots, no empty second row |
| 9–16 | Two snap pages (8 + remainder); dots under the folder |
| 17–24 | Three pages; same pattern |

With more than one page the grid locks `repeat(rows, auto)` so every page
shares one footprint. `axis: "y"` stacks pages vertically, caps the scroller
at `rows × 5.5rem` and moves the dots to the right edge.

## Rules

- **The inner `DragOverlay` is portaled to `<body>`.** In jiggle mode the
  masonry item wrapper carries a `rotate` transform (`widget-jiggle`), and a
  transformed ancestor becomes the containing block for the overlay's
  `position: fixed`. That displaced both the visible clone and dnd-kit's
  collision rect, which silently broke cross-row sorting.
- **Icon presses stop propagation.** `SortableAppIcon` stops `pointerdown`
  (and guards dnd-kit's activators) so an icon drag never activates the outer
  sortable and lifts the whole folder.
- **Keep the persistence ids.** `"app-shelf"` (section id) and
  `hux_app_order_v2` (storage key) are visitors' saved state; renaming either
  silently resets their order.
- **An `id` is a file name and a saved position.** Renaming one needs a
  `pnpm apps:snapshot` run (new file, old one pruned), and in visitors'
  saved orders the renamed app moves to the end (`reconcile` keeps known
  ids, then appends new ones).
- **Manual icons should be opaque, square art.** The tile clips its own
  squircle (`rounded-[22.5%]`); pre-masked art double-frames, and art under
  160px or non-square gets the padded plate.
- **Never point a tile at a remote image.** Everything the tile shows must
  be a committed file under `public/`.

## Free choices

- `layout={{ columns, rows, axis }}` on `AppFolder`; the default is
  `DEFAULT_APP_FOLDER_LAYOUT` (4 × 2, `"x"`).
- Which apps are `featured`, and their default order (catalog order).
- Hold and lift scales (`ICON_HOLD_SCALE` 1.08, `ICON_LIFT_SCALE` 1.15).

## Adding or changing an app

1. Add or edit the entry in `content/apps.json`.
2. `pnpm apps:snapshot`. If it fails with "no icon", add a manual `icon`
   (commit the file under `public/` if it is site-local) and run it again.
3. Look at the new tile: does it fill, or sit padded on the plate as
   intended? On the folder (if featured) and in the ⌘K strip.
4. `pnpm apps:check`, then commit `content/apps.json`,
   `content/app-icons.json` and `public/app-icons/` together.

## The ⌘K apps strip, for contrast

<img src="/img/docs/app-shelf/palette-strip.png" style={{ width: "50%" }} alt="The command palette on a phone: under the search field a horizontal strip of app icons, React, Lynx, Flappy Bird, Vue Lynx, Cat Wand and a clipped BusyWeek, each with its runtime badge showing." />

The same catalog in the palette (`CommandAppsStrip`,
`systems/command/apps-launcher.tsx`): every app, including the
`featured: false` ones (Cat Wand with its green Lynx badge, BusyWeek clipped
at the edge), at `md` (48px), badges always on, one horizontal row that
scrolls. It is documented in [Command System](./system-command.md).

## Reference

| Piece | Location |
|-------|----------|
| Catalog, featured list, page helpers, `iconFillsTile` | `lib/apps.ts` |
| `AppLink`, discovery, `resolveAppIconSrc`, `appTitle`, `runtimeLabel` | `lib/app-icon-core.ts` |
| Snapshot / check script | `scripts/app-icon-snapshot.ts` |
| Tile art (icon + badge + label) | `components/apps/app-tile.tsx` |
| Snap-paged folder widget | `components/apps/app-folder.tsx` |
| ⌘K apps strip | `systems/command/apps-launcher.tsx` |
| Window menu and minimized-dock icon | `systems/windows/components/app-icon-plate.tsx` |

`AppTile` is the icon visual for the folder and the ⌘K strip. Window chrome
uses `AppIconPlate`, which applies the same `resolveAppIconSrc` /
`iconFillsTile` rules at pill size. `AppShelf` (and
`components/home/app-shelf.tsx`) are deprecated aliases of `AppFolder`.
