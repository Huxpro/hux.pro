import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The experiences: short scenes built on packages/scene, each one page, built
// into public/dreams/<name>/ (gitignored) and served at /dreams/<name>/. The
// home folder opens them as apps (content/apps.json); their labs frame them.
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("."),
  base: "/dreams/",
  resolve: { alias: { scene: here("../packages/scene/src/index.ts") } },
  build: {
    outDir: here("../public/dreams"),
    // The folder also holds hand-written dreams; only ours are replaced.
    emptyOutDir: false,
    assetsDir: "_scene",
    rollupOptions: { input: { wardrobe: here("wardrobe/index.html") } },
  },
});
