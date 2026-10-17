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
  resolve: {
    alias: [
      { find: /^scene$/, replacement: here("../packages/scene/src/index.ts") },
      { find: /^reintent$/, replacement: here("../packages/reintent/src/reintent.js") },
      { find: /^intents$/, replacement: here("../packages/intents/src/index.ts") },
      // Reintent core, and its subpaths (the JSX runtime a program in TSX imports, the React binding).
      { find: /^reintent-core$/, replacement: here("../packages/reintent-core/src/core/index.ts") },
      { find: /^reintent-core\/(jsx-runtime|jsx-dev-runtime)$/, replacement: here("../packages/reintent-core/src/core/$1.ts") },
      { find: /^reintent-core\/lib\/(.*)$/, replacement: here("../packages/reintent-core/src/lib/$1.ts") },
    ],
  },
  build: {
    outDir: here("../public/scenes"),
    emptyOutDir: true,
    assetsDir: "_scene",
    rollupOptions: { input: Object.fromEntries(scenes().map((name) => [name, here(`${name}/index.html`)])) },
  },
});
