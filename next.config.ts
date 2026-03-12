import type { NextConfig } from "next";
import { jekyllRedirects } from "./lib/jekyll-redirects";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  async redirects() {
    return [
      ...jekyllRedirects,
      // Catch-all fallback: unmigrated posts → old site
      {
        source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:slug",
        destination: "https://huangxuan.me/:year/:month/:day/:slug/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
