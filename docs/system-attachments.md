# Attachments System

One door for everything a commit attaches.

```
systems/attachments/
├── provider.tsx                      # AttachmentProvider, useAttachments() — open / act / session
├── lib/
│   ├── types.ts                      # AttachmentSet, AttachmentHome
│   ├── policy.ts                     # homeFor / nativeHomeFor — where a piece of media opens
│   └── set.ts                        # attachmentSetFor(commit, locale)
└── components/
    ├── attachment-surface.tsx        # the paged sheet / panel / window (AdaptiveSurface)
    ├── attachment-page.tsx           # one attachment, large, with its native action
    └── image-lightbox.tsx            # an image, letterboxed, zoomable (the `lightbox` home)
```

## The problem

A commit on `/works` carries media — link cards, videos, slide decks, images,
social widgets — and each kind used to open its own way. A video went to the
theater. A deck went to a lightbox of its own (`SlideModal`), which on a phone
gave up and opened a tab. A card was a plain `<a target="_blank">`. A cover
in the contact strip was a link; the same cover in the expanded body was a
player. And the whole thing was pointer-shaped: on a phone, tapping a
thumbnail either left the site or dropped a Picture-in-Picture the size of a
thumb onto the page.

The site already has places for these things. It has a **theater** with a
persistent stage, a **window manager** that opens apps in draggable windows,
and a **router** for its own pages. It just had no rule for sending an
attachment to the right one, and no shape for a phone, where none of those
places is usable.

## The policy

`lib/policy.ts` is the rule, and it is two functions:

| | phone (`< sm`): a tap | phone: the sheet's button | tablet / desktop |
|---|---|---|---|
| video | attachment sheet | theater (a PiP there) | theater |
| slides | attachment sheet | theater (a PiP there, like a recording) | theater (a `slides` track — see below) |
| link card, external | attachment sheet | **the in-app browser, as a sheet stacked on this one**; a tab if the page refuses to be framed | in-app browser window, or a tab if the page refuses to be framed |
| link card, `/writing/…` | attachment sheet | the router | the router |
| image | attachment sheet | the lightbox | the lightbox |
| social widget | attachment sheet | a tab | attachment surface, in its desktop shape |

`homeFor(media, ctx)` says where a click lands. `nativeHomeFor(media, ctx)` is
the same question with the surface taken out of the picture — what the item
does natively, which is what a page's primary button in the sheet performs.
On a phone the sheet opens for everything and its `Watch` / `Slides` / `Read`
/ `Visit` button is the native action: a video and a deck go to the stage,
which is a PiP there, and a page opens in the in-app browser. The stage is
the stage whatever shape it takes; a deck is no different from a recording in
this, and nothing sends it to a tab any more.

The in-app browser is the same on every viewport: `useWindows().openUrl`. A
window on a phone is a sheet ([Window System](./system-windows.md), "A phone
window is a sheet"), so on a phone `Visit` stacks the browser over the
attachment sheet — the attachment sheet steps back, the page rises over it,
and a drag down on the page lands back on the commit's attachments, the way a
link in a mobile app opens in its own in-app browser and returns to the
screen it came from. The provider keeps the attachment sheet open for this
(`send`, the `window` case); on a desktop the window is its own thing and the
surface closes. The only `Visit` that leaves the site is a page that refuses
to be framed, and the button says so before it is pressed: its glyph is the
arrow out there, a globe for the in-app browser, a play mark for a
recording, the deck glyph for a deck, a book for a post. The page's cover
wears no chip (see below) — the button is the whole of it.

Whether a page refuses framing is read at snapshot time: `pnpm og:snapshot`
now records `X-Frame-Options` / `frame-ancestors` as `frame: "deny"` on the
entry (see [og-previews.md](./og-previews.md)), and enrichment carries it to
`preview.frame`. A refusal is only stored when explicit — a bot wall that
says nothing about framing is not read as permission. Pages the crawl cannot
reach at all can be told by hand (`preview: { frame: "deny" }`, as The Verge is).

A **PDF** (a link whose path ends `.pdf`, `isPdfLink`) leaves for a tab the
same way, whatever its headers say: the in-app browser is a sandboxed iframe,
and neither engine reads a PDF there — WebKit paints the first page as a
still image that will not scroll, Chrome will not run its viewer in a
sandboxed frame. The system's own viewer, in a tab, is its only good home.

A card that will leave for a tab says so **before** the click, not after:
its cover wears the `New tab` chip — on the expanded card, on the strip
cover and in the hover peek (the one chip vocabulary, below) — the cover's
tooltip carries it, the sheet's button wears the arrow out, and when the tab does open on a
desktop, a one-line system toast names the site that would not be framed
(`components/ui/system-toast.tsx`). Gitee, Medium, web.dev, The Verge and
Meta are the ones in the log today; the rest open in a window — on every
viewport.

### The lightbox

An image is usually attached to be read — a poster, a figure — and a sheet's
width is a thumbnail for it. Its home is the lightbox
(`components/image-lightbox.tsx`, mounted once in the root layout beside the
surface): Base UI's Dialog for the modal (focus, Escape, scroll lock) under
the theater's veil, the image fitted to the viewport with a margin all round,
and `react-zoom-pan-pinch` for wheel / trackpad / pinch zoom, double-click to
toggle, drag to pan, and `+` / `-` / `0`. Scale 1 is "fit"; the ceiling is
twice the file's own pixels, so author the full-resolution file as `url` and a
light cover as `thumbnail` (the tiles, the inline figure and the sheet paint
the cover). On a phone the sheet's `View` button opens it, and the sheet
steps aside rather than holding focus against a second modal.

## The set

Every affordance on a row opens the same thing: the commit's attachments as
one set, built once per row by `attachmentSetFor(commit, locale)` and handed
down as `attachmentSet`:

```ts
interface AttachmentSet {
  id: string;          // the commit id
  title: string;       // localized commit title
  subtitle?: string;   // conference / publication / platform / company
  hash?: string;       // its 7-char address
  href?: string;       // /works#<hash>
  items: readonly Media[];  // rich media in authored order — never pills
}
```

Set and tiles are the same collection: every non-pill attachment resolves
a cover, so nothing is dropped from the strip on its way to the grid and
the sheet's `2 / 3` cannot count a page the row never showed. That is a
build-time invariant, not a hope — `pnpm og:complete` fails when an
attachment cannot resolve a runtime image, and CI runs it
(`.github/workflows/ci.yml`). A deck has no OG tags of its own, so its
cover is authored (`thumbnail`); a card's comes from the snapshot.

One thing the crawl must not do is take a cover back. A site that
redesigns and stops advertising `og:image` still answers 200 with a
title, which `entryUsable` reads as success — so the entry would be
rewritten without its image, the tile would vanish, and `og:complete`
would fail over a picture that is still live. A recorded image is
therefore kept until a crawl offers another one, and the run says so
("kept the cover we already had").

A cover in the contact strip (`MediaStrip`), a player or card in the expanded
body (`MediaRenderer`), and an icon in the folded rail (`TimelineCommit`)
each find their own item by reference (`set.items.indexOf(media)`) and call
`open(set, index)`. Plain pills — a website, a repo — stay plain links; they
are not in the set. Modified clicks (⌘, middle) are never taken: every
affordance keeps a real `href` for them.

Outside the provider — an MDX `<Media />`, the editor's inspect mode, which
passes no set — everything behaves as it did: players play inline, cards are
links, a deck opens the theater if one is mounted.

## The surface

`AttachmentSurface` is mounted once in the root layout. Its shape is the
viewport's (`ADAPTIVE_PRESENTATION`): a bottom sheet on a phone, which is the
case it exists for; a panel on a tablet and a window on a desktop for the
kinds with no native home there.

Inside is the widgets' strip — `useSnapPager` and `PagerDots` from
`components/ui/snap-pager.tsx`, the same primitive the Featured Talks and
featured-stack widgets page with. One page per attachment, full width,
snapping page by page, dots and a `2 / 3` counter underneath. A talk with a
video, a deck and a write-up reads as one thing with three faces, and a swipe
moves between them without going back to the row. The surface lands on the
page that was tapped before its first paint.

Each page (`attachment-page.tsx`) is the attachment large — a 16:9 cover
with the theater's glass play mark, the whole link card, the image, the live
social widget — over the commit's title and venue, and an action cluster in
the theater's chrome (`GLASS_CLUSTER`, `GLASS_ACTION`, the primary on the
glass pill): the native action, and the way out to the source as a real link.

The surface sizes to its content (`fitContent`); the track is a flex row, so
every page is as tall as the tallest and the sheet holds still while swiping.
Pages off screen are `inert`.

## The chip a cover wears

Every cover on the site says what it is before it is pressed, and it used to
say so in three vocabularies at once — a play disc stamped on anything that
played, a caption chip over the disc on a deck, a line of prose under a card
that would leave for a tab — each drawn in place by whichever component was
holding the cover. `MediaMark` (`components/log/media/media-mark.tsx`) is the
one vocabulary and the only thing that draws it: **a chip at the cover's
bottom-left corner, with a glyph and a word** — the same chip a wallpaper
tile wears for Live / Preset (`ARTWORK_CHIP`, `lib/glass.ts`), so a chip on
a picture arrives the same way wherever the picture is.

| the cover | the chip |
|---|---|
| a recording (a video) | `▶ YouTube` / `bilibili` / `Vimeo` — the platform, so a talk says where it was recorded |
| a recording that lives on a page (a GitNation talk) | `▶ GitNation` — the same chip, the host's name |
| a deck | `Slides` |
| a page that refuses to be framed, whatever its kind | `↗ New tab` |
| a page, a post, an image, a social widget — in the hover peek only | `Web`, `Writing`, `Image`, the platform |

Who wears one is the surface's call, in three tiers:

| where | who wears a chip |
|---|---|
| `/works` (the strip, the expanded card, the inline players, the deck cover) | a recording, a deck, and a page that will leave — a card is its own hint (domain, title), and a chip on every card would be noise |
| the hover peek | **every kind** (`markFor`'s `all`) — a peek is a glance, and the chip is its caption |
| the attachment sheet's page, the home widgets' covers, the theater's rail | **none** — each already says what the thing is beside the cover (a labelled button whose glyph is the arrow out when it leaves, the widget's line, the rail's title), and a chip would repeat it |

The chip says what the thing *is*, never where it opens — which is how a
GitNation recording wears a play chip and opens in the in-app browser
rather than on the stage: it is a recording, and the policy above decides
the rest. `markFor(media, locale, { all, leaves })` reads the chip off an
item; `mediaKindOf` still reads the kind, for the sheet's button glyph and
the lab.

Two weights. On a cover in the page the chip is light (`ARTWORK_CHIP_REST`):
a row of covers should not be a row of stamps. The cover's hover raises it
to the full chip — the chip reads the hover off the anchor or button it
sits in, so no cover has to be a `group` — and a cover in a peek, which is
the after-hover state, is raised from the start (`raised`).

Three sizes: `mini` for the contact strip's tiles, where the chip keeps
its glyph and drops its word (the wallpaper tile's small badge); `compact`
for the grid's tiles, rail thumbs and dense cards; `default` for a full
cover. The tiles, the link card, the inline video facades, the deck cover
and the hover peek's poster all take the chip from here, and nothing else
on a cover says what it is —
the peek's poster has no caption but a deck's or an image's name; a card
with no cover to wear it on carries the chip in its caption line. The
chip says what the thing is; the policy above says where it opens, and the
two never trade jobs.

## The three forms of /works

How much of a commit the page prints is one of three *forms*, and a form
is a preset of a few independent atoms rather than a layout of its own
(`ROW_FORM`, `lib/log-view.ts`): what of the description prints (`none` ·
`clamp` · `full`), which attachment object (`none` · `covers` · `grid`),
whether the notes print (commentary, the author fields, the link labels),
and whether anything peeks on hover. The toolbar's control resets every
row to a preset; a row the reader opens by hand takes the `feed` preset
for itself. Old links with git's names (`oneline`, `stat`, `patch`) still
parse, as aliases.

| form | description | media | notes | peek | the reading |
|---|---|---|---|---|---|
| `index` | none | none | — | ✓ | the overview: one line per commit, the career in two screens |
| `covers` (default) | two lines | `covers` — 112px tiles, glyph chip | — | ✓ | the work on screen, still one row per commit |
| `feed` | all of it | `grid` — half-column tiles, captions written | ✓ | — | everything, with nothing behind a hover or a sheet. Rows do not fold; leave via the toolbar. |

### The attachment object

Every cover is one tile (`AttachmentTile`,
`components/log/media/attachment-tile.tsx`): a 2:1 crop of the artwork,
and its chip. 2:1 is the aspect the covers come in — an OG image is 1.91:1,
a video poster loses a sliver top and bottom that the peek and the surface
show whole — and one aspect for every kind is what lets a video sit beside
a card, and a row of tiles line up with the next row's. The form decides the
size and the caption, never the shape.

**The strip** (`MediaStrip`, `covers`) is the tiles in a row with no
caption — the chip is enough at that size, and the peek shows the rest.
When the covers are wider than the column the strip runs on under the
page's bleed (`--page-bleed`, globals.css: from the column's edge to the
viewport's), so a cover is only ever cut by the screen: on a phone the
strip reaches the gutter's edge and scrolls; on a desk it runs into the
margin, where three covers simply fit. A row cut mid-page reads as a
mistake, the same row running under the edge reads as a rail there is
more of. The handle signs the strip's line only when a single cover
leaves it the room on any viewport; otherwise it stays on the meta line.

**The grid** (`AttachmentGrid`, `feed`) takes the row's own strip items —
the timeline hands it `stripItems` directly, and what has no cover (a live
widget) goes to `MediaRenderer` under it. It is where the captions are
written out — where it is from, what it is, its blurb — and where nothing needs a
second step: the chip is down to the glyph on a recording or a deck (a
play mark is an affordance, not information) and gone from a card, and a
click is the item's native action (`act`: the stage, the in-app browser,
the page), never the attachment sheet, which would be a drawer opening on
what is already on screen.

Cover and caption are one control (`AttachmentTile`'s `footer`): the same
`<a>`, so a press on the title washes the artwork and dims the copy
(`COPY_WASH` — opacity, the cover-press language). The caption is not a
second click target that happens to do the same thing, and it is not the
row's fold handle. Folding is a muted fill on the title line; opening an
attachment is a dim. Mixing the two would make the presses feel the same. A hand-opened row in
`covers` / `index` still folds from its title line; the expanded body
(`data-row-body`) stops that click and wears a default cursor, so
description, notes and captions do not look like fold targets. The feed
itself does not fold per row — every commit is already open, and leaving
is a form change on the toolbar. On a phone, a recording or a deck is
the exception: the cover plays in place and the bar under it (`PiP`)
hands playback to the stage, so that line is a label, not a second door.

- On a desk, the unit is half the column whatever the count — the rule the
  feeds this borrows from (X, LinkedIn) agree on: media has a footprint,
  and the count changes how it is tiled, never how big the post is. A pair
  is two captioned tiles; a lone card is the tile with its caption beside
  it (the unfurl a chat app prints for a link); a lone recording or deck,
  which has nothing to say beside itself, takes the column as a video post
  does.
- On a phone, the feed is a feed: one thing under the next, each running
  edge to edge over the page gutter and the rail column (`PHONE_BLEED` wraps
  the crop, not the caption — negative margins on the `w-full` picture
  would only shift a column-width cover). Cover and caption are still one
  control; a tap on the title under a card is the same door as the artwork.
  A recording or a deck plays in place (`InlinePlayable`: a 16:9 cover
  swapped for the platform's player or the deck itself), and the bar under
  it — there from the start, so pressing play moves nothing — names the
  item and carries one control, `PiP`, which hands playback to the stage
  (`act`) for whoever wants to keep scrolling and stops the inline player
  so the two never play at once. While the item is on the stage its place in the feed says so (a
  wash and the PiP mark over the cover, read off `useOptionalTheaterStage`
  — the stage's occupant and its doors, without the ticking clock that the
  full theater context carries), and pressing it brings playback back. A
  card goes to its native home.

Before this, one card was full width and natural aspect, a video was full
width and 16:9, two of anything was a scroll rail at half width with the
publisher's caption deciding each tile's height — so every open row was a
different shape and no two right edges met.

Every tile is drawn from a `TileSlot` (`resolveTile`): its place in the
set, where its click lands, its chip and its caption, resolved once per
item by the strip or the grid rather than once per tile per render.

### The gutter

From `lg` up the hash and the rail hang in the page's left margin
(`GUTTER_PULL` in `TimelineCommit`): the row is pulled left by the gutter's
fixed width, so the title, the description and the attachment object sit on
the page column's own left edge, in line with the era markers and with
every other page's prose. Below `lg` there is no margin to hang it in and
the gutter stays inside the column; below the row's `@sm` the hash hides,
as it always did.

## What the page costs to scroll

The wallpaper is a canvas animating under the whole page, so every frame
already carries a composite; what the log puts on top decides whether the
frame is spent by then. Three rules keep the feed scrolling on a phone:

- **No `backdrop-filter` on a cover's chip.** Every cover wore a 2px blur
  under its chip — twenty-odd backdrop roots scrolling over full-bleed
  bitmaps. A translucent fill reads the same and costs a fill.
- **No `content-visibility` on a row body.** It was tried, with a 24rem
  intrinsic size, and it cost more than it saved — it is the one rule here
  that was never measured in time, only in what it skipped. Rows are
  380–530px on a 402px phone, so the page kept resizing as they came into
  range (32 changes over one pass, 17.0k → 20.1k), and each row entering
  range is a layout: **248ms of layout over a scroll versus 36ms without
  it, 147 layouts versus 67** (Chromium, 4x CPU throttle, scripted pass of
  the phone feed). It buys about 200ms of the first load at that throttle,
  and on iOS the resizing is worse than slow: the scroll view's idea of the
  page lags behind it, so a finger moving up can hit a bottom that is no
  longer there. The work it would skip is already lazy by other means —
  `loading="lazy"` on the covers, `decoding="async"`, and no peek tree
  where no pointer can hover.
- **A peek panel exists only while it peeks.** `Cursor` used to keep a
  fixed, transformed panel mounted for every row — fifty compositing
  layers on a desk before anyone hovered. Idle, it is a hidden span.

And the rest, each small: covers decode off the main thread
(`decoding="async"`); the sticky era pill's frosted blur is `sm:` and up;
nothing that only sends something to the stage subscribes to the ticking
theater context (`useOptionalTheaterStage`); no peek tree is built where
no pointer can hover (the row's, the strip's, the handle's); one handle
per row rather than a second, invisible one; a connector observes its
container alone. The trace in the PR shows where the rest goes — the
wallpaper's canvas, which every page pays alike.

## The lab

**`/editor/attachments`** — hidden, `noindex` — is the devtool for this system, the
way `/editor/legibility` is for reading surfaces. The lab prints every render
path (`app/editor/attachments/paths.ts`) next to live specimens: the chips at
every size on the log's own covers, in the `/works` tier and the peek's, the
GitNation case among them; the policy as a table, read live from `homeFor` /
`nativeHomeFor` for a context you can pin (phone or not, a window manager);
and the production surfaces themselves — the strip, the desk grid, the phone
feed (`InlinePlayable`), `MediaRenderer` (single and rail), pills, peeks,
inline players, the MDX `<Media />`, the home featured stack, `MediaThumbnail`,
the theater rail thumb, and the attachment page — plus buttons that go through
the real providers, with a readout of the surface stack and the open windows
as they stand. `/editor/attachment` redirects here. On a phone it is where to
watch `Visit` stack the browser over the attachment sheet. The top-left title
is the editor-family dropdown (`app/editor/catalog.ts`).

## Hovering a cover

The row's magnetic peek — the cursor-following panel that shows what a folded
row is holding — stands down in the forms that print a strip, because the
row now prints its covers, and in the feed altogether (`ROW_FORM.peek`). Each cover peeks instead, in the same vocabulary
(`components/log/media/media-peek.tsx`): rest the pointer on a thumbnail in
the contact strip and a link card peeks as the mini OG card (domain, title,
description), a video or a deck or an image as its poster — each wearing
its chip, raised, and nothing else: no caption, no note. `PeekThumb` and
`PeekCard` moved there from `commit-embed.tsx`; the row's stacked deck in
the `index` form is built from the same two and wears the same chips
(`PeekItem` carries its `media` for that), so the two forms peek alike.

## Slides in the theater

A deck is the other thing a talk leaves behind, and it belongs on the same
stage as the recording. `Track` is `VideoTrack | SlidesTrack`
(`systems/theater/lib/types.ts`): a `slides` track frames the deck URL in the
stage's iframe, keeps the theater's title bar, prev / next and playlist rail,
and has no transport (reveal.js takes the arrow keys inside the frame). It
minimizes to the Live Activity like anything else on the stage — the pill is
a place to keep a deck open, not only a place to listen, and it knows the
difference: for a deck the third view is `Minimize`, icon and word, in the
theater bar, the PiP bar and the pill alike (`SurfaceSwitch` reads the
track off the theater itself),
never `Audio`, and the pill reads `slides` under the deck glyph rather than
`watching` behind an equalizer.

The stage keeps **two libraries** and never shows them together. A recording
is browsed among recordings: the talk albums (React / Lynx / Personal) the
`TheaterRegistrar` registers, with an ad-hoc album for a video none of them
holds. A deck is browsed among decks: `buildSlidesAlbum(locale)` is every deck
in the log, in date order, registered as the Slides library, and opening any
deck lands in it at that deck with every other deck a card away.
`useTheater().openMedia(media, meta)` picks the library from the media's
kind; the attachment system and the standalone `<Slides />` cover both go
through it. `SlideModal` and `SlidesPlayerProvider` are gone.

## The in-app browser

`useWindows().openUrl(url, { title })` opens a page in an app window
(`systems/windows`): the same edge-to-edge frame, chrome pill and menu an app
gets, keyed by URL so the same page focuses its window rather than opening a
second. `Open in browser` in the window menu is the way out. See
[system-windows.md](./system-windows.md).

## Adding a kind

1. Say where it opens in `lib/policy.ts` — both functions.
2. Say what its cover wears in `media-mark.tsx` — `mediaKindOf` and `markFor`.
3. Give it a page in `attachment-page.tsx`.
4. If it can play on the stage, give it a `Track` kind and teach `mediaToTrack`
   (`systems/theater/lib/albums.ts`) to build one.
5. Check it in `/editor/attachments`: the table, the specimens, the buttons.
