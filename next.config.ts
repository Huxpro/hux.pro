import type { NextConfig } from "next";
import path from "node:path";
import { jekyllRedirects } from "./lib/jekyll-redirects";

const lynxShadowCss = path.join(
  process.cwd(),
  "systems/lynx-apps/lib/lynx-shadow.bundle.css",
);

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

    // @lynx-js/web-core does `import css from '…/in_shadow.css?inline'` (Vite).
    // Webpack turns `?inline` into a content-hash stub, so Lynx's shadow root
    // never gets web-elements layout CSS (flex-direction etc.). Replace with
    // a pre-flattened bundle and emit it as a raw string module — must win
    // against Next's CSS `oneOf` chain.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /in_shadow\.css(?:\?inline)?$/,
        lynxShadowCss,
      ),
    );
    const oneOfRule = config.module.rules.find(
      (rule: unknown): rule is { oneOf: unknown[] } =>
        typeof rule === "object" &&
        rule !== null &&
        Array.isArray((rule as { oneOf?: unknown }).oneOf),
    );
    if (oneOfRule) {
      oneOfRule.oneOf.unshift({
        test: /lynx-shadow\.bundle\.css$/,
        type: "asset/source",
      });
    } else {
      config.module.rules.unshift({
        test: /lynx-shadow\.bundle\.css$/,
        type: "asset/source",
      });
    }

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
