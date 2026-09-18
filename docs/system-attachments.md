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
    └── attachment-page.tsx           # one attachment, large, with its native action
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

| | phone (`< sm`) | tablet / desktop |
|---|---|---|
| video | attachment sheet | theater |
| slides | attachment sheet | theater (a `slides` track — see below) |
| link card, external | attachment sheet | in-app browser window, or a tab if the page refuses to be framed |
| link card, `/writing/…` | attachment sheet | the router |
| image, social widget | attachment sheet | attachment surface, in its desktop shape |

`homeFor(media, ctx)` says where a click lands. `nativeHomeFor(media, ctx)` is
the same question with the surface taken out of the picture — what the item
does natively, which is what a page's primary button in the sheet performs.
On a phone the sheet opens for everything and its `Watch` / `Slides` / `Read`
/ `Visit` button is the native action: a video plays in PiP, a deck opens in
a tab (reveal.js in a phone-sized frame is unreadable), a card opens.

Whether a page refuses framing is read at snapshot time: `pnpm og:snapshot`
now records `X-Frame-Options` / `frame-ancestors` as `frame: "deny"` on the
entry (see [og-previews.md](./og-previews.md)), and enrichment carries it to
`preview.frame`. A refusal is only stored when explicit — a bot wall that
says nothing about framing is not read as permission. Pages the crawl cannot
reach at all can be told by hand (`preview: { frame: "deny" }`, as The Verge is).

A card that will leave for a tab says so **before** the click, not after:
the expanded card and the cover's hover peek print `Opens in a new tab` as a
last line (`CardFace`'s `note`), the cover's tooltip carries it, and when the
tab does open, a one-line system toast names the site that would not be
framed (`components/ui/system-toast.tsx`). Gitee, Medium, web.dev, The Verge
and Meta are the ones in the log today; the rest open in a window.

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

## Hovering a cover

The row's magnetic peek — the cursor-following panel that shows what a folded
row is holding — stands down at the `stat` density, because the row now
prints its covers. Each cover peeks instead, in the same vocabulary
(`components/log/media/media-peek.tsx`): rest the pointer on a thumbnail in
the contact strip and a link card peeks as the mini OG card (domain, title,
description), a video or a deck or an image as its poster with a caption
saying what pressing it does (`YouTube · Watch`, `Slides · <deck>`). `PeekThumb`
and `PeekCard` moved there from `commit-embed.tsx`; the row's stacked deck is
built from the same two, so the strip and the deck cannot drift.

## Slides in the theater

A deck is the other thing a talk leaves behind, and it belongs on the same
stage as the recording. `Track` is `VideoTrack | SlidesTrack`
(`systems/theater/lib/types.ts`): a `slides` track frames the deck URL in the
stage's iframe, keeps the theater's title bar, prev / next and playlist rail,
and has no transport (reveal.js takes the arrow keys inside the frame). It
minimizes to the Live Activity like anything else on the stage — the pill is
a place to keep a deck open, not only a place to listen. `TrackThumb` wears
the same `Slides` chip the `/works` cover does.

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
2. Give it a page in `attachment-page.tsx`.
3. If it can play on the stage, give it a `Track` kind and teach `mediaToTrack`
   (`systems/theater/lib/albums.ts`) to build one.
