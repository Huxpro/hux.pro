#!/usr/bin/env node
/**
 * Fetch selected @lynx-example / @vue-lynx-example packages from npm and
 * materialize them under public/lynx-examples/{id}/ with example-metadata.json
 * so @lynx-js/go-web can load them same-origin (CORS-safe).
 *
 * Usage:
 *   node scripts/lynx-examples-prepare.mjs
 *   node scripts/lynx-examples-prepare.mjs --clean
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "lynx-examples");

/** @typedef {{ id: string; pkg: string; version?: string; gitBase?: string }} ExampleSpec */

/** @type {ExampleSpec[]} */
const EXAMPLES = [
  {
    id: "hello-world",
    pkg: "@lynx-example/hello-world",
    gitBase: "https://github.com/lynx-family/lynx-examples/tree/main",
  },
  {
    id: "animation",
    pkg: "@lynx-example/animation",
    gitBase: "https://github.com/lynx-family/lynx-examples/tree/main",
  },
  {
    id: "bankcards",
    pkg: "@lynx-example/bankcards",
    gitBase: "https://github.com/lynx-family/lynx-examples/tree/main",
  },
  {
    id: "Vuehello-world",
    pkg: "@vue-lynx-example/hello-world",
    gitBase: "https://github.com/lynx-family/lynx-stack/tree/main",
  },
  {
    id: "Vuetodomvc",
    pkg: "@vue-lynx-example/todomvc",
    gitBase: "https://github.com/lynx-family/lynx-stack/tree/main",
  },
];

const clean = process.argv.includes("--clean");

function walkFiles(dir, base = dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else {
      out.push(relative(base, full).split("\\").join("/"));
    }
  }
  return out;
}

function resolveVersion(pkg, pinned) {
  if (pinned) return pinned;
  const raw = execFileSync("npm", ["view", pkg, "version"], {
    encoding: "utf8",
  }).trim();
  return raw;
}

function extractPackage(pkg, version, dest) {
  const work = mkdtempSync(join(tmpdir(), "lynx-ex-"));
  try {
    const tarball = execFileSync(
      "npm",
      ["pack", `${pkg}@${version}`, "--pack-destination", work],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
      .trim()
      .split("\n")
      .pop();
    if (!tarball) throw new Error(`npm pack failed for ${pkg}@${version}`);
    execFileSync("tar", ["-xzf", join(work, tarball), "-C", work], {
      stdio: "inherit",
    });
    const pkgDir = join(work, "package");
    mkdirSync(dest, { recursive: true });
    // Prefer a clean copy of package contents (no nested package/)
    for (const entry of readdirSync(pkgDir)) {
      cpSync(join(pkgDir, entry), join(dest, entry), { recursive: true });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function buildMetadata(dest, spec, pkgJson) {
  const files = walkFiles(dest).filter((f) => f !== "example-metadata.json");
  const lynxBundles = files.filter((f) => f.endsWith(".lynx.bundle"));
  const webBundles = files.filter((f) => f.endsWith(".web.bundle"));

  /** @type {Array<{ name: string; file: string; webFile?: string }>} */
  const templateFiles = [];

  for (const file of lynxBundles) {
    const base = file.replace(/\.lynx\.bundle$/, "");
    const name = base.split("/").pop() || "main";
    const webCandidate = `${base}.web.bundle`;
    // Only pair when the sibling web bundle exists — never borrow another entry's.
    const webFile = webBundles.includes(webCandidate)
      ? webCandidate
      : undefined;
    templateFiles.push({
      name,
      file,
      ...(webFile ? { webFile } : {}),
    });
  }

  // Fallback when only a web bundle exists
  if (templateFiles.length === 0 && webBundles[0]) {
    templateFiles.push({
      name: "main",
      file: webBundles[0].replace(/\.web\.bundle$/, ".lynx.bundle"),
      webFile: webBundles[0],
    });
  }

  const metadata = {
    name: pkgJson.name?.replace(/^@[^/]+\//, "examples/") ?? `examples/${spec.id}`,
    version: pkgJson.version,
    files,
    templateFiles,
    ...(spec.gitBase ? { exampleGitBaseUrl: spec.gitBase } : {}),
  };

  writeFileSync(
    join(dest, "example-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  return metadata;
}

function main() {
  if (clean && existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest = [];

  for (const spec of EXAMPLES) {
    const version = resolveVersion(spec.pkg, spec.version);
    const dest = join(OUT_DIR, spec.id);
    console.log(`→ ${spec.id}  (${spec.pkg}@${version})`);

    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    extractPackage(spec.pkg, version, dest);

    const pkgJson = JSON.parse(
      readFileSync(join(dest, "package.json"), "utf8"),
    );
    const metadata = buildMetadata(dest, spec, pkgJson);
    manifest.push({
      id: spec.id,
      pkg: spec.pkg,
      version,
      entries: metadata.templateFiles.map((t) => t.name),
      hasWeb: metadata.templateFiles.some((t) => Boolean(t.webFile)),
    });
  }

  writeFileSync(
    join(OUT_DIR, "manifest.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), examples: manifest }, null, 2)}\n`,
  );
  console.log(`\nPrepared ${manifest.length} examples → ${OUT_DIR}`);
}

main();
