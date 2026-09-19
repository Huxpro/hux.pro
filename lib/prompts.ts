import fs from "fs";
import path from "path";
import type { Locale } from "@/lib/i18n";

// Bilingual text type
type BilingualText = {
  en: string;
  zh: string;
};

type BilingualArray = {
  en: string[];
  zh: string[];
};

type PromptLink = { label: string; url: string };

// Raw types (as stored in JSON)
interface RawQuote {
  id: string;
  text: BilingualText;
  author: string;
  source?: string;
  /** When set, `source` is a link to this URL. */
  url?: string;
  commentary?: BilingualText;
}

interface RawPrinciple {
  id: string;
  statement: BilingualText;
  topic?: BilingualText;
  shapedBy?: BilingualArray;
  reasoning?: BilingualText;
}

interface RawNamedEntry {
  id: string;
  name: string;
  context?: BilingualText;
  admire?: BilingualArray;
  links?: PromptLink[];
}

interface RawPromptsData {
  quotes: RawQuote[];
  principles: RawPrinciple[];
  people: RawNamedEntry[];
  books: RawNamedEntry[];
  meta: PromptsMeta;
}

// Resolved types (after locale selection)
export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
  url?: string;
  commentary?: string;
}

export interface Principle {
  id: string;
  statement: string;
  topic?: string;
  shapedBy?: string[];
  reasoning?: string;
}

export interface NamedEntry {
  id: string;
  name: string;
  context?: string;
  admire?: string[];
  links?: PromptLink[];
}

/** A team or group on the people list. */
export type Person = NamedEntry;
/** A book on the books list. */
export type Book = NamedEntry;

export interface PromptsMeta {
  tokenCount: number;
  lastUpdated: string;
  model: string;
}

export interface PromptsData {
  quotes: Quote[];
  principles: Principle[];
  people: Person[];
  books: Book[];
  meta: PromptsMeta;
}

/**
 * Load raw prompts data from content/prompts.json
 */
function getRawPromptsData(): RawPromptsData {
  const filePath = path.join(process.cwd(), "content", "prompts.json");
  const fileContents = fs.readFileSync(filePath, "utf8");
  return JSON.parse(fileContents) as RawPromptsData;
}

/**
 * Resolve bilingual text to a specific locale
 */
function resolveText(text: BilingualText, locale: Locale): string {
  return text[locale];
}

function resolveArray(arr: BilingualArray | undefined, locale: Locale): string[] | undefined {
  if (!arr) return undefined;
  return arr[locale];
}

function resolveOptionalText(text: BilingualText | undefined, locale: Locale): string | undefined {
  if (!text) return undefined;
  return text[locale];
}

function resolveNamedEntry(entry: RawNamedEntry, locale: Locale): NamedEntry {
  return {
    id: entry.id,
    name: entry.name,
    context: resolveOptionalText(entry.context, locale),
    admire: resolveArray(entry.admire, locale),
    links: entry.links,
  };
}

/**
 * Load prompts data resolved to a specific locale
 */
export function getPromptsData(locale: Locale = "en"): PromptsData {
  const raw = getRawPromptsData();

  return {
    quotes: raw.quotes.map((q) => ({
      id: q.id,
      text: resolveText(q.text, locale),
      author: q.author,
      source: q.source,
      url: q.url,
      commentary: resolveOptionalText(q.commentary, locale),
    })),
    principles: raw.principles.map((p) => ({
      id: p.id,
      statement: resolveText(p.statement, locale),
      topic: resolveOptionalText(p.topic, locale),
      shapedBy: resolveArray(p.shapedBy, locale),
      reasoning: resolveOptionalText(p.reasoning, locale),
    })),
    people: raw.people.map((p) => resolveNamedEntry(p, locale)),
    books: (raw.books ?? []).map((b) => resolveNamedEntry(b, locale)),
    meta: raw.meta,
  };
}
