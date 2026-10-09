---
name: content-snapshots
description: The generated files hux.pro commits, and the command that refreshes each. Use after editing content/log.json, a blog post, a <Badge> or link to a new site, content/apps.json, content/icon.json, or an image under public/ that a card shows - and before pushing, since CI checks only some of them.
---

# Content snapshots

Link previews, icons and sizes are crawled or rendered ahead of time and
committed, so the build never touches the network. Change the source, run
its command, review the diff, commit both.

| Changed | Run | Commit |
|---|---|---|
| A link card or a commit's inline link in `content/log.json`, a `<MagicLink href>` or `<Badge href>` to a new page, or a post a card points at | `pnpm og:snapshot` | `content/og-snapshot.json`, `content/image-sizes.json` |
| A manual `preview.image`, or a file in `public/` a card shows | `pnpm og:sizes` | `content/image-sizes.json` |
| A Chinese title with new glyphs | `pnpm og:fonts` | `lib/og-fonts/` |
| A `<Badge>` to a new site | `pnpm badges:snapshot` | `content/badge-icons.json`, `public/badge-icons/` |
| `content/apps.json` | `pnpm apps:snapshot` | `public/app-icons/`, `content/app-icons.json` |
| `content/icon.json` | `pnpm icon:generate` | `public/icons/*`, `app/favicon.ico` |

- A site that can't be crawled gets a manual `preview` (title and image)
  on its media item. Our own posts never do: their cards are computed;
  edit the post.
- `pnpm og:complete` checks log.json covers, our posts' cards and cover
  sizes; it does not notice a magic link's page missing from the snapshot.
- CI runs only `pnpm og:complete` and `pnpm badges:check`. Run
  `pnpm apps:check`, `pnpm icon:check` and `pnpm wallpapers:profile:check`
  yourself.
- `public/ask/index.json` is generated (`pnpm ask:index`) and ignored. Never
  commit it.

More: `docs/og-previews.md`, `docs/og-images.md`, `docs/app-shelf.md`,
`docs/app-icon.md`, `docs/system-about.md` (badges).
