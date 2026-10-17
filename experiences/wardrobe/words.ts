import { words } from "../common/words";

export const WORDS = words({
  zh: { hint: "按住，闭上眼睛", again: "再闭一次" },
  en: { hint: "Hold to close your eyes", again: "Close them again" },
});

export type Words = typeof WORDS;
