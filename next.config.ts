import type { NextConfig } from "next";
import { jekyllRedirects } from "./lib/jekyll-redirects";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // resvg is a native module used only by the icon generator (the dev save
  // route imports it dynamically). Keep it out of the bundle.
  serverExternalPackages: ["@resvg/resvg-js"],
  // The vitre demo, built by Vite into public/vitre at build time (see the
  // "build" script; `pnpm dev` builds it when stale). Only its entry needs a
  // rewrite; its assets are plain public files.
  async rewrites() {
    return [
      { source: "/vitre", destination: "/vitre/index.html" },
      { source: "/vitre/", destination: "/vitre/index.html" },
    ];
  },
  async redirects() {
    return [
      ...jekyllRedirects,
      // The site's address before the package was named vitre.
      { source: "/bezel", destination: "/vitre", permanent: true },
      { source: "/bezel/:path*", destination: "/vitre/:path*", permanent: true },
      // /vitre is the package's short address. A phone gets the demo there,
      // full screen; anything else gets its documentation, the Vitre Lab
      // (the hash rides along). Temporary: which one depends on the device.
      // /vitre/index.html is never redirected — the simulator frames it, and
      // the lab's "open the demo" link points at it, so a narrow window on a
      // desk still reaches the demo (whose own check sends wide ones back).
      ...["/vitre", "/vitre/"].map((source) => ({
        source,
        missing: [{ type: "header" as const, key: "user-agent", value: ".*(iPhone|iPod|Android|Mobile).*" }],
        destination: "/lab/vitre",
        permanent: false,
      })),
      // The labs' address before they were labs (app/lab/catalog.ts). The
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
