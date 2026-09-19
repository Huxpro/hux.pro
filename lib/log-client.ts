import logJson from "@/content/log.json";
import ogSnapshotJson from "@/content/og-snapshot.json";
import { normalizeLogData, type LogData, type RawLogData } from "@/lib/log";
import { enrichLogDataWithPreviews, type OGSnapshot } from "@/lib/og-enrich";

/**
 * The committed log, flattened and enriched once for the lifetime of the
 * module — for the client-side systems that derive from it without being
 * handed it (the theater's albums, the identity card). The server pages
 * load it through `lib/log-server` instead.
 */
export const LOG: LogData = enrichLogDataWithPreviews(
  normalizeLogData(logJson as unknown as RawLogData),
  ogSnapshotJson as OGSnapshot,
);
