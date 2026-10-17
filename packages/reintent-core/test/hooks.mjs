// Node module hooks for the tests: the package's subpaths, extensionless imports (the way Vite and
// Next resolve this repository's TypeScript), and .tsx compiled by TypeScript itself with this
// package's JSX runtime, so the tests run the instance files as written.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SRC = new URL("../src/", import.meta.url);
const PACKAGE = {
  "reintent-core": new URL("core/index.ts", SRC),
  "reintent-core/jsx-runtime": new URL("core/jsx-runtime.ts", SRC),
  "reintent-core/jsx-dev-runtime": new URL("core/jsx-dev-runtime.ts", SRC),
};

export async function resolve(specifier, context, next) {
  if (PACKAGE[specifier]) return next(PACKAGE[specifier].href, context);
  if (specifier.startsWith("reintent-core/lib/")) return next(new URL(`lib/${specifier.slice(18)}.ts`, SRC).href, context);
  if (/^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
    const base = new URL(specifier, context.parentURL).href;
    for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(fileURLToPath(base + ext))) return next(base + ext, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (!url.endsWith(".tsx")) return next(url, context);
  const source = readFileSync(fileURLToPath(url), "utf8");
  const out = ts.transpileModule(source, {
    fileName: fileURLToPath(url),
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, jsxImportSource: "reintent-core", module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  });
  return { format: "module", source: out.outputText, shortCircuit: true };
}

