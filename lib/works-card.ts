import type { Locale } from "./i18n";
import { LOG } from "./log-client";
import { parseViewState } from "./log-view";
import { isWorksReading, type WorksReading } from "./works-readings";

/**
 * /works, or one reading of it, as a card: what its page publishes as Open
 * Graph, what its baked image prints, and what a magic link to it shows
 * (components/magic-link/server.tsx). One function, so the three never
 * disagree. Counted, not written down, so a card never goes stale.
 */
export interface WorksCard {
  /** The address, as people send it: `/works?type=talk`. */
  url: string;
  /** The baked share image (an `opengraph-image` route). */
  image: string;
  /** The image's top-right mono path. */
  eyebrow: string;
  /** The image's mono line under the title. */
  meta: string;
  copy: Record<Locale, { title: string; description: string }>;
}

const count = (type: string) => LOG.commits.filter((c) => c.type === type).length;

const READINGS: Record<WorksReading, (n: number) => Pick<WorksCard, "meta" | "copy">> = {
  talk: (n) => ({
    meta: `${n} talks · recordings and decks`,
    copy: {
      en: { title: "Talks", description: `Recordings and decks from ${n} talks I've given, in the commit log.` },
      zh: { title: "演讲", description: `${n} 场演讲的录像与幻灯片，收在提交记录里。` },
    },
  }),
  project: (n) => ({
    meta: `${n} projects · from the commit log`,
    copy: {
      en: { title: "Projects", description: `${n} projects I've built, in the commit log.` },
      zh: { title: "项目", description: `${n} 个做过的项目，收在提交记录里。` },
    },
  }),
};

export function worksCardOf(reading: WorksReading | null): WorksCard {
  if (!reading) {
    return {
      url: "/works",
      image: "/works/opengraph-image",
      eyebrow: "/works",
      meta: "commit history: profession as git log",
      copy: {
        en: { title: "Works", description: "Commit history: professional work as git log, with tags marking each chapter." },
        zh: { title: "作品", description: "提交记录：把职业生涯写成 git log。" },
      },
    };
  }
  const url = `/works?type=${reading}`;
  return {
    url,
    image: `/works/${reading}/opengraph-image`,
    eyebrow: url,
    ...READINGS[reading](count(reading)),
  };
}

/**
 * The reading a query string names: exactly one type, and one with a card.
 * Read the way the page reads it (`parseViewState`), so `?type=talk&view=feed`
 * is still the talks; two types are /works.
 */
export function worksReadingOf(query: URLSearchParams): WorksReading | null {
  const { types } = parseViewState(query);
  return types.length === 1 && isWorksReading(types[0]) ? types[0] : null;
}
