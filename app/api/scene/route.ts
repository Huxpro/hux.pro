import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Writes one param of one node back to a scene file: what the inspector's
 * "save to source" does, the same edit as `pnpm scene:patch`. A scene is data
 * (packages/stage), so this is a literal swapped for a literal, never a model.
 *
 * Gated to development, like `/api/log` and `/api/icon`: nothing writes in
 * production (it answers 403 before loading the parser, which is left out of
 * the deployed function; see next.config.ts). Only `*.scene.tsx` files under
 * `app/` can be written, and a patch that would leave the scene anything but
 * data is refused.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "edits are written back only by the dev server" }, { status: 403 });
  }

  const { file, id, prop, value } = (await request.json().catch(() => ({}))) as {
    file?: string;
    id?: string;
    prop?: string;
    value?: unknown;
  };
  if (!file || !id || !prop || value === undefined) {
    return NextResponse.json({ error: "file, id, prop and value are all needed" }, { status: 400 });
  }
  const app = path.join(process.cwd(), "app");
  const full = path.resolve(process.cwd(), file);
  if (!full.startsWith(app + path.sep) || !full.endsWith(".scene.tsx") || !fs.existsSync(full)) {
    return NextResponse.json({ error: `${file} is not a scene file under app/` }, { status: 400 });
  }

  // TypeScript's parser is heavy; load it only when an edit arrives.
  const { checkScene, patchScene } = await import("@/packages/stage/tools/scene");
  const before = fs.readFileSync(full, "utf8");
  let after: string;
  try {
    after = patchScene(before, id, prop, value);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 });
  }
  const problems = checkScene(after, file);
  if (problems.length) {
    return NextResponse.json({ error: `the edit would leave the scene with: ${problems[0].message}` }, { status: 422 });
  }
  const temp = full + ".tmp";
  fs.writeFileSync(temp, after, "utf8");
  fs.renameSync(temp, full);
  return NextResponse.json({ message: `${file}: ${id}.${prop} = ${JSON.stringify(value)}` });
}
