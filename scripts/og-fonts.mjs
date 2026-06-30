// =============================================================================
// og-fonts — bake the fonts the OG image system needs into the repo.
//
// The OG cards (lib/og-image.tsx) render with Newsreader (serif), JetBrains
// Mono (system layer) and Noto Serif SC (CJK serif). Fetching these from Google
// Fonts *during the build* is fragile: `next build` statically generates ~40 OG
// routes, firing hundreds of font requests, and a single failed/ rate-limited
// fetch throws and fails the whole build (this is what broke Vercel).
//
// So instead we bake the fonts to disk once — exactly like og:snapshot bakes
// link previews — and the build reads them locally with no network at all.
//
// Latin faces are subset to the full printable Latin range, so *any* English
// title renders forever. The CJK face is subset to the characters that actually
// appear in current post titles plus a common-Hanzi cushion; if you add a
// Chinese post with a glyph outside that set, re-run this script:
//
//     node scripts/og-fonts.mjs        (or: pnpm og:fonts)
//
// =============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "lib", "og-fonts");
const blogDir = path.join(root, "content", "blog");

// --- glyph universe -------------------------------------------------------

// Full printable Latin: ASCII + Latin-1 supplement + the typographic marks the
// cards use. Keeps English/Latin titles working without ever re-running this.
const LATIN = (() => {
  let s = "";
  for (let c = 0x20; c <= 0x7e; c++) s += String.fromCharCode(c); // ASCII
  for (let c = 0xa0; c <= 0xff; c++) s += String.fromCharCode(c); // Latin-1
  return s + "λ·—–…‘’“”→";
})();

// Static strings the section/home cards render (all Latin, but harmless to add).
const SECTION_STRINGS = [
  "Hux.Pro",
  "hux.pro",
  "Prose · Profession · Programming · Production · Projects",
  "Writing",
  "/writing",
  "thoughts on craft, software, and practice",
  "Works",
  "/works",
  "commit history — profession as git log",
  "Documentation",
  "/docs",
  "technical architecture and design decisions",
  "System Prompts",
  "/prompts",
  "quotes, principles, and role models",
  "λhux",
  "min read",
].join("");

// A cushion of common Hanzi so most *future* Chinese titles render without a
// refresh (mirrors the common set used elsewhere in the app).
const COMMON_HANZI =
  "的一是了不人有我他这个们中来上大为和国地到以说时要就出会可也你对生能而子那得于着下自之年过发后作里用道行所然家种事成方多经么去法学如都同现当没动面起看定天分还进好小部其些主样理心她本前开但因只从想实日军者意无力它与长把机十民第公此已工使情明性知全三又关点正业外将两高间由问很最重并物手应战向头文体政美相见被利什二等产或新己制身果加西斯月话合回特代内信表化老给世位次度门任常先海通教儿原东声提立及比员解水名真论处走义各入几口认条平系气题活尔更别打女变四神总何电数安少报才结反受目太量再感建务做接必场件计管期市直德资命山金指克许统区保至队形社便空决治展马科司五基眼书非则听白却界达光放强即像难且权思王象完设式色路记南品住告类求据程北边死张该交规万取拉格望觉术领共确传师观清今切院让识候带导争运笑飞风步改收根干造言联持组每济车亲极林服快办议往元英士证近失转夫令准布始怎呢存未远叫台单影具罗字爱击流备兵连调深商算质团集百需价花党华城石级整府离况亚请技际约示复病息究线似官火断精满支视消越器容照须九增研写称企八功吗包片史委乎查轻易早星周离";

const charset = new Set();
for (const ch of LATIN) charset.add(ch);
for (const ch of SECTION_STRINGS) charset.add(ch);
for (const ch of COMMON_HANZI) charset.add(ch);

// Add every glyph from every post title (en + zh frontmatter).
for (const file of fs.readdirSync(blogDir)) {
  if (!file.endsWith(".mdx")) continue;
  const { data } = matter(fs.readFileSync(path.join(blogDir, file), "utf8"));
  for (const key of ["title", "description"]) {
    const v = data[key];
    if (typeof v === "string") for (const ch of v) charset.add(ch);
  }
}

const text = [...charset].join("");

// --- fetch + write --------------------------------------------------------

async function bake(family, weight, file) {
  const url =
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}` +
    `:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src:\s*url\(([^)]+)\)\s*format/)?.[1];
  if (!src) throw new Error(`could not resolve font URL for ${family} ${weight}`);
  const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
  fs.writeFileSync(path.join(outDir, file), buf);
  console.log(`  ${file.padEnd(22)} ${(buf.length / 1024).toFixed(1)} KB`);
}

fs.mkdirSync(outDir, { recursive: true });
console.log(`Baking OG fonts (${charset.size} glyphs) → lib/og-fonts/`);
await bake("Newsreader", 400, "newsreader-400.ttf");
await bake("JetBrains Mono", 400, "jetbrains-mono-400.ttf");
await bake("Noto Serif SC", 400, "noto-serif-sc-400.ttf");
console.log("Done.");
