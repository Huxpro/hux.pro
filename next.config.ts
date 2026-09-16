import type { NextConfig } from "next";
import { jekyllRedirects } from "./lib/jekyll-redirects";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // resvg is a native module used only by the icon generator (the dev save
  // route imports it dynamically). Keep it out of the bundle.
  serverExternalPackages: ["@resvg/resvg-js"],
  async redirects() {
    return [
      ...jekyllRedirects,
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
