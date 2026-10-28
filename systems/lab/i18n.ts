"use client";

// =============================================================================
// Lab strings: both languages, keyed, local to each lab.
//
// The labs are devtools, so their copy lives beside them (a `strings.ts` in
// each lab, `STRINGS` here for the frame) rather than in the site dictionary
// (`lib/i18n.ts`), which holds what visitors read. Every table is written
// the same way (`const en = {…}`, then `const zh: typeof en = {…}` so a
// missing or extra key is a type error) and read with `useLabStrings`.
// A string that takes a value is a function in both (`(n: number) => …`).
//
// What stays untranslated, on purpose: code (component, prop, file and
// JSON key names, CSS classes, route paths), because that is what you
// would search the repo for. A label is translated; the identifier it
// names is not.
// =============================================================================

import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/services";

export type LabTable<T> = Record<Locale, T>;

/** This lab's strings in the reader's language. */
export function useLabStrings<T>(table: LabTable<T>): T {
  const { locale } = useLocale();
  return table[locale];
}

/** The frame's own words: the shell, the switcher, the shared controls. */
const frameEn = {
  controls: "Controls",
  everyLab: "Every lab",
  unsaved: "unsaved",
  labs: "Labs",
  colorPicker: "Colour picker",
  about: "About this lab",
};

const frameZh: typeof frameEn = {
  controls: "控制面板",
  everyLab: "全部实验室",
  unsaved: "未保存",
  labs: "实验室",
  colorPicker: "取色器",
  about: "关于这间实验室",
};

export const FRAME_STRINGS: LabTable<typeof frameEn> = { en: frameEn, zh: frameZh };

export function useFrameStrings() {
  return useLabStrings(FRAME_STRINGS);
}
