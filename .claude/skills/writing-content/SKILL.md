---
name: writing-content
description: Adding or editing a blog post (content/blog/*.mdx, at /writing) or a doc (docs/*.md, at /docs) on hux.pro - file names and language pairing, frontmatter, image paths, the MDX that fails the build, and which snapshot commands a post needs. Use before creating or renaming a post or doc, adding images to one, or when a post or doc 404s or fails to compile.
---

# Writing a post or a doc

**Names carry the language.** A post is `content/blog/<slug>.en.mdx` and/or
`<slug>.zh.mdx`, same slug (or `<slug>/index.<lang>.mdx`). There is no
`language` frontmatter field. Any other name is skipped without an error.
A doc is `docs/<slug>.md` in English; its Chinese version is
`docs/<slug>.zh.md` beside it (keep the plain `.md`, don't rename it
`.en.md`). An unsuffixed `.mdx` is never read.

**Post frontmatter:** `title`, `date` (`"YYYY-MM-DD"`), `description`,
`tags`; optional `origin` (provenance), `featured: true`, `coverFit`,
`coverAspect`. The cover is the first image in the body; the excerpt is the
first paragraph.

**Docs:** the title is the first `# ` line; the `/docs` description is the
first prose paragraph after it (blockquotes, images, JSX are skipped), so
make it say what the page is. Optional frontmatter: `skills: [name]` closes
the page with a footnote linking each skill and tags the `/docs` row
`skill` (don't write `tags`, and don't point at the skill under the H1);
`origin` is provenance. A `.zh.md` carries
`origin: "AI-translated from the original"` and no `skills`. Its same-page
links (`#…`) use the translated heading's id, as `lib/heading-id.ts` makes
it (`## 原理` is `#原理`). A link to another doc is `./other.md#anchor`
(it works on GitHub; `lib/doc-links.ts` points it at `/docs/other/<lang>`).

**Images** go in `public/` with absolute paths: `/img/in-post/<slug>/…` for
posts, `/img/docs/<slug>/…` for docs. Markdown images bleed on their own
when wide; `#bleed` / `#no-bleed` overrides.

**MDX** (docs too): no bare `<` before a letter or `/`, no bare `{`, no
`<https://…>`, no `<!-- -->` (use `{/* */}`); a pair of `$` becomes math.
JSX attributes are JS: `style={{ display: "flex" }}`. Check a file alone
with `@mdx-js/mdx` `compile` + `remark-gfm` + `remark-math`, or open it.

**Snapshots** (table in `.claude/skills/content-snapshots`): a post with an
image needs `pnpm og:sizes`, or CI `og:complete` fails; a Chinese title with
new glyphs `pnpm og:fonts`; a `<Badge>` to a new site `pnpm badges:snapshot`;
editing a post a card points at `pnpm og:snapshot`. `ask:index` runs itself.

**Links** to a post name its language (`getPostHref`): a Chinese-only post
has no `/en` page. A new doc gets a row in `AGENT.md`'s index.

More: `docs/content-system.md`.
