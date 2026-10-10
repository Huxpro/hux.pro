import type { NextConfig } from "next";
import { jekyllRedirects } from "./lib/jekyll-redirects";
import { WORKS_READINGS } from "./lib/works-readings";

// `talk|project`: the readings of /works with a page of their own.
const READING = WORKS_READINGS.join("|");

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // resvg is a native module used only by the icon generator (the dev save
  // route imports it dynamically). Keep it out of the bundle. TypeScript's
  // parser, likewise, only for /api/scene's dev-only write-back.
  serverExternalPackages: ["@resvg/resvg-js", "typescript"],
  // Ask's system prompt reads the About off disk at request time
  // (lib/ask-prompt.ts); ship it with the function.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/about/**"],
  },
  // /api/scene answers 403 in production before it would load the parser.
  outputFileTracingExcludes: {
    "/api/scene": ["./node_modules/typescript/**", "./node_modules/.pnpm/typescript@*/**"],
  },
  // The vitre demo, built by Vite into public/vitre at build time (see the
  // "build" script; `pnpm dev` builds it when stale). Only its entry needs a
  // rewrite; its assets are plain public files.
  async rewrites() {
    return {
      // A reading of /works with a card of its own (`/works?type=talk`,
      // lib/works-readings.ts) is served by its page, so a crawler reads that
      // reading's Open Graph. Before the filesystem, or the plain /works page
      // would answer first. The address keeps its query, which the view
      // reads; the view is the section's layout, so it is the same either way.
      beforeFiles: [
        {
          source: "/works",
          has: [{ type: "query", key: "type", value: `(?<type>${READING})` }],
          destination: "/works/:type",
        },
      ],
      afterFiles: [
        { source: "/vitre", destination: "/vitre/index.html" },
        { source: "/vitre/", destination: "/vitre/index.html" },
      ],
      fallback: [],
    };
  },
  async redirects() {
    return [
      ...jekyllRedirects,
      // A reading's page is reached through its query (see rewrites); the
      // page itself is not an address.
      { source: `/works/:type(${READING})`, destination: "/works?type=:type", permanent: false },
      // The site's address before the package was named vitre.
      { source: "/bezel", destination: "/vitre", permanent: true },
      { source: "/bezel/:path*", destination: "/vitre/:path*", permanent: true },
      // /vitre is the package's short address. A phone gets the demo there,
      // full screen; anything else gets its documentation, the Vitre Lab
      // (the hash rides along). Temporary: which one depends on the device.
      // This is the one place that decides. /vitre/index.html is never
      // redirected: the simulator frames it, and the lab's Demo links point
      // at it, so any screen can still open the demo itself.
      ...["/vitre", "/vitre/"].map((source) => ({
        source,
        missing: [{ type: "header" as const, key: "user-agent", value: ".*(iPhone|iPod|Android|Mobile).*" }],
        destination: "/lab/vitre",
        permanent: false,
      })),
      // The labs' address before they were labs (systems/lab/catalog.ts). The
      // log editor is the Works Lab now; the theater chrome gallery is gone,
      // so its address lands on the index. Specific rules first.
      { source: "/editor", destination: "/lab/works", permanent: true },
      { source: "/editor/theater-variants", destination: "/lab", permanent: true },
      { source: "/editor/:path*", destination: "/lab/:path*", permanent: true },
      // Catch-all fallback: unmigrated posts → GitHub Pages archive
      // (huangxuan.me now 302s to hux.pro, which 404s these Jekyll paths)
      {
        source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:slug",
        destination: "https://huxpro.github.io/:year/:month/:day/:slug/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
