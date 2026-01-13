import fs from "fs";
import path from "path";

// Types for the prompt system
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
 * Load prompts data from content/prompts.json
 */
export function getPromptsData(): PromptsData {
  const filePath = path.join(process.cwd(), "content", "prompts.json");
  const fileContents = fs.readFileSync(filePath, "utf8");
  return JSON.parse(fileContents) as PromptsData;
}
