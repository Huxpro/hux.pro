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
pnpm og:check      # CI: re-crawl, diff vs committed snapshot, exit 1 on drift
```

Run `og:snapshot` whenever you add/change an embed, review the diff, and commit. The artifact is **deterministic** (sorted keys, no timestamps) so it only changes when content changes — no flaky churn. A failed crawl never overwrites a good prior entry.

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

## Drift / stale detection (stale-while-revalidate)

- **Primary:** `pnpm og:check` in CI re-crawls and fails if the committed snapshot differs from live — your signal to regenerate ("invalidate the cache").
- **Dev (opt-in):** set `NEXT_PUBLIC_OG_REVALIDATE=1` to have cards revalidate against the live crawl after painting and `console.warn` when the snapshot looks stale. Off by default to keep dev fast and non-flaky.

## Scope

Only **non-native embeds** are snapshotted — those are the items that render OG cards on the timeline. Plain `link` media are compact corner indicators (icon + label), not cards, so they're never crawled. Native embeds (X, Instagram, TikTok) use their own widgets.

## Files

| File | Role |
|------|------|
| `lib/og-core.ts` | Framework-agnostic crawl + parse + classification. Shared by the action and the script. |
| `lib/og.ts` | `"use server"` wrapper — the live/fallback path. |
| `lib/og-snapshot.ts` | Loads the snapshot; `enrichLogDataWithPreviews` bakes previews into log data. |
| `scripts/og-snapshot.ts` | `pnpm og:snapshot` / `og:check`. |
| `content/og-snapshot.json` | Committed artifact. |
