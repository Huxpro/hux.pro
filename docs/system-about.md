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

components/magic-link/
├── resolve.ts                   # props → summonable, label, icon, href (data only)
├── magic-link.tsx               # <MagicLink /> (and <Badge />): peek, drawer, home
└── server.tsx                   # MDX on the server: posts and site sections resolved
app/about/                       # `/about`: the home screen with the About up
```

## The About

A personal website usually says who it belongs to on a page you have to go
and find. This one is an operating system, and an OS introduces itself the
first time it boots. So the About is not a page: it is a surface that floats
over whatever page a visitor landed on.

| | |
|---|---|
| first visit | rises over the page 700ms after load, once there is something under it to blur. Dismissing it is what marks the visitor as met (`hux_about_seen` in localStorage); a reload before that shows it again. Not on `/lab*` and `/vitre`, which are tools. |
| `/` `O` | the palette's slash command, from any page — the About's only shortcut. There is no bare `O`: a single letter taken over every page fires by accident, and the About is not needed that often. |
| ⌘K | `About` in search. Geolocation moved from `O` to `C`. |
| λhux | the home screen's mark, the long way in: hover until it says its name (*The λHUX OS*) and the name is a door — click it; on a phone, hold it until the name is whole and the About rises — a ring round the mark, outside the finger, closes as the hold goes on (`HoldRing`, the search button's devtool hold's own; `components/home/scramble-identifier.tsx`). |
| `/about` | the address to share: the home screen with the About already up. Putting it away swaps the address to `/` in place (no navigation, no remount). |
| language | a chip in the top-right corner — the other language's name and the Languages glyph, the article header's own switch (`HeaderAction` in the meta row's mono) — so a visitor met in the language their browser guessed can turn to the one they read without leaving. |
| leaving | Escape, `/` `O`, the button at the foot, a click well clear of the words (with a pointer: beyond 96px either side of the column and 64px above and below it — nearer, a click is a miss; on a touch screen, never — a tap on a blank stretch is a thumb resting, and the button is the way out), or anything in the copy opening something — a badge or a link hands over to what it opened. Not the attachment drawer: on a phone a badge opens it *over* the About (`OVER_ABOUT_Z`, 10025), the words still underneath; Escape puts the drawer away first. The About steps aside only when the drawer sends the thing somewhere below it — the stage, a window, another page, the lightbox (`onSend` on the attachments' context); a tab leaves it be. |

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
   **Reveal** on a first visit (the veil lifts off the page the newcomer
   landed on), breathing — the glow's `pulse`, only its halo
   (`inside={false}`), blooming out from behind it: the one thing on the
   screen asking to be pressed. After the first dismissal it is a plain
   **Close**, still. Where there
   is a keyboard it wears `esc` after the word. How to come back is the
   copy's own last sentence (*you can find it again in the command menu*),
   not a line under the button, to keep the foot to the one press. On a
   phone the button is centred at the screen's foot; on a desk it hangs from
   the words' left edge, as their last line — centred under a ragged
   paragraph it would line up with nothing.
   **Where** — on a desk the words and the foot are one group, centred on the
   screen (flexible space above and below). On a phone the words take every
   line the screen has and the foot sits at its bottom.
3. **The glow** — the Siri ring, above everything, taking no pointer.

Z-order: above the theater and windows (10000–10005), below the command
palette (10050), which can still be summoned over it. The layers are one
table in `systems/about/provider.tsx`: `ABOUT_Z` (10020) for the surface,
`ABOUT_GLOW_Z` (10021) for the ring, `OVER_ABOUT_Z` (10025) for what its
copy opens over it, `DEVTOOL_OVER_ABOUT_Z` (10030) for the devtool. A
surface that must come up over the About asks `useOverAboutZ()`.

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

The words are set as an article is: the reader's size (`--reading-size`),
1.75 lines, the article's ink, a paragraph and a half apart; links and
emphasis share the article's rules (`.prose-link`, `.about-copy em`), so the
About cannot drift from the site's prose.

`content/about/en.mdx` and `zh.mdx`. The root layout renders both at build
time with `AboutCopy` (a server component, so it is imported by path, not from
the system's index) and the surface shows the reader's. What is available:

| | |
|---|---|
| `<MagicLink>` | a word that summons something — a post, a work, a role, a page (below) |
| `<Badge>` | the same link dressed as a pill wearing the thing's icon: a company, a project |
| `*…*` | italics, in the serif — the word the copy is about, *interface* (in Chinese, which has no italic, 界面 is the serif upright). Latin serif is set 1.0625em, the article's optical adjustment for Newsreader's smaller x-height — the same rule as the article's (`.about-copy em` beside `.prose-article em`, globals.css) |
| `<Fn n="1" />` | a note's mark: a superscript number that scrolls the note into view inside the About (the address is left alone) |
| `<Footnotes>` / `<Footnote n="1">` | the notes, at the end, in the About's annotation type — the tiny mono line; a note's number scrolls back to its mark |
| `<Kbd>`, plain links | a key; a link (internal ones use the router, external ones open a tab) |

Every keyword is a magic link: companies and projects as badges (each wears
its site's icon — `pnpm badges:snapshot`; `content/badges.json` names the
site for a commit or an identity), everything else as the word alone.

## Magic links

A magic link names a *summonable*, and summons it the way the site
summons that thing everywhere else — one semantics, whatever it is dressed
as:

| it names | with a pointer (hover) | on a phone (tap) | a press, with a pointer |
|---|---|---|---|
| `post="dreamer"` | the /writing row's peek (`PostPeekView`) | the drawer: that peek, and Read | the post |
| `commit="lynx-framework"` — a commit, whole | the /works row's peek (`buildCommitPreview`: the stacked covers) | the attachment drawer, paging through all of its media | its row on /works |
| `commit=… item={n}` — one media | the /works cover's peek (`mediaPeek`); a post on this site peeks as the post | a drawer of just it | its home: the stage, the in-app browser, the router |
| `role="meta-engineer"` | the /works role row's peek: the identity's profile | the role drawer (the identity card): the profile, its count of signed commits heading the commits themselves — each opens its own attachment drawer over this one — and Visit, to the role's row | its row on /works |
| `href="/works?type=talk"` | the section's card (its share image, a count) | the drawer: the card, Visit | the page |
| `href="https://…"` | the page's card (`pnpm og:snapshot` crawls these; `content/badges.json` `previews` for a page with no card to crawl) | the drawer | the in-app browser, or a tab |
| `app="…"` | — | a sheet | a window |

A post's peek is its body (excerpt, cover), which only the server can read,
so MDX maps rendered on the server (the About, posts, docs) use
`server.tsx`: it reads the post, or counts a section, and hands the client
link a `media` carrying it (`InternalLinkMeta.peek`).

Any page change while the About is up puts it away (the provider watches
the path), so a drawer's Visit or a card's row leaves it behind too.

The peek follows the input (`magneticPreviewEnabled`), as every peek does;
the drawer follows the viewport (the attachments' policy). Inside the About
the peeks, the drawer and the identity card all come up over it
(`MagicLinkHost layer`, `useOverAboutZ`), and the About steps aside only
when something leaves for a home beneath it — told by the attachments
(`onSend`), by a page change, or by a link that navigates or opens an app
(`MagicLinkHost onLaunch`); a tab takes nothing from it. Two verbs put it
away: `dismiss()` is the visitor's (the button, Escape, a click well clear
of the words) and is the only one that swaps `/about` for `/`; `close()` is
a hand-over and leaves the address to whatever is taking it, so the swap
never lands under the router's push. Escape is the About's only once
nothing over it (a drawer, a card, the palette) has marked it handled.

## Badges

`<Badge>` is a magic link for a thing I made, named inline in a sentence, wearing its icon, and
one press from where it lives on the site. It works anywhere MDX renders —
posts, docs, the About — and as `<MagicLink badge>` from code.

```mdx
<Badge commit="lynx-framework">Lynx</Badge>       {/* a commit in content/log.json */}
<Badge role="alitrip-engineer">Alibaba</Badge>   {/* a role: the identity's profile */}
<Badge commit="hermes-engine" item={1} />         {/* its second attachment */}
<Badge app="lynx-flappy-bird" />                  {/* an app in content/apps.json */}
<Badge href="https://youtu.be/…">Talk</Badge>     {/* any URL; the kind is read off it */}
<Badge href="/img/x.jpg" as="image" />           {/* force the kind */}
<Badge href="…" icon="/app-icons/react.png" />    {/* choose the icon (a path, a URL or an app id) */}
```

### Where a press lands

Through the attachment policy (`systems/attachments/lib/policy.ts`), so a
badge never disagrees with a cover on `/works` about where a thing lives:

A badge calls `open`, exactly as a `/works` cover does: on a phone the
attachment drawer first — the thing, its title and its way in, a thumb's
reach from where you are — and on a desk its native home straight away:

| the thing | on a desk | on a phone |
|---|---|---|
| a page | the in-app browser, a window — a tab if it refuses to be framed | the drawer |
| a recording, a deck | the stage (the theater) | the drawer |
| a post, an in-site path | the router | the drawer |
| an image, a social post | the attachment surface | the drawer |
| an app | a window, on its runtime (web or Lynx) — `openApp` | a sheet |

It keeps a real `href`, so ⌘-click, middle-click and a page without
JavaScript still work, and a page that will leave for a tab says so in its
tooltip.

A badge is a word in a sentence, so it copies as one: its icon is
`select-none` (a monogram's letter would copy as "H Hux Blog"), and it is
`draggable={false}`, so a drag across it selects text rather than carrying the
link away. The About's words are a document over the home screen, whose
selection lock (`useLockTextSelection`) would otherwise take them: the
article is marked `data-text-document`, which the lock lets be.

A surface that hosts magic links and should step aside when one opens
something wraps them in `<MagicLinkHost onLaunch={…}>` — the About does. A
link that opens the drawer or the identity card does not call it: those float
over their host, which raises them (`AdaptiveSurface`'s `zIndex`) and hears
where the drawer sends things next (`useAttachments().onSend`).

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
