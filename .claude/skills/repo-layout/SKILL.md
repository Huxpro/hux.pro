---
name: repo-layout
description: Where code goes in hux.pro and the import rules that break silently. Use when adding a top-level folder, a system, a service, a page, an API route or a script; when editing a .ts module under lib/ or systems/*/lib that a script or test imports; or when a "use client" file needs something from a lib/ module that reads the disk.
---

# Repo layout

The map (folders, system shape, where state lives, which doc owns each
system) is `docs/architecture.md`. The rules the tree won't tell you:

- **Scripts and tests run in plain Node** (`--experimental-strip-types` +
  `scripts/register-ts.mjs`) and import `lib/` and parts of `systems/ask`,
  `systems/ambient`, `systems/command`. In anything they reach: no JSX or
  `.tsx` import, no `enum` / `namespace` / parameter properties, and types
  imported with `import type` (a plain `import { SomeType }` fails at load:
  "does not provide an export named"). `tsc` misses all three. Check with
  `pnpm ask:index` (it also runs on every `pnpm dev` and `build`),
  `pnpm ask:test`, `pnpm command:test`, and
  `node --experimental-strip-types --import ./scripts/register-ts.mjs --test tests/*.test.ts`.
- **A `"use client"` file imports an `fs` reader** (`lib/mdx.ts`,
  `log-server.ts`, `prompts.ts`, `og-snapshot.ts`, `ask-corpus.ts`, …)
  **only with `import type`**; the page passes the data as props.
- **Production server code is `app/api/chat` and `app/api/voice`.** Pages
  are prerendered, no server actions. A new `app/api/*` route returns 403 when
  `NODE_ENV === "production"` (as `api/log`, `api/icon` do), or is added to
  `docs/architecture.md` and `AGENT.md`.
- **`services/` imports nothing** from `systems/`, `components/`, `shared/`
  or `app/`.
- **Inside a system, relative imports**; never its own `@/systems/<name>`.
- **`packages/vitre` imports nothing from the site**; the site imports `vitre`.
- **A new system** gets `index.ts`, its provider in `shared/providers.tsx`
  inside what it reads, surfaces in `app/layout.tsx`, a doc, and a row in
  the systems table of `docs/architecture.md` and in `AGENT.md`.
  `systems/index.ts` is unused; skip it.

More: `docs/architecture.md`.
