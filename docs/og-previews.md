# Link Previews (Open Graph) System

> The skill `.claude/skills/content-snapshots` is the checklist form of this
> page's commands (its `og:*` rows), alongside the other snapshots the site
> commits.

How `/works` paints the card of a page it links to (web.dev, a conference's
session page, one of our own posts): crawled ahead of time, committed, and
read at build time with no network. Our own social images, the ones we
publish for our pages, are [og-images.md](./og-images.md).

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/og-previews/card-crawled.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The Ele.me PWA commit's peek on a desk: web.dev's picture, its domain, the page's og:title and og:description, and a New tab chip on the cover." />
  <img src="/img/docs/og-previews/card-own-post.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The Hux Blog commit's peek: the post's first image, /writing as its domain, the title Hello 2015 and the post's first paragraph." />
</div>

Two peeks on `/works?view=index` (desk, hovering the row). Left, a crawled
card: web.dev's own `og:title`, `og:description` and `og:image`, and a
`New tab` chip because the crawl read that web.dev refuses to be framed.
Right, one of our own posts: nothing was crawled; the title, first
paragraph and first image are computed from the post (`siteCardOf`).

<img src="/img/docs/og-previews/card-manual-image.png" style={{ width: "calc(50% - 0.5rem)" }} alt="The ReasonML commit's peek: Reason's logo as the picture, the page's crawled title and description under it, and a Web chip on the cover." />

A card layered from two sources. The title and description are the crawl's;
the picture is a manual `preview.image` in `content/log.json`, because the
page advertises no `og:image`. The `Web` chip says it opens in the in-app
browser.

What makes these right:

- Every card paints on the first frame, from committed data. No skeleton,
  no request to the page, no request to our own server.
- A peek opens at its final height: the picture's `[width, height]` is
  already known, so nothing jumps when it loads.
- A card for our own post says what the post says now. CI fails when it
  doesn't.
- A site that blocks crawlers still has a card, written by hand, and never
  shows up as a flaky failure.

## How it works

![The snapshot pipeline: content/log.json, magic links and our posts feed pnpm og:snapshot, which writes content/og-snapshot.json and content/image-sizes.json; pnpm og:sizes writes the sizes alone. Below the line, with no network, both files feed pnpm og:complete in CI and enrichLogDataWithPreviews for the cards; a card with no title and image yet asks GET /api/og, which answers only in dev.](/img/docs/og-previews/pipeline.svg)

Above the line, commands you run with the network. Below it, CI and the
build, which read only the two committed files. The dashed box is the one
way a card reaches the network, and it is closed in production.

### Resolution: per field, the author wins

`enrichLogDataWithPreviews` (`lib/og-enrich.ts`) fills each card's
`preview` by merging, field by field (`title`, `description`, `image`,
`fit`, `aspect`, `frame`), earliest first:

1. **Manual `preview`** on the media item in `content/log.json`.
2. **The snapshot entry** for its URL in `content/og-snapshot.json`.

A `urls` map's locale URLs get their own entries, packed into
`previews[locale]`. It runs server-side for `/works`
(`app/works/layout.tsx`, through `lib/og-snapshot.ts`, which loads the file
from disk) and in client modules that import the snapshot statically
(`lib/log-client.ts`, `app/home-view.tsx`).

`LinkCard` (`components/log/media/link.tsx`) paints at once when the merged
preview has both a title and an image. Otherwise it asks the live crawl,
`fetchOGData` → `GET /api/og`, which answers only in `pnpm dev` (see
[The live crawl](#the-live-crawl)). That is how a link written a minute ago
gets a card before anyone runs `og:snapshot`.

### Our own pages

A card for one of this site's posts (a `link` whose `url`, or a `urls`
entry, is `/writing/<slug>/<lang>`) comes down the same pipeline: the
snapshot records it under its URL. What it records is not crawled but
computed by `siteCardOf` (`lib/site-card.ts`) from `postCardOf`
(`lib/content.ts`), the function the post's page publishes its Open Graph
with. So the title and text a crawler reads off our page and the ones we
paint for it are one answer: the post's title and its first paragraph,
whole. The picture is the post's first image, or its baked
`/writing/<slug>/<lang>/opengraph-image` when it has none; the two faces
are explained in [og-images.md](./og-images.md).

`og:complete` recomputes each of these and fails when the post has changed
since the snapshot, so they cannot drift.

### The crawl

`pnpm og:snapshot` (`scripts/og-snapshot.ts`) collects every target,
crawls the ones that need it five at a time with `fetchOG`
(`lib/og-core.ts`, the same function the live route uses), and writes:

- **Deterministic output.** Sorted keys, a fixed field order (`title`,
  `description`, `image`, `siteName`, `frame`), no timestamps. The file
  changes only when content does.
- **A failed crawl never overwrites a good entry.** Neither does a
  successful crawl that comes back without an image: the image recorded
  before is kept.
- **An entry needs an image to count.** A title-only crawl is unusable.
- **No usable entry and no complete manual preview: exit 1**, naming the
  URL. That URL is left out of the file; the good entries are still
  written.
- **A complete manual `preview` (title and image) skips the crawl** of that
  card's own URL: you've taken ownership, so it never appears as drift.
  Its locale URLs in a `urls` map are still crawled.
- **Video covers** for Bilibili and Vimeo (`platform`) come from their
  APIs, unless the item has a `thumbnail`. YouTube's poster is derived from
  the ID at runtime and is not snapshotted.

### Framing policy

The crawl also reads each page's `X-Frame-Options` and
`Content-Security-Policy: frame-ancestors`, the headers the browser will
honour when the window system puts the page in an iframe (the desktop's
in-app browser; see [system-attachments.md](./system-attachments.md)). A
page that refuses is stored as `frame: "deny"` on its entry; a page that
may be framed stores nothing, so the field reads as the exception it is.
Only an explicit refusal is trusted from a failed fetch: a bot wall that
says nothing about framing is not read as permission. Cards with a complete
manual `preview` still get a headers-only look, and a failed crawl that
keeps a prior entry still updates its `frame` (Medium's 403 carries
`SAMEORIGIN`).
Enrichment carries the answer to `preview.frame`; a page the crawl cannot
reach can be told by hand with `preview: { frame: "deny" }`.

### Cover sizes

A card's picture is shown whole by default (`CardFace`'s `fit` is
`"natural"`), so its slot is as tall as the picture, and the browser
doesn't know that height until the bytes arrive. Every cover is known at
build time, so its size is too: `content/image-sizes.json` records
`[width, height]` for every image the site can show whole (a card's
picture after enrichment, a magic link's or a badge's page, a still, each
post's first image), keyed by URL. `PeekCover`
(`components/log/media/peek-cover.tsx`) reads it through `imageSizeOf`
(`lib/image-sizes.ts`) and gives the slot that aspect before the image is
fetched. The site's own generated cards (`/…/opengraph-image`) are
1200×630 and need no entry.

- `pnpm og:snapshot` records the sizes of the covers it just snapshotted,
  from each file's header (a remote image is read only as far as its
  header; PNG, JPEG, GIF, WebP, AVIF, SVG in `lib/image-dimensions.ts`).
- `pnpm og:sizes` records them without crawling any page.
- `pnpm og:complete` fails when a cover has no recorded size, or a local
  file's size has changed since it was recorded.

A failed probe never drops a size already recorded.

## Rules

| Rule | Why | What breaks |
|---|---|---|
| The build and the page never crawl. Covers come from `content/og-snapshot.json`, a manual `preview`, or a `thumbnail` | The site ships without API routes; `/api/og` is 404 in production. Some sites (Medium) refuse server-side requests anyway | A card that needs a crawl paints as a bare domain in production |
| Added or changed a link card, or edited a post a card shows: run `pnpm og:snapshot` and commit both JSON files with the change | CI reads only committed files | `og:complete` fails: no image, a stale post card, or no size |
| A new `<MagicLink href>` or `<Badge href>` to someone's page: run `pnpm og:snapshot` too | Its peek is the page's card (`components/magic-link/resolve.ts` reads the snapshot) | CI does not check these: in production the peek shows a bare domain |
| Never write a `preview` for one of our own posts. Edit the post | Its card is `postCardOf`'s answer, checked against the post on every PR | The card says one thing and the page's `og:*` another |
| A manual `preview` that should replace the crawl has both `title` and `image` | `mediaNeedsLiveCrawl` skips only a complete one | The crawl still runs, and fails for a blocked site |
| Every card resolves an image | A card without one paints a blank tile, on /works and in the attachment pages | `og:complete` fails |
| Don't hand-edit crawled entries in `og-snapshot.json` | The next `og:snapshot` rewrites them from the page | Your edit vanishes in an unrelated PR's diff. Use a manual `preview` |
| `frame` is learned, not authored, except `preview: { frame: "deny" }` for a page the crawl cannot reach | The window system opens a framable page in an iframe | A page that refuses framing opens to a refusal in a window |

Free choices: a manual `preview` for a card whose crawled title or picture
you don't like (fields you leave out still come from the crawl);
`preview.fit: "cover"` and `preview.aspect` to crop a picture into a fixed
slot instead of showing it whole; a card by hand in `content/badges.json`
`previews` for a `<Badge>` or `<MagicLink>` page with nothing to crawl.

## Recipes

**Add a link card.** Add the media item to the commit in `content/log.json`
(`"kind": "link"`, `"present": "card"`, `url`), check it in `pnpm dev`
(the live crawl paints it), then:

```bash
pnpm og:snapshot   # crawl → content/og-snapshot.json, content/image-sizes.json
pnpm og:complete   # what CI runs: no network
```

Review the diff and commit both files with the content.

**A site can't be crawled.** `og:snapshot` exits 1 naming the URL. Add a
manual preview to that media item:

```jsonc
{
  "kind": "link",
  "present": "card",
  "url": "https://medium.com/…",
  "preview": {
    "title": "…",
    "description": "…",
    "image": "https://…"   // loaded by the visitor's browser, not crawled
  }
}
```

Then `pnpm og:sizes` to record the image's size.

**Added a manual `preview.image`, or replaced a file under `public/` a
card shows.** `pnpm og:sizes`, commit `content/image-sizes.json`.

**An image host refuses the size probe** (The Verge answers Node's fetch
with 403). Add `"<url>": [width, height]` to `content/image-sizes.json` by
hand. A failed probe keeps it.

**Edited a post that a card shows.** `pnpm og:snapshot`; the post's entry
changes in `content/og-snapshot.json`.

**Is the snapshot stale?** `pnpm og:check` runs completeness, then
re-crawls and fails if anything would change, without writing. In dev,
`NEXT_PUBLIC_OG_REVALIDATE=1` has each card re-crawl after painting and
`console.warn` when its title, description or image differs. Both are
optional; neither runs in CI.

## Reference

### Commands

| Command | Network | Does |
|---|---|---|
| `pnpm og:snapshot` | yes | Crawl every target, write `content/og-snapshot.json` and `content/image-sizes.json` |
| `pnpm og:sizes` | images only | Record cover sizes for the committed snapshot; no page crawl |
| `pnpm og:complete` | no | The CI gate (`.github/workflows/ci.yml`, beside `pnpm badges:check`) |
| `pnpm og:check` | yes | `og:complete`, then a re-crawl that fails on drift; writes nothing |

All four are `scripts/og-snapshot.ts` (`--sizes`, `--complete`, `--check`).

`og:complete` loads `log.json`, enriches it the same way `/works` does, and
fails if any media attachment that paints a cover has no image at runtime:

- **Link cards**: `preview.image` after the merge, for each locale URL in a
  `urls` map too.
- **Videos**: authored `thumbnail`, snapshot cover (Bilibili / Vimeo), or
  YouTube's derived poster.
- **Slides / images**: authored `thumbnail` / `url`; a site-local `/img/…`
  path must exist under `public/`.
- **Social widgets** paint themselves and are skipped.

It also fails on a stale card of our own post, and on a missing or stale
cover size. It does not crawl: a missing cover is a content bug, not a
flaky third-party outage.

### What is snapshotted

- Every `link` media item with `present: "card"` in `content/log.json`
  (today every link is a card), and each URL in its `urls` map.
- Bilibili and Vimeo `video` items without a `thumbnail`, for their cover.
- Every external `href` a `<MagicLink>` or `<Badge>` names in the MDX under
  `content/` and `docs/` (`scripts/magic-link-tags.ts`), except a page with
  a card in `content/badges.json` `previews`. Its peek is the page's card.
- A talk's `conference.url`, and every external page a commit's
  `description`, `commentary` or `details` links inline, in either locale:
  the timeline renders these as magic links.

Recordings, decks, images and social posts (by `detectMediaKind`) have
peeks of their own and are skipped. Native social embeds (X, Instagram,
TikTok) use their own widgets.

### Links in prose

MDX's `a` is `ServerProseLink` (`components/magic-link/server.tsx`). A link
that points at something of this site's own becomes a magic link, with the
same peek and phone drawer it has everywhere else:

| The link points at | It peeks, and on a phone opens, as |
|---|---|
| a post (`/writing/…`, or its full or old-blog URL) | the post |
| a section (`/works`, `/works?type=talk`, …) | the section's card |
| a URL a commit in `log.json` attaches | that attachment, as its /works cover |
| anything else | a plain link |

Someone else's page is not upgraded on its own card: a link out stays one
press from where it goes, so a plain prose link is not crawled. An author
who wants one summoned writes `<MagicLink href>`, whose card the snapshot
records.

### The live crawl

`GET /api/og?url=…` (`app/api/og/route.ts`) crawls a URL a visitor's
browser hands it, so it is guarded (`assertPublicUrl`, `lib/og-guard.ts`):

- only `http(s)` on the default ports, with no credentials in the URL;
- the host, and every redirect's host, must resolve only to public
  addresses (no localhost, private ranges, link-local, or the cloud
  metadata address);
- eight seconds at most, five redirects, and no more than the page's
  `<head>` (1 MB cap).

It is a GET so a CDN can cache it: a card for a day, a miss for an hour.
One of this site's own pages is answered by `siteCardOf`, without a request.

In production it answers 404 unless `NEXT_PUBLIC_OG_RUNTIME=1`. The site
ships without API routes, and every link it shows is written in the repo,
so the snapshot can hold every card; the live crawl is what paints a link
written a minute ago in `pnpm dev`.

### Files

| File | Role |
|------|------|
| `scripts/og-snapshot.ts` | `pnpm og:snapshot` / `og:sizes` / `og:complete` / `og:check`. |
| `scripts/magic-link-tags.ts` | Every `<MagicLink>` / `<Badge>` in the MDX, for the targets. |
| `lib/og-core.ts` | Framework-agnostic crawl, parse, framing policy, target predicates. Shared by the route and the script. |
| `lib/og-enrich.ts` | `enrichLogDataWithPreviews`, pure: merges manual and snapshot into the log data. |
| `lib/og-snapshot.ts` | Node loader: reads the snapshot from disk and calls the pure enrichment. |
| `lib/site-card.ts` | `siteCardOf`: this site's posts as cards, no crawl. |
| `lib/og.ts` | `fetchOGData`: the browser's call to `/api/og`. |
| `app/api/og/route.ts` | The live crawl: our pages from `siteCardOf`, anyone else's through the guard. Cacheable GET. |
| `lib/og-guard.ts` | `assertPublicUrl`: the live crawl requests only public web pages. |
| `lib/image-dimensions.ts` | Reads a size from an image's header. |
| `lib/image-sizes.ts` | `imageSizeOf`: a cover's recorded size, client-side. |
| `components/log/media/link.tsx` | `LinkCard` / `CardFace`: paints the card; live fallback and opt-in revalidation. |
| `components/log/media/peek-cover.tsx` | `PeekCover`: the cover slot, sized from `imageSizeOf`. |
| `content/og-snapshot.json` | Committed: each URL's card. |
| `content/image-sizes.json` | Committed: each cover's `[width, height]`. |

### Why a snapshot

Crawling at request time depends on the third-party site being reachable
**and** crawlable from the server's IP, and some (Medium) refuse
server-side requests whatever the User-Agent. The snapshot moves the crawl
to the author's machine and commits the result, which removes the runtime
dependency and keeps the site static-export compatible: no per-request
server work for previews.
