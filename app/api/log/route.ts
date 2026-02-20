import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { LogData } from "@/lib/log";

const LOG_PATH = path.join(process.cwd(), "content", "log.json");
const BACKUP_DIR = path.join(process.cwd(), "content", ".backups");

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    const data = fs.readFileSync(LOG_PATH, "utf8");
    return NextResponse.json(JSON.parse(data));
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

    // Atomic write: temp file + rename
    const tempPath = LOG_PATH + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(body, null, 2) + "\n", "utf8");
    fs.renameSync(tempPath, LOG_PATH);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save: ${message}` }, { status: 500 });
  }
}
