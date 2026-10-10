import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { scenes } from "./scenes.mjs";

// The experiences: short scenes built on packages/scene, each one page, built
// into public/scenes/<name>/ (gitignored) and served at /scenes/<name>/. The
// home folder opens them as apps (content/apps.json); their labs frame them.
// Every folder here with an index.html is one (scenes.mjs); `pnpm scene:new`
// makes a new one.
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("."),
  base: "/scenes/",
  resolve: { alias: { scene: here("../packages/scene/src/index.ts") } },
  build: {
    outDir: here("../public/scenes"),
    emptyOutDir: true,
    assetsDir: "_scene",
    rollupOptions: { input: Object.fromEntries(scenes().map((name) => [name, here(`${name}/index.html`)])) },
  },
});
