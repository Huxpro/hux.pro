import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * A floating surface must paint with the `--glass*` tokens, not its own alpha.
 *
 * The Glass setting (Tinted / Clear — see docs/system-glass.md) swaps those
 * tokens from one class on <html>. A surface that hardcodes `bg-card/70` does
 * not respond to it, and stays an opaque slab beside washed-out neighbours.
 * That contract used to live in a comment claiming "every floating System UI
 * surface" already followed it, which had quietly become false for eleven
 * surfaces. A comment cannot notice the twelfth; this can.
 *
 * Three things are banned:
 *
 * 1. `bg-card/NN` and `bg-popover/NN` — the alpha ladder the tokens replaced.
 * 2. A raw `bg-white/…`, `bg-black/…`, `bg-foreground/…` or `bg-neutral-N/…`
 *    fill in the same class string as a `backdrop-blur`. A blurred raw fill is
 *    a floating surface by definition, and blur is what tells it apart from an
 *    ink wash — a recessed track or a hover deepening is *supposed* to be drawn
 *    relative to the content in front of it, and stays raw. Surfaces over media
 *    (a play badge on a video, a scrim on a wallpaper tile) are borrowing the
 *    picture's own dark, not the System material, so those directories are out.
 * 3. The retired `bg-glass-strong` / `bg-glass-overlay` names. Tailwind emits
 *    nothing for a class it does not know, so a stale name is a surface that
 *    silently stops painting.
 */
const RAW_FILL = String.raw`bg-(white|black|foreground|neutral-\d+)\/`;
const BLURRED_RAW_FILL = new RegExp(
  String.raw`(backdrop-blur[^"'\`]*${RAW_FILL})|(${RAW_FILL}[^"'\`]*backdrop-blur)`,
);
const CARD_ALPHA = /(^|[\s"'`:])(hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:)*bg-(card|popover)\//;
const RETIRED_TOKEN = /bg-glass-(strong|overlay)/;

const TOKENS_MESSAGE =
  "Floating surfaces must use the glass roles (bg-glass, bg-glass-hover, bg-glass-raised, bg-glass-solid, bg-glass-panel, bg-glass-sheet, bg-glass-popover) so they follow the Tinted/Clear setting. See docs/system-glass.md.";
const BLUR_MESSAGE =
  "A blurred raw fill is a floating surface that skipped the glass roles — use bg-glass* so it follows the Tinted/Clear setting. Ink washes (a recessed track, a hover deepening) stay raw and belong in lib/glass.ts. See docs/system-glass.md.";
const RETIRED_MESSAGE =
  "bg-glass-strong / bg-glass-overlay were renamed for their role: bg-glass-raised, bg-glass-solid (the old -strong-hover) and bg-glass-panel. See docs/system-glass.md.";

/** The same check on both spellings of a class string. */
const banned = (pattern, message) => [
  { selector: `Literal[value=/${pattern.source}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern.source}/]`, message },
];

const GLASS_TOKENS_ONLY = {
  files: ["**/*.{ts,tsx}"],
  ignores: [
    // Where the ink washes live, deliberately and in one place.
    "lib/glass.ts",
    // Over media, not over the page: badges and scrims borrow the picture's
    // own dark rather than the System material.
    "components/log/media/**",
    // Design mockups of an always-dark stage.
    "app/editor/theater-variants/**",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      ...banned(CARD_ALPHA, TOKENS_MESSAGE),
      ...banned(BLURRED_RAW_FILL, BLUR_MESSAGE),
      ...banned(RETIRED_TOKEN, RETIRED_MESSAGE),
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  GLASS_TOKENS_ONLY,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
