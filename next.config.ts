import type { NextConfig } from "next";
import { jekyllRedirects } from "./lib/jekyll-redirects";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  // Empty turbopack config silences Next 16's webpack+turbo conflict warning
  // while we still keep a webpack DefinePlugin for `next build` / `--webpack`.
  turbopack: {},
  // go-web ships TypeScript + SCSS source; transpile with the app bundler.
  transpilePackages: [
    "@lynx-js/go-web",
    "@lynx-js/web-core",
    "@douyinfe/semi-ui",
    "@douyinfe/semi-icons",
  ],
  // resvg is a native module used only by the icon generator (the dev save
  // route imports it dynamically). Keep it out of the bundle.
  serverExternalPackages: ["@resvg/resvg-js"],
  webpack: (config, { webpack }) => {
    // go-web checks `import.meta.env.SSG_MD` (Vite-style). Provide a stub.
    config.plugins.push(
      new webpack.DefinePlugin({
        "import.meta.env.SSG_MD": "undefined",
      }),
    );
    // @lynx-js/web-core wasm loader uses top-level await.
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };
    return config;
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
