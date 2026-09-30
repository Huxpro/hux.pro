import type { Locale } from "@/lib/i18n";

/**
 * The `/lab` family — the site, studied from the inside.
 *
 * Each lab lays one of this site's own systems open: the real components,
 * the real policy, the real state, with the knobs that tune them. None is a
 * mock; a lab is where a system is looked at, not where a copy of it is.
 *
 *   - `/lab` is the index: every lab as a card wearing its widget surface
 *     (components/lab/surfaces), the same surface the home screen's Lab
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
 * home widget is off until a visitor adds it (components/home/widgets.ts —
 * the grid's edit mode, or the switch on the index). The dropdown on each
 * lab's sticky bar (`LabNav`) is how you move between the labs.
 *
 * Adding a lab: an entry here, a route under `app/lab/<id>`, a surface in
 * `components/lab/surfaces`, the `LabShell` around the page, and its words
 * in both languages — a `strings.ts` beside it, read with `useLabStrings`
 * (app/lab/i18n.ts). Every lab is bilingual; code names stay as written.
 */

export type LabId = "works" | "attachments" | "icon" | "legibility" | "glow";

type Text = Record<Locale, string>;

export interface LabEntry {
  id: LabId;
  href: string;
  /** The lab's name — `Glow Lab` / `光实验室`. */
  name: Text;
  /** The mono mark in the switcher and on the card: the file or system it opens. */
  mark: string;
  /** One line: which system it lays open. */
  hint: Text;
  /** What it is for, a sentence or two — behind the bar's info button. */
  blurb: Text;
}

export const LAB_INDEX = {
  href: "/lab",
  name: { en: "Lab", zh: "实验室" } satisfies Text,
  mark: "lab",
  blurb: {
    en: "This site, studied from the inside. Each lab lays one of its own systems open — the real components, the real policy, with the knobs that tune them.",
    zh: "研究本站自身的实现。每间实验室剖开它的一个系统——真的组件、真的策略，以及调它们的旋钮。",
  } satisfies Text,
} as const;

export const LABS: readonly LabEntry[] = [
  {
    id: "works",
    href: "/lab/works",
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
    name: { en: "Attachments Lab", zh: "附件实验室" },
    mark: "attachments",
    hint: {
      en: "Where a commit's media opens",
      zh: "一条提交的媒体在哪里打开",
    },
    blurb: {
      en: "The question “what happens when I press this?”, answered for every kind of thing a commit attaches, on every viewport — with the site's own surfaces doing the answering.",
      zh: "「按下它会发生什么？」——对一条提交能附带的每一种东西、在每一种视口下作答，答题的是本站自己的界面。",
    },
  },
  {
    id: "icon",
    href: "/lab/icon",
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
    name: { en: "Legibility Lab", zh: "可读性实验室" },
    mark: "legibility",
    hint: {
      en: "Ink, glass and wallpaper",
      zh: "墨色、玻璃与壁纸",
    },
    blurb: {
      en: "Can I read this? Every wallpaper, both materials, both tints, and one of every surface the site draws text on — with every number in the system a slider.",
      zh: "这能读清吗？每一张壁纸、两种材质、两种着色，以及本站每一种承载文字的界面——系统里的每个数字都是一根滑杆。",
    },
  },
  {
    id: "glow",
    href: "/lab/glow",
    name: { en: "Glow Lab", zh: "光实验室" },
    mark: "glow",
    hint: {
      en: "The one light, at every scale",
      zh: "同一束光，在每一种尺度",
    },
    blurb: {
      en: "One light for the whole site — Siri's ring, as a shader on the edge of a rounded box. Every specimen is the production <Glow>, drawn by the one shared renderer. Try the microphone.",
      zh: "全站只有一束光——Siri 的光环，作为圆角盒边缘上的着色器。每个样本都是线上的 <Glow>，由同一个渲染器绘制。试试麦克风。",
    },
  },
];

export function labById(id: LabId): LabEntry {
  return LABS.find((lab) => lab.id === id)!;
}

/** The lab a path belongs to, or null for the index (and anything unknown). */
export function labFromPath(pathname: string): LabEntry | null {
  // `/lab/attachment` (singular) and any nested lab path land on their lab.
  const segment = pathname.replace(/^\/lab\/?/, "").split("/")[0];
  if (!segment) return null;
  if (segment === "attachment") return labById("attachments");
  return LABS.find((lab) => lab.id === segment) ?? null;
}
