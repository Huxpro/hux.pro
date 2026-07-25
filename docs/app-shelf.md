# App Folder — home-screen folder for external projects

The homepage widget grid includes an **app folder**: an iPad-style springboard
of icons for apps (React, Lynx, Lynx Flappy Bird, BusyWeek, …). Each icon is
the artwork the target site *itself* declares for home-screen use, wearing a
small **runtime badge** in the corner.

Tapping a tile opens the app in a **chrome window** (see the
[Window System](./system-windows)) — web apps in an iframe, Lynx apps in a
Lynx Player. ⌘/middle-click still opens the app's `url` in a new tab.

When the catalog outgrows one page, the folder **snap-scrolls** into pages —
horizontal (`axis: "x"`, default, like iOS folders) or vertical (`axis: "y"`).

## Authoring

Apps live in [`content/apps.json`](../content/apps.json):

```json
{
  "apps": [
    { "id": "react", "title": "React", "url": "https://react.dev" }
  ]
}
```

- `id` — stable identifier; also names the icon file under `public/app-icons/`.
- `title` — the label under the tile.
- `url` — canonical destination (the "open externally" target, and what the
  icon snapshot resolves tile art from).
- `runtime` *(optional)* — `"web"` (default) or `"lynx"`; picks the window
  body. `flavor` / `bundleUrl` extend this for Lynx apps — see the
  [Window System](./system-windows) doc.
- `icon` *(optional)* — manual override when the site's declared icon is wrong
  or unfetchable: a site-local `/img/…` path is used as-is; an `https://…` URL
  is downloaded. Same recovery philosophy as og-snapshot's manual `preview`.

## Icon pipeline (build-time, static-export friendly)

```
pnpm apps:snapshot   # crawl each app URL, download icons, write snapshot
pnpm apps:check      # filesystem-only validation (no network)
```

`scripts/app-icon-snapshot.ts` resolves each URL's icon with the discovery
core in `lib/app-icon-core.ts`, preferring, in order: **web-app manifest
icons → `apple-touch-icon` → `<link rel="icon">` → conventional fallbacks**
(`/apple-touch-icon.png` probe, `/favicon.ico`). The winning file is
committed to `public/app-icons/<id>.<ext>` and described in
`content/app-icons.json` (source, origin URL, intrinsic size), so production
serves only local static assets — no runtime crawling, no hotlinking.

Failures never delete a good prior icon; an app with no fetchable icon and no
manual `icon` fails the run loudly.

## Shared app UI

| Piece | Location |
|-------|----------|
| Catalog + folder layout helpers | `lib/apps.ts` |
| Tile art (icon + badge + label) | `components/apps/app-tile.tsx` |
| Snap-scrollable folder widget | `components/apps/app-folder.tsx` |
| ⌘K Apps grid / list | `systems/command/apps-launcher.tsx` |

`AppTile` is the single icon visual used by the folder, the command launcher,
and (via the same fill/pad rules) the minimized dock pills.

## Rendering — App Folder

`components/apps/app-folder.tsx` renders as one chrome-less item in the home
`SortableMasonry`, so it drags alongside widgets. Icons inside are a *nested*
dnd-kit sortable with its own persisted order (`localStorage["hux_app_order"]`):

- Pointer presses on icons stop propagation, so dragging an icon never lifts
  the whole folder (the folder still lifts from its empty areas).
- An inner drag enters the masonry's shared jiggle edit mode (via
  `useMasonryEdit()`), which also makes the item wrapper swallow the
  post-drop click that would otherwise open the dropped icon's link.
- The shared **Reset** control restores the icon order too (the folder
  registers itself as a masonry *section* under id `"app-shelf"` for
  backwards-compatible persistence).
- The inner `DragOverlay` is **portaled to `<body>`**. This is load-bearing:
  in jiggle mode the masonry item wrapper carries a `rotate` transform, and a
  transformed ancestor becomes the containing block for the overlay's
  `position: fixed` — displacing both the visible clone and dnd-kit's
  collision rect, which silently broke cross-row sorting.

**Pages.** Default layout is **4 columns × 2 rows** per page (`axis: "x"`).
Pass `layout={{ columns, rows, axis }}` to change capacity or scroll direction.
When `apps.length` fits one page, snap scrolling and page dots stay dormant.
Overflow splits the ordered id list into fixed-capacity pages; the last page
may be short (left-aligned), like a springboard.

**Group hint (Siri-Suggestions platter).** The folder is chrome-less at rest,
but a translucent rounded platter materializes behind the icons whenever the
group is "held": on hover, in edit mode, and on the lifted drag clone. In dark
mode the platter uses a faint white wash — `--card` is darker than
`--background` there, so a card tint alone would read as a hole rather than a
lift.

**Tiles.** Padded glyph icons composite on a white plate (like Safari's
add-to-home-screen), so transparent dark glyphs stay visible in dark mode.
Square icons ≥160px render full-bleed *without* the plate.

## Command palette — Spotlight launcher

⌘K is dual-purpose: command search **and** an app launcher (see
[Command System](./system-command)).

- **Browse (empty query):** dedicated Apps **icon grid** at the top of the
  palette — real snapshot icons, not generic glyphs.
- **Search (non-empty query):** compact Apps **list rows** with the same
  icons, filtered by title / runtime / keywords via cmdk.
