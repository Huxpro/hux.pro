# Lynx Apps System

Floating **Lynx Player** windows that load real Lynx web bundles via
[`@lynx-js/go-web`](https://www.npmjs.com/package/@lynx-js/go-web) in
`mode="preview"` (preview-only — no source panel).

## Mental model

Homescreen **App Shelf** icons (`content/apps.json` with `lynxExample`) →
open a frosted app window → `<Go mode="preview" defaultTab="web" />` hosts
`<lynx-view>` with the example’s `.web.bundle`.

External shelf links (React, Lynx docs, Flappy Bird, …) still open in a new
tab; only entries with `lynxExample` use the in-window player.

## Layout

```
systems/lynx-apps/
├── provider.tsx              # open / focus / minimize / close windows
├── lib/apps.ts               # Lynx example registry (go-web ids)
├── components/
│   ├── window-manager.tsx    # mounts open windows
│   ├── app-window.tsx        # title bar + drag chrome
│   └── lynx-player.tsx       # go-web preview host
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

- Use webpack (`pnpm dev` / `pnpm build` pass `--webpack`) so
  `import.meta.env.SSG_MD` can be defined for go-web.
- Peer deps include `@lynx-js/web-core`, `@lynx-js/lynx-core`, Semi UI, etc.
- Player + window chrome are dynamically imported so the homepage stays light.
