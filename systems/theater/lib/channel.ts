// =============================================================================
// Theater System — channels
//
// The library as television: two channels, one per language, each a loop of
// every recording that can be heard in it, playing since a fixed moment. What
// is on is a function of the clock, so it is the same for everyone — you do
// not pick a video, you tune in, and you arrive where the program is.
//
// A channel is an ordinary album with `live` set: the stage plays on when a
// program ends and loops at the end (provider.tsx), and everything else about
// the theater — the rail, the PiP, the Live Activity — works unchanged.
//
// A program needs a running time to be scheduled (`duration` on the video
// media); a recording without one is left off the air rather than guessed at.
// Decks do not broadcast.
// =============================================================================

import type { Locale } from "@/lib/i18n";
import { buildLibrary, entryLanguages, entryToTrack } from "./library";
import type { Album, Track, TrackLanguage } from "./types";

/** When the channels went on the air. Any fixed moment does. */
const EPOCH = Date.UTC(2025, 0, 1);

const TITLE: Record<TrackLanguage, Record<Locale, string>> = {
  zh: { zh: "中文台", en: "Chinese" },
  en: { zh: "英文台", en: "English" },
};

export interface Channel extends Album {
  live: true;
  language: TrackLanguage;
  /** One full loop, in seconds. */
  length: number;
}

/** The channels, the viewer's language first. Empty ones are dropped. */
export function buildChannels(locale: Locale): Channel[] {
  const entries = buildLibrary(locale).filter((e) => e.kind === "video");
  const order: TrackLanguage[] = locale === "zh" ? ["zh", "en"] : ["en", "zh"];
  const channels: Channel[] = [];
  for (const language of order) {
    const tracks = entries
      .filter((e) => entryLanguages(e).includes(language))
      .map((e) => entryToTrack(e, locale, language))
      // Wearing this channel's telling, and only if that telling has a
      // running time to schedule by.
      .filter((t) => t.language === language && (t.duration ?? 0) > 0);
    if (tracks.length === 0) continue;
    channels.push({
      id: `channel-${language}`,
      title: TITLE[language][locale],
      tracks,
      live: true,
      language,
      length: tracks.reduce((n, t) => n + (t.duration ?? 0), 0),
    });
  }
  return channels;
}

export interface Slot {
  index: number;
  track: Track;
  /** Wall-clock start and end of this airing, ms since the epoch. */
  startsAt: number;
  endsAt: number;
}

/** What is on `channel` at `now`, and how far into it. */
export function onAir(channel: Channel, now: number): Slot & { offset: number } {
  const loopMs = channel.length * 1000;
  const into = (((now - EPOCH) % loopMs) + loopMs) % loopMs;
  let t = 0;
  for (let i = 0; i < channel.tracks.length; i++) {
    const ms = (channel.tracks[i].duration ?? 0) * 1000;
    if (into < t + ms) {
      const startsAt = now - (into - t);
      return {
        index: i,
        track: channel.tracks[i],
        startsAt,
        endsAt: startsAt + ms,
        offset: (into - t) / 1000,
      };
    }
    t += ms;
  }
  // Unreachable while durations are positive; the first program otherwise.
  return {
    index: 0,
    track: channel.tracks[0],
    startsAt: now,
    endsAt: now,
    offset: 0,
  };
}

/** The next `count` airings after the one on now — the program guide. */
export function upNext(channel: Channel, now: number, count: number): Slot[] {
  const current = onAir(channel, now);
  const out: Slot[] = [];
  let at = current.endsAt;
  let index = current.index;
  for (let n = 0; n < Math.min(count, channel.tracks.length - 1); n++) {
    index = (index + 1) % channel.tracks.length;
    const track = channel.tracks[index];
    const endsAt = at + (track.duration ?? 0) * 1000;
    out.push({ index, track, startsAt: at, endsAt });
    at = endsAt;
  }
  return out;
}
