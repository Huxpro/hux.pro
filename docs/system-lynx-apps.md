# Lynx Apps System

Floating **app windows** (iPadOS Stage Manager–style chrome) that host either:

- **Lynx** — real `.web.bundle`s via
  [`@lynx-js/web-core`](https://www.npmjs.com/package/@lynx-js/web-core)
  `<lynx-view>` (no go-web / Semi chrome — keeps example CSS intact), or
- **Web** — an iframe of the shelf entry’s `url` (menu: Open in browser).

## Mental model

Homescreen **App Shelf** icons (`content/apps.json`) → open a floating window:

- `lynxExample` set → Lynx Player (`<lynx-view>` + same-origin bundle)
- otherwise `url` → Web Player (iframe)

Shelf tiles wear a bottom-right kind chip: **Lynx mark** on React-cyan /
Vue-green for Lynx apps, **globe** for Web apps.

## Layout

```
systems/lynx-apps/
├── provider.tsx              # open / focus / minimize / close windows
├── lib/apps.ts               # Lynx example registry (bundle folder ids)
├── components/
│   ├── window-manager.tsx    # mounts open windows
│   ├── app-window.tsx        # iPadOS-style title bar + drag chrome
│   ├── lynx-player.tsx       # direct <lynx-view> host
│   └── web-player.tsx        # iframe host for shelf web apps
└── index.ts
```


Homescreen icons live in the existing App Shelf (`content/apps.json` +
`components/home/app-shelf.tsx`); entries with `lynxExample` call `openApp()`.

## Examples

Bundles are **not** fetched from lynxjs.org at runtime (CORS). They are
materialized into `public/lynx-examples/` from npm:

```bash
pnpm lynx:examples        # or lynx:examples:clean
```

`prebuild` runs the same script so Vercel/CI always has fresh samples.

Current samples: `hello-world`, `animation`, `bankcards`, `Vuehello-world`,
`Vuetodomvc` (from `@lynx-example/*` / `@vue-lynx-example/*`).

## Dev notes

- Player loads `@lynx-js/web-core/client` on demand and resolves
  `public/lynx-examples/{id}/example-metadata.json` for the `.web.bundle`.
- Window chrome is Stage Manager–inspired: floating ••• pill (drag + menu
  with Close/Minimize) over edge-to-edge content — not macOS traffic lights.
- `pnpm lynx:shadow-css` (also `predev` / `prebuild`) flattens web-core’s
  `in_shadow.css` so Webpack can inject real layout CSS into `<lynx-view>`.
- Player + window chrome are dynamically imported so the homepage stays light.
