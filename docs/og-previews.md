# Link Previews (Open Graph) System

How `/works` renders the preview cards for non-native embeds (web.dev, Medium, …).

## Resolution order

For each embed that renders as a card, the preview data is resolved highest-priority first:

1. **Manual `preview`** in `content/log.json` — author-curated, authoritative.
2. **Build-time snapshot** `content/og-snapshot.json` — crawled OG metadata.
3. **Live crawl** (Server Action `fetchOGData`) — runtime fallback for links not yet snapshotted.

`(1)` and `(2)` are baked into the data **server-side** (`enrichLogDataWithPreviews` in `app/works/page.tsx`), so cards paint immediately with no request-time crawl and no skeleton flash. `(3)` only runs for a brand-new embed you haven't snapshotted yet — so dev still "just works".

## Why a snapshot

Crawling at request time depends on the third-party site being reachable **and** crawlable from the server's IP. Some sites (Medium) return `403` to server-side requests regardless of User-Agent, so the live crawl is unreliable. The snapshot moves the crawl to build time and commits the result, removing the runtime dependency (and advancing the "static-export compatible" goal — no per-request server action for previews).

## Workflow

```bash
pnpm og:snapshot   # crawl embeds in log.json → write content/og-snapshot.json
pnpm og:complete   # CI: no network; every cover-bearing attachment has an image
pnpm og:check      # completeness, then re-crawl and fail on snapshot drift
```

Run `og:snapshot` whenever you add/change an embed, review the diff, and commit. The artifact is **deterministic** (sorted keys, no timestamps) so it only changes when content changes — no flaky churn. A failed crawl never overwrites a good prior entry. A crawl that returns a title but no image is treated as unusable — recover with a manual `preview.image`.

### When a site can't be crawled

If an embed can't be crawled **and** has no manual `preview`, `og:snapshot` fails loudly and tells you which URL. Recover by adding a manual preview to that media item in `log.json`:

```jsonc
{
  "type": "embed",
  "url": "https://medium.com/…",
  "preview": {
    "title": "…",
    "description": "…",
    "image": "https://…"   // loaded client-side by the browser, not crawled
  }
}
```

Manual previews are skipped by the crawler (you've taken ownership), so they never appear as drift or as a flaky failure.

## Framing policy

The crawl also reads each page's `X-Frame-Options` and `Content-Security-
Policy: frame-ancestors`, the headers the browser will honour when the window
system puts the page in an iframe (the desktop's in-app browser — see
[system-attachments.md](./system-attachments.md)). A page that refuses is
stored as `frame: "deny"` on its entry; a page that may be framed stores
nothing, so the field reads as the exception it is. Only an explicit refusal
is trusted from a failed fetch: a bot wall that says nothing about framing is
not read as permission. Cards with a manual `preview` still get a
headers-only look, so Medium's `SAMEORIGIN` lands even though its OG data
never will. Enrichment carries the answer to `preview.frame`; a page the
crawl cannot reach can be told by hand with `preview: { frame: "deny" }`.

## Completeness (runtime images)

GitHub CI runs `pnpm og:complete`. It loads `log.json`, enriches it the same way `/works` does, and fails if any media attachment that paints a cover has no image at runtime:

- **Link cards** — `preview.image` after snapshot + manual merge, including each locale URL in a `urls` map.
- **Videos** — authored `thumbnail`, snapshot cover (Bilibili / Vimeo), or YouTube's derived poster.
- **Slides / images** — authored `thumbnail` / `url`; a site-local `/img/…` path must exist under `public/`.
- **Pills** are not attachments. **Social widgets** paint themselves and are skipped.

This check does not crawl. A missing cover is a content bug (add a manual `preview` / `thumbnail`, or regenerate the snapshot), not a flaky third-party outage.

## Drift / stale detection (stale-while-revalidate)

- **CI (completeness):** `pnpm og:complete` — see above. Wired in `.github/workflows/ci.yml`.
- **Optional live drift:** `pnpm og:check` re-crawls and fails if the committed snapshot differs from live — your signal to regenerate ("invalidate the cache"). Completeness runs first so a blank cover fails before the network work.
- **Dev (opt-in):** set `NEXT_PUBLIC_OG_REVALIDATE=1` to have cards revalidate against the live crawl after painting and `console.warn` when the snapshot looks stale. Off by default to keep dev fast and non-flaky.

## Scope

Only **non-native embeds** are snapshotted — those are the items that render OG cards on the timeline. Plain `link` media are compact corner indicators (icon + label), not cards, so they're never crawled. Native embeds (X, Instagram, TikTok) use their own widgets.

## Files

| File | Role |
|------|------|
| `lib/og-core.ts` | Framework-agnostic crawl + parse + classification. Shared by the action and the script. |
| `lib/og.ts` | `"use server"` wrapper — the live/fallback path. |
| `lib/og-snapshot.ts` | Loads the snapshot; `enrichLogDataWithPreviews` bakes previews into log data. |
| `scripts/og-snapshot.ts` | `pnpm og:snapshot` / `og:complete` / `og:check`. |
| `content/og-snapshot.json` | Committed artifact. |
