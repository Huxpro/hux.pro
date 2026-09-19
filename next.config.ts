import type { NextConfig } from "next";
import { jekyllRedirects } from "./lib/jekyll-redirects";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // resvg is a native module used only by the icon generator (the dev save
  // route imports it dynamically). Keep it out of the bundle.
  serverExternalPackages: ["@resvg/resvg-js"],
  // The vitre demo and docs site, built by Vite into public/vitre at
  // build time (see the "build" script). Only its entry needs a rewrite; its
  // assets are plain public files.
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
