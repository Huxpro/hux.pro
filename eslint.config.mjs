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
 */
const GLASS_TOKENS_ONLY = {
  files: ["**/*.{ts,tsx}"],
  ignores: ["lib/glass.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "Literal[value=/(^|[\\s\"'`:])(hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:)*bg-(card|popover)\\//]",
        message:
          "Floating surfaces must use the glass tokens (bg-glass, bg-glass-strong, bg-glass-overlay, bg-glass-sheet, bg-glass-popover, and their -hover variants) so they follow the Tinted/Clear setting. See docs/system-glass.md.",
      },
      {
        selector:
          "TemplateElement[value.raw=/(^|[\\s\"'`:])(hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:)*bg-(card|popover)\\//]",
        message:
          "Floating surfaces must use the glass tokens (bg-glass, bg-glass-strong, bg-glass-overlay, bg-glass-sheet, bg-glass-popover, and their -hover variants) so they follow the Tinted/Clear setting. See docs/system-glass.md.",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  GLASS_TOKENS_ONLY,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // vitre site build output, generated into public at build time.
    "public/vitre/**",
    "packages/vitre/site/dist/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
