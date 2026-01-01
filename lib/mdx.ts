import fs from "fs";
import matter from "gray-matter";
import path from "path";
import readingTime from "reading-time";
import type { BlogPost } from "./content";

const contentDirectory = path.join(process.cwd(), "content");

export interface BlogPostWithContent extends BlogPost {
  content: string;
  contentZh?: string;
  readingTime: string;
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

/**
 * Get all blog post slugs for static generation
 */
export function getBlogSlugs(): string[] {
  const blogDir = path.join(contentDirectory, "blog");

  if (!fs.existsSync(blogDir)) {
    return [];
  }

  const files = fs.readdirSync(blogDir);
  const slugs: string[] = [];

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // For directory-based posts: content/blog/slug/index.mdx
      if (fs.existsSync(path.join(filePath, "index.mdx"))) {
        slugs.push(file);
      }
    } else if (file.endsWith(".mdx")) {
      // For file-based posts: content/blog/slug.mdx
      slugs.push(file.replace(/\.mdx$/, ""));
    }
  }

  return slugs;
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
 */
export function getBlogPostBySlug(slug: string): BlogPostWithContent | null {
  const blogDir = path.join(contentDirectory, "blog");
  let filePath = path.join(blogDir, `${slug}.mdx`);
  let contentZh: string | undefined;

  // Check for directory-based post structure first
  const dirPath = path.join(blogDir, slug);
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    filePath = path.join(dirPath, "index.mdx");
    const zhFilePath = path.join(dirPath, "index.zh.mdx");
    if (fs.existsSync(zhFilePath)) {
      const zhFileContents = fs.readFileSync(zhFilePath, "utf8");
      const { content: rawContentZh } = matter(zhFileContents);
      contentZh = rawContentZh;
    }
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContents);

  const stats = readingTime(content);

  return {
    slug,
    language: data.language || "en",
    title: data.title,
    titleZh: data.titleZh,
    date: data.date,
    description: data.description,
    descriptionZh: data.descriptionZh,
    tags: data.tags || [],
    content,
    contentZh,
    readingTime: stats.text,
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

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  content: string;
  readingTime: string;
}

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
 */
export function getDocSlugs(): string[] {
  if (!fs.existsSync(docsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(docsDirectory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

/**
 * Get all docs with metadata (for listing pages)
 */
export function getAllDocs(): DocPage[] {
  const slugs = getDocSlugs();

  return slugs
    .map((slug) => getDocBySlug(slug))
    .filter((doc): doc is DocPage => doc !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Get a single doc by slug with full content
 */
export function getDocBySlug(slug: string): DocPage | null {
  const filePath = path.join(docsDirectory, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const { content } = matter(fileContents);

  const title = extractTitleFromMarkdown(content);
  const description = extractDescriptionFromMarkdown(content);
  const stats = readingTime(content);

  return {
    slug,
    title,
    description,
    content,
    readingTime: stats.text,
  };
}
