import fs from "fs";
import path from "path";
import type { Era, WorkItem, ErasData } from "@/lib/eras";

// =============================================================================
// Data Loading
// =============================================================================

const contentDirectory = path.join(process.cwd(), "content");

/**
 * Load all eras data from content/eras.json
 */
export function getErasData(): ErasData {
  const filePath = path.join(contentDirectory, "eras.json");

  if (!fs.existsSync(filePath)) {
    return { eras: [], items: [] };
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  return JSON.parse(fileContents) as ErasData;
}

/**
 * Get all eras sorted by date (most recent first)
 */
export function getAllEras(): Era[] {
  const { eras } = getErasData();
  return eras.sort((a, b) => {
    return b.startDate.localeCompare(a.startDate);
  });
}

/**
 * Get a single era by ID
 */
export function getEraById(id: string): Era | null {
  const { eras } = getErasData();
  return eras.find((era) => era.id === id) || null;
}

/**
 * Get all items for a specific era
 */
export function getItemsByEra(eraId: string): WorkItem[] {
  const { items } = getErasData();
  return items.filter((item) => item.eraId === eraId);
}

/**
 * Get all items across all eras
 */
export function getAllItems(): WorkItem[] {
  const { items } = getErasData();
  return items;
}

/**
 * Get eras with their items combined
 */
export function getErasWithItems(): Array<Era & { items: WorkItem[] }> {
  const { eras, items } = getErasData();

  return eras
    .map((era) => ({
      ...era,
      items: items.filter((item) => item.eraId === era.id),
    }))
    .sort((a, b) => {
      return b.startDate.localeCompare(a.startDate);
    });
}
