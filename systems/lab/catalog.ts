import type { Locale } from "@/lib/i18n";
import vitrePackage from "@/packages/vitre/package.json";

/**
 * The `/lab` family: the site, studied from the inside.
 *
 * Each lab lays one of this site's own systems open: the real components,
 * the real policy, the real state, with the knobs that tune them. None is a
 * mock; a lab is where a system is looked at, not where a copy of it is.
 *
 *   - `/lab` is the index: every lab as a card wearing its widget surface
 *     (systems/lab/surfaces), the same surface the home screen's Lab
 *     widget rotates through, for a visitor who adds it.
 *   - `/lab/works` is the one that still writes: log.json, edited over the
 *     /works timeline as it prints (on a wide screen, in `next dev`).
 *   - The others are readouts of a system (attachments, icon, legibility,
 *     glow), each with a panel of knobs.
 *
 * This family used to live under `/editor` and was called the editor family;
 * next.config.ts keeps every old address pointing here.
 *
 * Public, and quiet about it: the family is a study of the site's insides,
 * not what most visitors came for. So the palette finds Labs by name but
 * never offers it (`searchOnly`; `/` `E` still opens the index), and its
 * home widget is off until a visitor adds it (components/home/widgets.ts;
 * the grid's edit mode, or the switch on the index). The dropdown on each
 * lab's sticky bar (`LabNav`) is how you move between the labs.
 *
 * A lab is one of three kinds:
 *
 *   study       one of this site's systems laid open (most of them)
 *   library     a system that left as a package. Vitre is the first. Its lab
 *               is the library's home, in the library template
 *               (components/library.tsx): its docs, its API reference and
 *               how this site uses it, under one header. Its content stays
 *               in the package, where the type check holds it to the API.
 *   experience  a feeling, in a few seconds and a few touches: one
 *               self-contained document in `public/`, which the home
 *               folder opens as an app (content/apps.json) and its lab
 *               frames beside the story it came from
 *               (components/experience.tsx). The Wardrobe is the first.
 *
 * Adding a lab: an entry here, a route under `app/lab/<id>`, a surface in
 * `systems/lab/surfaces`, the `LabShell` (or, for a library, the
 * `LibraryShell`) around the page, and its words in both languages: a
 * `strings.ts` beside it, read with `useLabStrings` (systems/lab/i18n.ts).
 * Every lab is bilingual; code names stay as written. docs/system-lab.md has
 * the rest.
 */

export type LabId = "works" | "attachments" | "icon" | "legibility" | "glow" | "band" | "vitre" | "wardrobe" | "torch";

/** Words in both languages. */
export type Text = Record<Locale, string>;

interface LabBase {
  id: LabId;
  href: string;
  /** The lab's name: `Glow Lab` / `光实验室`. */
  name: Text;
  /** The mono mark in the switcher and on the card: the file or system it opens. */
  mark: string;
  /** One line: which system it lays open. */
  hint: Text;
  /** What it is for, a sentence or two, behind the bar's info button. */
  blurb: Text;
}

/** One of this site's systems, laid open with its knobs. */
export interface StudyLab extends LabBase {
  kind: "study";
}

/** A system of this site, published as a package: its lab is its home. */
export interface LibraryLab extends LabBase {
  kind: "library";
  library: LibraryInfo;
}

/** A feeling, a few seconds long: one document, framed beside its story. */
export interface ExperienceLab extends LabBase {
  kind: "experience";
  experience: ExperienceInfo;
}

export type LabEntry = StudyLab | LibraryLab | ExperienceLab;

/** Where an experience's document is, and what opens it elsewhere. */
export interface ExperienceInfo {
  /** The document itself, under public/: what the lab frames and the app opens. */
  src: string;
  /** Its entry in content/apps.json: the icon on the home screen. */
  app: string;
}

/** What a library's header says about the package, read from it, not retyped. */
export interface LibraryInfo {
  /** The name it is imported by. */
  package: string;
  version: string;
  /** What it needs from the host, one line (its peer dependencies). */
  requires: string;
  /** The package's folder in this site's repository. */
  source: string;
  /** Its npm page; null while it lives only in this repository. */
  npm: string | null;
  /** The demo's own page, which the simulator frames and a phone opens full screen. */
  demo: string;
}

/** This site's repository, at main (GitHub takes a file or a folder here). */
export const SITE_REPO = "https://github.com/Huxpro/hux.pro/tree/main";

export const LAB_INDEX = {
  href: "/lab",
  name: { en: "Lab", zh: "实验室" } satisfies Text,
  mark: "lab",
} as const;

export const LABS: readonly LabEntry[] = [
  {
    id: "works",
    href: "/lab/works",
    kind: "study",
    name: { en: "Works Lab", zh: "作品实验室" },
    mark: "log.json",
    hint: {
      en: "The /works timeline, as it prints",
      zh: "/works 时间线，如其排印",
    },
    blurb: {
      en: "content/log.json rendered by the production timeline, in each of its forms. On a wide screen, Inspect edits the log in place and Save writes it back (in next dev).",
      zh: "由线上时间线渲染的 content/log.json，三种形态皆可切换。宽屏下「检查」可就地编辑，「保存」写回文件（仅 next dev）。",
    },
  },
  {
    id: "attachments",
    href: "/lab/attachments",
    kind: "study",
    name: { en: "Attachments Lab", zh: "附件实验室" },
    mark: "attachments",
    hint: {
      en: "Where a commit's media opens",
      zh: "一条提交的媒体在哪里打开",
    },
    blurb: {
      en: "What happens when I press this? Answered for every kind of thing a commit attaches, on every viewport, by the site's own surfaces.",
      zh: "按下它会发生什么？对一条提交能附带的每一种东西，在每一种视口下，由本站自己的界面作答。",
    },
  },
  {
    id: "icon",
    href: "/lab/icon",
    kind: "study",
    name: { en: "Icon Lab", zh: "图标实验室" },
    mark: "icon.json",
    hint: {
      en: "The generative app icon",
      zh: "生成式的应用图标",
    },
    blurb: {
      en: "The app icon is generated from a wordmark and a textured ground. Every lever is here, previewed at every size it ships; Save rewrites the icon and its home-screen PNGs (in next dev).",
      zh: "应用图标由一枚字标和一层纹理底色生成。每根杠杆都在这里，按实际出货的每个尺寸预览；「保存」会重写图标与主屏 PNG（仅 next dev）。",
    },
  },
  {
    id: "legibility",
    href: "/lab/legibility",
    kind: "study",
    name: { en: "Legibility Lab", zh: "可读性实验室" },
    mark: "legibility",
    hint: {
      en: "Ink, glass and wallpaper",
      zh: "墨色、玻璃与壁纸",
    },
    blurb: {
      en: "Can I read this? Every wallpaper, both materials, both tints, and one of every surface the site draws text on. Every number in the system is a slider.",
      zh: "这能读清吗？每一张壁纸、两种材质、两种着色，以及本站每一种承载文字的界面。系统里的每个数字都是一根滑杆。",
    },
  },
  {
    id: "glow",
    href: "/lab/glow",
    kind: "study",
    name: { en: "Glow Lab", zh: "光实验室" },
    mark: "glow",
    hint: {
      en: "The one light, at every scale",
      zh: "同一束光，在每一种尺度",
    },
    blurb: {
      en: "One light for the whole site: Siri's ring, as a shader on the edge of a rounded box. Every specimen is the production <Glow>, drawn by the one shared renderer. Try the microphone.",
      zh: "全站只有一束光：Siri 的光环，作为圆角盒边缘上的着色器。每个样本都是线上的 <Glow>，由同一个渲染器绘制。试试麦克风。",
    },
  },
  {
    id: "band",
    href: "/lab/band",
    name: { en: "Band Lab", zh: "顶部带实验室" },
    mark: "dock",
    kind: "study",
    hint: {
      en: "The top of the screen, shared",
      zh: "屏幕顶部，谁来共用",
    },
    blurb: {
      en: "Live Activities, parked windows, a notice and a page's pinned bar all reach for one strip at the top. Compose how they share it on the real Dock and real bars (each choice is an overflow strategy), and hold it to four rules measured off the page.",
      zh: "实时活动、停靠的窗口、提示和页面的吸顶工具栏，都要争顶部这一条。在真实的 Dock 和真实的工具栏上组合它们怎么共用（每个选择都是一种溢出策略），再用从页面上量出来的四条规则检查。",
    },
  },
  {
    id: "wardrobe",
    href: "/lab/wardrobe",
    name: { en: "The Wardrobe", zh: "衣柜" },
    mark: "dream",
    kind: "experience",
    experience: {
      src: "/dreams/wardrobe/index.html",
      app: "dream-wardrobe",
    },
    hint: {
      en: "A childhood nightmare, in three blinks",
      zh: "童年的一个噩梦，三次闭眼",
    },
    blurb: {
      en: "A tall thin man in black, under a round hat far too big for him, stood in my wardrobe, then at my bed. I woke, and the wardrobe door really was opening. Hold to close your eyes; each time you open them, he is closer.",
      zh: "一个穿黑衣服、又高又瘦、戴着一顶大得出奇的圆帽子的男人，先站在我的衣柜里，后来站在我的床头。我醒了，衣柜门真的正在打开。按住闭上眼睛；每次睁开，他都更近一些。",
    },
  },
  {
    id: "torch",
    href: "/lab/torch",
    name: { en: "Torch", zh: "手电" },
    mark: "dream",
    kind: "experience",
    experience: {
      src: "/dreams/torch/index.html",
      app: "dream-torch",
    },
    hint: {
      en: "The same dream, under the blanket",
      zh: "同一个梦，躲在被子里",
    },
    blurb: {
      en: "Under the blanket with a torch, as a child does. Wherever you shine, he is not there: his eyes are always in the dark just outside the beam, and whenever the light leaves the wardrobe its door opens a little more. Then the torch begins to fail.",
      zh: "像小时候那样，躲在被子里打着手电。照到哪里，他都不在那里：他的眼睛总在光圈外的黑暗里；光一离开衣柜，柜门就又开了一点。然后，手电开始没电了。",
    },
  },
  {
    id: "vitre",
    href: "/lab/vitre",
    name: { en: "Vitre", zh: "Vitre 窗玻璃" },
    mark: "vitre",
    kind: "library",
    library: {
      package: vitrePackage.name,
      version: vitrePackage.version,
      requires: `React ${vitrePackage.peerDependencies.react}`,
      source: `${SITE_REPO}/packages/vitre`,
      npm: vitrePackage.private ? null : `https://www.npmjs.com/package/${vitrePackage.name}`,
      // The demo's page itself: /vitre sends anything but a phone back here.
      demo: "/vitre/index.html",
    },
    hint: {
      en: "Safari's glass, in your colours",
      zh: "让 Safari 的玻璃，显示你的颜色",
    },
    blurb: {
      en: "A React package from this site: it tints Safari's toolbar and status bar live on iOS 26, draws a bezel around the page, and scrolls the page in a container so its edges hold still. Its documentation, with a simulated iPhone running the demo; on a phone, the demo itself.",
      zh: "出自本站的一个 React 包：在 iOS 26 上实时给 Safari 的工具栏和状态栏着色，给页面画一圈边框，并让页面在容器里滚动、边缘稳住。这里是它的文档，旁边一台模拟的 iPhone 跑着演示；在手机上，就是演示本身。",
    },
  },
];

/**
 * The three kinds, in the order the index and the switcher show them, with
 * their headings (lib/i18n). Experiences lead: they are the one kind made for
 * whoever wanders in, not for someone reading the site's insides.
 */
export const LAB_GROUPS = [
  { kind: "experience", title: "labExperiences", note: "labExperiencesNote" },
  { kind: "library", title: "labLibraries", note: "labLibrariesNote" },
  { kind: "study", title: "labStudies", note: "labStudiesNote" },
] as const;

export function labById(id: LabId): LabEntry {
  return LABS.find((lab) => lab.id === id)!;
}

/** A library lab by id. A study's id is a mistake, caught here. */
export function libraryById(id: LabId): LibraryLab {
  const lab = labById(id);
  if (lab.kind !== "library") throw new Error(`${id} is a study, not a library`);
  return lab;
}

/** An experience lab by id. Any other kind is a mistake, caught here. */
export function experienceById(id: LabId): ExperienceLab {
  const lab = labById(id);
  if (lab.kind !== "experience") throw new Error(`${id} is a ${lab.kind}, not an experience`);
  return lab;
}

/** The lab a path belongs to, or null for the index (and anything unknown). */
export function labFromPath(pathname: string): LabEntry | null {
  // `/lab/attachment` (singular) and any nested lab path land on their lab.
  const segment = pathname.replace(/^\/lab\/?/, "").split("/")[0];
  if (!segment) return null;
  if (segment === "attachment") return labById("attachments");
  return LABS.find((lab) => lab.id === segment) ?? null;
}
