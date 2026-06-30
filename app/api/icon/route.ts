import { NextRequest, NextResponse } from "next/server";
import { normalizeIconConfig } from "@/lib/icon/config";
import {
  generateIconAssets,
  readIconConfig,
  writeIconConfig,
} from "@/lib/icon/generate";

/**
 * Dev-only persistence for the app-icon editor.
 *
 *   GET  → current `content/icon.json` (normalized)
 *   POST → validate, write `content/icon.json`, regenerate `public/icons/*`
 *
 * Gated to development, exactly like `/api/log`: the site ships as a static
 * surface, so this never runs in production. The committed config + generated
 * SVGs are the production artifacts.
 */

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  try {
    return NextResponse.json(readIconConfig());
  } catch {
    return NextResponse.json(
      { error: "Failed to read icon.json" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  try {
    const config = normalizeIconConfig(await request.json());
    writeIconConfig(config);
    const result = await generateIconAssets(config);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save: ${message}` },
      { status: 500 },
    );
  }
}
