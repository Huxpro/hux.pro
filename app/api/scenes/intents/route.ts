import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

/**
 * Dev-only persistence for an experience's intent tree (packages/intents).
 *
 *   POST { scene, version, tree, savedAt }  → content/scenes/<scene>.intents.json
 *                                             and its served copy, public/scenes/_data/
 *
 * Gated to development, like the Lab's other editors (/api/icon, /api/log):
 * the committed file is the production artifact; the experiences build copies
 * content/scenes into public/scenes/_data (scripts/scenes-data.mjs), and each
 * experience loads its tree from there over the one in its code.
 */

const SCENE = /^[a-z][a-z0-9-]*$/;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { scene?: string; version?: unknown; tree?: { nodes?: unknown[] }; savedAt?: string };
    if (!body.scene || !SCENE.test(body.scene) || !Array.isArray(body.tree?.nodes)) {
      return NextResponse.json({ error: "Expected { scene, version, tree }" }, { status: 400 });
    }
    const json = `${JSON.stringify({ version: body.version, tree: body.tree, savedAt: body.savedAt }, null, 2)}\n`;
    const file = `${body.scene}.intents.json`;
    for (const dir of [join(process.cwd(), "content/scenes"), join(process.cwd(), "public/scenes/_data")]) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, file), json);
    }
    return NextResponse.json({ ok: true, file: `content/scenes/${file}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save: ${message}` }, { status: 500 });
  }
}
