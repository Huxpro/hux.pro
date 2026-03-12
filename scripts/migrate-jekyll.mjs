#!/usr/bin/env node

/**
 * Jekyll → Next.js MDX Blog Migration Script
 *
 * Migrates published, non-keynote, non-hidden posts from huxpro.github.io
 * to the new Next.js MDX blog structure.
 *
 * Usage: node scripts/migrate-jekyll.mjs [path-to-old-blog]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ─── Paths ─────────────────────────────────────────────────────────────

const OLD_BLOG =
  process.argv[2] || path.join(process.env.HOME, "github/huxpro.github.io");
const POSTS_DIR = path.join(OLD_BLOG, "_posts");
const INCLUDES_DIR = path.join(OLD_BLOG, "_includes/posts");

const BLOG_DIR = path.join(PROJECT_ROOT, "content/blog");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const REDIRECTS_FILE = path.join(PROJECT_ROOT, "lib/jekyll-redirects.ts");

// ─── Stats ─────────────────────────────────────────────────────────────

const stats = {
  total: 0,
  skipped: { keynote: 0, unpublished: 0, hidden: 0 },
  migrated: { en: 0, zh: 0, both: 0 },
  images: 0,
  warnings: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────

function getPostFiles() {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => {
      const ext = path.extname(f);
      if (ext !== ".md" && ext !== ".markdown") return false;
      return !fs.statSync(path.join(POSTS_DIR, f)).isDirectory();
    })
    .sort();
}

function shouldSkip(data) {
  if (data.layout === "keynote") {
    stats.skipped.keynote++;
    return true;
  }
  if (data.published === false) {
    stats.skipped.unpublished++;
    return true;
  }
  if (data.hidden === true) {
    stats.skipped.hidden++;
    return true;
  }
  return false;
}

function parseFilename(filename) {
  const match = filename.match(
    /^(\d{4})-(\d{2})-(\d{2})-(.+)\.(md|markdown)$/
  );
  if (!match) throw new Error(`Invalid filename: ${filename}`);
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    slug: match[4],
  };
}

function detectLanguage(data) {
  if (data.multilingual === true) return "both";
  if (data.lang === "en") return "en";
  return "zh";
}

function extractDate(data, filenameDate) {
  if (data.date) {
    if (data.date instanceof Date) {
      return data.date.toISOString().slice(0, 10);
    }
    // String date — extract YYYY-MM-DD
    const m = String(data.date).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return filenameDate;
}

// ─── Frontmatter Serialization ─────────────────────────────────────────

function serializeFrontmatter(fm) {
  const lines = ["---"];
  lines.push(`title: ${JSON.stringify(fm.title)}`);
  if (fm.description) lines.push(`description: ${JSON.stringify(fm.description)}`);
  lines.push(`date: "${fm.date}"`);
  if (fm.tags && fm.tags.length > 0) {
    lines.push(`tags: [${fm.tags.map((t) => JSON.stringify(t)).join(", ")}]`);
  }
  lines.push("---");
  return lines.join("\n");
}

function buildFrontmatter(data, filenameDate) {
  const fm = {};
  // Strip HTML tags from title/description (e.g. <code> tags)
  fm.title = (data.title || "").replace(/<[^>]+>/g, "");
  if (data.subtitle) fm.description = data.subtitle.replace(/<[^>]+>/g, "");
  fm.date = extractDate(data, filenameDate);
  if (data.tags && data.tags.length > 0) fm.tags = data.tags;
  return fm;
}

// ─── Content Transformations ───────────────────────────────────────────

function transformContent(content, data) {
  let result = content;

  // 1. Header image injection
  if (
    data["header-img"] &&
    data["header-img"].trim() !== "" &&
    data["header-style"] !== "text"
  ) {
    const imgPath = data["header-img"].startsWith("/")
      ? data["header-img"]
      : `/${data["header-img"]}`;
    const alt = (data.title || "").replace(/"/g, '\\"');
    result = `<Figure url="${imgPath}" alt="${alt}" size="large" />\n\n${result}`;
  }

  // 2. Remove Liquid tags
  result = result.replace(/\{%\s*raw\s*%\}/g, "");
  result = result.replace(/\{%\s*endraw\s*%\}/g, "");
  result = result.replace(/\{%.*?%\}/g, "");
  result = result.replace(/\{\{.*?\}\}/g, "");

  // 3. Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  // ─── HTML → Markdown conversions (before JSX fixes) ──────────────

  // Remove icon elements: <i class="icon-external"></i>
  result = result.replace(/<i\s+class="[^"]*icon[^"]*">\s*<\/i>/gi, "");

  // Remove <span class="invisible">...</span> (Zhihu tracking spans)
  result = result.replace(/<span\s+class="invisible">[^<]*<\/span>/gi, "");
  // Unwrap <span class="visible">text</span> → text
  result = result.replace(/<span\s+class="visible">([^<]*)<\/span>/gi, "$1");
  // Unwrap remaining <span> tags
  result = result.replace(/<\/?span[^>]*>/gi, "");

  // Convert <a href="url" ...>text</a> → [text](url)
  // Handle links with nested elements (already cleaned icons/spans above)
  result = result.replace(
    /<a\s+[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, url, text) => {
      const cleanText = text.replace(/<[^>]*>/g, "").trim();
      // Use the original URL, stripping Zhihu redirect wrapper
      const cleanUrl = url.startsWith("https://link.zhihu.com/?target=")
        ? decodeURIComponent(url.replace("https://link.zhihu.com/?target=", ""))
        : url;
      return `[${cleanText}](${cleanUrl})`;
    }
  );

  // Convert <blockquote>...</blockquote> → > ...
  result = result.replace(
    /<blockquote>([\s\S]*?)<\/blockquote>/gi,
    (_, inner) => {
      const lines = inner
        .replace(/<br\s*\/?>/gi, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => `> ${l}`);
      return "\n" + lines.join("\n") + "\n";
    }
  );

  // Convert <b>text</b> and <strong>text</strong> → **text**
  result = result.replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**");
  result = result.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");

  // Convert <i>text</i> and <em>text</em> → *text* (non-icon <i> tags)
  result = result.replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*");
  result = result.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");

  // Convert list structures to markdown
  result = result.replace(/<\/?[uo]l[^>]*>/gi, "");
  result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const text = inner.replace(/<br\s*\/?>\s*/gi, "").trim();
    return `- ${text}\n`;
  });

  // Remove <div> / </div>, <p> / </p> wrapper tags
  result = result.replace(/<\/?div[^>]*>/gi, "\n");
  result = result.replace(/<\/?p[^>]*>/gi, "\n");

  // Convert <http://url> autolinks → [url](http://url) (MDX incompatible)
  result = result.replace(/<(https?:\/\/[^>]+)>/g, "[$1]($1)");

  // ─── Self-closing tag fixes ──────────────────────────────────────

  // 4. Fix self-closing tags
  result = result.replace(/<br\s*>/gi, "<br />");
  result = result.replace(/<br\/>/gi, "<br />");
  result = result.replace(/<hr\s*>/gi, "<hr />");
  result = result.replace(/<hr\/>/gi, "<hr />");
  result = result.replace(/<img\s([^>]*[^/])>/gi, "<img $1 />");

  // 5. JSX compat
  result = result.replace(/\bclass="/g, 'className="');
  result = result.replace(/\bclass='/g, "className='");
  // Remove inline style attributes (JSX requires object syntax)
  result = result.replace(/\s+style="[^"]*"/g, "");
  result = result.replace(/\s+style='[^']*'/g, "");
  // Remove data-* attributes
  result = result.replace(/\s+data-[a-z-]+="[^"]*"/gi, "");
  result = result.replace(/\s+data-[a-z-]+='[^']*'/gi, "");

  // 6. Protocol-relative URLs
  result = result.replace(/src="\/\//g, 'src="https://');
  result = result.replace(/src='\/\//g, "src='https://");
  result = result.replace(/href="\/\//g, 'href="https://');
  result = result.replace(/href='\/\//g, "href='https://");

  // 7. Convert <br /> to newlines for cleaner markdown
  result = result.replace(/<br \/>\s*\n/gi, "\n");
  result = result.replace(/<br \/>/gi, "\n");

  // 8. Clean up excessive blank lines (3+ → 2)
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

// ─── Image Collection ──────────────────────────────────────────────────

function collectImagePaths(content, data) {
  const images = new Set();

  // From frontmatter header-img
  if (data["header-img"] && data["header-img"].trim()) {
    const img = data["header-img"].replace(/^\//, "");
    images.add(img);
  }

  // From markdown ![](/img/...) or ![](img/...)
  const mdImgRegex = /!\[[^\]]*\]\(\/?(img\/[^)]+)\)/g;
  let match;
  while ((match = mdImgRegex.exec(content)) !== null) {
    images.add(match[1]);
  }

  // From HTML <img src="/img/..."> or <img src="img/...">
  const htmlImgRegex = /src=["']\/?(img\/[^"']+)["']/g;
  while ((match = htmlImgRegex.exec(content)) !== null) {
    images.add(match[1]);
  }

  return images;
}

function copyImages(allImages) {
  console.log(`\nCopying ${allImages.size} images...`);

  for (const imgPath of allImages) {
    const src = path.join(OLD_BLOG, imgPath);
    const dest = path.join(PUBLIC_DIR, imgPath);

    if (!fs.existsSync(src)) {
      stats.warnings.push(`Image not found: ${imgPath}`);
      console.log(`  WARN  Image not found: ${imgPath}`);
      continue;
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    stats.images++;
  }
}

// ─── File Writing ──────────────────────────────────────────────────────

function writeMdxFile(outputPath, frontmatter, content) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fm = serializeFrontmatter(frontmatter);
  const fileContent = `${fm}\n\n${content.trim()}\n`;
  fs.writeFileSync(outputPath, fileContent);
}

// ─── Redirect Map Generation ───────────────────────────────────────────

function generateRedirects(redirects) {
  const entries = redirects
    .map(({ date, slug, lang }) => {
      const [year, month, day] = date.split("-");
      return `  { source: "/${year}/${month}/${day}/${slug}", destination: "/writing/${slug}/${lang}", permanent: true },`;
    })
    .join("\n");

  const content = `// Auto-generated by scripts/migrate-jekyll.mjs
// Maps old Jekyll permalink URLs to new Next.js routes

export const jekyllRedirects = [
${entries}
];
`;

  fs.writeFileSync(REDIRECTS_FILE, content);
  console.log(`\nRedirect map written to lib/jekyll-redirects.ts`);
}

// ─── Main Migration ───────────────────────────────────────────────────

function migrate() {
  console.log(`Old blog: ${OLD_BLOG}`);
  console.log(`Output:   ${BLOG_DIR}\n`);

  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`ERROR: Posts directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const files = getPostFiles();
  stats.total = files.length;

  const redirects = [];
  const allImages = new Set();

  // Ensure output directories exist
  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(raw);
    const { date, slug } = parseFilename(file);

    if (shouldSkip(data)) {
      console.log(
        `  SKIP  ${file} (${data.layout === "keynote" ? "keynote" : data.published === false ? "unpublished" : "hidden"})`
      );
      continue;
    }

    const lang = detectLanguage(data);
    const frontmatter = buildFrontmatter(data, date);

    // Collect images from original content
    collectImagePaths(content, data).forEach((img) => allImages.add(img));

    if (lang === "both" && slug === "upgrading-eleme-to-pwa") {
      // Special case: bilingual post with separate include files
      const enIncludePath = path.join(
        INCLUDES_DIR,
        "2017-07-12-upgrading-eleme-to-pwa",
        "en.md"
      );
      const zhIncludePath = path.join(
        INCLUDES_DIR,
        "2017-07-12-upgrading-eleme-to-pwa",
        "zh.md"
      );

      const enContent = fs.readFileSync(enIncludePath, "utf8");
      const zhContent = fs.readFileSync(zhIncludePath, "utf8");

      // Collect images from both language versions
      collectImagePaths(enContent, data).forEach((img) => allImages.add(img));
      collectImagePaths(zhContent, data).forEach((img) => allImages.add(img));

      // EN file uses subtitle as title, ZH file uses title
      const enFm = {
        ...frontmatter,
        title: (data.subtitle || data.title).replace(/<[^>]+>/g, ""),
        description: data.title.replace(/<[^>]+>/g, ""),
      };
      const zhFm = { ...frontmatter };

      const postDir = path.join(BLOG_DIR, slug);
      writeMdxFile(
        path.join(postDir, "index.en.mdx"),
        enFm,
        transformContent(enContent, data)
      );
      writeMdxFile(
        path.join(postDir, "index.zh.mdx"),
        zhFm,
        transformContent(zhContent, data)
      );

      stats.migrated.both++;
      redirects.push({ date, slug, lang: "zh" });
      console.log(`  BOTH  ${slug}/`);
    } else if (lang === "en") {
      const transformed = transformContent(content, data);
      writeMdxFile(
        path.join(BLOG_DIR, `${slug}.en.mdx`),
        frontmatter,
        transformed
      );
      stats.migrated.en++;
      redirects.push({ date, slug, lang: "en" });
      console.log(`  EN    ${slug}.en.mdx`);
    } else {
      // Default: Chinese
      const transformed = transformContent(content, data);
      writeMdxFile(
        path.join(BLOG_DIR, `${slug}.zh.mdx`),
        frontmatter,
        transformed
      );
      stats.migrated.zh++;
      redirects.push({ date, slug, lang: "zh" });
      console.log(`  ZH    ${slug}.zh.mdx`);
    }
  }

  // Copy images
  copyImages(allImages);

  // Generate redirect map
  generateRedirects(redirects);

  // Report
  const total =
    stats.migrated.zh + stats.migrated.en + stats.migrated.both;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Migration Report`);
  console.log(`${"=".repeat(50)}`);
  console.log(`Total posts found:  ${stats.total}`);
  console.log(`Skipped:`);
  console.log(`  Keynote:          ${stats.skipped.keynote}`);
  console.log(`  Unpublished:      ${stats.skipped.unpublished}`);
  console.log(`  Hidden:           ${stats.skipped.hidden}`);
  console.log(`Migrated:`);
  console.log(`  Chinese (zh):     ${stats.migrated.zh}`);
  console.log(`  English (en):     ${stats.migrated.en}`);
  console.log(`  Bilingual (both): ${stats.migrated.both}`);
  console.log(`  Total:            ${total}`);
  console.log(`Images copied:      ${stats.images}`);
  if (stats.warnings.length > 0) {
    console.log(`\nWarnings:`);
    stats.warnings.forEach((w) => console.log(`  ! ${w}`));
  }
  console.log(`${"=".repeat(50)}`);
}

migrate();
