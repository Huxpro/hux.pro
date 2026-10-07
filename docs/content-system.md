# Content System

How a post in `content/blog/` and a page in `docs/` become static pages at `/writing` and `/docs`: file names, languages, frontmatter, the MDX pipeline and what reads the files at build time.

> The checklist form of this page is the skill `.claude/skills/writing-content`.
> The generated files a post can touch are the skill `.claude/skills/content-snapshots`.

## What it looks like done well

- A post is one file per language, and its language is in the file name:
  `dreamer.en.mdx` + `dreamer.zh.mdx` is a bilingual post, `miui6.zh.mdx`
  alone is a Chinese one. No frontmatter field says which.
- Each language is its own static page, `/writing/<slug>/<lang>`, with
  `hreflang` alternates when both exist. A bare `/writing/<slug>` is
  redirected to a language.
- A doc is one file per slug per language. Its title is its first `#`
  heading and its listing description is the line after it.
- The body compiles as MDX, in a doc as much as in a post. Its images live
  under `public/` and are referenced by absolute path, so they load at
  `/docs/<slug>/en` and in a post alike.
- CI (`pnpm og:complete`, `pnpm badges:check`) passes without anyone having
  to remember why: the snapshots a post feeds were refreshed with it.

## How it works

![The content pipeline. Files in content/blog/ and docs/ are read by lib/mdx.ts (slugs, language from which files exist, frontmatter, derived excerpt, cover and reading time). The route pages generate one static page per language, pick that language's body, and hand it to MDXRenderer, which is MDXRemote with mdxOptions from lib/mdx-processor.ts and mdxComponents. Below, the build-time readers: og:fonts and the badge scan read the files directly; ask:index, og:sizes / og:snapshot and the opengraph-image route go through lib/mdx.ts.](/img/docs/content-system/pipeline.svg)

The top row is one request for a page, done at build time. The bottom row is
everything else that reads the same files: each one is a command (or a route)
with its own output, and the ones on the left skip `lib/mdx.ts`.

1. **Files.** Posts: `content/blog/<slug>.<lang>.mdx`, or a folder
   `content/blog/<slug>/index.<lang>.mdx` (only `upgrading-eleme-to-pwa`
   uses it). `<lang>` is `en` or `zh`. Docs: `docs/<slug>.md`, or
   `docs/<slug>.<lang>.md` / `.mdx` per language.
2. **`lib/mdx.ts`** lists and reads them. `getBlogSlugs()` matches
   `/^(.+)\.(en|zh)\.mdx$/` and folders holding an index file;
   `getBlogPostBySlug()` reads both language files with `gray-matter` and
   returns `BlogPostWithContent`: `language` (`"en" | "zh" | "both"`, from
   which files exist), the merged frontmatter, `content` / `contentZh`, and
   the derived `excerpt`, `cover` and `readingTime` per language.
   `getBlogLangManifest()` is the slug → language map the card pipeline
   uses. `getDocSlugs()` / `getDocBySlug()` / `getAllDocs()` do the same for
   `docs/`.
3. **Route pages.** `app/writing/[slug]/[lang]/page.tsx` generates one page
   per language that exists (`dynamicParams = false`), picks `contentZh` for
   `zh` and `content` otherwise, and sets `generateMetadata` (canonical,
   `hreflang` alternates for a bilingual post, Open Graph from
   `postCardOf`). `app/docs/[...slug]/page.tsx` reads the locale from the
   last segment, strips the first `# ` line (the header prints the title)
   and allows params it did not generate (`dynamicParams = true`).
4. **`MDXRenderer`** (`components/mdx-renderer.tsx`) is `<MDXRemote>` from
   `next-mdx-remote/rsc` with `options={mdxOptions}` and
   `components={mdxComponents}`. Compilation happens on the server, during
   `next build`; an MDX error fails that page's build.
5. **Build-time readers.** `pnpm ask:index` (`lib/ask-corpus.ts`) indexes
   posts, not docs, for Ask, and runs by itself in `predev` and `build`.
   `scripts/og-snapshot.ts` records each post's cover size and the cards
   that point at a post. `pnpm og:fonts` reads post titles and descriptions
   for the CJK glyph subset. `scripts/magic-link-tags.ts` finds every
   `<Badge>` and `<MagicLink>` in `content/` and `docs/`. Which command
   refreshes which file is the skill `content-snapshots`.

The About copy (`content/about/<locale>.mdx`) is MDX too but has its own
`MDXRemote` in `systems/about/components/about-copy.tsx`; see
[system-about.md](./system-about.md).

### Languages

| Files | `language` | Pages |
|---|---|---|
| `slug.en.mdx` | `"en"` | `/writing/slug/en` |
| `slug.zh.mdx` | `"zh"` | `/writing/slug/zh` |
| both | `"both"` | `/writing/slug/en` and `/writing/slug/zh` |

- **Bare URLs.** `middleware.ts` (matcher `/writing/:path+`, `/docs/:path+`)
  sends a path whose last segment is not `en` / `zh` (or a metadata route
  such as `opengraph-image`) to `/{locale cookie}` with a 307, falling back
  to `en`. The cookie is written by `services/locale.tsx`.
  `app/writing/[slug]/page.tsx` redirects to `defaultLocale` as a fallback.
  Neither knows which languages a post has: a bare link to a Chinese-only
  post, for a reader whose cookie is `en` or who has none, lands on
  `/writing/<slug>/en`, a 404 (on hux.pro today, `/writing/hello-2015`).
  Links to a post name its language.
- **Links.** Internal links use `getPostHref(post, locale, basePath)`
  (`lib/content.ts`): the reader's locale for a bilingual post, the post's
  own language otherwise. A hand-written link to a single-language post
  names its language.
- **Reading a bilingual post in the other language.** The header's
  `中文版` / `English` action (`usePostLanguage`,
  `components/post/use-post-language.tsx`) navigates to the other route
  and raises a Dock notice at the top of the screen: "Reading in Chinese ·
  Preference unchanged" (`languageReadingIn`, `languageNote` in
  `lib/i18n.ts`; no note when the new language is the reader's own). See
  [system-dock.md](./system-dock.md#notices).
- **A link shared in the other language.** When a bilingual page's locale
  differs from the reader's (after `hydrated`), `LanguageSharedSheet`
  (`components/post/language-sheet.tsx`) rises from the bottom and asks
  which to read. It is a non-modal sheet, it waits for the About veil, and
  closing it keeps the page as shared. A `sessionStorage` key
  (`language-switch-intentional`) stops it asking again after a deliberate
  switch.
- **Lists.** `/writing` and `/docs` show the reader's language and
  bilingual entries; the `EN` / `中文` vs `All` chips (`LanguageFilter`)
  add the rest, each marked with its language (`shouldShowPost`). On
  `/writing` the choice is `?lang=all`; on `/docs` it is local state.

Per-language routes rather than a `?lang=` query: each language is full
static HTML a crawler can read, an MDX error fails the build instead of
hiding behind Suspense, only one body is rendered per page, and
`hreflang` alternates come from `generateMetadata`.

### Blog frontmatter

| Field | Use | Read from |
|---|---|---|
| `title` | The post's title (falls back to the slug) | `en` file; the `zh` file's is `titleZh` |
| `date` | `"YYYY-MM-DD"`, sorts the lists | `en` file, else `zh` |
| `description` | The dek; the `zh` file's is `descriptionZh` | each file |
| `tags` | Tags; `译` and `知乎` show only in Chinese (`tagLocaleVisibility`) | `en` file, else `zh` |
| `origin` | A provenance line on the article; `[text](url)` links render | each file (`origin` / `originZh`) |
| `featured` | `true` puts it on the home writing widget | either file |
| `coverFit` | `"cover"` (default) or `"natural"` for the peek cover | `en` file, else `zh` |
| `coverAspect` | CSS `aspect-ratio` for a `"cover"` slot, default `16 / 9` | `en` file, else `zh` |

There is no `language` field; one would be ignored. Derived, not written:
`excerpt` (the first paragraph that is prose, `extractLead`), `cover` (the
first `<Figure url>`, `<img src>` or `![](…)` in the body) and
`readingTime` ("4 min" / "4 分钟"). The verbatim frontmatter of each file
goes to the devtool inspector.

### Docs

Docs carry no frontmatter that is read. `getDocBySlug` takes the title
from the first `# ` heading and the description (the `/docs` list, the
page's meta description) from the first non-empty line after it that is not
a heading, cut at 200 characters. It is one *line*, not a paragraph, so the
line after the H1 is written unwrapped.

Which file a slug reads:

| On disk | Read |
|---|---|
| `slug.en.mdx` and `slug.en.md` | `slug.en.mdx` (per language, `.mdx` wins) |
| `slug.en.md(x)` and `slug.md` | the suffixed file; `slug.md` is read only when no suffixed file exists |
| `slug.md` and `slug.mdx` | `slug.md`. An unsuffixed `.mdx` is never read |
| `slug.mdx` alone | nothing: listed by `getDocSlugs`, but `getDocBySlug` returns `null` and `/docs/slug/en` is a 404 |

So: one file per slug per language. `docs/navigation.md` and
`docs/navigation.mdx` both mapped to `navigation` and the `.mdx` never
rendered (PR #472).

Docs are listed under `/docs` sorted by title, and render in the same
`PostContent` as a post (`app/docs/[...slug]/content.tsx`).

### MDX components and images

`components/mdx-components.tsx` maps elements to components and adds the
custom ones. It holds no visual styling: prose typography lives in
`app/globals.css` under `.prose-article`, and an embed is wrapped in
`.not-prose` (`withNotProse`) to escape it.

| In the MDX | Rendered by |
|---|---|
| `![alt](src)` | `MdxImage` (`components/mdx-image.tsx`) |
| fenced code | `CodeBlock`: language badge, copy button |
| `[text](href)` | `ServerProseLink`: a link to something the site knows peeks as it; `http…` opens in a new tab |
| `#` `##` `###` | `HeadingWithLink` (copyable anchors) |
| table | `.prose-table-wrapper` (scrolls sideways) |
| `<Figure>` `<Media>` `<Video>` `<SocialEmbed>` `<Link>` `<LinkCard>` `<MediaRenderer>` | `components/log` |
| `<Badge>` `<MagicLink>` | `components/magic-link` ([system-about.md](./system-about.md)) |
| `<PLChart>` `<LanguageNotes>` | `components/languages` (the PL chart post) |
| `<Commit>` `<HStackWidget>` `<VStackWidget>` `<Widget…>` `<Playground>` | as named |

**Bleed.** `MdxImage` reads a local image's size from `public/` at build
time and lets it break out of the 680px column when it is at least 1024px
wide and at least 1.3 times as wide as tall (`shouldBleedImage`,
`lib/image-meta.ts`). A fragment overrides it: `![](/img/x.png#bleed)`,
`#no-bleed` (or `#nobleed`). The CSS applies from 900px
(`--breakpoint-bleed`) at `min(60rem, 100vw - 14rem)`. Only markdown
images go through `MdxImage`: a JSX `<img>` in MDX is a plain element, with
no bleed and no fragment parsing.

**Code.** `rehype-pretty-code` with Shiki, themes `one-light` /
`one-dark-pro`, `defaultLang: "plaintext"`. ` ```js {1,3-5} ` adds
`line--highlighted`, ` ```js /word/ ` adds `word--highlighted`.

**Plugins** (`lib/mdx-processor.ts`): `remark-gfm` (tables,
strikethrough, task lists, bare-URL autolinks) and `remark-math`. There is
no KaTeX: `$…$` becomes `<code class="language-math math-inline">` and
`$$` blocks a `math-display` code block, shown as code.
`blockJS: false` keeps JSX attribute expressions (`commit={{…}}`,
`defaultExpanded={true}`): next-mdx-remote v6 strips them by default, and
the components then get `undefined`. All MDX here is first-party.

## Rules

| Rule | Why | What breaks |
|---|---|---|
| A post's file is `<slug>.en.mdx` / `<slug>.zh.mdx` (or `<slug>/index.<lang>.mdx`), the same slug for both languages | The language and the pairing come from the name | Any other name is silently skipped: no page, no error. `validateBlogContent()` would catch it but nothing calls it |
| A doc is one file per slug per language; an unsuffixed doc is `.md` | `getDocBySlug` reads only `<slug>.md` unsuffixed, and `.mdx` over `.md` per language | The other file never renders (`navigation.mdx`), or the doc 404s |
| The line after a doc's `#` title is one unwrapped sentence that says what the page is | It is the doc's description on `/docs` and in its meta tags | A description cut mid-sentence, or one that reads "> The checklist…" |
| No bare `<` before a letter or `/`, no bare `{`, in prose; put them in backticks or a code fence | MDX reads `<x` as a tag and `{` as a JS expression | `Expected a closing tag`, `Could not parse expression with acorn`: the page fails to build. `a < b` with spaces is fine |
| `<https://…>` autolinks and `<!-- -->` comments are not MDX | Same parser | Compile error. Write `[text](url)` and `{/* note */}` |
| A pair of `$` in a paragraph is math | `remark-math` | "costs $5 and $10" renders `5 and ` as code |
| JSX attributes are JavaScript: `style={{ display: "flex" }}`, `width={2}`, `className` | It is JSX, not HTML | `style="display: flex"` compiles but React throws on a string style |
| Images live in `public/` and are referenced by absolute path: posts under `/img/in-post/<post>/` (headers `/img/post-bg-*.jpg`), docs under `/img/docs/<slug>/` | Nothing in `content/` or `docs/` is served, and a relative path resolves against `/docs/<slug>/<lang>` | 404 images; no bleed (the size is read from `public/`) |
| A post whose body has an image runs `pnpm og:sizes` | Its first image is its cover, and `og:complete` checks every cover's size | CI fails: "cover size not recorded" |
| Internal links to a post go through `getPostHref`, or name the post's own language | A single-language post has only that page | A 404 for the other language |

## Free choices

- File or folder for a post. The folder form only groups the language
  files; its images still go in `public/`.
- Translating a post or a doc. Single-language is a full citizen.
- Overriding the bleed with `#bleed` / `#no-bleed`.
- Side-by-side images in a doc: a flex `<div>` of JSX `<img>`s with
  `style={{ width: "calc(50% - 0.5rem)", margin: 0 }}`
  (`docs/keyboard-input.md` has one).

## Recipes

**A new post.** Write `content/blog/<slug>.<lang>.mdx` (and the other
language with the same slug) with `title`, `date`, `description`, `tags`.
Put its images in `public/img/in-post/<slug>/`. Run `pnpm og:sizes` if it
has an image, `pnpm og:fonts` if a Chinese title or description brings new
glyphs, `pnpm badges:snapshot` for a `<Badge>` to a new site. Open
`/writing/<slug>/<lang>` for each language.

**A new doc.** Write `docs/<slug>.md`: `# Title`, then the one-line
description, then the page. Images in `public/img/docs/<slug>/`,
referenced as `/img/docs/<slug>/<name>.png`. Add it to the index in
`AGENT.md`. Open `/docs/<slug>/en`, or compile it alone with `@mdx-js/mdx`
`compile` and `remark-gfm` + `remark-math`.

## Key files

| File | Purpose |
|---|---|
| `lib/mdx.ts` | Slugs, language pairs, frontmatter, derived fields, docs |
| `lib/content.ts` | `BlogPost` / `Doc` types, `getPostHref`, `shouldShowPost`, `postCardOf` |
| `lib/mdx-processor.ts` | `mdxOptions`: plugins, Shiki, `blockJS: false` |
| `components/mdx-renderer.tsx` | `MDXRenderer`, the one place posts and docs compile |
| `components/mdx-components.tsx` | `mdxComponents` |
| `components/mdx-image.tsx`, `lib/image-meta.ts` | `MdxImage`, the bleed heuristic and fragments |
| `app/writing/[slug]/[lang]/page.tsx` | Per-language post pages, metadata |
| `app/writing/[slug]/page.tsx` | Bare post URL fallback redirect |
| `app/docs/[...slug]/page.tsx` | Doc pages, locale from the last segment |
| `middleware.ts` | Bare URL → `/{locale cookie}` (307) |
| `components/post/use-post-language.tsx`, `language-sheet.tsx` | The language switch notice and the shared-link sheet |

## Why not Fumadocs

A custom stack on `next-mdx-remote` and standard remark / rehype plugins
keeps every component ours and the upgrade path short; versioned docs and
API reference generation are not needed. Reconsider if `/docs` grows past
about 50 pages or needs versions.
