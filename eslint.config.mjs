import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * A floating surface must paint with the `--glass*` tokens, not its own alpha.
 *
 * The Glass setting (Tinted / Clear; see docs/system-glass.md) swaps those
 * tokens from one class on <html>. A surface that hardcodes `bg-card/70` does
 * not respond to it, and stays an opaque slab beside washed-out neighbours.
 * That contract used to live in a comment claiming "every floating System UI
 * surface" already followed it, which was no longer true for eleven
 * surfaces. A comment cannot catch a twelfth; this rule can.
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

/**
 * Reintent's intent layer is not React. Its `useIntent` / `usePath` / `useCtx`
 * are reads of values known by path (docs/system-reintent-core.md: values, not
 * signals), so a read may sit under an `if`: React's call-order rule does not
 * apply to them. The React view (experiences/reintent/main.tsx) keeps it.
 */
const REINTENT_INTENT_LAYER = {
  files: ["packages/reintent-core/src/**/*.ts", "packages/reintent-core/test/**/*.{ts,tsx}", "experiences/reintent/intents/**/*.ts"],
  rules: { "react-hooks/rules-of-hooks": "off" },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  GLASS_TOKENS_ONLY,
  REINTENT_INTENT_LAYER,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // vitre site build output, generated into public at build time.
    "public/vitre/**",
    // experiences build output, generated into public at build time.
    "public/scenes/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
