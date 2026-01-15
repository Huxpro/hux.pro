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

// Raw types (as stored in JSON)
interface RawQuote {
  id: string;
  text: BilingualText;
  author: string;
  source?: string;
  commentary?: BilingualText;
}

interface RawPrinciple {
  id: string;
  statement: BilingualText;
  topic?: BilingualText;
  shapedBy?: BilingualArray;
  reasoning?: BilingualText;
}

interface RawPerson {
  id: string;
  name: string;
  context?: BilingualText;
  admire?: BilingualArray;
  links?: { label: string; url: string }[];
}

interface RawPromptsData {
  quotes: RawQuote[];
  principles: RawPrinciple[];
  people: RawPerson[];
  meta: PromptsMeta;
}

// Resolved types (after locale selection)
export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
  commentary?: string;
}

export interface Principle {
  id: string;
  statement: string;
  topic?: string;
  shapedBy?: string[];
  reasoning?: string;
}

export interface Person {
  id: string;
  name: string;
  context?: string;
  admire?: string[];
  links?: { label: string; url: string }[];
}

export interface PromptsMeta {
  tokenCount: number;
  lastUpdated: string;
  model: string;
}

export interface PromptsData {
  quotes: Quote[];
  principles: Principle[];
  people: Person[];
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
      commentary: resolveOptionalText(q.commentary, locale),
    })),
    principles: raw.principles.map((p) => ({
      id: p.id,
      statement: resolveText(p.statement, locale),
      topic: resolveOptionalText(p.topic, locale),
      shapedBy: resolveArray(p.shapedBy, locale),
      reasoning: resolveOptionalText(p.reasoning, locale),
    })),
    people: raw.people.map((p) => ({
      id: p.id,
      name: p.name,
      context: resolveOptionalText(p.context, locale),
      admire: resolveArray(p.admire, locale),
      links: p.links,
    })),
    meta: raw.meta,
  };
}
