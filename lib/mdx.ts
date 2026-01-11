import fs from "fs";
import matter from "gray-matter";
import path from "path";
import readingTime from "reading-time";
import type { BlogPost, Doc, PostLanguage } from "./content";

const contentDirectory = path.join(process.cwd(), "content");

// BlogPost already has readingTime from Post, just add content fields
export interface BlogPostWithContent extends BlogPost {
  content: string;
  contentZh?: string;
}

// Doc already has readingTime from Post, just add content fields
export interface DocWithContent extends Doc {
  content: string;
  contentZh?: string;
}

export interface TalkWithContent {
  slug: string;
  title: string;
  titleZh?: string;
  event: string;
  date: string;
  location: string;
  video?: string;
  slides?: string;
  description?: string;
  descriptionZh?: string;
  content: string;
}

// Regex to match [slug].[lang].mdx pattern
const LANG_FILE_REGEX = /^(.+)\.(en|zh)\.mdx$/;

/**
 * Validate blog content files and report issues
 * Called during build to catch bad naming conventions
 */
export function validateBlogContent(): {
  errors: string[];
  warnings: string[];
} {
  const blogDir = path.join(contentDirectory, "blog");
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(blogDir)) {
    return { errors, warnings };
  }

  const files = fs.readdirSync(blogDir);

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Directory-based post: must have index.en.mdx or index.zh.mdx
      const dirFiles = fs.readdirSync(filePath);
      const hasEnIndex = dirFiles.includes("index.en.mdx");
      const hasZhIndex = dirFiles.includes("index.zh.mdx");
      const hasOldIndex = dirFiles.includes("index.mdx");

      if (hasOldIndex) {
        errors.push(
          `${file}/index.mdx: Missing language suffix. Rename to index.en.mdx or index.zh.mdx`
        );
      }

      if (!hasEnIndex && !hasZhIndex) {
        errors.push(
          `${file}/: Directory must contain index.en.mdx and/or index.zh.mdx`
        );
      }

      // Check for orphan mdx files without language suffix
      for (const dirFile of dirFiles) {
        if (
          dirFile.endsWith(".mdx") &&
          !LANG_FILE_REGEX.test(dirFile) &&
          dirFile !== "index.mdx"
        ) {
          warnings.push(
            `${file}/${dirFile}: MDX file missing language suffix (should be .en.mdx or .zh.mdx)`
          );
        }
      }
    } else if (file.endsWith(".mdx")) {
      // File-based post: must match [slug].[lang].mdx pattern
      if (!LANG_FILE_REGEX.test(file)) {
        errors.push(
          `${file}: Invalid filename. Must be [slug].en.mdx or [slug].zh.mdx`
        );
      }
    }
  }

  return { errors, warnings };
}

/**
 * Get all blog post slugs for static generation
 * Language is derived from filename, not frontmatter
 */
export function getBlogSlugs(): string[] {
  const blogDir = path.join(contentDirectory, "blog");

  if (!fs.existsSync(blogDir)) {
    return [];
  }

  const files = fs.readdirSync(blogDir);
  const slugs = new Set<string>();

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Directory-based post: check for index.en.mdx or index.zh.mdx
      const hasEnIndex = fs.existsSync(path.join(filePath, "index.en.mdx"));
      const hasZhIndex = fs.existsSync(path.join(filePath, "index.zh.mdx"));
      if (hasEnIndex || hasZhIndex) {
        slugs.add(file);
      }
    } else if (file.endsWith(".mdx")) {
      // File-based post: extract slug from [slug].[lang].mdx
      const match = file.match(LANG_FILE_REGEX);
      if (match) {
        slugs.add(match[1]);
      }
    }
  }

  return Array.from(slugs);
}

/**
 * Get all blog posts with metadata (for listing pages)
 */
export function getAllBlogPosts(): BlogPost[] {
  const slugs = getBlogSlugs();

  const posts = slugs
    .map((slug) => {
      const post = getBlogPostBySlug(slug);
      if (!post) return null;

      // Return just the metadata, not the content
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, readingTime, ...metadata } = post;
      return metadata as BlogPost;
    })
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

/**
 * Get a single blog post by slug with full content
 * Language is derived from file existence, not frontmatter
 */
export function getBlogPostBySlug(slug: string): BlogPostWithContent | null {
  const blogDir = path.join(contentDirectory, "blog");

  // Check for directory-based post structure first
  const dirPath = path.join(blogDir, slug);
  const isDirectory =
    fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();

  let enFilePath: string;
  let zhFilePath: string;

  if (isDirectory) {
    enFilePath = path.join(dirPath, "index.en.mdx");
    zhFilePath = path.join(dirPath, "index.zh.mdx");
  } else {
    enFilePath = path.join(blogDir, `${slug}.en.mdx`);
    zhFilePath = path.join(blogDir, `${slug}.zh.mdx`);
  }

  const hasEn = fs.existsSync(enFilePath);
  const hasZh = fs.existsSync(zhFilePath);

  // Must have at least one language version
  if (!hasEn && !hasZh) {
    return null;
  }

  // Derive language from file existence
  const language: PostLanguage = hasEn && hasZh ? "both" : hasEn ? "en" : "zh";

  // Read English content (primary for bilingual, only source for English-only)
  let content = "";
  let enData: Record<string, unknown> = {};
  let readingTimeEn = "";
  if (hasEn) {
    const enContents = fs.readFileSync(enFilePath, "utf8");
    const parsed = matter(enContents);
    enData = parsed.data;
    content = parsed.content;
    readingTimeEn = readingTime(content).text;
  }

  // Read Chinese content
  let contentZh: string | undefined;
  let zhData: Record<string, unknown> = {};
  let readingTimeZh: string | undefined;
  if (hasZh) {
    const zhContents = fs.readFileSync(zhFilePath, "utf8");
    const parsed = matter(zhContents);
    zhData = parsed.data;
    contentZh = parsed.content;
    readingTimeZh = readingTime(contentZh).text;
  }

  // Merge frontmatter: prefer English, fallback to Chinese for Chinese-only posts
  const data = hasEn ? enData : zhData;

  // Extract titleZh and descriptionZh from Chinese file's own title/description
  const titleZh = hasZh ? (zhData.title as string) : undefined;
  const descriptionZh = hasZh ? (zhData.description as string) : undefined;

  return {
    slug,
    language,
    title: (data.title as string) || slug,
    titleZh,
    date: (data.date as string) || (zhData.date as string) || "",
    description: (data.description as string) || "",
    descriptionZh,
    tags: (data.tags as string[]) || (zhData.tags as string[]) || [],
    content,
    contentZh,
    readingTime: readingTimeEn || readingTimeZh || "",
    readingTimeZh,
  };
}

/**
 * Get all talk slugs for static generation
 */
export function getTalkSlugs(): string[] {
  const talksDir = path.join(contentDirectory, "talks");

  if (!fs.existsSync(talksDir)) {
    return [];
  }

  return fs
    .readdirSync(talksDir)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

/**
 * Get all talks with metadata
 */
export function getAllTalks(): TalkWithContent[] {
  const slugs = getTalkSlugs();

  return slugs
    .map((slug) => getTalkBySlug(slug))
    .filter((talk): talk is TalkWithContent => talk !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get a single talk by slug
 */
export function getTalkBySlug(slug: string): TalkWithContent | null {
  const talksDir = path.join(contentDirectory, "talks");
  const filePath = path.join(talksDir, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    slug,
    title: data.title,
    titleZh: data.titleZh,
    event: data.event,
    date: data.date,
    location: data.location,
    video: data.video,
    slides: data.slides,
    description: data.description,
    descriptionZh: data.descriptionZh,
    content,
  };
}

// ===== Documentation Pages =====

const docsDirectory = path.join(process.cwd(), "docs");

// Regex to match [slug].[lang].md pattern
const DOC_LANG_FILE_REGEX = /^(.+)\.(en|zh)\.md$/;

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitleFromMarkdown(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : "Untitled";
}

/**
 * Extract description from markdown content (first paragraph after title)
 */
function extractDescriptionFromMarkdown(content: string): string {
  // Remove the title line and get first non-empty paragraph
  const lines = content.split("\n");
  let foundTitle = false;
  let description = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && trimmed && !trimmed.startsWith("#")) {
      description = trimmed;
      break;
    }
  }

  // Truncate if too long
  if (description.length > 200) {
    return description.slice(0, 197) + "...";
  }
  return description;
}

/**
 * Get all doc slugs for static generation
 * Handles both [slug].md (legacy) and [slug].[lang].md (bilingual) patterns
 */
export function getDocSlugs(): string[] {
  if (!fs.existsSync(docsDirectory)) {
    return [];
  }

  const files = fs.readdirSync(docsDirectory);
  const slugs = new Set<string>();

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    // Check for language-suffixed file pattern
    const langMatch = file.match(DOC_LANG_FILE_REGEX);
    if (langMatch) {
      slugs.add(langMatch[1]);
    } else {
      // Legacy pattern: [slug].md (no language suffix)
      slugs.add(file.replace(/\.md$/, ""));
    }
  }

  return Array.from(slugs);
}

/**
 * Get all docs with metadata (for listing pages)
 * Returns only metadata, not the full content
 */
export function getAllDocs(): Doc[] {
  const slugs = getDocSlugs();

  return slugs
    .map((slug) => {
      const doc = getDocBySlug(slug);
      if (!doc) return null;

      // Return just the metadata, not the content
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, contentZh, ...metadata } = doc;
      return metadata as Doc;
    })
    .filter((doc): doc is Doc => doc !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Get a single doc by slug with full content
 * Supports both legacy [slug].md and bilingual [slug].[lang].md patterns
 */
export function getDocBySlug(slug: string): DocWithContent | null {
  // Check for bilingual files first
  const enFilePath = path.join(docsDirectory, `${slug}.en.md`);
  const zhFilePath = path.join(docsDirectory, `${slug}.zh.md`);
  const legacyFilePath = path.join(docsDirectory, `${slug}.md`);

  const hasEn = fs.existsSync(enFilePath);
  const hasZh = fs.existsSync(zhFilePath);
  const hasLegacy = fs.existsSync(legacyFilePath);

  // Must have at least one version
  if (!hasEn && !hasZh && !hasLegacy) {
    return null;
  }

  // Legacy file (no language suffix) - treat as English only
  if (hasLegacy && !hasEn && !hasZh) {
    const fileContents = fs.readFileSync(legacyFilePath, "utf8");
    const { content } = matter(fileContents);
    const title = extractTitleFromMarkdown(content);
    const description = extractDescriptionFromMarkdown(content);
    const stats = readingTime(content);

    return {
      slug,
      language: "en",
      title,
      description,
      content,
      readingTime: stats.text,
    };
  }

  // Bilingual or single-language with suffix
  const language: PostLanguage = hasEn && hasZh ? "both" : hasEn ? "en" : "zh";

  // Read English content
  let content = "";
  let title = "";
  let description = "";
  let readingTimeEn = "";
  if (hasEn) {
    const enContents = fs.readFileSync(enFilePath, "utf8");
    const parsed = matter(enContents);
    content = parsed.content;
    title = extractTitleFromMarkdown(content);
    description = extractDescriptionFromMarkdown(content);
    readingTimeEn = readingTime(content).text;
  }

  // Read Chinese content
  let contentZh: string | undefined;
  let titleZh: string | undefined;
  let descriptionZh: string | undefined;
  let readingTimeZh: string | undefined;
  if (hasZh) {
    const zhContents = fs.readFileSync(zhFilePath, "utf8");
    const parsed = matter(zhContents);
    contentZh = parsed.content;
    titleZh = extractTitleFromMarkdown(contentZh);
    descriptionZh = extractDescriptionFromMarkdown(contentZh);
    readingTimeZh = readingTime(contentZh).text;
  }

  // For Chinese-only docs, use Chinese as primary
  if (!hasEn && hasZh) {
    title = titleZh || "";
    description = descriptionZh || "";
    content = contentZh || "";
  }

  return {
    slug,
    language,
    title,
    titleZh,
    description,
    descriptionZh,
    content,
    contentZh,
    readingTime: readingTimeEn || readingTimeZh || "",
    readingTimeZh,
  };
}
