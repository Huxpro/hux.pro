# Deployment

The first migration stage serves the site from Cloudflare Pages and keeps
Vercel AI Gateway as the model and transcription provider. The browser still
uses same-origin `/api/chat` and `/api/voice`; a Pages Function streams those requests to `https://hux-pro.vercel.app`,
where their existing handlers continue running. No model credential enters the browser bundle.

## Build and preview

Use Node 22.18 or later and the pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm pages:test
pnpm pages:build
pnpm pages:dev
```

`pages:build` builds the Vitre demo and Ask index, then exports Next.js in
`.pages-build/`. The source `app/` is never moved or rewritten. The isolated
export omits API routes and middleware, freezes the two development editors
at build time, and explicitly prerenders metadata routes. `out/` contains
the pages, RSC payloads, public assets, and an advanced-mode `_worker.js`.
`_routes.json` limits Function execution to dynamic routing and AI endpoints;
the homepage and ordinary static resources go directly to the Pages CDN.

The Function preserves locale-cookie redirects, Jekyll links, lab aliases,
Vitre's device-specific entry, and the Works query's social card. Local image
URLs use the original assets instead of the Next image optimizer. Open Graph
images are generated at build time and served as PNGs. Unknown API routes,
including the development editors, return 404.

The AI prompt and model credentials remain in the Vercel deployment. The original
`pnpm build` and `pnpm dev` remain available for Vercel rollback and local
content editing.

## Cloudflare project

- Account: Huxpro's personal Cloudflare account (`ba429bdc34621849184882661f1f9e4c`).
- Project: `hux-pro`.
- Git repository: `Huxpro/hux.pro`, production branch `main`.
- Build command: `pnpm pages:build`; output directory: `out`.
- Build environment: `NODE_VERSION=22`.
- Runtime: standard Web APIs; compatibility date pinned in `wrangler.jsonc`.
- `AI_API_ORIGIN=https://hux-pro.vercel.app` (a non-secret runtime variable).

The project can use Git integration for deployments after merge. Keep
production automatic builds disabled until this migration is on `main`.
For a manual preview, build first, then run:

```sh
CLOUDFLARE_ACCOUNT_ID=ba429bdc34621849184882661f1f9e4c \
  pnpm exec wrangler pages deploy out --branch codex/cloudflare-migration
```

CI builds and tests the Pages artifact without credentials or deployment.

## AI API and Gateway remain on Vercel

The Pages Function forwards only `/api/chat` (POST) and `/api/voice`
(GET and POST) to the stable Vercel production domain in `AI_API_ORIGIN`.
Never point that origin to `hux.pro`: after cutover it would recurse into
Pages. Keep the Vercel project's Git integration and production deployment
active so its API code and content continue to update on merge.

Request bodies and response streams pass through without buffering. The
proxy forwards content type, accepted format and voice model headers, but
not site cookies or visitor authorization. It preserves AI SDK stream
headers and upstream error statuses and disables caching. Unexpected
redirects or connection failures return 502. Unknown APIs return 404.

Vercel's existing OIDC authentication to AI Gateway remains in place.
There are no new API keys or Cloudflare secrets in this stage. The browser
keeps using same-origin endpoints; it does not require CORS changes.

## Cutover and rollback

Before moving the domain, verify a preview's homepage, client navigation,
localized writing and docs, OG PNGs, `/works?type=talk`, desktop/mobile Vitre,
a real streamed Ask response and voice transcription. Then deploy the tested
revision to production, add `hux.pro` in Pages custom domains, and change only
the site's existing DNS record to the Pages target. Preserve unrelated DNS
records and the Vercel project during the migration.

Record the original DNS target before changing it. Roll back by restoring
that record to Vercel; the ordinary Next build and original API routes remain
supported. Do not remove the Vercel API deployment or AI Gateway during hosting
cutover. A later migration can change the AI provider separately.

References: [Next.js static export on Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/),
[Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/),
[Vercel AI Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok).

The pre-migration apex DNS record is a DNS-only CNAME from `hux.pro` to
`5a671bd9a2e0f4c2.vercel-dns-017.com`, with automatic TTL. This is the rollback
target. `www.hux.pro` currently uses the same target and Vercel redirects it
to `https://hux.pro/`; it can remain in place for this stage. Other subdomains
are independent and must not be changed.
