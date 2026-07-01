import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  denormalizeLogData,
  normalizeLogData,
  type LogData,
  type RawLogData,
} from "@/lib/log";

const LOG_PATH = path.join(process.cwd(), "content", "log.json");
const BACKUP_DIR = path.join(process.cwd(), "content", ".backups");

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    // Editor consumes the FLAT runtime shape so its commit-list, form,
    // and preview all reason about a plain `commits[]`. Normalize on
    // read; the reverse happens on POST to preserve nested authoring
    // on disk.
    const data = fs.readFileSync(LOG_PATH, "utf8");
    const raw = JSON.parse(data) as RawLogData;
    return NextResponse.json(normalizeLogData(raw));
  } catch {
    return NextResponse.json({ error: "Failed to read log.json" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    const body: LogData = await request.json();

    if (!body.tags || !Array.isArray(body.tags) || !body.commits || !Array.isArray(body.commits)) {
      return NextResponse.json({ error: "Invalid LogData: tags and commits arrays required" }, { status: 400 });
    }

    // Create backup
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `log-${timestamp}.json`);
    if (fs.existsSync(LOG_PATH)) {
      fs.copyFileSync(LOG_PATH, backupPath);
    }

    // Editor sends the flat runtime shape; re-nest role commits under
    // their identity's `ranges` so `log.json` keeps the authoring
    // co-location that makes identity+ranges one visual unit on disk.
    const onDisk = denormalizeLogData(body);

    // Atomic write: temp file + rename
    const tempPath = LOG_PATH + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(onDisk, null, 2) + "\n", "utf8");
    fs.renameSync(tempPath, LOG_PATH);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save: ${message}` }, { status: 500 });
  }
}
