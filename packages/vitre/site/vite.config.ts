import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { vitreBootScript } from "../src/boot";
import { bootResolver } from "./src/defaults";

// The Vitre demo and documentation site. It imports the package the way a
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
        html.replace("<!-- bezel-boot -->", `<script>${vitreBootScript(bootResolver())}</script>`),
    },
  ],
  // Straight into hux.pro's public folder, which serves it at /vitre.
  build: { outDir: fileURLToPath(new URL("../../../public/vitre", import.meta.url)), emptyOutDir: true },
});
