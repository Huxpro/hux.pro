// The page's words, in the site's language (read from the same origin); ?lang= wins.
// The dreams share the ending; each adds its own (words(zh, en)).

const zh = {
  epilogue: "小时候，他隔三差五就来看我。",
  replay: "轻触 · 再梦一次",
  sound: "声音",
  drawing: "正在画…",
};

const en: typeof zh = {
  epilogue: "When I was little, he came to watch me every few nights.",
  replay: "Tap · dream it again",
  sound: "Sound",
  drawing: "drawing…",
};

export type CommonWords = typeof zh;

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

/** A dream's words, with the shared ones. */
export function words<W extends Record<string, string>>(own: { zh: W; en: W }): CommonWords & W {
  return { ...(LANG === "zh" ? zh : en), ...own[LANG] };
}
