// =============================================================================
// Theater System — the tour
//
// Every talk the log lists has a place: the city on its `conference`. Laid on
// a map, those places are a tour — Beijing and Shanghai in the PWA years,
// Hangzhou and Shenzhen, then Amsterdam, Wrocław, London, Berlin, Paris. The
// tour is another way into the library: a city holds the talks given there,
// and a talk that left a recording or a deck plays on the stage.
//
// It reads the log's talks, not only the library, because a stop is a place
// I spoke, recorded or not; the ones without media link to their row.
// Talks online, or whose city the log does not name, are kept apart rather
// than pinned somewhere they were not.
// =============================================================================

import { LOG as log } from "@/lib/log-client";
import type { Locale } from "@/lib/i18n";
import {
  type Commit,
  type SlidesMedia,
  type TalkCommit,
  type VideoMedia,
  computeCommitHash,
  isCommitVisibleIn,
  isSlidesMedia,
  isVideoMedia,
  localize,
} from "@/lib/log";

export type Region = "europe" | "china";

/** Which side of its dot a city's name goes, where neighbours are close. */
export type LabelSide = "below" | "left" | "right";

interface City {
  lng: number;
  lat: number;
  region: Region;
  name: Record<Locale, string>;
  label?: LabelSide;
}

/**
 * The cities the log names, keyed exactly as `conference.city` spells them.
 * A talk in a city missing here is kept off the map until it is added.
 */
const CITIES: Record<string, City> = {
  "Beijing, China": { lng: 116.41, lat: 39.9, region: "china", name: { en: "Beijing", zh: "北京" } },
  "Shanghai, China": { lng: 121.47, lat: 31.23, region: "china", name: { en: "Shanghai", zh: "上海" }, label: "right" },
  "Hangzhou, China": { lng: 120.16, lat: 30.27, region: "china", name: { en: "Hangzhou", zh: "杭州" }, label: "left" },
  "Shenzhen, China": { lng: 114.06, lat: 22.54, region: "china", name: { en: "Shenzhen", zh: "深圳" } },
  "Amsterdam, Netherlands": { lng: 4.9, lat: 52.37, region: "europe", name: { en: "Amsterdam", zh: "阿姆斯特丹" } },
  "Wrocław, Poland": { lng: 17.04, lat: 51.11, region: "europe", name: { en: "Wrocław", zh: "弗罗茨瓦夫" } },
  "London, UK": { lng: -0.13, lat: 51.51, region: "europe", name: { en: "London", zh: "伦敦" } },
  "Berlin, Germany": { lng: 13.4, lat: 52.52, region: "europe", name: { en: "Berlin", zh: "柏林" } },
  "Paris, France": { lng: 2.35, lat: 48.86, region: "europe", name: { en: "Paris", zh: "巴黎" } },
};

export interface TourTalk {
  id: string;
  title: string;
  venue: string;
  date: string;
  /** What plays on the stage, when the talk left one. */
  media: VideoMedia | SlidesMedia | null;
  /** The talk's row on /works. */
  href: string;
}

export interface Stop {
  id: string;
  name: string;
  lng: number;
  lat: number;
  region: Region;
  label: LabelSide;
  /** Newest first. */
  talks: TourTalk[];
}

export interface Tour {
  stops: Stop[];
  /** The stops in the order they were first visited — the route. */
  route: Stop[];
  /** Talks with no place on the map: online, or no city in the log. */
  elsewhere: TourTalk[];
}

function toTalk(commit: TalkCommit, locale: Locale): TourTalk {
  const media =
    (commit.media ?? []).find(
      (m): m is VideoMedia | SlidesMedia => isVideoMedia(m) || isSlidesMedia(m),
    ) ?? null;
  return {
    id: commit.id,
    title: localize(commit.title, locale),
    venue: commit.conference.name,
    date: commit.date,
    media,
    href: `/works#${computeCommitHash(commit.id)}`,
  };
}

export function buildTour(locale: Locale): Tour {
  const talks = (log.commits as Commit[])
    .filter((c): c is TalkCommit => c.type === "talk")
    .filter((c) => isCommitVisibleIn(c, locale))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byCity = new Map<string, Stop>();
  const route: Stop[] = [];
  const elsewhere: TourTalk[] = [];

  for (const commit of talks) {
    const key = commit.conference.city ?? "";
    const city = CITIES[key];
    const talk = toTalk(commit, locale);
    if (!city) {
      elsewhere.unshift(talk);
      continue;
    }
    let stop = byCity.get(key);
    if (!stop) {
      stop = {
        id: key,
        name: city.name[locale],
        lng: city.lng,
        lat: city.lat,
        region: city.region,
        label: city.label ?? "below",
        talks: [],
      };
      byCity.set(key, stop);
      route.push(stop);
    }
    stop.talks.unshift(talk);
  }

  return { stops: route.slice(), route, elsewhere };
}

/** The stop whose latest talk is the latest — where the tour is now. */
export function latestStop(tour: Tour): Stop | null {
  let best: Stop | null = null;
  for (const s of tour.stops) {
    if (!best || s.talks[0].date > best.talks[0].date) best = s;
  }
  return best;
}
