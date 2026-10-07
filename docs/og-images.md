# OG Images System

> The checklist form of this page's font baking is the `pnpm og:fonts` row of the skill `.claude/skills/content-snapshots`.

Generates the site's **own** Open Graph / social cards: the 1200×630 image
that previews a page when shared to X, LinkedIn, iMessage, Slack, etc.

> Not to be confused with [og-previews.md](./og-previews.md), which crawls
> **other** sites' OG metadata to render the link cards on `/works`. This doc
> is about the images **we** publish for **our** pages.

## What it looks like

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/og-images/home.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The home card: λhux top-left, hux.pro top-right, Hux.Pro in serif, a hairline, then the mono tagline, on flat #1a1a1a." />
  <img src="/img/docs/og-images/post-en.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The English card of the post dreamer: its first image darkened, Software Dreamer in serif over it, 2018 · 3 min under the hairline." />
</div>
<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginTop: "1rem" }}>
  <img src="/img/docs/og-images/post-zh.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The Chinese card of the same post: 程序员中的梦想家 set in a sans face, not the serif of the English title; 2018 · 4 分钟 under it." />
  <img src="/img/docs/og-images/post-zh-offline.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same Chinese card rendered with Google Fonts unreachable: every Hanzi in the title and in 分钟 is an empty box." />
</div>

Top: `/opengraph-image` (a section card) and
`/writing/dreamer/en/opengraph-image` (a post card over its first image),
both entirely from the fonts baked in `lib/og-fonts/`. Bottom: the post's
Chinese card as `pnpm dev` renders it, and again with Google Fonts
unreachable. The Hanzi are not the baked Noto Serif SC: they are Noto Sans,
fetched while the card renders, and boxes when the fetch fails (see
[Chinese glyphs](#chinese-glyphs-today)).

## Model

Three kinds of card, one renderer (`renderOgImage` in `lib/og-image.tsx`):

| Kind | What | Card |
|------|------|------|
| **Section** | Home and each main section share one card | `λhux` · path · serif section title · mono tagline |
| **Post** | Each post, per locale, gets its own card | post's first image (darkened) · serif title · `year · reading time` |
| **Reading** | A narrowing of a section people send, e.g. `/works?type=talk` | the section card, with the query as its path and a count |

A route without an `opengraph-image` of its own shows the nearest one above
it: a doc page (`/docs/<slug>/<lang>`) shows the `/docs` card, `/lab` the
home card.

A post has two faces. **Shared**, it is its card, baked by its
`opengraph-image` route: its first image (`cover`/`coverZh`, extracted in
`lib/mdx.ts`) darkened, the title and the year set over it, or the flat
typographic card when it has no image. A feed may show the picture alone,
so the picture carries the title. **Inside the site**, a card of the post
shows the image itself and sets the title beside it.

The page's Open Graph comes from `postCardOf(post, lang)` in
`lib/content.ts`, and the card route reads the same title
(`getLocalizedTitle`, without the `| Hux.Pro` the browser tab gets). The
page publishes the post's first paragraph, whole (`extractLead`), as
`og:description`; the dek (frontmatter `description`) is a peek's field,
used only when the body has no paragraph. Cards are per-locale, so a
bilingual post gets distinct EN/ZH cards.

## Readings: a card for a query string

`/works?type=talk` is /works filtered, not a page: the query string is the
view state (`lib/log-view.ts`). But it is a link people send (the About's
magic links, the home widgets), and a crawler unfurling it reads the Open
Graph of whatever HTML it is served. A static page has one, so each reading
worth a card (`WORKS_READINGS` in `lib/works-readings.ts`: `talk`,
`project`) has a page of its own, `app/works/[type]`, prerendered with its
title, its words and its baked card, and rendering nothing else.

- **The view is the layout's** (`app/works/layout.tsx`). `/works` and
  `/works/<type>` are both empty pages under it, so a chip tap that moves
  between them keeps the view mounted.
- **The query is still the address.** `next.config.ts` rewrites
  `/works?type=<type>` to `/works/<type>` (`beforeFiles`, or the plain
  `/works` page would answer first) and redirects a bare `/works/<type>` back
  to the query. Only a query naming exactly one reading is rewritten
  (`?type=talk&view=feed` is; `?type=talk,project` is /works).
- **One card, three readers.** `worksCardOf` (`lib/works-card.ts`) is the
  page's Open Graph (`app/works/metadata.ts`), its image
  (`/works/<type>/opengraph-image`) and a magic link's card
  (`components/magic-link/server.tsx`), counted from the log so it never
  goes stale. As a bonus, the tab's title follows the reading.

A new reading: add its type to `WORKS_READINGS` and its words to `READINGS`
in `lib/works-card.ts`.

## How it works

Built on the Next.js [`opengraph-image`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
file convention + `next/og` (`ImageResponse`, which runs Satori). Images are
**prerendered at build time**: 7 `opengraph-image.tsx` files, about 50 cards
(every section, both readings, every post/locale via
`generateStaticParams`), so there is no request-time rendering.

`metadataBase`, `openGraph`, and the `summary_large_image` Twitter card are
set once in `app/layout.tsx`. A page that sets its own `openGraph` (a post,
/works) sets it whole, since it replaces the layout's rather than merging.
The file-convention image fills `og:image` and `twitter:image` by itself.

Fonts are **baked into the repo** (`lib/og-fonts/`, written by
`pnpm og:fonts` = `scripts/og-fonts.mjs`) and read from disk by
`loadFonts()`. The Latin faces cover the full printable range, so any
English title renders without a refresh; the CJK face is subset to the
glyphs of every post's `title` and `description` (both locales) plus a
common-Hanzi cushion. The three files are about 310 KB.

![pnpm og:fonts subsets three Google fonts into lib/og-fonts/; next build's opengraph-image routes call renderOgImage, whose loadFonts reads them and hands them to ImageResponse; a glyph in the element's family is drawn from the baked file, any other goes through next/og's loadDynamicAsset to Google Fonts, giving a sans glyph online and a box offline.](/img/docs/og-images/font-path.svg)

Left to right: the bake that needs network, the build that is meant not
to, and where each glyph comes from. The red path is the one every Hanzi
takes today.

A post's first image is read from `public/` and inlined as a data URI. A
remote first image (three Zhihu-era posts open with a `zhimg.com` picture)
is fetched during the build; if that fails the card falls back to the flat
one.

### Chinese glyphs, today

The intent is a Hanzi title in Noto Serif SC from the baked file. What
happens:

- `loadFonts()` registers Newsreader and Noto Serif SC under one family
  name, `OgSerif`. Satori draws from the first face of a family and does not
  try a second one with the same name, weight and style, so the baked CJK
  face is loaded and never used.
- A glyph no face of the element's family has goes to next/og's
  `loadDynamicAsset`, which fetches Noto Sans JP / SC from Google Fonts for
  it. With network, the title prints in that sans face (bottom left above).
  Without, it prints boxes and the build still succeeds (bottom right).
- The meta line is set in `OgMono`, which has no Hanzi, so the `分钟` of a
  Chinese reading time takes the same path on every Chinese card.

So `pnpm og:fonts` has no visible effect on Chinese cards until the CJK face
is reachable (its own family name, listed after `OgSerif` for the title and
after `OgMono` for the meta). Keep running it after a Chinese title with new
glyphs anyway, so the face is complete when it is: `pl-chart`'s Chinese
title already has two glyphs (`偏`, `编`) the bake does not hold.

## Constraints

| Constraint | Why | What breaks |
|---|---|---|
| No network in `next build` for fonts: read them from `lib/og-fonts/` | Every card fetching its fonts means hundreds of Google Fonts requests in one build; one rate-limited fetch once threw and failed the Vercel build | Then, a failed deploy; today, next/og's fallback catches the error and ships boxes instead |
| One face per family name in `loadFonts()` | Satori does not fall back across faces that share a name | The second face is dead weight (the CJK face today) |
| Every string a card prints is in the bake: Latin, the card strings, every post title | A glyph outside it is fetched at build, or a box | A sans glyph or a box in a serif title |
| 1200×630, `OG_SIZE` in every route's `size` | The size crawlers expect for `summary_large_image` | Cropped or letterboxed previews |
| `<img>`, not `next/image`, inside the card | Satori renders raw elements | The cover does not render |

Free choices: the colours (they mirror the dark-mode tokens in
`app/globals.css`), the title size tiers (`titleSize`), the overlay
gradient over a cover, each section's tagline.

## Design

Faithful to the dark-mode design tokens (`app/globals.css`) and the "Personal
Operating System" language:

- **Base** `#1a1a1a` (`--background`), text `#e8e8e8`, muted `#a0a0a0`
- **`λhux`** mono brand mark, top-left (same identifier as the homepage)
- **Path** (`/writing`, `hux.pro`) mono, top-right
- **Title** serif, Newsreader; 92 / 80 / 70 / 64px by length (a Hanzi counts
  double), clamped to about three lines
- **Meta** mono system line under a hairline rule
- No gradients/blobs/illustration chrome; the cover image is the only imagery

## Adding / changing

- **New section** → add `app/<section>/opengraph-image.tsx` (copy an existing one, set `title` / `eyebrow` / `meta`). Without one it shows the nearest card above it.
- **New post** → nothing to do for the card; the per-post route picks it up from `generateStaticParams`. If its title is Chinese with new glyphs, run `pnpm og:fonts` and commit `lib/og-fonts/`.
- **Tweak the look** → edit `lib/og-image.tsx` (one place styles every card).

Preview a card in `pnpm dev` by opening its route, e.g.
`/writing/<slug>/<lang>/opengraph-image`, `/works/talk/opengraph-image`. A
Chinese card fetches from Google Fonts there too. After `pnpm build`, the
baked images are the `.next/server/app/**/opengraph-image.body` files
(PNGs).

## Files

| File | Role |
|------|------|
| `lib/og-image.tsx` | Shared renderer: palette, `loadFonts()`, cover loader, title sizing, `renderOgImage()` |
| `scripts/og-fonts.mjs` (`pnpm og:fonts`) | Subsets the three fonts from Google Fonts into `lib/og-fonts/` |
| `lib/og-fonts/` | The baked fonts: `newsreader-400.ttf`, `jetbrains-mono-400.ttf`, `noto-serif-sc-400.ttf` |
| `app/opengraph-image.tsx` | Home card, and the card of any route without its own |
| `app/{writing,works,docs,prompt}/opengraph-image.tsx` | Per-section cards |
| `app/works/[type]/{page,opengraph-image}.tsx` | A reading's Open Graph and card (`/works?type=talk`, rewritten here) |
| `lib/works-readings.ts`, `lib/works-card.ts` | Which readings have a card; the card (copy, count, image) |
| `app/writing/[slug]/[lang]/page.tsx` | A post's Open Graph (`generateMetadata`, from `postCardOf`) |
| `app/writing/[slug]/[lang]/opengraph-image.tsx` | Each post's shared card (its `og:image`) |
| `app/layout.tsx` | `metadataBase` + base `openGraph` / `twitter` metadata |
