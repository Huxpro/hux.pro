import fs from "fs";
import path from "path";
import type { Locale } from "@/lib/i18n";
import type { PromptTopic } from "@/lib/prompt-view";

// Bilingual text type
type BilingualText = {
  en: string;
  zh: string;
};

/**
 * A name is usually locale-neutral ("Dan Abramov"), but sometimes it is a
 * phrase that needs translating ("Lynx team culture"). Accept both.
 */
type NameText = string | BilingualText;

type PromptLink = { label: string; url: string };

/**
 * A pointer at whoever shaped a conviction. `ref` is optional — plenty of
 * people and experiences shaped a belief without earning an entry of their
 * own, and those render as plain text instead of an anchor.
 */
interface RawAttribution {
  name: NameText;
  /** id of an entry in `influences` */
  ref?: string;
  /**
   * Where the words come from, e.g. "PARC, 1971". Bilingual when the two
   * languages inherited the saying from different places — 尽人事听天命 came
   * from 《镜花缘》 and "Man proposes, God disposes" from Thomas à Kempis, and
   * each reader should be handed the source their own language actually has.
   */
  source?: NameText;
  /** when set, `source` links here */
  url?: string;
}

/**
 * One instance of a conviction: the same belief showing up somewhere
 * specific — in a career, in a culture, in a line someone else said first.
 *
 * Instances are why this page can stay small. A belief that has been held
 * for a decade has a dozen faces, and filing each as its own entry would
 * turn the page into the pile it exists to replace. So the essence is the
 * statement, and its faces live here: secondary, revealed on expand, each
 * able to carry its own attribution and to point at whatever entry on the
 * page it is also an instance of.
 */
interface RawInstance {
  /** A small heading: the name this face of the belief goes by. */
  title?: BilingualText;
  text: BilingualText;
  /** Whose words or whose example this one is. */
  from?: RawAttribution;
  /** Another entry on this page that this instance is also filed under. */
  ref?: string;
}

/**
 * What did the training: a person, a team, something written — or a whole
 * field. `field` is the one that isn't an author: nobody signs a discipline,
 * and it still teaches you more than most of the people in it.
 */
type InfluenceKind = "person" | "team" | "book" | "paper" | "field";

/**
 * A conviction is something *I* hold. `quotedFrom` says whose words they are:
 * present means I adopted someone's phrasing verbatim (rendered as a quote),
 * absent means the words are mine (rendered as a statement). Either way the
 * belief is mine — a quote nobody lives by does not belong on this page.
 */
/**
 * One sentence of a conviction, with the provenance that belongs to it:
 * `quotedFrom` present means these are someone's words (set as a quote),
 * absent means they are mine (set as a statement). Provenance is per
 * sentence, so a chorus can mix my voice with borrowed ones.
 */
interface RawStatement {
  /**
   * What this sentence answers for — correctness, behaviour, abstraction.
   * It does not print beside the sentence; it rides in the tag row as
   * `on="…"`, because it is the kind of thing that row is for.
   */
  facet?: BilingualText;
  text: BilingualText;
  quotedFrom?: RawAttribution;
}

interface RawConviction {
  /**
   * The canonical key: what `ref` points at, and the same in every locale.
   * If a belief cannot be named in one word, it has not been reduced yet —
   * so the id doubles as this page's outline.
   */
  id: string;
  /**
   * What the URL shows, per locale. Everything else on this page is
   * bilingual and the id was the one English-only thing in it, printed in
   * the margin of a Chinese column. The Chinese name is not a translation
   * of the English one — `flux` is 「常变」 — same rule as the statements.
   * Refs stay canonical, so this is display only; `app/prompt/view` maps
   * one to the other and accepts either in an incoming link.
   */
  anchor?: BilingualText;
  /** The shelf in `lib/prompt-view` this sits on. One, in practice always:
   *  a second is allowed and is a last resort, since a belief that governs
   *  two modes is usually two beliefs, or one belief plus an instance that
   *  links to the other. */
  topics: PromptTopic[];
  /**
   * One belief, in as many sentences as it has voices.
   *
   * Most entries hold one. A few hold a chorus: the same conviction as it
   * is said in different traditions — Curry–Howard says it about
   * correctness, Jobs about behaviour, Mies about abstraction, and none of
   * the three is a rephrasing of the others. They share an anchor, a
   * commentary and one expand, because they are one belief.
   *
   * `statements[0]` is the head: the sentence the widget shows, the label a
   * `ref` prints, and the one the entry is named by. The rest are set a
   * half step down — still whole sentences, visibly not the head.
   *
   * The discipline is three at most, and each must answer a different
   * `facet`, or be from a different tradition. A chorus that agrees with
   * itself is an instance list that has climbed onto the front page.
   */
  statements: RawStatement[];
  shapedBy?: RawAttribution[];
  /**
   * My own rephrasing of the statement, in my voice. A shared saying is the
   * essence but it can also be the corniest way to put it, and the line I
   * actually say is usually the one worth reading — so it rides at rest
   * under the statement rather than waiting inside the notes.
   */
  commentary?: BilingualText;
  /** The other ways this belief has shown up. */
  instances?: RawInstance[];
  /** Markdown-lite: all-"- " lines become a list, anything else is prose. */
  body?: BilingualText;
  links?: PromptLink[];
}

/**
 * Something the page can play rather than link away to: a deck opens on the
 * Theater stage (and its PiP), in the Slides library beside every other deck
 * in the log. One per entry — this page is text, and a player is a guest.
 */
interface RawPromptMedia {
  kind: "slides";
  url: string;
  thumbnail?: string;
  title?: BilingualText;
}

/**
 * An influence carries no topic. It was tempting to file one — Dalio on
 * fortune, PLT on the world — but a person is not *on* a subject: whoever
 * trained you trained all of you, and the tag would only ever be the union
 * of the convictions below, which the back-links already say out loud. So
 * the topics belong to what I hold, and the influences are read through
 * them.
 */
interface RawInfluence {
  id: string;
  /** @see RawConviction.anchor */
  anchor?: BilingualText;
  kind: InfluenceKind;
  name: NameText;
  context?: BilingualText;
  body?: BilingualText;
  media?: RawPromptMedia;
  links?: PromptLink[];
}

interface RawPromptsData {
  convictions: RawConviction[];
  influences: RawInfluence[];
  meta: { model: string };
}

// Resolved types (after locale selection)
export interface Attribution {
  name: string;
  ref?: string;
  source?: string;
  url?: string;
}

export interface Instance {
  title?: string;
  text: string;
  from?: Attribution;
  ref?: string;
}

export interface Statement {
  facet?: string;
  text: string;
  quotedFrom?: Attribution;
}

export interface Conviction {
  id: string;
  /** This locale's anchor; falls back to `id`. */
  anchor: string;
  topics: PromptTopic[];
  /** Never empty; `statements[0]` is the head. */
  statements: Statement[];
  shapedBy?: Attribution[];
  commentary?: string;
  instances?: Instance[];
  body?: string;
  links?: PromptLink[];
}

export interface PromptMedia {
  kind: "slides";
  url: string;
  thumbnail?: string;
  title?: string;
}

export interface Influence {
  id: string;
  anchor: string;
  kind: InfluenceKind;
  name: string;
  context?: string;
  body?: string;
  media?: PromptMedia;
  links?: PromptLink[];
}

export interface PromptsMeta {
  tokenCount: number;
  lastUpdated: string;
  model: string;
}

export interface PromptsData {
  convictions: Conviction[];
  influences: Influence[];
  meta: PromptsMeta;
}

const PROMPTS_PATH = path.join(process.cwd(), "content", "prompts.json");

/**
 * Load raw prompts data from content/prompts.json
 */
function getRawPromptsData(): RawPromptsData {
  const fileContents = fs.readFileSync(PROMPTS_PATH, "utf8");
  return JSON.parse(fileContents) as RawPromptsData;
}

/**
 * Resolve bilingual text to a specific locale
 */
function resolveText(text: BilingualText, locale: Locale): string {
  return text[locale];
}

function resolveOptionalText(
  text: BilingualText | undefined,
  locale: Locale,
): string | undefined {
  if (!text) return undefined;
  return text[locale];
}

function resolveName(name: NameText, locale: Locale): string {
  return typeof name === "string" ? name : name[locale];
}

function resolveAttribution(
  attribution: RawAttribution,
  locale: Locale,
): Attribution {
  return {
    name: resolveName(attribution.name, locale),
    ref: attribution.ref,
    source: attribution.source
      ? resolveName(attribution.source, locale)
      : undefined,
    url: attribution.url,
  };
}

/**
 * Footer meta is derived, not authored — a hand-written "last updated" goes
 * stale the moment you forget it. Token count is the usual chars/4 estimate
 * over the locale the reader is actually seeing.
 */
function deriveMeta(
  data: Omit<PromptsData, "meta">,
  model: string,
): PromptsMeta {
  const mtime = fs.statSync(PROMPTS_PATH).mtime;
  const month = String(mtime.getMonth() + 1).padStart(2, "0");

  return {
    tokenCount: Math.round(JSON.stringify(data).length / 4),
    lastUpdated: `${mtime.getFullYear()}.${month}`,
    model,
  };
}

/**
 * Load prompts data resolved to a specific locale
 */
export function getPromptsData(locale: Locale = "en"): PromptsData {
  const raw = getRawPromptsData();

  const resolved = {
    convictions: raw.convictions.map((c) => ({
      id: c.id,
      anchor: c.anchor ? resolveText(c.anchor, locale) : c.id,
      topics: c.topics,
      statements: c.statements.map((st) => ({
        facet: resolveOptionalText(st.facet, locale),
        text: resolveText(st.text, locale),
        quotedFrom: st.quotedFrom
          ? resolveAttribution(st.quotedFrom, locale)
          : undefined,
      })),
      shapedBy: c.shapedBy?.map((s) => resolveAttribution(s, locale)),
      commentary: resolveOptionalText(c.commentary, locale),
      instances: c.instances?.map((i) => ({
        title: resolveOptionalText(i.title, locale),
        text: resolveText(i.text, locale),
        from: i.from ? resolveAttribution(i.from, locale) : undefined,
        ref: i.ref,
      })),
      body: resolveOptionalText(c.body, locale),
      links: c.links,
    })),
    influences: raw.influences.map((i) => ({
      id: i.id,
      anchor: i.anchor ? resolveText(i.anchor, locale) : i.id,
      kind: i.kind,
      name: resolveName(i.name, locale),
      context: resolveOptionalText(i.context, locale),
      body: resolveOptionalText(i.body, locale),
      media: i.media
        ? { ...i.media, title: resolveOptionalText(i.media.title, locale) }
        : undefined,
      links: i.links,
    })),
  };

  return { ...resolved, meta: deriveMeta(resolved, raw.meta.model) };
}
