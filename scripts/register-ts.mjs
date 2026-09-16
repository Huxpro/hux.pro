// Lets plain Node run the repo's TypeScript scripts the way Next resolves the
// modules they import: an extensionless "./scene" is "./scene.ts", "@/x" is
// the repo root, and a ".json" import needs no attribute (Next infers it; Node
// insists on `with { type: "json" }`, so the loader supplies it). Type
// stripping itself is Node's own (22.18+). Use as
// `node --import ./scripts/register-ts.mjs scripts/<script>.ts`.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  `data:text/javascript,${encodeURIComponent(`
    import { existsSync } from "node:fs";
    import { fileURLToPath, pathToFileURL } from "node:url";
    const ROOT = ${JSON.stringify(pathToFileURL(process.cwd() + "/").href)};
    export async function resolve(specifier, context, next) {
      let s = specifier;
      if (s.startsWith("@/")) s = new URL(s.slice(2), ROOT).href;
      if (/^(\\.{1,2}\\/|file:)/.test(s) && !/\\.[a-z]+$/i.test(s)) {
        const base = s.startsWith("file:") ? s : new URL(s, context.parentURL).href;
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(fileURLToPath(base + ext))) return next(base + ext, context);
        }
      }
      const resolved = await next(s, context);
      if (/\\.json$/i.test(resolved.url) && !context.importAttributes?.type) {
        return { ...resolved, importAttributes: { type: "json" } };
      }
      return resolved;
    }
  `)}`,
  pathToFileURL("./"),
);
