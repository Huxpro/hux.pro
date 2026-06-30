import type { MetadataRoute } from "next";

/**
 * Web App Manifest — what lets Android / Chrome (and other PWA-capable
 * browsers) install the site to the home screen with the generated icon.
 *
 * Next serves this at `/manifest.webmanifest` and auto-adds the
 * `<link rel="manifest">`. The PNG icons are the committed, rasterized outputs
 * of `pnpm icon:generate`. The 512 is marked `maskable` too: the icon is a
 * full-bleed background with a centered mark, so it survives platform masking.
 *
 * iOS does not read the manifest for home-screen icons — that path is the
 * `apple-touch-icon` PNG wired in `app/layout.tsx`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hux.Pro",
    short_name: "Hux",
    description: "Prose, Profession, Programming, Production, Projects",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1a1a",
    theme_color: "#1a1a1a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
