---
skills: [content-snapshots]
---

# About & Badges

The surface a newcomer meets, and the inline badge that names a thing I made.

## What it looks like done well

A first visit to `/` on a desk: the page is still there under the veil, the
words sit in one column in the middle, the ring of light runs round the
screen's edge, and the one thing asking to be pressed is **Reveal**,
breathing.

![The About over the home screen on a desk, first visit: a blurred page under a pale glass veil, the greeting in serif, a paragraph of company and project badges, two footnotes in mono, a Reveal button with an esc key at the words' left edge and the other language at their right, and a coloured glow around the screen's edge.](/img/docs/system-about/first-visit-desk.png)

1280×860, headless. Every company and project in the copy is a badge
wearing its site's icon; the footnotes are in the annotation type; the way
out hangs from the words' left edge as their last line.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-about/first-visit-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The About on a phone, first visit: the greeting with the 中文 switch at its right, the words filling the screen and fading at the foot where they overflow, a centred Reveal button blooming with the glow at the bottom, and the glow around the screen's rounded edge." />
  <img src="/img/docs/system-about/badge-drawer-phone.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same About after tapping the Lynx badge: the attachment drawer, titled Lynx Framework, has risen over the About with the lynxjs.org card and a lynxjs.org button; the greeting and the glow are still visible above and around it." />
</div>

A phone (iPhone 15 Pro viewport, headless, so no bezel and no safe-area
insets). Left: the words take the screen and fade at its foot because they
overflow; Reveal stays centred at the bottom. Right: a badge tapped inside
the About opens the attachment drawer *over* it, and the words stay
underneath until the drawer sends the thing somewhere.

## How it works

```
systems/about/
├── index.ts                     # AboutProvider, useAbout, useOptionalAbout, AboutSurface (client-safe)
├── provider.tsx                 # open / dismiss / close, first visit, Escape, the z-order table, useOverAboutZ()
└── components/
    ├── about-surface.tsx        # the veil, the words, the foot, the glow (systems/glow); mounted once in app/layout.tsx
    ├── about-copy.tsx           # server: content/about/<locale>.mdx → the words
    ├── about-language.tsx       # the other language's switch
    └── footnote.tsx             # <Fn>, <Footnotes>, <Footnote>

content/about/{en,zh}.mdx        # the copy
content/badges.json              # authored: which site a commit or identity stands for, vendored icons, manual cards
content/badge-icons.json         # generated: each site's official icon (pnpm badges:snapshot)
lib/badge-site.ts                # the rule for "which site", shared by component and script
scripts/badge-icon-snapshot.ts   # pnpm badges:snapshot / badges:check
scripts/magic-link-tags.ts       # reads every <Badge> / <MagicLink> in content/** and docs/**

components/magic-link/
├── resolve.ts                   # props → target, label, icon, href (data only)
├── magic-link.tsx               # <MagicLink /> (and the badge dress), <MagicLinkHost />
└── server.tsx                   # ServerMagicLink / ServerBadge / ServerProseLink: posts and site sections resolved
app/about/                       # `/about`: the home screen with the About up
```

## The About

A personal website usually says who it belongs to on a page you have to go
and find. This one is an operating system, and an OS introduces itself the
first time it boots. So the About is a surface that floats over whatever
page a visitor landed on, rather than a page of its own.

| | |
|---|---|
| first visit | rises over the page 700ms after load (`FIRST_VISIT_DELAY_MS`), once there is something under it to blur. Putting it away, by any route, is what marks the visitor as met (`hux_about_seen = "1"` in localStorage); a reload before that shows it again. Storage blocked counts as met: never nag. Not on paths under `/lab` and `/vitre` (`QUIET_PREFIXES`), which are tools. |
| `/` `O` | the palette's slash command, from any page (`/` outside a field opens the slash list; `about` in `systems/command/actions.tsx` has `key: "o"`). It is the About's only shortcut. There is no bare `O`: a single letter taken over every page fires by accident, and the About is not needed that often. |
| ⌘K | `About` in search. Geolocation moved from `O` to `C`. |
| λhux | the home screen's mark, the long way in. Hover until it says its name (*The λHUX OS*), then click the name. On a phone, hold the mark until the name is whole and the About rises; a ring round the mark, drawn outside the finger, closes as the hold goes on (`HoldRing` in `components/ui/hold-ring.tsx`, shared with the search button's devtool hold; `components/home/scramble-identifier.tsx`). Both go to `/about`. |
| `/about` | the address to share: the home screen with the About already up (`app/about/about-route.tsx`). Putting it away swaps the address to `/` in place (`history.replaceState`: no navigation, no remount). |
| language | the other language's name with the Languages glyph (`AboutLanguageSwitch`, the article header's own `HeaderAction` in the meta row's mono). On a phone it sits at the words' top-right, level with the greeting, and scrolls away with them; on a desk it closes the foot's row at the words' bottom-right. A visitor met in the language their browser guessed can switch to the one they read without leaving. |
| leaving | Escape, `/` `O`, the button at the foot, a click well clear of the words, or anything in the copy opening something (a badge or a link hands over to what it opened). With a pointer, "well clear" means beyond 96px either side of the words or the foot and 64px above and below them (`MISS_MARGIN_X`, `MISS_MARGIN_Y`); a nearer click is treated as a miss. On a touch screen a blank tap never dismisses: it is usually a thumb resting, and the button is the way out. Opening the attachment drawer does not count. On a phone a badge opens the drawer *over* the About (`OVER_ABOUT_Z`, 10025) with the words still underneath, and Escape puts the drawer away first. The About steps aside only when the drawer sends the thing somewhere below it: the stage, a window, another page, the lightbox (`onSend` on the attachments' context). A tab leaves it in place. |

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-about/slash-list-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The slash command list open over /writing on a desk: Navigation lists Home H, Writing U, Works X, System Prompts P and About O, then Actions and Settings." />
  <img src="/img/docs/system-about/slash-o-desk.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The About after pressing O in that list, over the blurred /writing page: the same words, and the button now reads Close with esc, without the pulse." />
</div>

`/` on `/writing` opens the slash list, where About is `O` (left). Pressing
it brings the About over that page (right). The visitor has met it before,
so the button is a still **Close**, not a breathing Reveal.

### Three layers

1. **The veil**: the page, blurred (`backdrop-blur-2xl backdrop-saturate-150`)
   and washed in the glass material (`bg-glass/70`), so Tinted / Clear and
   the wallpaper tint apply. The page stays visible: you can still see where
   you are.
2. **The words**: one column, `33rem`, in the middle, kept brief. The
   greeting is serif (somebody talking), the rest sans. Each block rises in
   turn as a small blur clears (`.about-copy` in `globals.css`); none of this
   runs under reduced motion. The words scroll in their own container and
   fade at its foot when they overflow (`.about-scroll-fade`), so no length
   of copy or height of screen can push the way out off screen.
   **The foot**: always on screen. It is a glass button
   (`GLASS_TRACK_FLAT`, the theater's control glass, so it belongs to the
   veil instead of sitting on it as a slab). On a first visit it reads
   **Reveal** (the veil lifts off the page the newcomer landed on) and
   breathes: the glow's `pulse`, only its halo (`inside={false}`), blooms out
   from behind it. It is the one thing on the screen asking to be pressed.
   After the first put-away it is a plain **Close** and stays still. Where
   there is a keyboard (a fine hover pointer) it shows `esc` after the word.
   The foot is one press and nothing else: no line under the button. On a
   phone the button is centred at the screen's foot. On a desk it hangs
   from the words' left edge as their last line, because centred under a
   ragged paragraph it would line up with nothing.
   **Where**: on a desk (`sm` and up) the words and the foot are one group,
   centred on the screen (flexible space above and below). On a phone the
   words take every line the screen has and the foot sits at its bottom.
3. **The glow**: the Siri ring, above everything, taking no pointer.

Z-order: above the theater and windows (10000–10005), below the command
palette (10050), which can still be summoned over it. The layers are one
table in `systems/about/provider.tsx`: `ABOUT_Z` (10020) for the surface,
`ABOUT_GLOW_Z` (10021) for the ring, `OVER_ABOUT_Z` (10025) for what its
copy opens over it, `DEVTOOL_OVER_ABOUT_Z` (10030) for the devtool. A
surface that must come up over the About asks `useOverAboutZ()` (the
attachment surface and the identity card do; the devtool dock passes
`DEVTOOL_OVER_ABOUT_Z`).

**Inside the bezel.** With the vitre bezel drawn (iOS), the page's screen is
the box within its bands, rounded at its radius. The About is a surface on
that screen, not on the glass around it. Its z-order puts it above the
bezel's mask (9999), so it cannot rely on the mask to trim it. Both the
surface and the glow take `BEZEL_INSET` and the screen's radius, clip to it,
and wear `VITRE_LAYER_ATTRIBUTE` so container scroll makes them absolute. The
radius is `useWallpaper().screenRadius`: the bezel's radius, the same number
`<Vitre>` is given, so a devtool drag moves the bezel, the veil and the ring
together. (The About mounts outside `<Vitre>`, where `useVitre()` would read
the disabled default.) The ring's shader runs around that same rounded box.
Without a bezel the ring runs around the plain rectangle of the viewport.

**Room.** On a phone the words keep 36px from each side (or the safe area
plus 24px), 5rem above them (or the safe area plus 3.5rem), and the foot
keeps 36px below the button (or the safe area plus 20px): the ring owns the
outer few dozen pixels.

### The glow

The ring is the site's one light: `<EdgeGlow>` from `systems/glow`, the
same shader and renderer every other glow uses (the palette listening, a
window loading). How it is built, its knobs and its cost are in
[system-glow.md](./system-glow.md). Here it frames the words. Its `content`
is the article (as far as its scroll container shows it) and the way out
under it. Its `depth` is where the light ends, as a share of the narrower
gutter to them, the same off every edge. The depth comes from the devtool's
Glow module, one per layout (`aboutDesk` for a desk's centred group,
`aboutPhone` for a phone's whole screen; `systems/glow/lib/tuning.ts`):
140% on both by default. Strength, motion (`flow` by default) and baseline
are the About's own knobs there too. Its corners are `screenRadius`: the
bezel's inside a bezel, 0 without one (a browser window's page is a
rectangle; a phone's rounded glass is the hardware's to clip).

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
| `<MagicLink>` | a word that summons something: a post, a work, a role, a page (below) |
| `<Badge>` | the same link dressed as a pill wearing the thing's icon: a company, a project |
| `*…*` | italics, in the serif, for the word the copy is about, *interface* (in Chinese, which has no italic, 界面 is the serif upright). Latin serif is set 1.0625em, the article's optical adjustment for Newsreader's smaller x-height. It is the same rule as the article's (`.about-copy em` beside `.prose-article em`, globals.css) |
| `<Fn n="1" />` | a note's mark: a superscript number that scrolls the note into view inside the About (the address is left alone) |
| `<Footnotes>` / `<Footnote n="1">` | the notes, at the end, in the About's annotation type (the tiny mono line); a note's number scrolls back to its mark |
| `<Kbd>` | a key |
| a plain link | `ServerProseLink`: a magic link when it points at something the site knows (a post, at any address it has had; a section; a URL a commit attaches), otherwise a plain link. A path on this site puts the About away and navigates; a link out opens a tab and leaves it up |

Every keyword is a magic link: companies and projects as badges (each wears
its site's icon from `pnpm badges:snapshot`; `content/badges.json` names the
site for a commit or an identity), everything else as the word alone.

## Magic links

A magic link names a *summonable* and summons it the way the site summons
that thing everywhere else. The behaviour is the same whatever the link is
dressed as:

| it names | with a pointer (hover) | on a phone (tap) | a press, with a pointer |
|---|---|---|---|
| `post="dreamer"` | the /writing row's peek (`PostPeekView`) | the drawer: that peek, and Read | the post |
| `commit="lynx-framework"` (a commit, whole) | the /works row's peek (`buildCommitPreview`) | the attachment drawer, paging through all of its media | its row on /works |
| `commit=… item={n}` (one media) | the /works cover's peek (`mediaPeek`); a post on this site peeks as the post | a drawer of just it | its home: the stage, the in-app browser, the router, the lightbox |
| `role="meta-engineer"` (or `identity="meta"`, the identity as a whole) | the /works role row's peek: the identity's profile (`IdentityPeek`) | the identity card ([system-identity.md](./system-identity.md)) | its row on /works (`/works` for an identity) |
| `href="/works?type=talk"` | the section's card (its share image, a count) | the drawer: the card, Visit | the page |
| `href="https://…"` | the page's card (`pnpm og:snapshot` crawls these; `content/badges.json` `previews` for a page with no card to crawl) | the drawer | the in-app browser, or a tab |
| `app="…"` | none | a window, which on a phone is a sheet | a window (`openApp`) |

A post's peek is its body (excerpt, cover), which only the server can read,
so MDX maps rendered on the server (the About, posts, docs) use
`server.tsx`: it reads the post, or counts a section, and hands the client
link a `media` carrying it (`InternalLinkMeta.peek`).

![The About on a desk with the pointer on the Lynx badge: a peek card floats beside the words showing the lynxjs.org blog card, "Lynx: Unlock Native for More", over the veil.](/img/docs/system-about/badge-peek-desk.png)

With a pointer the Lynx badge peeks as its /works row does (here its one
attachment's card), above the About (`MagicLinkHost layer`). A press takes
it to its row on `/works` and puts the About away.

Any page change while the About is up puts it away (the provider watches
the path), so a drawer's Visit or a card's row leaves it behind too.

The peek follows the input (`magneticPreviewEnabled`), as every peek does;
the drawer follows the viewport (the attachments' policy). Inside the About
the peeks, the drawer and the identity card all come up over it
(`MagicLinkHost layer`, `useOverAboutZ`), and the About steps aside only
when something leaves for a home beneath it. It learns this from the
attachments (`onSend`), from a page change, or from a link that navigates or
opens an app (`MagicLinkHost onLaunch`); a tab takes nothing from it. Two verbs put it
away: `dismiss()` is the visitor's (the button, Escape, a click well clear
of the words) and is the only one that swaps `/about` for `/`; `close()` is
a hand-over and leaves the address to whatever is taking it, so the swap
never lands under the router's push. Both mark the visitor as met. Escape is
the About's only once nothing over it (a drawer, a card, the palette) has
marked it handled (`defaultPrevented`).

## Badges

`<Badge>` is a magic link for a thing I made, named inline in a sentence, wearing its icon, and
one press from where it lives on the site. It works anywhere MDX renders
(posts, docs, the About: `Badge: ServerBadge` in `components/mdx-components.tsx`
and `about-copy.tsx`) and as `<MagicLink badge>` from code.

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

A badge calls `open` through the attachment policy
(`systems/attachments/lib/policy.ts`), exactly as a `/works` cover does, so
a badge never disagrees with a cover about where a thing lives. On a phone
the attachment drawer comes first, with the thing, its title and its way in
within a thumb's reach. On a desk the thing opens in its native home
straight away:

| the thing | on a desk | on a phone |
|---|---|---|
| a page | the in-app browser (a window), or a tab if it refuses to be framed or is a PDF | the drawer |
| a recording, a deck | the stage (the theater) | the drawer |
| a post, an in-site path | the router | the drawer |
| an image | the lightbox | the drawer |
| a social post | the attachment surface | the drawer |
| a commit, whole | its row on /works | the drawer, paging through its media |
| a role | its row on /works | the identity card |
| an app | a window, on its runtime (web or Lynx), via `openApp` | a window, which is a sheet |

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
something wraps them in `<MagicLinkHost onLaunch={…}>`, as the About does. A
link that opens the drawer or the identity card does not call it: those float
over their host, which raises them (`AdaptiveSurface`'s `zIndex`) and hears
where the drawer sends things next (`useAttachments().onSend`).

### What it wears

Its official icon, always. CI fails a badge without one.

![Where a badge's icon comes from: Badge tags in content and docs, listed projects in content/log.json and content/badges.json feed lib/badge-site.ts, which both scripts/badge-icon-snapshot.ts and components/magic-link/resolve.ts ask for a site; the script writes content/badge-icons.json and public/badge-icons/, which resolve.ts reads to hand BadgeMark its icon.](/img/docs/system-about/badge-icons.svg)

One rule for "which site" (`lib/badge-site.ts`), asked twice: ahead of time
by the snapshot script, which fetches and commits the icons, and on the page
by `resolve.ts`, which looks them up. The snapshot can only hold what the
page will ask for.

| the badge | its icon |
|---|---|
| `app=` | the app's home-screen icon (`content/app-icons.json`, `pnpm apps:snapshot`) |
| `role=`, `identity=` | the icon of the identity's site, named under `identities` in `content/badges.json` |
| `commit=`, `href=` elsewhere | the icon its **site** declares for a home screen (manifest → apple-touch-icon → favicon), snapshotted into `public/badge-icons/` and `content/badge-icons.json` by `pnpm badges:snapshot` |
| `href=` a path on this site | this site's own icon (`/icons/icon.svg`) |
| `href=` an image | the image itself |
| `icon=` | that: a path, a URL, or an app id |

Which site stands for a badge: an `href`'s host, without `www.` and with
aliases folded (youtu.be is YouTube, twitter.com is X, b23.tv is bilibili);
a role's identity's site, from `identities`; a commit's first external
attachment, unless `content/badges.json` names its site under `commits`:
Ele.me's PWA is h5.ele.me, not the Medium post about it; Alitrip's mobile
web is Alibaba (alibabagroup.com); Hux Blog is huxpro.github.io.

Where a site's own icon is gone or has moved on, `content/badges.json` names
one under `icons`, vendored under `public/img/badges/` and never re-crawled:
Hermes (hermesengine.dev now redirects to GitHub, so its logo is the one the
Wayback Machine kept), Ele.me (h5.ele.me now wears the 淘宝闪购 rebrand;
the blue `e` is the archived icon the PWA shipped with) and Wepiao
(wepiao.com).

An icon drawn for a home screen (manifest, apple-touch-icon, or any square
≥160px) fills its tile. A favicon is a glyph and sits on a white plate, the
way a home screen shows one, so a black mark (Lynx's cat) still reads in the
dark. A badge nobody has snapshotted falls back to a monogram in its colour
(the commit's era, the identity's accent), or, for an `href`, the glyph of
what it is; that is what the check is for.

The pill is sized in `em`, so it sits in a sentence at any size. In prose it
carries `.not-prose` to escape the link style.

## Constraints

Each of these, broken, has a visible failure.

| Constraint | Why | What breaks |
|---|---|---|
| A new site behind a badge or a listed project: run `pnpm badges:snapshot` and commit `content/badge-icons.json` and `public/badge-icons/` | The page only reads the snapshot; `pnpm badges:check` (`.github/workflows/ci.yml`) fails on a site with no icon | CI red; without CI, a monogram where the logo should be |
| Removing the last badge or project on a site: run the snapshot again | `--check` also fails on a stale entry no badge uses | CI red |
| A syntax sample in `docs/` or `content/` writes its URL or id with `…` (`href="https://youtu.be/…"`) | `scripts/magic-link-tags.ts` reads raw text, code fences included, and skips only tags with a `…` in an attribute | The sample is crawled and checked like a real badge |
| A surface that must appear over the About takes its layer from `useOverAboutZ()` | The About sits at 10020, above windows and the theater | It opens under the veil, blurred and unpressable |
| A surface over the About calls `preventDefault()` on the Escape it handles | The About's Escape listener is on the window, bubble phase, and yields only to `defaultPrevented` | One Escape closes both |
| Something that takes the screen from the About calls `close()`, not `dismiss()` | `dismiss()` swaps `/about` for `/` with `replaceState` | The swap lands under the router's push and cancels the navigation |
| `AboutCopy` and `components/magic-link/server.tsx` are imported by path, never from an index | They read the file system; the indexes are imported by client code | The client bundle pulls in `node:fs` and the build fails |
| No bare `O` (or any single letter) to open the About | A letter taken over every page fires by accident | Visitors summoning it while typing elsewhere |

## What is free to choose

- **The copy.** Anything in `content/about/*.mdx`, as long as it stays
  brief: the column scrolls, but the About is an introduction, not a page.
  The two languages need not match word for word.
- **Badge or word.** A company or a project is a badge; anything else is a
  `<MagicLink>`, the word alone. Both behave the same.
- **The glow's tuning.** Depth, strength, motion and baseline are the
  devtool's Glow module; the defaults live in `systems/glow/lib/tuning.ts`.
- **Which site stands for a commit.** Its first external link, or whatever
  `commits` in `content/badges.json` names.

## Recipes

A badge to a new site:

1. Write it: `<Badge href="https://…">Name</Badge>` with the real URL, or a
   `commit=` whose first external link is that site.
2. `pnpm badges:snapshot`. If the crawl finds no icon, name one under
   `icons` in `content/badges.json` (a URL, or a file vendored under
   `public/img/badges/`) and run it again.
3. Look at the badge on a light and a dark page: a favicon gets a white
   plate, a home-screen icon fills.
4. Commit the MDX, `content/badge-icons.json` and `public/badge-icons/`.
   `pnpm badges:check` passes.

The specimens, one of each kind, are in `docs/component-test.en.mdx`
(`/docs/component-test`).

A new surface that a link in the copy opens: read `useOverAboutZ()` for its
`zIndex`, mark its Escape handled, and if it sends the visitor somewhere
below the About, put the About away with `close()` (or let the attachments'
`onSend` do it).

Seeing the first visit again: remove `hux_about_seen` from localStorage and
reload a page outside `/lab` and `/vitre`.
