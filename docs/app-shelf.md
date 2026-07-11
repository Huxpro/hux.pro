# App Shelf — home-screen icons for external projects

The homepage widget grid includes an **app shelf**: a row of iPad-springboard
style icons that deep-link to external projects (React, Lynx, Lynx Flappy
Bird, Vue Lynx, …). Each icon is the artwork the target site *itself*
declares for home-screen use.

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
- `url` — external destination (opens in a new tab).
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

## Rendering

`components/home/app-shelf.tsx` renders the shelf as one chrome-less item in
the home `SortableMasonry`, so it drags alongside widgets. The icons inside
are a *nested* dnd-kit sortable with its own persisted order
(`localStorage["hux_app_order"]`):

- Pointer presses on icons stop propagation, so dragging an icon never lifts
  the whole shelf (the shelf still lifts from its empty areas).
- An inner drag enters the masonry's shared jiggle edit mode (via
  `useMasonryEdit()`), which also makes the item wrapper swallow the
  post-drop click that would otherwise open the dropped icon's link.
- The shared **Reset** control restores the icon order too (the shelf
  registers itself as a masonry *section*).

Tiles composite on white (like Safari's add-to-home-screen), so transparent
dark glyphs stay visible in dark mode. Square icons ≥160px render full-bleed;
small or non-square favicons render padded and centered.
