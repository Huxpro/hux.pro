// =============================================================================
// OG Image System — generates our *own* Open Graph cards (not to be confused
// with lib/og*.ts, which crawl *other* sites' OG metadata for /works embeds).
//
// Renders a 1200×630 card with the site's signature look: dark #1a1a1a base,
// `λhux` mono mark, serif title (Newsreader / Noto Serif SC for CJK), and a
// mono system-metadata line. Used by the `opengraph-image` route conventions:
//   - one shared card per "subsite" (home, /writing, /works, /docs, /prompts)
//   - a per-post card for each writing, optionally using the post's cover image
//
// Fonts are pulled from Google Fonts at build time, subsetted to exactly the
// glyphs each card renders (`&text=`), so payloads stay tiny even for CJK.
// =============================================================================

import { ImageResponse } from "next/og";
import fs from "fs/promises";
import path from "path";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "Hux.Pro";

// Palette mirrors the dark-mode tokens in app/globals.css (OKLCH → sRGB).
const COLOR = {
  bg: "#1a1a1a", // --background  oklch(0.2178 0 0)
  fg: "#e8e8e8", // --foreground  oklch(0.93 0 0)
  muted: "#a0a0a0", // --muted-foreground oklch(0.708 0 0)
  hairline: "rgba(255,255,255,0.10)", // --border oklch(1 0 0 / 10%)
} as const;

// -----------------------------------------------------------------------------
// Fonts
// -----------------------------------------------------------------------------

// A generous base of glyphs every mono string might use, so the subset always
// covers brand/eyebrow/meta even before we add the dynamic strings.
const MONO_BASE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /·—–-—.,:;!?'\"()[]{}@#&+*=_λ";
const SERIF_BASE =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?'\"()-—–&";

const CJK_RE = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

const fontCache = new Map<string, ArrayBuffer>();

async function loadGoogleFont(
  family: string,
  weight: number,
  text: string
): Promise<ArrayBuffer> {
  const key = `${family}:${weight}:${text}`;
  const cached = fontCache.get(key);
  if (cached) return cached;

  const url =
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}` +
    `:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src:\s*url\(([^)]+)\)\s*format/)?.[1];
  if (!src) throw new Error(`OG font not found: ${family} ${weight}`);
  const data = await (await fetch(src)).arrayBuffer();

  fontCache.set(key, data);
  return data;
}

type FontEntry = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: "normal";
};

// Build the exact font set a given card needs. `OgSerif` may carry two faces
// (Newsreader for Latin + Noto Serif SC for CJK) — Satori falls back across
// faces that share a family name for glyphs the first one is missing.
async function loadFonts(serifText: string, monoText: string): Promise<FontEntry[]> {
  const monoSubset = MONO_BASE + monoText;
  const serifSubset = SERIF_BASE + serifText;

  // Weights mirror the live site: serif titles and the mono system layer both
  // render at 400 (normal) — the deliberately light, editorial "quiet
  // confidence" look (see app/layout.tsx + components/ui/header-zone.tsx).
  const jobs: Promise<FontEntry>[] = [
    loadGoogleFont("Newsreader", 400, serifSubset).then((data) => ({
      name: "OgSerif",
      data,
      weight: 400,
      style: "normal",
    })),
    loadGoogleFont("JetBrains Mono", 400, monoSubset).then((data) => ({
      name: "OgMono",
      data,
      weight: 400,
      style: "normal",
    })),
  ];

  if (CJK_RE.test(serifText)) {
    jobs.push(
      loadGoogleFont("Noto Serif SC", 400, serifSubset).then((data) => ({
        name: "OgSerif",
        data,
        weight: 400,
        style: "normal",
      }))
    );
  }

  return Promise.all(jobs);
}

// -----------------------------------------------------------------------------
// Cover image → data URI (read at build time; no runtime dependency)
// -----------------------------------------------------------------------------

function mimeFor(p: string): string {
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function loadCover(cover?: string): Promise<string | null> {
  if (!cover) return null;
  try {
    let buf: Buffer;
    if (/^https?:\/\//.test(cover)) {
      buf = Buffer.from(await (await fetch(cover)).arrayBuffer());
    } else {
      const fp = path.join(process.cwd(), "public", cover.replace(/^\//, ""));
      buf = await fs.readFile(fp);
    }
    return `data:${mimeFor(cover)};base64,${buf.toString("base64")}`;
  } catch {
    // Missing/unreachable cover → fall back to the flat typographic card.
    return null;
  }
}

// -----------------------------------------------------------------------------
// Card
// -----------------------------------------------------------------------------

export interface OgCardInput {
  /** Big serif headline — section name or post title. */
  title: string;
  /** Mono path shown top-right, e.g. "/writing" or "hux.pro". */
  eyebrow: string;
  /** Mono system line under the title — tagline or "2024 · 12 min read". */
  meta?: string;
  /** Optional cover image path (local "/img/…" or remote URL). */
  cover?: string;
}

function titleSize(title: string): number {
  // CJK glyphs are visually ~2× a Latin char; weight the length accordingly.
  const cjk = (title.match(new RegExp(CJK_RE, "g")) || []).length;
  const weighted = title.length + cjk;
  if (weighted <= 20) return 92;
  if (weighted <= 36) return 74;
  if (weighted <= 60) return 58;
  return 46;
}

function Card({
  title,
  eyebrow,
  meta,
  coverUri,
}: OgCardInput & { coverUri: string | null }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: COLOR.bg,
        color: COLOR.fg,
        fontFamily: "OgMono",
        padding: 80,
      }}
    >
      {coverUri ? (
        // Satori renders raw <img>; next/image is not valid inside ImageResponse.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUri}
          alt=""
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            objectFit: "cover",
          }}
        />
      ) : null}

      {coverUri ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            background:
              "linear-gradient(180deg, rgba(20,20,20,0.55) 0%, rgba(20,20,20,0.72) 52%, rgba(20,20,20,0.94) 100%)",
          }}
        />
      ) : null}

      {/* Header: brand mark + path */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 28,
          letterSpacing: 1,
          color: COLOR.muted,
        }}
      >
        <span style={{ color: COLOR.fg }}>λhux</span>
        <span>{eyebrow}</span>
      </div>

      <div style={{ display: "flex", flex: 1 }} />

      {/* Title + system meta, bottom-anchored */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "OgSerif",
            fontSize: titleSize(title),
            lineHeight: 1.1,
            letterSpacing: -0.5,
            color: COLOR.fg,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        {meta ? (
          <div
            style={{
              display: "flex",
              marginTop: 32,
              paddingTop: 28,
              borderTop: `1px solid ${COLOR.hairline}`,
              fontSize: 27,
              letterSpacing: 0.5,
              color: COLOR.muted,
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export async function renderOgImage(input: OgCardInput): Promise<ImageResponse> {
  const coverUri = await loadCover(input.cover);
  const monoText = `${input.eyebrow}${input.meta ?? ""}λhux`;
  const fonts = await loadFonts(input.title, monoText);

  return new ImageResponse(<Card {...input} coverUri={coverUri} />, {
    ...OG_SIZE,
    fonts,
  });
}
