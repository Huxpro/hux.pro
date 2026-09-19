import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { bezelBootScript } from "../src/boot";
import { bootResolver } from "./src/defaults";

// The vitre demo and documentation site. It imports the package the way a
// consumer does, as "vitre", and nothing from the site it lives next to.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/vitre/",
  resolve: {
    alias: { "vitre": fileURLToPath(new URL("../src/index.ts", import.meta.url)) },
  },
  plugins: [
    {
      name: "bezel-boot",
      // Inline the boot script so the first frame is right before any module loads.
      transformIndexHtml: (html) =>
        html.replace("<!-- bezel-boot -->", `<script>${bezelBootScript(bootResolver())}</script>`),
    },
  ],
  build: { outDir: "dist", emptyOutDir: true },
});
