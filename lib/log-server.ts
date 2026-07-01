import fs from "fs";
import path from "path";
import { normalizeLogData, type Tag, type Commit, type LogData, type RawLogData } from "@/lib/log";

// =============================================================================
// Data Loading
// =============================================================================

const contentDirectory = path.join(process.cwd(), "content");

/**
 * Load all log data from content/log.json and normalize the nested
 * `identities[*].ranges` authoring shape into the flat runtime shape
 * every downstream consumer expects (roles hoisted into `commits[]`,
 * `identities` reduced to a metadata lookup).
 */
export function getLogData(): LogData {
  const filePath = path.join(contentDirectory, "log.json");

  if (!fs.existsSync(filePath)) {
    return { tags: [], groups: [], commits: [] };
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const raw = JSON.parse(fileContents) as RawLogData;
  return normalizeLogData(raw);
}

/**
 * Get all tags sorted by date (most recent first)
 */
export function getAllTags(): Tag[] {
  const { tags } = getLogData();
  return tags.sort((a, b) => {
    return b.startDate.localeCompare(a.startDate);
  });
}

/**
 * Get a single tag by ID
 */
export function getTagById(id: string): Tag | null {
  const { tags } = getLogData();
  return tags.find((tag) => tag.id === id) || null;
}

/**
 * Get all commits for a specific tag
 */
export function getCommitsByTag(tagId: string): Commit[] {
  const { commits } = getLogData();
  return commits.filter((commit) => commit.tagId === tagId);
}

/**
 * Get all commits across all tags
 */
export function getAllCommits(): Commit[] {
  const { commits } = getLogData();
  return commits;
}

/**
 * Get tags with their commits combined
 */
export function getTagsWithCommits(): Array<Tag & { commits: Commit[] }> {
  const { tags, commits } = getLogData();

  return tags
    .map((tag) => ({
      ...tag,
      commits: commits.filter((commit) => commit.tagId === tag.id),
    }))
    .sort((a, b) => {
      return b.startDate.localeCompare(a.startDate);
    });
}