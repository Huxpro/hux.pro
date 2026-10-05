# Agent.md: AI Context for Hux.Pro

> This file provides context for AI assistants working on this codebase.

## 1. Documentation Map

> This file is an index.

| Topic | Source of Truth |
|-------|-----------------|
| **Design Philosophy** | [docs/design-philosophy.md](./docs/design-philosophy.md) (Core principles) |
| **Design System** | [docs/design-system.md](./docs/design-system.md) (Typography, colors) |
| **Navigation** | [docs/navigation.md](./docs/navigation.md) (Command palette) |
| **Secondary Surfaces** | [docs/system-surface.md](./docs/system-surface.md) (sheet / panel / window, per viewport) |
| **Dock / Live Activities / Notices** | [docs/system-dock.md](./docs/system-dock.md) (top-anchored drawer, pill ⇄ panel; `showNotice` for a one-line notice; there is no bottom toast) |
| **Glass** | [docs/system-glass.md](./docs/system-glass.md) (Clear / Tinted material, reading surfaces) |
| **Legibility** | [docs/system-legibility.md](./docs/system-legibility.md) (Ink-at-alpha tokens, wallpaper profiles, relief, tint, the `/lab/legibility` lab) |
| **Ambient / Wallpaper** | [docs/system-ambient.md](./docs/system-ambient.md) (Weather + Apple wallpaper pairs, `pnpm wallpapers:encode` / `pnpm wallpapers:check` / `pnpm wallpapers:profile`) |
| **Architecture** | [docs/architecture.md](./docs/architecture.md) (Implementation details) |
| **Post Glossary** | [docs/glossary.md](./docs/glossary.md) (Inline term explanations; `pnpm glossary:pending` / `apply` / `check`, judged by a coding agent, no API) |
| **OG Images (ours)** | [docs/og-images.md](./docs/og-images.md) (Social cards we publish for our pages) |
| **Link Previews (OG)** | [docs/og-previews.md](./docs/og-previews.md) (Crawling *others'* OG for /works cards; `pnpm og:complete` in GitHub CI) |
| **App Icon** | [docs/app-icon.md](./docs/app-icon.md) (Generative favicon + the `/lab/icon` lab) |
| **App Folder** | [docs/app-shelf.md](./docs/app-shelf.md) (Home-screen snap-paged app folder) |
| **Attachments** | [docs/system-attachments.md](./docs/system-attachments.md) (Where a commit's media opens: sheet on a phone, with the in-app browser stacked on it; theater / in-app window / router elsewhere; the chip every cover wears; the `/lab/attachments` lab, which covers every render path) |
| **Labs** | [systems/lab](./systems/lab); see [docs/system-lab.md](./docs/system-lab.md) (`/lab`: the site studied from the inside, and the libraries it publishes. Each lab in the catalog (`systems/lab/catalog.ts`) is a `study` (Works (log.json) / Attachments / Icon / Legibility / Glow) or a `library`: Vitre, whose lab is the package's home in the library template (`LibraryShell`: Docs `/lab/vitre` with a simulated iPhone running the demo, API `/lab/vitre/api`, On hux.pro `/lab/vitre/site`); `/vitre` is only the demo. One frame for all of them (`LabShell`), bilingual throughout (a `strings.ts` per lab, `systems/lab/i18n.ts`), a surface each (`systems/lab/surfaces`) worn on the index and rotated by the home Lab widget, which is off by default. Routes stay in `app/lab/<id>`. In the palette Labs is search-only; `/` `E` opens the index; the old `/editor/*` addresses redirect.) |
| **Home widgets** | [components/home/widgets.ts](./components/home/widgets.ts) (Every widget the home grid can show and whether it is on by default (`defaultEnabled`); a visitor's choices are overrides in `hux_widget_prefs`. Edit mode's `Widgets` pill lists them; a feature can offer its own switch with `useHomeWidget`, as `/lab` does.) |
| **About / Badges** | [docs/system-about.md](./docs/system-about.md) (The surface a newcomer meets: veil, copy from `content/about/*.mdx`, the screen-edge glow, `/` `O` from anywhere; `<Badge>` opens a thing I made where it lives) |
| **Ask** | [docs/system-ask.md](./docs/system-ask.md) (⌘K as a conversation: on a desk it sits in three places (the palette's center, a side panel, the Dock's top panel) or is minimized to a Dock pill, moved by buttons or by dragging its header; on a phone it is one bottom drawer; every such choice a setting with a preset per platform (`systems/ask/lib/config.ts`, the devtool's Ask section); the Ask row / Tab, ⌘J, an agent whose tools (`search_site`, `read`) run in the browser over `public/ask/index.json` (`pnpm ask:index`), one route `app/api/chat` holding the key (AI SDK; AI Gateway, a provider key, or a keyless stand-in), AI Elements on Base UI in `components/ai-elements/`) |
| **Glow / Voice** | [docs/system-glow.md](./docs/system-glow.md) (Siri's ring as a shared WebGL shader, the site's one light: `ring` / `line`, voice `level`, `processing`; voice search in ⌘K via the Web Speech API; the `/lab/glow` lab) |
| **Identity card** | [docs/system-identity.md](./docs/system-identity.md) (The profile card behind `<handle>` and `Role:`, showing who signed a commit) |
| **Widget Scroll** | [docs/system-widget-scroll.md](./docs/system-widget-scroll.md) (Why a widget's list body scrolls under a pointer and holds still under a finger) |

## 2. Quick Start Context

**Hux.Pro** is a personal website functioning as a "Personal Operating System". It prioritizes a **System UI** aesthetic (tools, command palettes) over traditional marketing design.

### Key Constraints
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 (OKLCH colors)
- **Navigation**: Command Palette (`⌘K`) is the primary nav; no visible navbar.
- **Portability**: Pages are static; no server actions. The one API route
  in production is `app/api/chat` (Ask), which holds the model key; the
  other `app/api/*` routes are dev-only tools.

### File Locations

| Feature | Location |
|---------|----------|
| Global styles | `app/globals.css` |
| Command palette | `systems/command/` (`palette.tsx` picks sheet vs popover) |
| Ask (AI in ⌘K) | `systems/ask/`, `app/api/chat/route.ts`, `components/ai-elements/` |
| shadcn primitives | `components/ui/` (Base UI flavour, `components.json` style `base-maia`) |
| Add to Home Screen | `systems/install/` (per-browser directions sheet; Chromium's `beforeinstallprompt` when it offers one) |
| Global state | `components/providers.tsx` |
| Translations | `lib/i18n.ts` |
| Blog posts | `content/blog/*.mdx` (at /writing) |
| PL chart | A post, `content/blog/pl-chart.{en,zh}.mdx`, around `<PLChart>` / `<LanguageNotes>` (`components/languages/`, registered in `components/mdx-components.tsx`) over `content/languages.json` (`lib/languages.ts`); standalone twin: github.com/Huxpro/PL-chart |

### Design Tokens

```css
/* Fonts */
--font-sans: Inter
--font-serif: Newsreader
--font-mono: JetBrains Mono

/* Layout */
max-width: 680px (content)

/* Key transitions */
duration-200 (quick interactions)
duration-300 (morphing transitions)
```

### Before Coding
1.  **Check the Docs**: If modifying UI, check `design-system.md` for token usage.
2.  **Respect the Vibe**: Maintain the "Dual Aesthetic" (Prose vs System).
3.  **Keyboard First**: Ensure new features are accessible via Command Palette.
4.  **Sheets are Base UI Drawer**: before touching `systems/surface/sheet.tsx`,
    `systems/dock/components/live-activity.tsx`, or the surface / dock motion
    blocks in `globals.css`, read the "BEFORE CHANGING THIS FILE" list at the
    top of each file and Base UI's Drawer docs. The library's data attributes
    and CSS variables are a contract with meanings its types do not carry;
    every one of the listed items was a shipped bug. The Live Activity panel is
    the same drawer travelling `up`. Three things differ in that direction;
    they are listed in `live-activity.tsx`.

## 3. Common Tasks

### Adding Content
- Blog posts go in `content/blog/` (displayed at /writing).
- Must include frontmatter (title, date, description, language).

### Modifying Design
- Use `app/globals.css` for global variables.
- Use Tailwind utility classes for component styling.
- Avoid introducing new colors; stick to the grayscale system.
- Text and washes are `--ink` at an alpha, never a fixed grey (see
  `docs/system-legibility.md`). Use `text-muted-foreground` /
  `text-tertiary-foreground` / `text-quaternary-foreground` / `bg-muted` /
  `bg-accent`, never `text-muted-foreground/NN`, and a glass token for any
  floating surface. Recurring recipes are roles in `lib/typography.ts`
  (`TYPE.label`, `TYPE.rowMeta`, `TYPE.kbd`, …); use them. Text sitting directly on the wallpaper goes in an
  `.ink-bare` zone.
- After adding a wallpaper: `pnpm wallpapers:profile` and commit the table.

### Testing the Music System Offline
- Set `localStorage.hux_music_mock = "1"` **before app scripts run** (e.g. Playwright `context.addInitScript()`), or flip "Mock player" in the Devtool panel → Music section.
- The flag makes `MusicProvider` skip the YouTube IFrame API and drive every music surface (home widget, Live Activity, playlist sheet) from the committed fixture in `systems/music/lib/mock.ts`. Play/pause/skip/select all work with no network.
- Use this for headless-browser verification in sandboxes where `youtube.com` is unreachable. Never enabled by default; real visitors always get the real player.

### Testing the Bezel

The bezel is its own package, `packages/vitre` (`vitre`). Its API and the
iOS Safari findings behind it are in `packages/vitre/vitre.d.ts` and
`packages/vitre/README.md`; read those before changing anything about the edge
of the page. This site's configuration of it is `systems/ambient/lib/bezel.ts`.

- **Bezel on/off** follows the wallpaper kind (`WALLPAPER_KIND_EDGES`): weather
  off with soft edge, image on without. A devtool override lasts until the kind
  switches. On iOS only.
- **Tint, band, radius** are saved settings (`bezelTint`, `bezelBand`,
  `bezelRadius` in `hux_ambient_settings`), the same for every kind. Defaults:
  black, 0px, 16px. Tints: `black`, `dark`, `theme` (the page ground in the
  current theme) or `#rrggbb`.
- **Scroll** is container on an iPhone with the bezel on, window otherwise; the
  devtool's Scroll row overrides it for the session. Scroll-driven CSS must
  not use `scroll(root)`; bind to `--page-scroll` (published by the package
  on whichever element actually scrolls) or to `scroll(nearest)`.
- **Hero exit** is how the home / index title leaves as the page scrolls:
  `fade` (the default: sticky, phases out) or `scroll` (in flow, rides up).
  `defaultHeroExit` in `components/ui/hero-exit.ts` is the platform picker;
  the DevTool's Hero exit row pins either for the session.
- **Everything is live.** Safari does not re-read the root background for its
  chrome after load; `syncChrome` in the package shows it each change by
  morphing a fixed bezel to 8px and back. That morph is iOS-only. The surface
  passes `chromeMorph`; everywhere else the colour is set on `theme-color`
  with nothing drawn. Do not write the bezel colour, `data-bezel` or the scroll
  mode anywhere else.
- **Page scroll** goes through the package (`pageScrollTop`, `onPageScroll`,
  `scrollPageTo`, `usePageScroll`, …), never `window.scrollY`: with the bezel on
  an iPhone the page scrolls in a container.
- In the devtool, an amber `*` is a session override and a blue `*` a saved
  setting; clicking it resets the row.

```bash
pnpm vitre:typecheck
```

The package's documentation is the Vitre lab, in the lab's library template:
the guide `/lab/vitre` (with the simulator), the API reference
`/lab/vitre/api` and how this site uses it, `/lab/vitre/site`. The pages are in
`app/lab/vitre`; the content is the package's (`packages/vitre/site/src/docs`). A new
export or prop fails the type check until it is documented there, and then
shows on the API page by itself. The demo the simulator runs is
`packages/vitre/site` (`pnpm vitre:site`; built into `public/vitre` and served
at `/vitre`, `/bezel` redirecting there; `pnpm dev` builds it when stale). A
phone opens it full screen; anything else is redirected to the lab, by user
agent. next.config.ts is the one place that decides. The simulator and the
lab's Demo links use `/vitre/index.html`, which is never redirected.

