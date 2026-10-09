---
skills: [repo-layout]
---

# Architecture

The map of the repo: what each top-level folder holds, how a system is
shaped, what may import what, where state lives, and which doc owns each
system. Read it to know where a change goes; read the system's own doc
before changing the system.

## What it looks like done well

- A feature with its own UI, state and logic is one folder,
  `systems/<name>/`, with an `index.ts`, a row in [the table](#systems-and-their-docs)
  and a doc.
- A new file goes in the folder this page names for its kind. Nothing new
  appears at the top level.
- The server code that runs in production is still two routes,
  `app/api/chat` and `app/api/voice`. Every page is prerendered.
- `pnpm ask:index` still runs: every module a script reaches still loads in
  plain Node.

## The map

![The repo map: app/ routes mount shared/providers.tsx, which composes services/ and the systems' providers; each system box names its doc; systems, components/ and lib/ import each other; content/ is read by scripts/ that write committed snapshots, and by lib/ at build.](/img/docs/architecture/map.svg)

Top row: what runs in the browser and the two production routes.
`app/layout.tsx` mounts `Providers` and every app-level surface (Dock,
palette, sheets, windows); `api/chat` and `api/voice` call into `systems/ask`
and `systems/voice`. Bottom row: what happens before the build. Arrows point
from the importer (or reader) to what it uses.

| Folder | Holds |
|--------|-------|
| `app/` | Next.js 16 App Router routes. A `page.tsx` reads content through `lib/` on the server and hands it to a client view in the same folder (`app/page.tsx` → `home-view.tsx`, `app/writing/page.tsx` → `blog-list.tsx`, `app/works/layout.tsx` → `view.tsx`). Routes: `/`, `/writing`, `/works`, `/prompt`, `/about`, `/docs`, `/lab/<id>`. |
| `systems/<name>/` | Features with UI, state and logic. See [How a system is shaped](#how-a-system-is-shaped). |
| `services/` | Global state with no UI, one provider each: `theme.tsx`, `locale.tsx`, `visitor.tsx`, `glass.tsx`, `input-capability.tsx`, exported from `services/index.ts` (`@/services`). |
| `shared/providers.tsx` | The provider tree and nothing else. Its order and the reason for it: [React Conventions](./react-engineering.md). |
| `components/` | Shared UI no single system owns: `ui/` (shadcn primitives on Base UI, `components.json` style `base-maia`), `home/` (widgets; the list is `widgets.ts`), `post/` (reading pages), `log/` (the works timeline's cards and media), `ai-elements/` (Ask's chat parts), `apps/`, `languages/`, `magic-link/`, `motion-primitives/`, `prompt/`, and the MDX renderer (`mdx-components.tsx`, `mdx-renderer.tsx`). |
| `lib/` | Modules with no UI of their own: helpers (`utils.ts` `cn`, `typography.ts` `TYPE`, `i18n.ts` with the translations), a few hooks (`use-controllable-state.ts`, `use-hash-landing.ts`), the query client (`query.ts`), and the server readers that turn `content/` into data and import `fs`: `mdx.ts`, `log-server.ts`, `prompts.ts`, `og-snapshot.ts`, `ask-corpus.ts`, `ask-prompt.ts`, `image-meta.ts`, `icon/generate.ts`. |
| `content/` | The site's words and data: `blog/*.{en,zh}.mdx`, `about/{en,zh}.mdx`, `log.json` (works), `prompts.json`, `apps.json`, `icon.json`, `badges.json`, `languages.json`; and the snapshots the scripts write. |
| `docs/` | These pages. Every `.md` / `.mdx` here is published at `/docs/<slug>/<lang>` (`getDocSlugs` in `lib/mdx.ts`). |
| `packages/vitre` | The page's edge on iOS Safari, a package of its own with a demo site in `packages/vitre/site`. The site imports it as `vitre` (a `tsconfig.json` path to `src/index.ts`). See the skill `vitre`. |
| `scripts/` | Node CLIs behind the `pnpm` scripts in `package.json`: snapshots (`og:*`, `badges:*`, `apps:*`, `icon:*`), `wallpapers:*`, `ask:index`, the vitre demo build, and the tests in `scripts/tests/`. |
| `tests/` | `node:test` files for Ask's state machine and policies (`ask-*.test.ts`). No `pnpm` script runs them; see [Commands](#commands). |
| `public/` | Static files. Docs images in `public/img/docs/<slug>/`. Generated and ignored: `public/ask/index.json`, `public/vitre/`. |
| `middleware.ts` | Adds the locale to a bare `/writing/*` or `/docs/*` address, from the `locale` cookie (default `en`). |

## How a system is shaped

```
systems/<name>/
├── index.ts         # what other folders import: @/systems/<name>
├── provider.tsx     # its context, when it has app-wide state
├── components/      # its UI
└── lib/             # its logic, data and pure state
```

Every system has an `index.ts`. Eleven have a `provider.tsx`. The other
six (`ask`, `draggable`, `glow`, `lab`, `surface`, `voice`) have none; what
state they keep is in module stores (`systems/surface/stack.ts`,
`systems/ask/lib/use-ask.ts`) or `makeStore` preferences
(`systems/voice/prefs.ts`). Some stay flat, a file per concern and no
`components/` or `lib/`: `command`, `devtool`, `surface`, `draggable`.

A system's provider is mounted in `shared/providers.tsx` when the whole app
reads it, inside whatever provider it reads. Its surfaces (sheets, windows,
Dock activities) are mounted once in `app/layout.tsx`. A provider only one
subtree needs is mounted there instead (`DockProvider` in `<Dock>`).

## Where state lives

| Kind | Where | Example |
|------|-------|---------|
| App-wide, read by many | A provider in `shared/providers.tsx` | `useTheme()`, `useWeather()`, `useMusic()` |
| One feature's, read from anywhere | A module store over `useSyncExternalStore`, no provider | `systems/dock/notice.ts` (`showNotice`), `systems/surface/stack.ts` |
| A visitor's string preference | `makeStore` in `components/post/persisted-setting.ts` | reading settings, Ask's model |
| A setting with structure | One JSON object in localStorage, read by its provider | `hux_ambient_settings` |
| Server data | TanStack Query, persisted as `hux_query_cache` | the ambient system's location and weather |
| The locale | localStorage and the `locale` cookie, which `middleware.ts` reads | `services/locale.tsx` |
| Content | `content/`, read at build | posts, works, prompts |

Which to pick and how to read a browser-only value without a hydration
mismatch: [React Conventions](./react-engineering.md).

## Rules

**Production server code is `app/api/chat` and `app/api/voice`.** Chat holds
the model key for Ask; voice transcribes speech through the AI Gateway (its
`GET` says whether that is available). Everything else is prerendered: there
are no server actions, and the dynamic routes list their params
(`generateStaticParams`). `/writing/<slug>/<lang>` and `/works/<type>`
refuse any other (`dynamicParams = false`); `/docs` allows one so a new doc
shows in `next dev`. `app/api/log`, `app/api/icon` and `app/api/og`
are tools for `next dev` and answer 403 (`og`: 404, unless
`NEXT_PUBLIC_OG_RUNTIME=1`) in production. `/lab/icon` and `/lab/works` are
`force-dynamic`: they read their file on each request so the dev routes can
save it. `middleware.ts` also runs, only to redirect. A new endpoint is
either gated the same way or named here.

**Every module a script or test reaches runs in plain Node.** The `pnpm`
scripts run `scripts/*.ts` with `--experimental-strip-types` and
`scripts/register-ts.mjs` (which resolves `@/` and extensionless paths), and
they import site code: `lib/` and parts of `systems/ask`, `systems/ambient`
and `systems/command`. Node only strips types, so in those modules:

- no JSX and no `.tsx` import (`ERR_UNKNOWN_FILE_EXTENSION`);
- no `enum`, `namespace` or constructor parameter properties
  (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`);
- a type is imported with `import type` or an inline `type`. A plain
  `import { SomeType }` survives stripping and fails at load: "does not
  provide an export named".

`tsc` catches none of these. `pnpm ask:index` runs on every `pnpm dev` and
`pnpm build`, so a break there stops both.

**A client module imports a server reader only as a type.** The readers in
`lib/` import `fs`. A `"use client"` file that needs their shapes uses
`import type` (`app/prompt/view.tsx` from `lib/prompts.ts`); the page passes
the data in as props.

**`services/` imports nothing from `systems/`, `components/`, `shared/` or
`app/`.** Its providers sit outside every system's provider, and everything
imports them.

**Inside a system, imports are relative.** No system imports its own
`@/systems/<name>` barrel (none does today): `index.ts` re-exports the
system, so importing it from inside runs through the barrel and invites a
cycle.

**`packages/vitre` imports nothing from the site.** It is a package; the
site imports it as `vitre`. The one reach the other way is the lab, which
reads the demo site's docs modules (`app/lab/vitre` from
`@/packages/vitre/site/src/…`, `systems/lab/catalog.ts` the
`package.json`).

## Free choices

- **Barrel or deep import from outside a system.** Most imports go through
  `@/systems/<name>`; deep imports into a system's `lib/` or `components/`
  are common (into `ambient`, `ask` and `command` most) and nothing forbids
  them.
- **`components/` and `systems/` import each other.** Home widgets, log cards
  and reading pages use systems; systems use `components/ui`, `log` and
  `ai-elements`. There is no layer between them.
- `systems/index.ts` re-exports six systems and nothing imports it. A new
  system does not need to be added there.

## Recipes

**Adding a system.** `systems/<name>/index.ts` first; `provider.tsx`,
`components/`, `lib/` as it grows. Mount the provider in
`shared/providers.tsx` inside what it reads, its surfaces in
`app/layout.tsx`. Write `docs/system-<name>.md`, add a row to the table below
and to the Documentation Map in `AGENT.md`.

**Adding a service.** `services/<name>.tsx` with a provider and a hook,
exported from `services/index.ts`, mounted in `shared/providers.tsx`.

**Adding a page.** A folder under `app/`; `page.tsx` reads through `lib/`,
the client view sits beside it. A dynamic segment lists its params. Reach it
from ⌘K: a catalog entry in `systems/command/catalog.ts` and its `run` in
`actions.tsx` (the skill `ask-commands`).

**Adding a script.** `scripts/<name>.ts`, a `package.json` entry in the
shape of the others (`node --experimental-strip-types --import
./scripts/register-ts.mjs scripts/<name>.ts`). If it writes a file that is
committed, add it to the skill `content-snapshots`.

## Commands

```bash
pnpm dev                 # predev: lynx CSS module, vitre demo (when stale), ask:index
pnpm build               # prebuild: lynx CSS module; then vitre demo, ask:index, next build
pnpm lint
npx tsc --noEmit -p .
pnpm ask:test && pnpm command:test
node --experimental-strip-types --import ./scripts/register-ts.mjs --test tests/*.test.ts
```

Snapshot commands and what each commits: the skill `content-snapshots`.

## Systems and their docs

| System | What it is | Doc |
|--------|-----------|-----|
| `about` | The surface a newcomer meets; `<Badge>` | [About & Badges](./system-about.md) |
| `ambient` | Weather, sun, wallpapers, the bezel's settings | [Ambient](./system-ambient.md) (location, weather, phase, cache); the live sky in [The Sky](./ambient-sky.md), its eggs in [Ambient easter eggs](./ambient-easter-eggs.md); styles, pictures and the bezel in [Wallpapers](./wallpapers.md) |
| `ask` | ⌘K as a conversation; `app/api/chat` | [Ask](./system-ask.md) |
| `attachments` | Where a commit's media opens | [Attachments](./system-attachments.md) |
| `command` | The ⌘K palette and the floating button | [Command](./system-command.md); moving between pages: [Navigation](./navigation.md) |
| `devtool` | The debug panel and FAB | [Devtool](./system-devtool.md) |
| `dock` | Live Activities and one-line notices, at the top | [Dock](./system-dock.md) |
| `draggable` | `withDraggable` / `useDraggable` for the FABs and windows | none; the devtool's FAB in [Devtool](./system-devtool.md) |
| `glow` | Siri's ring, the site's one light | [Glow & Voice](./system-glow.md) |
| `identity` | The profile card behind a handle | [Identity](./system-identity.md) |
| `install` | Add to Home Screen directions | none |
| `lab` | `/lab`: the studies and the vitre library pages | [Lab](./system-lab.md) |
| `music` | Now Playing, the YouTube player (`hux_music_mock` offline) | its Live Activity in [Dock](./system-dock.md); offline testing in `AGENT.md` |
| `surface` | Sheet / panel / window, per viewport | [Surface](./system-surface.md), [Typing on a phone](./keyboard-input.md) |
| `theater` | The video and slides player, theater and PiP | its tracks in [Attachments](./system-attachments.md), its activity in [Dock](./system-dock.md) |
| `voice` | Speech input; `app/api/voice` | [Glow & Voice](./system-glow.md) |
| `windows` | Chrome windows for apps | [Windows](./system-windows.md) |

Cross-cutting: [Design System](./design-system.md),
[Legibility](./system-legibility.md), [Glass](./system-glass.md),
[Motion](./motion.md), [React Conventions](./react-engineering.md),
[Content](./content-system.md), [OG Images](./og-images.md),
[Link Previews](./og-previews.md), [App Icon](./app-icon.md),
[App Folder](./app-shelf.md), [Widget Scroll](./system-widget-scroll.md).
