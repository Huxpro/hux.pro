// The page's words, in the site's language (read from the same origin); ?lang= wins.

const zh = {
  hint: "按住，闭上眼睛",
  again: "再闭一次",
  epilogue: "小时候，他隔三差五就来看我。",
  replay: "轻触 · 再梦一次",
  sound: "声音",
};

const en: typeof zh = {
  hint: "Hold to close your eyes",
  again: "Close them again",
  epilogue: "When I was little, he came to watch me every few nights.",
  replay: "Tap · dream it again",
  sound: "Sound",
};

export type Words = typeof zh;

function lang(): "zh" | "en" {
  const asked = new URLSearchParams(location.search).get("lang");
  if (asked === "zh" || asked === "en") return asked;
  try {
    const stored = localStorage.getItem("locale");
    if (stored === "zh" || stored === "en") return stored;
  } catch {}
  return /^zh/i.test(navigator.language) ? "zh" : "en";
}

export const LANG = lang();
export const WORDS: Words = LANG === "zh" ? zh : en;
