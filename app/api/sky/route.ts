import { NextRequest, NextResponse } from "next/server";
import { readSkyFile, writeSkyFile } from "@/lib/sky-file";

/**
 * Dev-only persistence for the Sky Engine Lab (`/editor/sky`).
 *
 *   GET  → current `content/sky.json` (normalized)
 *   POST → validate, write `content/sky.json`
 *
 * Gated to development, exactly like `/api/icon`: the site ships as a static
 * surface, so this never runs in production. The committed config *is* the
 * production artifact — `systems/ambient/lib/scene.ts` imports it at build.
 */

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  try {
    return NextResponse.json(readSkyFile());
  } catch {
    return NextResponse.json(
      { error: "Failed to read sky.json" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  try {
    const file = writeSkyFile(await request.json());
    return NextResponse.json({ ok: true, file });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save: ${message}` },
      { status: 500 }
    );
  }
}
