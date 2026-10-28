import type { Locale } from "@/lib/i18n";
import type { AskDoc } from "./corpus";

function decoded(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

const byHref = new WeakMap<Map<string, AskDoc>, Map<string, AskDoc[]>>();

/** The doc a link on this site points at: the exact href, or for a passage
 *  (`#heading`) its post. In the reader's language when there are both. */
export function docForHref(docs: Map<string, AskDoc>, href: string, locale: Locale): AskDoc | null {
  let index = byHref.get(docs);
  if (!index) {
    index = new Map();
    for (const doc of docs.values()) {
      const key = decoded(doc.href);
      const list = index.get(key) ?? [];
      list.push(doc);
      index.set(key, list);
    }
    byHref.set(docs, index);
  }
  // Compared decoded: a model writes `/prompt#自然` as often as the
  // index's `/prompt#%E8%87%AA%E7%84%B6`.
  const key = decoded(href);
  const found = index.get(key) ?? index.get(key.split("#")[0]) ?? [];
  return found.find((d) => d.lang === locale) ?? found[0] ?? null;
}

