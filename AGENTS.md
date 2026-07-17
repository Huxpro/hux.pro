# AGENTS.md

For project context, docs map, and coding conventions, see [AGENT.md](./AGENT.md).

## Cursor Cloud specific instructions

Hux.Pro is a **single-service Next.js 16 app** (App Router, Turbopack, Tailwind CSS v4)
managed with **pnpm**. Node 22 and pnpm are already available; the startup update
script runs `pnpm install`.

Standard commands live in `package.json` (`dev`, `build`, `lint`) — use those:
- Dev server: `pnpm dev` (http://localhost:3000).
- Production build: `pnpm build`.
- Lint: `pnpm lint`.

Non-obvious caveats:
- **No automated test framework** is configured (no `test` script). Validate changes
  via `pnpm build`, `pnpm lint`, and manual browser testing.
- **`pnpm lint` currently reports pre-existing errors** (mostly in `systems/music/*`),
  so it exits non-zero on a clean checkout. Judge lint results by whether *your*
  changes add new problems, not by the overall exit code.
- **`middleware.ts` redirects bare content paths to a locale suffix** (e.g. `/writing`
  → `/writing/en`, `/docs/...` → `/docs/.../en`) with a 307. Use `curl -L` when hitting
  those routes so the redirect is followed.
- **Navigation is keyboard-first**: the Command Palette (`⌘K` / `Ctrl+K`) is the primary
  nav; there is no visible navbar. Use it to reach Writing, Works, System Prompts, etc.
- The app is **static-export compatible** by design (no server actions); the `app/api`
  and `/editor` routes are dev-only tooling for OG images / icons.
