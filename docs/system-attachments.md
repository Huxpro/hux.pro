# Attachments System

> The checklist form of this page is the skill `.claude/skills/attachments`.

One door for everything a commit attaches. A commit on `/works` carries
media (link cards, videos, slide decks, images, social widgets), and every
cover, card and player on its row calls the same `open(set, index)`. One
policy (`systems/attachments/lib/policy.ts`) decides where the item goes:
on a phone, a sheet that pages through the commit's attachments; on a
wider screen, straight to the place the site already has for that kind of
thing (the theater's stage, an in-app browser window, the router).

## What it looks like done well

On a phone, a tap on any cover brings up the attachment sheet at that item.
Its button sends the item on. A page opens in the in-app browser, which is
a sheet there, stacked on the attachment sheet: a drag down on the page
lands back on the commit's attachments, the way a link in a mobile app
opens in its own browser and returns to the screen it came from.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-attachments/phone-sheet.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The attachment sheet on a phone over the React Compiler row: the react.dev card large, its title and description, a react.dev button with an arrow, and 1 / 2 under it." />
  <img src="/img/docs/system-attachments/phone-browser.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same phone after the react.dev button: the react.dev page in the in-app browser, a taller sheet stacked over the attachment sheet." />
</div>

Left: a real tap (`hasTouch`) on the react.dev cover of the React Compiler
row opens the sheet at that card, `1 / 2` because the commit attaches two.
Right: its button stacks the in-app browser over it. Both sheets are open
(two dialogs); the attachment sheet is under the taller one.

On a desk the same click skips the sheet. A link card opens straight in an
in-app browser window over the page; a video or a deck goes to the
theater; an image to the lightbox.

![A desktop /works page with the react.dev page open in an in-app browser window centred over it.](/img/docs/system-attachments/desk-window.png)

The react.dev cover clicked at 1280px: no sheet, the page in a window. (The
theater is not shown: headless Chromium cannot play the embeds.)

Before it is pressed, a cover says what it is with one chip, and a page
that will leave for a tab says so (the chip, below).

## How it works

### The policy

![Flow: open(set, index) calls homeFor(media, ctx), which asks ctx.compact. On a phone the answer is the surface, a sheet whose page's button calls act and nativeHomeFor; elsewhere homeFor sends each kind to its home directly. A table lists, per kind, the home from the sheet's button and from a desktop click: video and slides to theater, image to lightbox, a link to this site to route, a link that cannot be framed to tab, any other link to window, a social widget to tab on a phone and the surface on a desk.](/img/docs/system-attachments/routing.svg#bleed)

The policy is two functions, and the diagram is both of them. `homeFor(media,
ctx)` says where a click lands. `nativeHomeFor(media, ctx)` is the same
question with the surface taken out of the picture: what the item does
natively, which is what the sheet's primary button performs (the provider's
`act`). `ctx` is two facts: `compact` (below `sm`, 640px) and `windows` (a
window manager is mounted). Each home is an `AttachmentHome`
(`lib/types.ts`); `send` in `provider.tsx` is one case per home.

| | phone (`< sm`): a tap | phone: the sheet's button | `sm` and up |
|---|---|---|---|
| video | attachment sheet | theater (a PiP there) | theater |
| slides | attachment sheet | theater (a PiP there, like a recording) | theater (a `slides` track; see below) |
| link card, external | attachment sheet | **the in-app browser, as a sheet stacked on this one**; a tab if the page refuses to be framed | in-app browser window, or a tab if the page refuses to be framed |
| link card, this site (`/writing/…`) | attachment sheet | the router | the router |
| image | attachment sheet | the lightbox | the lightbox |
| social widget | attachment sheet | a tab | attachment surface: a panel from `sm`, a window from `lg` |

On a phone the sheet opens for everything, and its button is the native
action: a video and a deck go to the stage, which is a PiP there, and a page
opens in the in-app browser. The stage is the stage whatever shape it
takes; a deck is no different from a recording in this, and nothing sends
it to a tab.

### The in-app browser

The in-app browser is the same on every viewport: `useWindows().openUrl(url,
{ title })` opens the page in an app window (`systems/windows`): the same
edge-to-edge frame, chrome pill and menu an app gets, keyed by URL so the
same page focuses its window rather than opening a second. `Open in browser`
in the window menu is the way out. See [system-windows.md](./system-windows.md).

A window on a phone is a sheet ([Window System](./system-windows.md), "A
phone window is a sheet"), so there the button stacks the browser over the
attachment sheet: the attachment sheet steps back, the page rises over it.
The provider keeps the attachment sheet open for this (`send`, the `window`
case, `if (!compact) setIsOpen(false)`); on a desk the window is its own
thing and the surface closes.

### Pages that leave for a tab

The only press on a page that leaves the site is one the in-app browser
cannot show (`leavesSite`, `unframeable` in `policy.ts`):

- **A page that refuses to be framed** (`preview.frame === "deny"`). The
  snapshot reads `X-Frame-Options` / `frame-ancestors`; how, and how to
  mark a page by hand, is [og-previews.md](./og-previews.md), "Framing
  policy".
- **A PDF** (a link whose path ends `.pdf`, `isPdfLink`), whatever its
  headers say: the in-app browser is a sandboxed iframe, and neither engine
  reads a PDF there. WebKit paints the first page as a still image that will
  not scroll, and Chrome will not run its viewer in a sandboxed frame. The
  system's own viewer, in a tab, is its only good home.

On a desk such a card says so **before** the click: its cover wears the
`New tab` chip on the strip, on the expanded card and in the hover peek, and
its tooltip adds "Opens in a new tab". When the tab opens, a Dock notice
(`showNotice`, `systems/dock/notice.ts`, 4s) names the host that would not
be framed. On a phone there is no notice under a tab that has just covered
the screen. Today the attachments that leave are on GitHub, Gitee, Meta,
web.dev, WeAreDevelopers and Behance, plus one PDF; every other page opens
in a window on every viewport.

### The lightbox

An image is usually attached to be read (a poster, a figure), and a sheet's
width makes it a thumbnail. Its home is the lightbox
(`components/image-lightbox.tsx`, mounted once in the root layout beside the
surface): Base UI's Dialog for the modal (focus, Escape, scroll lock) under
the theater's veil, the image fitted to the viewport with a margin all round,
and `react-zoom-pan-pinch` for wheel / trackpad / pinch zoom, double-click to
toggle, drag to pan, and `+` / `-` / `0`. Scale 1 is "fit"; the ceiling is
twice the file's own pixels, so author the full-resolution file as `url` and a
light cover as `thumbnail` (the tiles, the inline figure and the sheet paint
the cover). On a phone the sheet's `View` button opens it, and the sheet
steps aside rather than holding focus against a second modal.

### The set

Every affordance on a row opens the same thing: the commit's attachments as
one set, built once per row by `attachmentSetFor(commit, locale)` and handed
down as `attachmentSet`:

```ts
interface AttachmentSet {
  id: string;          // the commit id, the surface's session key
  title: string;       // localized commit title
  subtitle?: string;   // conference / publication / platform / company / team
  href?: string;       // /works#<hash>
  items: readonly Media[];  // every media item, in authored order
}
```

Set and tiles are the same collection: every attachment resolves a cover
(links included; the log presents a link only as a card), so nothing is
dropped from the strip on its way to the grid and the sheet's `2 / 3` cannot
count a page the row never showed. That is a build-time invariant:
`pnpm og:complete` fails when an attachment cannot resolve a runtime image,
and CI runs it (`.github/workflows/ci.yml`). A deck has no OG tags of its
own, so its cover is authored (`thumbnail`); a card's comes from the
snapshot. The snapshot keeps a recorded image until a crawl offers another
("kept the cover we already had", `scripts/og-snapshot.ts`), so a site that
stops advertising `og:image` cannot fail `og:complete` over a picture that
is still live.

A cover in the contact strip (`MediaStrip`) and a player or card in the
expanded body (`MediaRenderer`) each find their own item by reference
(`set.items.indexOf(media)`) and call `open(set, index)`. The title line has
no door of its own: where covers print, they are the way in; in the index,
which prints none, the line only counts them (`📎 3`) and opening the row
brings the strip (`rowFormFor`). Modified clicks (⌘, middle) are never taken:
every affordance keeps a real `href` for them.

Outside the provider (an MDX `<Media />`, or the editor's inspect mode, which
passes no set), everything behaves as it did: players play inline, cards are
links, a deck opens the theater if one is mounted.

### The surface

`AttachmentSurface` (`id="surface-attachments"`) is mounted once in the root
layout. Its shape is the viewport's (`ADAPTIVE_PRESENTATION`): a bottom sheet
on a phone, which is the case it exists for; from `sm` a panel, and from
`lg` a window, `min(92vw, 560px)` wide, for the one kind with no native home
there (a social widget). The window is not draggable by default:
`surface-attachments` is listed in `DRAGGABLE_INSTANCES`, so the DevTool can
turn dragging on, but it has no entry in `DRAGGABLE_DEFAULTS`
(`systems/devtool/provider.tsx`), where the wallpaper and playlist windows
have one.

Inside is the widgets' strip: `useSnapPager` and `PagerDots` from
`components/ui/snap-pager.tsx`, the same primitive the Featured Talks and
featured-stack widgets page with. One page per attachment, full width,
snapping page by page, dots and a `2 / 3` counter underneath. A talk with a
video, a deck and a write-up reads as one thing with three faces, and a swipe
moves between them without going back to the row. The surface lands on the
page that was tapped before its first paint.

Each page (`attachment-page.tsx`) shows the attachment large: a 16:9 cover
for a video or a deck, the whole link card, the image, or the live social
widget. Under it sits an action cluster in the theater's chrome
(`GLASS_CLUSTER`, `GLASS_ACTION`, the primary on the glass pill,
`systems/theater/lib/chrome.ts`):

| the page | the primary | beside it |
|---|---|---|
| video, deck | `Watch` / `Slides`, play mark or deck glyph, on the pill | the source's domain ↗ |
| image | `View` (zoom glyph) | the file's domain, or `Open original` for a file this site serves |
| link to this site | `Read` (book) for a post, `Visit` for another section, on the pill | none |
| link elsewhere, social widget | the domain ↗, a real link, the row's only one | none |

A page elsewhere is dressed as a way out whether it opens in the in-app
browser or a tab: its address and the arrow. The page's cover wears no chip
(below). The video and deck pages also print the commit's title and venue.

The surface sizes to its content (`fitContent`); the track is a flex row, so
every page is as tall as the tallest and the sheet holds still while swiping.
Pages off screen are `inert`, counted from the page the track settled on.

### Slides in the theater

A deck is the other thing a talk leaves behind, and it belongs on the same
stage as the recording. `Track` is `VideoTrack | SlidesTrack`
(`systems/theater/lib/types.ts`): a `slides` track frames the deck URL in the
stage's iframe, keeps the theater's title bar, prev / next and playlist rail,
and has no transport (reveal.js takes the arrow keys inside the frame). It
minimizes to the Live Activity like anything else on the stage. The pill is
a place to keep a deck open as well as a place to listen, and it knows the
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
through it.

## The chip a cover wears

Every cover on the site says what it is before it is pressed. `MediaMark`
(`components/log/media/media-mark.tsx`) is the one vocabulary and the only
thing that draws it: **a chip at the cover's bottom-left corner, with a glyph
and a word**. It is the same chip a wallpaper tile wears for Live / Preset
(`ARTWORK_CHIP`, `lib/glass.ts`), so a chip on a picture looks the same
wherever the picture is.

| the cover | the chip |
|---|---|
| a recording (a video) | `▶ YouTube` / `bilibili` / `Vimeo`: the platform, so a talk says where it was recorded |
| a recording that lives on a page (a GitNation talk) | `▶ GitNation`: the same chip, with the host's name |
| a deck | `Slides` |
| a page that refuses to be framed, whatever its kind | `↗ New tab` |
| a page, a post, an image, a social widget (in the hover peek only) | `Web`, `Writing`, `Image`, the platform. Another section of this site (`/works`) wears none: its card prints its own name, and `Web` would say it leaves |

![Three covers from the Attachments Lab in the hover-peek tier: the WeAreDevelopers page wearing New tab, the GOSIM Paris page wearing Web, and a post wearing Writing.](/img/docs/system-attachments/lab-chips.png)

The lab's vocabulary in the peek's tier, where every kind is marked and the
chip is raised: a page that refuses framing says `New tab`, a page `Web`,
a post `Writing`.

Who wears one is the surface's call, in three tiers:

| where | who wears a chip |
|---|---|
| `/works` (the strip, the expanded card, the inline players, the deck cover) | a recording, a deck, and a page that will leave. A card is its own hint (domain, title), and a chip on every card would be noise |
| the hover peek | **every kind** (`markFor`'s `all`): a peek is a glance, and the chip is its caption |
| the attachment sheet's page, the home widgets' covers, the theater's rail | **none**: each already says what the thing is beside the cover (a labelled button, the widget's line, the rail's title), and a chip would repeat it |

The chip says what the thing *is*, never where it opens. That is how a
GitNation recording wears a play chip and opens in the in-app browser
rather than on the stage: it is a recording, and the policy above decides
the rest. `markFor(media, locale, { all, leaves })` reads the chip off an
item; `leaves` comes from `homeOf(set, i) === "tab"`, so it is only ever
true where the click itself opens the tab (on a desk; a phone's tap opens
the sheet). `mediaKindOf` reads the kind, for the sheet's button glyph and
the lab.

Two weights. On a cover in the page the chip is light (`ARTWORK_CHIP_REST`):
a row of covers should not be a row of stamps. The cover's hover raises it
to the full chip, and so does its press, which a finger never hovers. The
chip reads both off the anchor, button or `[data-cover]` it sits in, so no
cover has to be a `group`. A cover in a peek, which is the after-hover
state, is raised from the start (`raised`).

Three sizes: `mini` for the contact strip's tiles, where the chip keeps
its glyph and drops its word (the wallpaper tile's small badge); `compact`
for the grid's tiles, rail thumbs and dense cards; `default` for a full
cover. The tiles, the link card, the inline video facades, the deck cover
and the hover peek's poster all take the chip from here, and nothing else
on a cover says what it is. A card with no cover to wear it on carries the
chip in its caption line (`inline`).

## The three forms of /works

How much of a commit the page prints is one of three *forms*, and a form
is a preset of a few independent atoms rather than a layout of its own
(`ROW_FORM`, `lib/log-view.ts`): whether the text prints (the description
and the commentary, `none` · `full`; there is no clamp), which attachment
object (`none` · `covers` · `grid`), whether the notes print (the
`details`), whether the author fields print, and whether anything peeks on
hover. The toolbar's control resets every row to a preset; a row's own
press flips its notes (and in the index, where there is no text or picture
to keep still, brings those too). A row a press would add nothing to has
no press: no wash, no pointer, no `role="button"`. Old links with git's
names (`oneline`, `stat`, `patch`) still parse, as aliases.

The feed is on its way out. The control offers it only while the DevTool's
Works module switches it on (`worksFeed`, a saved setting, off by default);
off, a `?view=feed` link reads as the default form and the URL is left as it
came.

| form | text | media | notes | author | peek | the reading |
|---|---|---|---|---|---|---|
| `index` | none | none | — | — | ✓ | the overview: one line per commit, the career in two screens |
| `covers` (default) | all of it | `covers`: 112px tiles, glyph chip | press | — | ✓ | the work on screen, read by scrolling: nothing a reader should know waits on a press |
| `feed` | all of it | `grid`: half-column tiles, captions written | ✓ | ✓ | — | everything, with nothing behind a hover or a sheet. A press folds a row's notes. |

**What is read, and what is asked for.** The split is made once, in the
data, for every commit. Above the covers is what someone scrolling should
know: the `description` (what the work is, my part in it, why it matters,
complete in itself and short enough to print whole) and the `commentary`,
my own line on it, under it in the aside's serif. Under the covers, behind
the row's press, is the long form: `details` (a talk's programme abstract
as the conference published it, a thesis's particulars, a source quoted
whole, an archive note). A description that needs a clamp to fit has
`details` in it; a fact the reader needs to judge the work does not go in
`details`.

**Names link in place.** The three fields may link what they name,
`[words](target)` (lib/inline-links.ts): a URL or a site path, a commit
(`commit:lynx-framework`), one of its media (`commit:wasmcert#1`), or a role
(`role:meta-engineer`). The row renders each as a magic link (`InlineText`),
so a page a sentence names peeks its card and opens where a cover's page
does, and a cover that only stood for that page can leave the strip. Every
other surface that prints a commit (a peek, the shelf, a widget, a compact
row) gets the plain words. The snapshot crawls the pages linked this way.

**Decoration never gates a press.** The `--pretty=fuller` fields are
provenance: the chapter names the era and the title line the team. When
they were part of the notes every row was pressable for them, and most
presses brought nothing else. Now nothing of them prints at rest (not even
the `@handle` that used to sign a single cover), and they come when asked
for as **the signature** (TimelineCommit): `commit` and `Author:`, the same
two everywhere. There is no `Role:`. `Author:` opens the identity card,
which carries the role, its tenure, team and place, and a role line on
every row read `Architect @ ByteDance` eleven times down the Lynx years,
restating the company the handle and the team already name.

- **On a desk** the hash already hangs in the margin. Hovering or focusing
  a row (after a 140ms beat of intent, so a pointer sweeping down the page
  does not set every margin flickering) lights the hash a rung and drops
  `<author>` from it (`MarginFields`), 12px on the muted rung, right-aligned
  to the hash's edge, 6px under it. Nothing in the column moves. It is the
  identity card's trigger.
- **Anywhere, a tap** toggles it. It is an easter egg, so nothing announces
  it: a tap on the row's **mark** in the gutter, its **team** (`Lynx @
  ByteDance`, `M.S. Capstone @ RIT`, the plain-text venue a finger goes
  for; a venue that is a link keeps its link), or its **date**, the
  commit's own timestamp. None of them changes how it looks, and the row
  does not look pressable for it. Below `lg`, where there is no margin, the
  row opens to the labelled stack, the hash as its `commit` field; on a
  desk the tap pins the margin's. An index line is too short for the
  margin, so there the tap opens the labelled stack too.
- **Motion** (globals.css, "The signature"): every line is revealed by a
  clip sweeping its own box, never a transform (a transformed layer
  re-rasterizes 12px mono and it shimmers). On a desk the author drops from
  the hash. On a phone the row opens to the stack's height (grid rows `0fr`
  → `1fr`), the mark nods, and the fields print left to right, 70ms apart,
  each value a beat after its label, the way `git log` prints them. The
  metadata line it came from stays lit while the signature is out. Leaving
  is one quick fade. Reduced motion keeps the fades only.

The feed prints the fields outright, so it has no egg. The row's address
is the hash, and only the hash: the gutter's on a desk, the stack's
`commit` field on a phone. The date was the phone's permalink for a while,
when the stack had lost its `commit` field; a date that scrolled the page
when tapped surprised more than it served, and it is plain text again.
Asides are the other half of the same rule at row scale: a whole commit
that is secondary, folded to its quiet line until pressed.

### The title line

Every fact on a row has one place, in every form and every state, and
opening a row only adds below the title line. Nothing above the
description moves. The line is `hash · mark · title [· 中文] ··· [📎 n]
venue date`: the venue (a talk's conference, a piece of press's platform, a
project's team) sits on the title line in a column before the date, and
the right of the line is packed to the edge, so when an open row's covers
replace the count the venue and the date stay where they were. A team is
printed sparsely, and its `@ Company` once per run of one company's
projects: `React Core team @ Meta`, then `PLR`.

A venue with a page of its own (a talk's conference) is a **magic link**
to it, never a bare way out. Under a pointer it peeks the page's card, and
a press goes where a cover's page goes: the drawer on a phone, the in-app
browser on a desk, a tab only for a page that refuses to be framed. It used
to leave for a new tab with a `↗`, the one door the title line had of its
own. Even a conference's front page is worth keeping, but behind its card
rather than a jump. Its card is in the snapshot (`logHrefs`,
scripts/og-snapshot.ts); a page that cannot be crawled has no peek and
keeps its drawer.

Below `@md` the line has no room for a column, so the same
three become an *eyebrow*: one mono line over the title, a step (6px) off
it, the way a kicker sits over a headline. The venue is on the left, and
`📎 n` and the date are packed to the right edge. Nothing is cut to fit, and
the title and its sentence still sit together. The venue is never under
the title, whatever the viewport, folded and open alike. The eyebrow's
cells are top-aligned 16px lines rather than baseline-aligned, so the `📎 n`
an open row gives up cannot nudge the venue. The title's weight is the
form's too (`rowHeading` where the form prints a message, `rowTitle` in the
index), never the press's: a title that thickened as its row opened was the
one thing on the line that moved. There is no meta line: with nothing between
a title and its sentence, the description sits one rung up (`TYPE.caption`,
muted) and reads as the row's second tier. Nothing signs the row at rest:
the handle is the signature's (above), asked for by hover or by a tap on
the mark, the team or the date.

### The attachment object

Every cover is one tile (`AttachmentTile`,
`components/log/media/attachment-tile.tsx`): a 2:1 crop of the artwork,
and its chip. 2:1 is the aspect the covers come in: an OG image is 1.91:1,
and a video poster loses a sliver top and bottom that the peek and the
surface show whole. One aspect for every kind is what lets a video sit
beside a card, and a row of tiles line up with the next row's. The form
decides the size and the caption, never the shape.

**The strip** (`MediaStrip`, `covers`) is the tiles in a row with no
caption: the chip is enough at that size, and the peek shows the rest.
When the covers are wider than the column the strip runs on under the
page's bleed (`--page-bleed`, globals.css: from the column's edge to the
viewport's), so a cover is only ever cut by the screen: on a phone the
strip reaches the gutter's edge and scrolls; on a desk it runs into the
margin, where three covers simply fit. A row cut mid-page reads as a
mistake, the same row running under the edge reads as a rail there is
more of. The strip's line is the covers' alone; nothing signs it.

**The grid** (`AttachmentGrid`, `feed`) takes the row's own strip items:
the timeline hands it `stripItems` directly, and what has no cover (a live
widget) goes to `MediaRenderer` under it. It is where the captions are
written out (where it is from, what it is, its blurb) and where nothing
needs a second step. The chip is down to the glyph on a recording or a
deck (a play mark is an affordance, not information) and gone from a card.
A click is the item's native action (`act`: the stage, the in-app browser,
the page), never the attachment sheet, which would be a drawer opening on
what is already on screen.

Cover and caption are one control (`AttachmentTile`'s `footer`): the same
`<a>`, so a press on the title washes the artwork and dims the copy
(`COPY_WASH`: opacity, the cover-press language). The caption is not a
second click target that happens to do the same thing, and it is not the
row's fold handle. Folding is a muted fill on the title line; opening an
attachment is a dim. Mixing the two would make the presses feel the same. A hand-opened row in
`covers` / `index` still folds from its title line; the expanded body
(`data-row-body`) stops that click and wears a default cursor, so
description, notes and captions do not look like fold targets. The feed
itself does not fold per row: every commit is already open, and leaving
is a form change on the toolbar. On a phone, a recording or a deck is
the exception: the cover plays in place and the bar under it (`PiP`)
hands playback to the stage, so that line is a label, not a second door.

- On a desk, the unit is half the column whatever the count. The feeds
  this borrows from (X, LinkedIn) agree on the rule: media has a
  footprint, and the count changes how it is tiled, never how big the
  post is. A pair
  is two captioned tiles; a lone card is the tile with its caption beside
  it (the unfurl a chat app prints for a link); a lone recording or deck,
  which has nothing to say beside itself, takes the column as a video post
  does.
- On a phone, the feed is a feed: one thing under the next, each running
  edge to edge over the page gutter and the rail column (`PHONE_BLEED` wraps
  the crop, not the caption; negative margins on the `w-full` picture
  would only shift a column-width cover). Cover and caption are still one
  control; a tap on the title under a card is the same door as the artwork.
  A recording or a deck plays in place (`InlinePlayable`: a 16:9 cover
  swapped for the platform's player or the deck itself). The bar under it
  is there from the start, so pressing play moves nothing. It names the
  item and carries one control, `PiP`, which hands playback to the stage
  (`act`) for whoever wants to keep scrolling and stops the inline player
  so the two never play at once. While the item is on the stage, its place
  in the feed says so with a wash and the PiP mark over the cover, and
  pressing it brings playback back. That state is read off
  `useOptionalTheaterStage`, which carries the stage's occupant and its
  doors without the ticking clock of the full theater context. A
  card goes to its native home.

Before this, one card was full width and natural aspect, a video was full
width and 16:9, two of anything was a scroll rail at half width with the
publisher's caption deciding each tile's height, so every open row was a
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
  under its chip: twenty-odd backdrop roots scrolling over full-bleed
  bitmaps. A translucent fill reads the same and costs a fill.
- **No `content-visibility` on a row body.** It was tried, with a 24rem
  intrinsic size, and it cost more than it saved. It is the one rule here
  that was never measured in time, only in what it skipped. Rows are
  380–530px on a 402px phone, so the page kept resizing as they came into
  range (32 changes over one pass, 17.0k → 20.1k), and each row entering
  range is a layout: **248ms of layout over a scroll versus 36ms without
  it, 147 layouts versus 67** (Chromium, 4x CPU throttle, scripted pass of
  the phone feed). It buys about 200ms of the first load at that throttle,
  and on iOS the resizing is worse than slow: the scroll view's idea of the
  page lags behind it, so a finger moving up can hit a bottom that is no
  longer there. The work it would skip is already lazy by other means:
  `loading="lazy"` on the covers, `decoding="async"`, and no peek tree
  where no pointer can hover.
- **A peek panel exists only while it peeks.** `Cursor` used to keep a
  fixed, transformed panel mounted for every row: fifty compositing
  layers on a desk before anyone hovered. Idle, it is a hidden span.

And the rest, each small: covers decode off the main thread
(`decoding="async"`); the sticky era pill's frosted blur is `sm:` and up;
nothing that only sends something to the stage subscribes to the ticking
theater context (`useOptionalTheaterStage`); no peek tree is built where
no pointer can hover (the row's, the strip's, the signature's); a connector
observes its container alone. The trace in the PR shows where the rest goes: the
wallpaper's canvas, which every page pays alike.

## Hovering a cover

The row's magnetic peek (the cursor-following panel that shows what a folded
row is holding) stands down in the forms that print a strip, because the
row now prints its covers, and in the feed altogether (`ROW_FORM.peek`).
Each cover peeks instead, in the same vocabulary
(`components/log/media/media-peek.tsx`): rest the pointer on a thumbnail in
the contact strip and a link card peeks as the mini OG card (domain, title,
description), a video or a deck or an image as its poster, each wearing
its chip, raised, and nothing else: no caption, no note. `PeekThumb` and
`PeekCard` live there; the row's stacked deck in the `index` form is built
from the same two and wears the same chips (`PeekItem` carries its `media`
for that), so the two forms peek alike. How a peek's picture is sized
(`PeekCover`) is [og-previews.md](./og-previews.md), "Cover sizes".

## The lab

**`/lab/attachments`**, the Attachments Lab (`noindex`), is the devtool for
this system, the way `/lab/legibility` is for reading surfaces. Nothing on
it is a mock:

- **Vocabulary**: the chips at every size on the log's own covers, in the
  `/works` tier and the peek's, the GitNation case among them.
- **Render paths**: every place a commit's media is drawn, where a press
  sends it, and the file (`RENDER_PATHS`, `app/lab/attachments/paths.ts`):
  the strip, the desk grid, the phone grid and `InlinePlayable`,
  `MediaRenderer` (single, rail, pills), the peeks, the attachment page,
  the theater's rail thumb, the MDX `<Media />` and the home Featured
  Talks widget.
- **Homes**: the policy as a table, read live from `homeFor` /
  `nativeHomeFor` for a context you can pin (phone or not, a window
  manager).
- **Specimens**: those surfaces rendered by the production components.
- **Try it**: buttons that go through the real providers, with a readout of
  the surface stack and the open windows as they stand. On a phone it is
  where to watch the button stack the browser over the attachment sheet.

![The lab's Homes table with the viewport pinned to phone: every row's tap is sheet; the button sends video and slides to theater, the GitNation recording and a page to window · sheet, the page that refuses framing to tab, a post to route, an image to lightbox.](/img/docs/system-attachments/lab-homes.png)

The Homes table pinned to a phone. Every tap is `sheet`; the button column
is `nativeHomeFor`, and `window · sheet` is the in-app browser as a stacked
sheet. Unpinned at 1280px the tap column turns into the button column.

`/lab/attachment` (and the old `/editor/attachments`) redirect here. The
title is the labs' dropdown (`systems/lab/catalog.ts`).

## Adding a kind

1. Add it to the `Media` union and give it an `is…Media` guard
   (`lib/log.ts`).
2. Say where it opens in `lib/policy.ts`, in both functions.
3. If its home is the theater or the lightbox, let it through the kind guard
   in that case of `send` (`provider.tsx`).
4. Say what its cover wears in `media-mark.tsx`, in `mediaKindOf` and `markFor`.
5. Give it a page in `attachment-page.tsx`; without one the sheet shows
   nothing for it.
6. If it can play on the stage, give it a `Track` kind and teach `mediaToTrack`
   (`systems/theater/lib/albums.ts`) to build one.
7. Give it a row in `RENDER_PATHS` and a specimen in the lab, then check it
   there: the table (pinned to phone and not), the specimens, the buttons.
8. If it paints a cover, `pnpm og:complete` must still pass.

## Reference

```
systems/attachments/
├── index.ts                          # the public surface
├── provider.tsx                      # AttachmentProvider, useAttachments(): open / act / homeOf / send
├── lib/
│   ├── types.ts                      # AttachmentSet, AttachmentHome
│   ├── policy.ts                     # homeFor / nativeHomeFor, leavesSite, isPdfLink, linkTarget
│   └── set.ts                        # attachmentSetFor(commit, locale)
└── components/
    ├── attachment-surface.tsx        # the paged sheet / panel / window (AdaptiveSurface)
    ├── attachment-page.tsx           # one attachment, large, with its native action
    └── image-lightbox.tsx            # an image, letterboxed, zoomable (the `lightbox` home)

components/log/media/
├── media-mark.tsx                    # MediaMark, markFor, mediaKindOf: the chip
├── attachment-tile.tsx               # AttachmentTile, TileSlot, resolveTile: one cover
├── media-strip.tsx                   # MediaStrip: the `covers` form's strip
├── attachment-grid.tsx               # AttachmentGrid, InlinePlayable: the feed's grid
├── media-renderer.tsx                # MediaRenderer: players and cards in a body or MDX
└── media-peek.tsx                    # PeekCard, PeekThumb: the hover peek

app/lab/attachments/                  # the lab; paths.ts is RENDER_PATHS
```

`<AttachmentProvider>` mounts inside the theater and window providers;
`<AttachmentSurface />` and `<ImageLightbox />` mount once in
`app/layout.tsx`.

### History

Each kind used to open its own way. A video went to the theater. A deck went
to a lightbox of its own (`SlideModal`), which on a phone gave up and opened
a tab. A card was a plain `<a target="_blank">`. A cover in the contact strip
was a link; the same cover in the expanded body was a player. On a phone,
tapping a thumbnail either left the site or dropped a Picture-in-Picture the
size of a thumb onto the page. The site already had a theater, a window
manager and a router; it had no rule for sending an attachment to the right
one, and no shape for a phone. `SlideModal` and `SlidesPlayerProvider` are
gone. The chip replaced three vocabularies drawn in place by whichever
component held the cover: a play disc on anything that played, a caption
chip over the disc on a deck, and a line of prose under a card that would
leave for a tab.
