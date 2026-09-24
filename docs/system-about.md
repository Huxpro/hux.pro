# About & Badges

The surface a newcomer meets, and the inline badge that names a thing I made.

```
systems/about/
├── provider.tsx                 # AboutProvider, useAbout() — open / close / toggle, first visit, `O`
└── components/
    ├── about-surface.tsx        # the veil, the words, the glow (mounted once in the root layout)
    ├── about-copy.tsx           # server: content/about/<locale>.mdx → the words
    └── edge-glow.tsx            # the Siri ring — a WebGL shader on the screen's edge

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
| `O` | toggles it from any page — unless a field has the keyboard, a modifier is held, or the palette is open (its slash list owns the letters; `/` `O` is the same command there). |
| ⌘K | `About` in search; `/` `O` in the slash list. Geolocation moved from `O` to `C`. |
| `/about` | the address to share: the home screen with the About already up. Putting it away swaps the address to `/` in place (no navigation, no remount). |
| leaving | Escape, `O`, a press outside the words, the button at the foot, or anything in the copy opening something — a badge or a link hands over to what it opened. |

### Three layers

1. **The veil** — the page, blurred (`backdrop-blur-2xl`) and washed in the
   glass material (`bg-glass/70`), so Tinted / Clear and the wallpaper tint
   apply. The page stays visible: you can still see where you are.
2. **The words** — one column, `33rem`, in the middle; brief. The greeting
   is serif (somebody talking), the rest sans. Each block rises in turn with a
   little blur resolving (`.about-copy` in `globals.css`), none of it under
   reduced motion.
3. **The glow** — the Siri ring, above everything, taking no pointer.

Z-order: above the theater and windows (10000–10005), below the command
palette (10050), which can still be summoned over it: `z-[10020]` for the
surface, `z-[10021]` for the glow.

**Inside the bezel.** With the vitre bezel drawn (iOS), the page's screen is
the box within its bands, rounded at its radius — and the About is a surface
on that screen, not on the glass around it. Its z-order puts it above the
bezel's mask (9999), so it cannot rely on the mask to trim it: both the
surface and the glow take `BEZEL_INSET` and the bezel's radius
(`useWallpaper().bezel` / `bezelRadius`, since the About mounts outside
`<Bezel>` and `useBezel()` would read the disabled default), clip to it, and
wear `BEZEL_LAYER_ATTRIBUTE` so container scroll makes them absolute. The
ring's shader runs around that same rounded box. Without a bezel the ring
follows the screen: 44px corners where the pointer is coarse, 10px otherwise.

**Room.** On a phone the words keep 36px from each side (or the safe area plus
24px) and 6rem top and bottom (or the safe area plus 4rem): the ring owns the
outer few dozen pixels.

### The glow

`EdgeGlow` is one fragment shader on a full-screen canvas. Each pixel knows
how far in from the screen's rounded edge it sits (`sdRoundBox`) and where
around the ring it is (the angle on the aspect-normalised square), and the
rest is built from those two numbers:

- **Beams** — four travelling waves around the ring, two each way, at
  harmonics 2 · 3 · 5 · 7, so their crests never line up the same way twice.
  A wave sets how far its light reaches in from the edge; sharpened crests
  read as beams sweeping along it, and a slower swell makes each one breathe.
- **Colour** — a cyclic Siri palette (blue · violet · pink · amber · cyan)
  laid around the ring and drifting a little differently per beam, so colours
  slide past each other. Averaging neighbouring hues greys them, so the result
  is pushed back out from its luminance — further in the light theme, where a
  pastel would vanish into the ground.
- **Core** — a thin bright line on the edge itself, whiter in the dark.
- **Arrival** — the ring sweeps in from the bottom centre up both sides to
  meet at the top (1.1s), its front flaring on the way, with a surge in reach
  as it lands that settles over 0.9s. Leaving is the same sweep backwards.

Cost: the canvas is at most one pixel per CSS pixel (half the device ratio;
the glow is soft and only the core needs the resolution), pixels deeper than
nine beam-widths exit early, and the frame loop runs only while the ring is
on screen and the tab is visible. With `prefers-reduced-motion` the ring still
arrives and leaves, then holds still and the loop stops. Without WebGL it is a
CSS conic gradient masked to the edge (`.about-glow-fallback`).

Knobs, all in `edge-glow.tsx`: `uWidth` (a beam's base reach, 16–34px by the
screen's short side), `uRadius` (the `radius` prop — the bezel's, when one is
drawn — else 44px where the pointer is coarse, 10px otherwise), `IN_MS` / `OUT_MS` / `SURGE_MS`, and the
palette in `ring()`.

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
