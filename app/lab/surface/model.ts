// =============================================================================
// Surface Physics — the data model behind the interactive design-language page.
//
// Every floating surface on the site is described by two latent state variables
// (see docs/design-philosophy.md and components/ui/surface.ts):
//
//   • Z — ELEVATION. How far off the content plane a surface floats. Read off
//     the shadow tier (none → raised → overlay) and the blur radius. A veil
//     hugs the page; a modal floats clearly above it.
//
//   • A — PRESENCE / AUTHORITY. How much the surface insists on itself,
//     encoded by fill opacity α. Glass (α 50–70) invites you to see through it;
//     solid (α 75–95) demands to be the subject; a scrim (low α on the content
//     plane) is translucent *by function* — its whole job is to dim.
//
// Everything else (base colour token, border, blur) is derived from where a
// surface sits on these two axes.
//
// L1 — STAY CONNECTED TO REALITY. The *sanctioned* glass surfaces below are not
// re-transcribed here: they are built from `glassSpec()` in components/ui/surface.ts
// — the same authority `surface()` renders from — so the plot literally cannot
// disagree with what the primitive ships. Shadow values come from the same CSS
// vars the site uses (var(--shadow-*)). The remaining entries are documented
// *exceptions* the primitive doesn't (and shouldn't) express — popover modals,
// off-token media/window chrome, scrims, and one historical bug — and are the
// only hand-authored numbers on the page.
// =============================================================================

import {
  GLASS_FILLS,
  glassSpec,
  type Elevation,
  type Fill,
} from "@/components/ui/surface";

/** Which CSS colour-var family a surface belongs to — a declaration of layer, not a colour choice. */
export type Plane = "background" | "card" | "popover" | "media";

/** Shadow elevation tier, matching the --shadow-* tokens. */
export type Shadow = "none" | "raised" | "overlay";

/** Blur radius bucket → px, matching Tailwind's backdrop-blur scale. */
export type Blur = "none" | "sm" | "md" | "xl";

export const BLUR_PX: Record<Blur, number> = { none: 0, sm: 4, md: 12, xl: 24 };

/** Normalize a blur (bucket or raw px) to px. */
export function toBlurPx(b: Blur | number): number {
  return typeof b === "number" ? b : BLUR_PX[b];
}

// Shadow values are owned by globals.css (--shadow-*); reference them by var so
// the specimens render the exact site shadows and never carry a stale copy.
export const SHADOW_CSS: Record<Shadow, string> = {
  none: "none",
  raised: "var(--shadow-raised)",
  overlay: "var(--shadow-overlay)",
};

/** The three presence bands α falls into. */
export type Band = "scrim" | "glass" | "solid";

/** Top of the sanctioned glass band — derived from surface()'s allowed fills. */
export const GLASS_MAX = Math.max(...GLASS_FILLS);

export function bandOf(plane: Plane, alpha: number): Band {
  // On the content plane a low α is a scrim (translucent on purpose to dim).
  if (plane === "background" && alpha <= 65) return "scrim";
  if (alpha <= GLASS_MAX) return "glass";
  return "solid";
}

export const BAND_LABEL: Record<Band, string> = {
  scrim: "SCRIM · 透明是功能",
  glass: "GLASS · ambient，可透视",
  solid: "SOLID · 权威，是主体",
};

export interface SurfaceSpec {
  id: string;
  /** Display name. */
  name: string;
  /** Source file the recipe lives in. */
  file: string;
  plane: Plane;
  /** Fill opacity α, 0–100. */
  alpha: number;
  /** Frost radius — a bucket ("xl") or raw px (24, when derived from glassSpec). */
  blur: Blur | number;
  shadow: Shadow;
  /** Border opacity 0–100, or null for no border. */
  border: number | null;
  /** Corner radius in px, for the specimen. */
  radius: number;
  /**
   * Plotted elevation rank 0–2 (continuous). Usually tracks `shadow`, but a few
   * surfaces float high yet *delegate* their shadow to an inner element, so
   * they carry an elevation their shadow tier alone wouldn't show.
   */
  z: number;
  /** One-line role in the system. */
  role: string;
  /** The physics note — why it sits where it sits. */
  note: string;
  /** Visual family for the plot legend. */
  status?: "canonical" | "fixed" | "drift" | "bug" | "special";
}

/** Fields a catalogue entry supplies on top of its derived surface shape. */
type SurfaceMeta = Pick<
  SurfaceSpec,
  "id" | "name" | "file" | "radius" | "z" | "role" | "note" | "status"
>;

/**
 * Build a *sanctioned* entry straight from `glassSpec()` — the same authority
 * `surface()` renders from. plane / α / blur / border / shadow are never typed
 * out here, so a sanctioned node cannot disagree with the shipped primitive.
 */
function glass(fill: Fill, elevation: Elevation, meta: SurfaceMeta): SurfaceSpec {
  const s = glassSpec({ fill, elevation });
  return {
    plane: s.plane,
    alpha: s.alpha,
    blur: s.blurPx,
    shadow: elevation,
    border: s.borderAlpha,
    ...meta,
  };
}

// The catalogue — every backdrop-blur surface found in the audit, placed by (A, Z).
//
// Two kinds of entry:
//   • glass(...)  — SANCTIONED. Derived from glassSpec(); guaranteed to match
//     surface(). If the primitive's recipe changes, these move with it.
//   • { ... }     — DOCUMENTED EXCEPTION. Off-token planes (media, window),
//     popover modals, scrims, and one historical bug: things surface() doesn't
//     express. These are the only hand-authored numbers on the page.
export const SURFACES: SurfaceSpec[] = [
  {
    id: "content",
    name: "Content / 正文",
    file: "prose-article",
    plane: "background",
    alpha: 100,
    blur: "none",
    shadow: "none",
    border: null,
    radius: 0,
    z: 0,
    role: "内容平面 — 一切浮层的地面",
    note: "系统的 z=0 基准。完全不透明、无影、无边：它就是页面本身。",
    status: "special",
  },
  {
    id: "scrim",
    name: "Scrim / 遮罩",
    file: "ruler-toc.tsx",
    plane: "background",
    alpha: 55,
    blur: "sm",
    shadow: "none",
    border: null,
    radius: 0,
    z: 1.2,
    role: "全屏 veil — 压暗内容以托起 modal",
    note: "一个『负』surface：低 α 不是因为它 ambient，而是因为它的天职就是让你看见被压暗的背景。field，不是 object。",
    status: "special",
  },
  {
    id: "media-btn",
    name: "Media play / 播放键",
    file: "media/youtube.tsx",
    plane: "media",
    alpha: 40,
    blur: "sm",
    shadow: "none",
    border: null,
    radius: 999,
    z: 0.4,
    role: "浮在图片/视频上的 chrome",
    note: "用字面 black/40，不用 theme token — 因为它漂在任意亮度的媒体上，不能假设背景。这是 media plane，另一套物理。",
    status: "special",
  },
  {
    id: "caption",
    name: "Caption / 角标",
    file: "commit-embed.tsx",
    plane: "background",
    alpha: 85,
    blur: "sm",
    shadow: "none",
    border: null,
    radius: 4,
    z: 0.3,
    role: "贴着媒体的 inline 计数/说明",
    note: "近页面的 inline chip：高 α 求清晰，但 z 极低、blur 很小 — 它不是浮空 object，是一枚标签。",
    status: "special",
  },
  {
    id: "editor-header",
    name: "Editor 吸顶头",
    file: "editor/commit-list.tsx",
    plane: "background",
    alpha: 95,
    blur: "sm",
    shadow: "none",
    border: 50,
    radius: 0,
    z: 0.3,
    role: "内部工具的 sticky header",
    note: "background/95 — 几乎实心的内容色板。它是 chrome，不是浮层。lang toast 旧 bug 正是错穿了这一层的物理。",
    status: "special",
  },
  glass(50, "raised", {
    id: "fab",
    name: "Command FAB",
    file: "systems/command/fab.tsx",
    radius: 24,
    z: 1,
    role: "常驻的浮空动作按钮",
    note: "最轻的 glass：α=50 透得最多。raised 的低飘 + xl frost = 一个明确的浮空 object。",
    status: "canonical",
  }),
  glass(50, "none", {
    id: "widget",
    name: "Homepage Widget",
    file: "components/ui/widget.tsx",
    radius: 16,
    z: 0.6,
    role: "首页玻璃卡片（hover 升到 70）",
    note: "静息时 α=50、无影贴地；hover 时 α→70 并浮起。它是唯一一个会沿 A 轴移动的 surface。",
    status: "canonical",
  }),
  glass(60, "raised", {
    id: "live-pill",
    name: "Live Activity · Pill",
    file: "dock/live-activity.tsx",
    radius: 999,
    z: 1,
    role: "折叠态的环境状态胶囊",
    note: "compact 形态：ambient、raised。报状态，不打断你。lang switch toast 现在就映射到这一档。",
    status: "canonical",
  }),
  glass(70, "overlay", {
    id: "live-panel",
    name: "Live Activity · Panel",
    file: "dock/live-activity.tsx",
    radius: 28,
    z: 2,
    role: "展开态的活动面板",
    note: "expanded 形态：仍是 glass(70)，但升到 overlay。系统里『需要注意』的最高一档 ambient 面板。",
    status: "canonical",
  }),
  glass(70, "none", {
    id: "peek",
    name: "Magnetic Peek",
    file: "motion-primitives/magnetic-preview.tsx",
    radius: 8,
    z: 1.5,
    role: "hover 预览面板（影子委托给内层）",
    note: "α/blur 都是 panel 档，但 shadow=none：影子被让给真正可见的内卡片。飘得高，却故意不自己投影。",
    status: "canonical",
  }),
  glass(60, "raised", {
    id: "toast-switch",
    name: "Lang Switch Toast ✓",
    file: "post/language-toast.tsx",
    radius: 999,
    z: 1,
    role: "切换语言后的环境反馈",
    note: "本次修复：从 background/95 迁到 card/60 — 精确落回 Live Activity 的 pill 档。",
    status: "fixed",
  }),
  glass(70, "overlay", {
    id: "toast-conflict",
    name: "Lang Conflict Toast ✓",
    file: "post/language-toast.tsx",
    radius: 12,
    z: 2,
    role: "分享链接语言冲突的决策卡",
    note: "本次修复：迁到 card/70 + overlay — 对齐 Live Activity 的 panel 档：需决策 = 更高的 z。",
    status: "fixed",
  }),
  {
    id: "toast-bug",
    name: "Lang Toast (旧 · bug)",
    file: "post/language-toast.tsx",
    plane: "background",
    alpha: 95,
    blur: "xl",
    shadow: "overlay",
    border: 50,
    radius: 12,
    z: 2,
    role: "错穿到 background 平面的浮层",
    note: "它写了 backdrop-blur-xl，却配 background/95。95% 内容色几乎实心，模糊完全失效 — 它有了『editor chrome』的物理，落在了错误的区域。",
    status: "bug",
  },
  {
    id: "masonry-done",
    name: "Masonry “Done” 按钮",
    file: "components/ui/sortable-masonry.tsx",
    plane: "card",
    alpha: 80,
    blur: "xl",
    shadow: "raised",
    border: 60,
    radius: 999,
    z: 1,
    role: "编辑态的完成按钮",
    note: "轻微漂移：card/80 + border/60。比 glass 档更实一点 — 也许是想让按钮读起来更『硬』，也可能只是没对齐。",
    status: "drift",
  },
  {
    id: "pip-overlay",
    name: "Theater PiP 控制条",
    file: "systems/theater/components/pip-overlay.tsx",
    plane: "card",
    alpha: 85,
    blur: "xl",
    shadow: "overlay",
    border: 60,
    radius: 12,
    z: 2,
    role: "画中画的悬浮控制条（较新）",
    note: "新证据：card 平面正伸进 solid 档。card/85 已越过 glass 上限(70) — 一个想读得更实的控制条，也是 surface() 尚未表达、正等着被界定的『solid card control』新档。",
    status: "drift",
  },
  {
    id: "palette",
    name: "Command Palette",
    file: "systems/command/palette.tsx",
    plane: "popover",
    alpha: 75,
    blur: "xl",
    shadow: "overlay",
    border: 50,
    radius: 16,
    z: 2,
    role: "模态命令面板",
    note: "最有意思的杂交点：Z 和 A 都拉满（modal + 权威），所以升到 popover 平面 — 但 α 只到 75、保留 xl，故意不做全实心，维持 OS 的通透感。",
    status: "canonical",
  },
  {
    id: "devtool",
    name: "Devtool Panel",
    file: "systems/devtool/panel.tsx",
    plane: "popover",
    alpha: 95,
    blur: "xl",
    shadow: "overlay",
    border: 50,
    radius: 16,
    z: 2,
    role: "内部调试面板",
    note: "popover/95 — A 轴拉满的纯 solid。内部工具，不参与美学叙事，只要绝对清晰。",
    status: "canonical",
  },
];

export const STATUS_META: Record<
  NonNullable<SurfaceSpec["status"]>,
  { label: string; hue: number }
> = {
  canonical: { label: "已合规", hue: 210 },
  fixed: { label: "本次修复", hue: 150 },
  drift: { label: "轻微漂移", hue: 45 },
  bug: { label: "旧 bug", hue: 5 },
  special: { label: "另一套物理", hue: 275 },
};

/** CSS var (or literal) for a plane's base fill colour. */
export function planeVar(plane: Plane): string {
  if (plane === "media") return "0 0 0"; // handled as literal black below
  return `var(--${plane})`;
}

/** Compose the live inline style for a surface spec (works without providers). */
export function surfaceStyle(spec: {
  plane: Plane;
  alpha: number;
  blur: Blur | number;
  shadow: Shadow;
  border: number | null;
  radius: number;
}): React.CSSProperties {
  const blurPx =
    typeof spec.blur === "number" ? spec.blur : BLUR_PX[spec.blur];
  const bg =
    spec.plane === "media"
      ? `rgb(0 0 0 / ${spec.alpha / 100})`
      : `color-mix(in oklch, ${planeVar(spec.plane)} ${spec.alpha}%, transparent)`;
  return {
    background: bg,
    backdropFilter: `blur(${blurPx}px)`,
    WebkitBackdropFilter: `blur(${blurPx}px)`,
    border:
      spec.border == null
        ? "1px solid transparent"
        : `1px solid color-mix(in srgb, var(--border) ${spec.border}%, transparent)`,
    boxShadow: SHADOW_CSS[spec.shadow],
    borderRadius: spec.radius,
  };
}
