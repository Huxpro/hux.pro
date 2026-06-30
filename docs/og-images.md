# OG Images System

Generates the site's **own** Open Graph / social cards — the 1200×630 image
that previews a page when shared to X, LinkedIn, iMessage, Slack, etc.

> Not to be confused with [og-previews.md](./og-previews.md), which crawls
> **other** sites' OG metadata to render the link cards on `/works`. This doc
> is about the images **we** publish for **our** pages.

## Model

Two tiers, mirroring how the site is structured:

| Tier | What | Card |
|------|------|------|
| **Subsite** | Each main section shares one card | `λhux` · path · serif section title · mono tagline |
| **Writing** | Each post gets its own card | post cover image (darkened) · serif title · `year · reading time` |

A post card uses the post's cover image (`/img/post-bg-*.jpg`, the first image
in the body — already extracted as `cover`/`coverZh` in `lib/mdx.ts`). When a
post has no cover, it falls back to the flat typographic card. Cards are
per-locale, so a bilingual post gets distinct EN/ZH cards (CJK titles render in
Noto Serif SC).

## Design

Faithful to the dark-mode design tokens (`app/globals.css`) and the "Personal
Operating System" language:

- **Base** `#1a1a1a` (`--background`), text `#e8e8e8`, muted `#a0a0a0`
- **`λhux`** mono brand mark, top-left (same identifier as the homepage)
- **Path** (`/writing`, `hux.pro`) mono, top-right
- **Title** serif — Newsreader (Latin) + Noto Serif SC (CJK fallback)
- **Meta** mono system line under a hairline rule
- No gradients/blobs/illustration chrome — the cover image is the only imagery

## How it works

Built on the Next.js [`opengraph-image`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
file convention + `next/og` (`ImageResponse`). Images are **prerendered at build
time** (every section + every post/locale via `generateStaticParams`), so there
is no request-time rendering.

Fonts are pulled from Google Fonts at build, **subsetted to exactly the glyphs
each card renders** (`&text=`), keeping payloads tiny even for CJK. Cover images
are read from disk and inlined as data URIs — no runtime network dependency,
consistent with the project's "bake it at build" philosophy.

`metadataBase`, `openGraph`, and the `summary_large_image` Twitter card are set
once in `app/layout.tsx`; the file-convention images populate `og:image`
automatically (Twitter falls back to `og:image`).

## Files

| File | Role |
|------|------|
| `lib/og-image.tsx` | Shared renderer — palette, font subsetting, cover loader, `renderOgImage()` |
| `app/opengraph-image.tsx` | Home / default subsite card |
| `app/{writing,works,docs,prompt}/opengraph-image.tsx` | Per-section subsite cards |
| `app/writing/[slug]/[lang]/opengraph-image.tsx` | Per-post, per-locale cards |
| `app/layout.tsx` | `metadataBase` + base `openGraph` / `twitter` metadata |

## Adding / changing

- **New section** → add `app/<section>/opengraph-image.tsx` (copy an existing one, set `title` / `eyebrow` / `meta`).
- **New post** → nothing to do; the per-post route picks it up from `generateStaticParams`.
- **Tweak the look** → edit `lib/og-image.tsx` (one place styles every card).

Preview locally by running `pnpm build` and opening any
`.next/server/app/**/opengraph-image.body` (it's a PNG), or hit the route in
`pnpm dev` (e.g. `/writing/<slug>/<lang>/opengraph-image`).
