# About & Badges

The surface a newcomer meets, and the inline badge that names a thing I made.

```
systems/about/
├── provider.tsx                 # AboutProvider, useAbout() — open / close / toggle, first visit, Escape
└── components/
    ├── about-surface.tsx        # the veil, the words, the glow (systems/glow), mounted once in the root layout
    └── about-copy.tsx           # server: content/about/<locale>.mdx → the words

content/about/{en,zh}.mdx        # the copy
content/badges.json              # authored: which site a commit badge stands for, vendored icons
content/badge-icons.json         # generated: each site's official icon (pnpm badges:snapshot)
lib/badge-site.ts                # the rule for "which site", shared by component and script
scripts/badge-icon-snapshot.ts   # pnpm badges:snapshot / badges:check

components/badge/
├── resolve.ts                   # props → target, label, icon, href (data only)
└── badge-link.tsx               # <BadgeLink /> — `Badge` in MDX
app/about/                       # `/about`: the home screen with the About up
```

## The About

A personal website usually says who it belongs to on a page you have to go
and find. This one is an operating system, and an OS introduces itself the
first time it boots. So the About is not a page: it is a surface that floats
over whatever page a visitor landed on.

| | |
|---|---|
| first visit | rises over the page 700ms after load, once there is something under it to blur. Dismissing it is what marks the visitor as met (`hux_about_seen` in localStorage); a reload before that shows it again. Not on `/editor*` and `/vitre`, which are tools. |
| `/` `O` | the palette's slash command, from any page — the About's only shortcut. There is no bare `O`: a single letter taken over every page fires by accident, and the About is not needed that often. |
| ⌘K | `About` in search. Geolocation moved from `O` to `C`. |
| `/about` | the address to share: the home screen with the About already up. Putting it away swaps the address to `/` in place (no navigation, no remount). |
| leaving | Escape, `/` `O`, a press outside the words, the button at the foot, or anything in the copy opening something — a badge or a link hands over to what it opened. |

### Three layers

1. **The veil** — the page, blurred (`backdrop-blur-2xl`) and washed in the
   glass material (`bg-glass/70`), so Tinted / Clear and the wallpaper tint
   apply. The page stays visible: you can still see where you are.
2. **The words** — one column, `33rem`, in the middle; brief. The greeting
   is serif (somebody talking), the rest sans. Each block rises in turn with a
   little blur resolving (`.about-copy` in `globals.css`), none of it under
   reduced motion. The words scroll in their own container, fading at its
   foot when they overflow, so however long the copy and however short the
   screen, nothing pushes the way out off it.
   **The foot** — always on screen: a glass button, centred (`GLASS_TRACK_FLAT`,
   the theater's control glass — part of the veil, not a slab on it), reading
   **Reveal** every time (the veil lifts off the page underneath). Where there
   is a keyboard it is longer (12rem) and wears `esc` on its right, balanced
   by an empty column of the same width on its left, so the word stays at
   the button's centre and the button at the screen's. Beneath it one quiet
   line (quaternary) for every device — *Find it again in the command menu* —
   kept to about the button's width so the weight stays on the press.
   **Where** — on a desk the words and the foot are one group, centred on the
   screen (flexible space above and below). On a phone the words take every
   line the screen has and the foot sits at its bottom.
3. **The glow** — the Siri ring, above everything, taking no pointer.

Z-order: above the theater and windows (10000–10005), below the command
palette (10050), which can still be summoned over it: `z-[10020]` for the
surface, `z-[10021]` for the glow.

**Inside the bezel.** With the vitre bezel drawn (iOS), the page's screen is
the box within its bands, rounded at its radius — and the About is a surface
on that screen, not on the glass around it. Its z-order puts it above the
bezel's mask (9999), so it cannot rely on the mask to trim it: both the
surface and the glow take `BEZEL_INSET` and the screen's radius
(`useWallpaper().screenRadius` — the bezel's radius, the very number
`<Vitre>` is given, so a devtool drag moves the bezel, the veil and the ring
together; the About mounts outside `<Vitre>`, where `useVitre()` would read
the disabled default), clip to it, and
wear `VITRE_LAYER_ATTRIBUTE` so container scroll makes them absolute. The
ring's shader runs around that same rounded box. Without a bezel the ring
runs around the plain rectangle of the viewport.

**Room.** On a phone the words keep 36px from each side (or the safe area plus
24px) and 6rem top and bottom (or the safe area plus 4rem): the ring owns the
outer few dozen pixels.

### The glow

The ring is the site's one light — `<EdgeGlow>` from `systems/glow`, the
same shader and renderer every other glow uses (the palette listening, a
window loading). How it is built, its knobs and its cost are in
[system-glow.md](./system-glow.md). Here it frames the words: its `content`
is the article (as far as its scroll container shows it) and the way out
under it, and its `depth` — where the light ends, as a share of the
narrower gutter to them, alike off every edge — comes from the devtool's
Glow module, one per layout (a desk's centred group, a phone's whole
screen): 130% on a desk, the ring as it first shipped, and 140% on a phone. Its
corners are `screenRadius`: the bezel's inside a bezel, 0 without one (a
browser window's page is a rectangle; a phone's rounded glass is the
hardware's to clip).

### The copy

`content/about/en.mdx` and `zh.mdx`. The root layout renders both at build
time with `AboutCopy` (a server component, so it is imported by path, not from
the system's index) and the surface shows the reader's. Components available:
`Badge` / `BadgeLink`, `Kbd`, `Credits` (the tiny line at the foot), plain
links (internal ones use the router; external ones open a tab).

Keep it short: a greeting, who I am, what the site is, credits last.

## Badges

`<Badge>` is a thing I made, named inline in a sentence, wearing its icon, and
one press from where it lives on the site. It works anywhere MDX renders —
posts, docs, the About — and as `<BadgeLink>` from code.

```mdx
<Badge commit="lynx-framework">Lynx</Badge>       {/* a commit in content/log.json */}
<Badge commit="hermes-engine" item={1} />         {/* its second attachment */}
<Badge app="lynx-flappy-bird" />                  {/* an app in content/apps.json */}
<Badge href="https://youtu.be/…">Talk</Badge>     {/* any URL; the kind is read off it */}
<Badge href="/img/x.jpg" as="image" />           {/* force the kind */}
<Badge href="…" icon="/app-icons/react.png" />    {/* choose the icon (a path, a URL or an app id) */}
```

### Where a press lands

Through the attachment policy (`systems/attachments/lib/policy.ts`), so a
badge never disagrees with a cover on `/works` about where a thing lives:

| the thing | where it opens | how |
|---|---|---|
| a page | the in-app browser (a window; a sheet on a phone) — a tab if it refuses to be framed | `act` |
| a recording, a deck | the stage (the theater; a PiP on a phone) | `act` |
| a post, an in-site path | the router | `act` |
| an app | a window, on its runtime (web or Lynx) | `openApp` |
| an image, a social post | the attachment surface — their only in-site home | `open` |

A badge goes straight to the native home even on a phone, skipping the
attachment sheet a `/works` cover opens: a badge is one thing, with no set to
page through. It keeps a real `href`, so ⌘-click, middle-click and a page
without JavaScript still work, and a page that will leave for a tab says so in
its tooltip.

A surface that hosts badges and should step aside when one opens something
wraps them in `<BadgeLaunchProvider onLaunch={…}>` — the About does.

### What it wears

Its official icon, always — CI fails a badge without one.

| the badge | its icon |
|---|---|
| `app=` | the app's home-screen icon (`content/app-icons.json`, `pnpm apps:snapshot`) |
| `commit=`, `href=` elsewhere | the icon its **site** declares for a home screen — manifest → apple-touch-icon → favicon — snapshotted into `public/badge-icons/` and `content/badge-icons.json` by `pnpm badges:snapshot` |
| `href=` a path on this site | this site's own icon (`/icons/icon.svg`) |
| `href=` an image | the image itself |
| `icon=` | that: a path, a URL, or an app id |

Which site stands for a badge is one rule, `lib/badge-site.ts`, shared by the
component and the script: an `href`'s host (youtu.be is YouTube, twitter.com
is X); a commit's first external attachment, unless `content/badges.json`
names its site under `commits` — Ele.me's PWA is h5.ele.me, not the Medium
post about it; Alitrip is Fliggy, which alitrip.com now serves; Hux Blog is
huxpro.github.io.

Where a site's own icon is gone or has moved on, `content/badges.json` names
one under `icons`, vendored under `public/img/badges/` and never re-crawled:
Hermes (hermesengine.dev now redirects to GitHub, so its logo is the one the
Wayback Machine kept) and Ele.me (h5.ele.me now wears the 淘宝闪购 rebrand;
the blue `e` is the archived icon the PWA shipped with).

`pnpm badges:snapshot` reads every `<Badge>` in `content/` and `docs/`,
fetches what is missing, keeps a good prior icon when a crawl fails, and fails
when a badge's site has no icon at all. `pnpm badges:check` is the
filesystem-only half that CI runs (`.github/workflows/ci.yml`). A new badge
pointing at a new site: run the snapshot and commit what it writes.

An icon drawn for a home screen (manifest, apple-touch-icon, or any square
≥160px) fills its tile; a favicon is a glyph and sits on a white plate, the
way a home screen shows one — so a black mark (Lynx's cat) reads in the dark.
A badge nobody has snapshotted falls back to a monogram in the commit's era
colour, or the glyph of what it is; that is what the check is for.

The pill is sized in `em`, so it sits in a sentence at any size. In prose it
carries `.not-prose` to escape the link style, and `globals.css` takes the
block margin that class would give it back off.

The specimens are in `docs/component-test.en.mdx` (`/docs/component-test`).
