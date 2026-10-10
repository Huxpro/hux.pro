// Lets plain Node run the repo's TypeScript scripts the way Next resolves the
// modules they import: an extensionless "./scene" is "./scene.ts", "@/x" is
// the repo root, and a package named in tsconfig's paths ("sem", "stage") is
// its entry. Type stripping itself is Node's own (22.18+). Use as
// `node --import ./scripts/register-ts.mjs scripts/<script>.ts`.
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// The repo's own packages, by name: tsconfig's exact (wildcard-free) paths.
const PACKAGES = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync("tsconfig.json", "utf8")).compilerOptions.paths ?? {})
    .filter(([name]) => !name.includes("*"))
    .map(([name, [target]]) => [name, pathToFileURL(target).href]),
);

register(
  `data:text/javascript,${encodeURIComponent(`
    import { existsSync } from "node:fs";
    import { fileURLToPath, pathToFileURL } from "node:url";
    const ROOT = ${JSON.stringify(pathToFileURL(process.cwd() + "/").href)};
    const PACKAGES = ${JSON.stringify(PACKAGES)};
    export async function resolve(specifier, context, next) {
      let s = specifier;
      if (s in PACKAGES) return next(PACKAGES[s], context);
      if (s.startsWith("@/")) s = new URL(s.slice(2), ROOT).href;
      if (/^(\\.{1,2}\\/|file:)/.test(s) && !/\\.[a-z]+$/i.test(s)) {
        const base = s.startsWith("file:") ? s : new URL(s, context.parentURL).href;
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(fileURLToPath(base + ext))) return next(base + ext, context);
        }
      }
      return next(s, context);
    }
  `)}`,
  pathToFileURL("./"),
);
