// =============================================================================
// Prompts Lab model: content/prompts.json, read as a structure.
//
// /prompt prints the system prompt as something to read; this module reads it
// as something to keep. It flattens every sentence into one row (a head, a
// voice under it, an instance), indexes the rows by who said them, draws the
// graph the `ref`s and `shapedBy`s make, and holds the file to the rules
// that until now lived only in comments in `lib/prompts.ts` (three voices at
// most under a head, each on its own facet, every ref landing somewhere).
//
// Pure: no React, no `fs`. The lab (`app/lab/prompts`) and its surface read
// it in the browser, and `pnpm prompts:check` runs the same checks in Node,
// so the page and the script can never disagree about what is wrong.
// =============================================================================

import type {
  BilingualText,
  NameText,
  RawAttribution,
  RawConviction,
  RawPromptsData,
} from "@/lib/prompts";
import { PROMPT_TOPICS, type PromptTopic } from "@/lib/prompt-view";

// -----------------------------------------------------------------------------
// Text
// -----------------------------------------------------------------------------

const MARKS = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

/** The same string with its `**bold**` and `*title*` marks taken off. */
export function plainMarks(text: string): string {
  return text.replace(MARKS, (m) => m.replace(/\*/g, ""));
}

/** A name in both languages; a locale-neutral one is the same in each. */
export function bothNames(name: NameText): BilingualText {
  return typeof name === "string" ? { en: name, zh: name } : name;
}

/** The key a voice is grouped by: its English name, marks and case aside. */
export function voiceKey(name: NameText): string {
  return plainMarks(bothNames(name).en).trim().toLowerCase();
}

// -----------------------------------------------------------------------------
// Rows: every sentence on the page, flat
// -----------------------------------------------------------------------------

/**
 * What a sentence is to its entry: the head (`statements[0]`, the line the
 * entry is named by), a voice under it (the rest of `statements`), or an
 * instance (the other ways the belief has shown up).
 */
export type PromptRowKind = "head" | "voice" | "instance";

export const PROMPT_ROW_KINDS: readonly PromptRowKind[] = ["head", "voice", "instance"];

export interface PromptRow {
  /** `models/voice-2`, `models/instance-5`: stable while the order is. */
  key: string;
  conviction: string;
  topic: PromptTopic;
  kind: PromptRowKind;
  /** Position in `statements` (head and voices) or `instances`. */
  index: number;
  facet?: BilingualText;
  title?: BilingualText;
  text: BilingualText;
  /** Whose words: a statement's `quotedFrom`, an instance's `from`. */
  from?: RawAttribution;
  /** An instance's `ref`: another entry it is also filed under. */
  ref?: string;
}

export function promptRows(data: RawPromptsData): PromptRow[] {
  const rows: PromptRow[] = [];
  for (const c of data.convictions) {
    const topic = c.topics[0];
    c.statements.forEach((s, index) => {
      const kind: PromptRowKind = index === 0 ? "head" : "voice";
      rows.push({
        key: `${c.id}/${kind}-${index}`,
        conviction: c.id,
        topic,
        kind,
        index,
        facet: s.facet,
        text: s.text,
        from: s.quotedFrom,
      });
    });
    c.instances?.forEach((i, index) => {
      rows.push({
        key: `${c.id}/instance-${index}`,
        conviction: c.id,
        topic,
        kind: "instance",
        index,
        title: i.title,
        text: i.text,
        from: i.from,
        ref: i.ref,
      });
    });
  }
  return rows;
}

/** Whether a row matches a free-text query, in either language. */
export function rowMatches(row: PromptRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields: (string | undefined)[] = [
    row.conviction,
    row.text.en,
    row.text.zh,
    row.title?.en,
    row.title?.zh,
    row.facet?.en,
    row.facet?.zh,
    row.ref,
  ];
  if (row.from) {
    const name = bothNames(row.from.name);
    fields.push(name.en, name.zh, row.from.ref);
    if (row.from.source) {
      const source = bothNames(row.from.source);
      fields.push(source.en, source.zh);
    }
  }
  return fields.some((f) => f && plainMarks(f).toLowerCase().includes(q));
}

// -----------------------------------------------------------------------------
// Voices: who is quoted, and where
// -----------------------------------------------------------------------------

export interface Voice {
  key: string;
  name: BilingualText;
  /** The influence this voice is, when one of its rows says so. */
  influence?: string;
  rows: PromptRow[];
  /** The entries it speaks in, in page order, once each. */
  convictions: string[];
}

/**
 * Everyone the page quotes, grouped by name across entries, most-quoted
 * first; `influence` is set when any of their rows links to an entry. An instance with no `from` but a `ref` to an influence is that
 * influence speaking (the *Hackers & Painters* instance under 会通), so it
 * counts as theirs.
 */
export function promptVoices(data: RawPromptsData, rows = promptRows(data)): Voice[] {
  const influences = new Map(data.influences.map((i) => [i.id, i]));
  const order = new Map(data.convictions.map((c, i) => [c.id, i]));
  const voices = new Map<string, Voice>();

  for (const row of rows) {
    let name: NameText | undefined = row.from?.name;
    let influence = row.from?.ref;
    if (!name && row.ref && influences.has(row.ref)) {
      influence = row.ref;
      name = influences.get(row.ref)!.name;
    }
    if (!name) continue;
    // By the name the words are signed with: a team's entry (React Team)
    // speaks through several people, and each is their own voice.
    const key = voiceKey(name);
    let voice = voices.get(key);
    if (!voice) {
      voice = { key, name: bothNames(name), rows: [], convictions: [] };
      voices.set(key, voice);
    }
    if (influence && influences.has(influence)) voice.influence ??= influence;
    voice.rows.push(row);
    if (!voice.convictions.includes(row.conviction)) voice.convictions.push(row.conviction);
  }

  for (const voice of voices.values()) {
    voice.convictions.sort((a, b) => order.get(a)! - order.get(b)!);
  }
  return [...voices.values()].sort(
    (a, b) => b.rows.length - a.rows.length || a.name.en.localeCompare(b.name.en),
  );
}

// -----------------------------------------------------------------------------
// The graph: what points where
// -----------------------------------------------------------------------------

/**
 * `link`: an instance filed under another entry too (`instances[].ref`),
 * which on /prompt reads as "and then the next one". `shaped`: an influence
 * in an entry's `shapedBy`. `quoted`: an influence an entry quotes by `ref`.
 */
export type PromptEdgeKind = "link" | "shaped" | "quoted";

export interface PromptEdge {
  from: string;
  to: string;
  kind: PromptEdgeKind;
}

export function promptEdges(data: RawPromptsData): PromptEdge[] {
  const convictions = new Set(data.convictions.map((c) => c.id));
  const influences = new Set(data.influences.map((i) => i.id));
  const edges: PromptEdge[] = [];
  const seen = new Set<string>();
  const add = (edge: PromptEdge) => {
    const id = `${edge.kind}:${edge.from}>${edge.to}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push(edge);
  };

  for (const c of data.convictions) {
    for (const id of c.shapedBy ?? []) if (influences.has(id)) add({ from: id, to: c.id, kind: "shaped" });
    for (const s of c.statements) {
      const ref = s.quotedFrom?.ref;
      if (ref && influences.has(ref)) add({ from: ref, to: c.id, kind: "quoted" });
    }
    for (const i of c.instances ?? []) {
      if (i.ref && convictions.has(i.ref)) add({ from: c.id, to: i.ref, kind: "link" });
      else if (i.ref && influences.has(i.ref)) add({ from: i.ref, to: c.id, kind: "quoted" });
      const ref = i.from?.ref;
      if (ref && influences.has(ref)) add({ from: ref, to: c.id, kind: "quoted" });
    }
  }
  return edges;
}

// -----------------------------------------------------------------------------
// Each entry, measured
// -----------------------------------------------------------------------------

export interface ConvictionStats {
  id: string;
  topic: PromptTopic;
  /** Statements under the head; the rule is three at most. */
  voices: number;
  instances: number;
  /** Rows with a `from`: borrowed words, against my own. */
  quoted: number;
  body: { en: number; zh: number };
  linksOut: string[];
  linksIn: string[];
}

/** The most voices a head may carry (see `RawConviction.statements`). */
export const MAX_VOICES = 3;

export function convictionStats(data: RawPromptsData, edges = promptEdges(data)): ConvictionStats[] {
  return data.convictions.map((c) => ({
    id: c.id,
    topic: c.topics[0],
    voices: Math.max(0, c.statements.length - 1),
    instances: c.instances?.length ?? 0,
    quoted:
      c.statements.filter((s) => s.quotedFrom).length +
      (c.instances ?? []).filter((i) => i.from).length,
    body: { en: c.body?.en.length ?? 0, zh: c.body?.zh.length ?? 0 },
    linksOut: edges.filter((e) => e.kind === "link" && e.from === c.id).map((e) => e.to),
    linksIn: edges.filter((e) => e.kind === "link" && e.to === c.id).map((e) => e.from),
  }));
}

// -----------------------------------------------------------------------------
// Checks: the comments in lib/prompts.ts, as rules
// -----------------------------------------------------------------------------

/**
 * `error`: the page is wrong (a ref to nothing, a missing language, a fourth
 * voice). `warn`: probably wrong, worth a look. `info`: a suggestion; the
 * file may well be right as it is.
 */
export type CheckLevel = "error" | "warn" | "info";

export const CHECK_LEVELS: readonly CheckLevel[] = ["error", "warn", "info"];

export interface CheckIssue {
  level: CheckLevel;
  rule: string;
  /** The entry it is in: a conviction or influence id. */
  where: string;
  /** The row, when it is one sentence. */
  row?: string;
  message: BilingualText;
}

function missing(text: BilingualText | undefined): ("en" | "zh")[] {
  if (!text) return [];
  return (["en", "zh"] as const).filter((l) => !text[l]?.trim());
}

function unbalanced(text: BilingualText | undefined): ("en" | "zh")[] {
  if (!text) return [];
  return (["en", "zh"] as const).filter((l) => ((text[l] ?? "").match(/\*/g)?.length ?? 0) % 2 === 1);
}

function rowLabel(row: PromptRow): string {
  return row.kind === "instance" ? `instances[${row.index}]` : `statements[${row.index}]`;
}

export function checkPrompts(data: RawPromptsData): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const push = (issue: CheckIssue) => issues.push(issue);
  const convictions = new Set<string>();
  const influences = new Set(data.influences.map((i) => i.id));
  const influenceByName = new Map(data.influences.map((i) => [voiceKey(i.name), i.id]));

  // Ids: unique, and one namespace, since an instance's `ref` may name either kind.
  const seen = new Set<string>();
  for (const id of [...data.convictions.map((c) => c.id), ...data.influences.map((i) => i.id)]) {
    if (seen.has(id))
      push({
        level: "error",
        rule: "id-unique",
        where: id,
        message: { en: `"${id}" is used by two entries.`, zh: `「${id}」被两个条目共用。` },
      });
    seen.add(id);
  }
  for (const c of data.convictions) convictions.add(c.id);

  for (const c of data.convictions) checkConviction(c);

  function checkConviction(c: RawConviction) {
    if (c.topics.length !== 1)
      push({
        level: c.topics.length === 0 ? "error" : "warn",
        rule: "one-topic",
        where: c.id,
        message: {
          en: `On ${c.topics.length} shelves; one is the rule, a second a last resort.`,
          zh: `放在 ${c.topics.length} 格里；规则是一格，第二格是最后手段。`,
        },
      });
    for (const t of c.topics)
      if (!(PROMPT_TOPICS as readonly string[]).includes(t))
        push({
          level: "error",
          rule: "topic",
          where: c.id,
          message: { en: `"${t}" is not a shelf.`, zh: `「${t}」不是一个格。` },
        });

    if (c.statements.length === 0)
      push({
        level: "error",
        rule: "head",
        where: c.id,
        message: { en: "No head: statements is empty.", zh: "没有 head：statements 是空的。" },
      });
    const voices = c.statements.length - 1;
    if (voices > MAX_VOICES)
      push({
        level: "error",
        rule: "voices",
        where: c.id,
        message: {
          en: `${voices} voices under the head; ${MAX_VOICES} at most. Move one down to the instances.`,
          zh: `head 下有 ${voices} 个声部，最多 ${MAX_VOICES} 个。挪一个下去当 instance。`,
        },
      });

    const facets = new Map<string, number>();
    c.statements.forEach((s, i) => {
      const f = s.facet?.en.trim().toLowerCase();
      if (!f) return;
      if (facets.has(f))
        push({
          level: "warn",
          rule: "facet-unique",
          where: c.id,
          row: `${c.id}/voice-${i}`,
          message: {
            en: `statements[${i}] answers the same facet ("${f}") as statements[${facets.get(f)}].`,
            zh: `statements[${i}] 和 statements[${facets.get(f)}] 回答的是同一个 facet（「${f}」）。`,
          },
        });
      else facets.set(f, i);
    });

    for (const l of missing(c.anchor))
      push({ level: "error", rule: "bilingual", where: c.id, message: lang("anchor", l) });
    for (const l of missing(c.body))
      push({ level: "error", rule: "bilingual", where: c.id, message: lang("body", l) });
    for (const l of unbalanced(c.body))
      push({ level: "warn", rule: "marks", where: c.id, message: marks("body", l) });

    for (const id of c.shapedBy ?? [])
      if (!influences.has(id))
        push({
          level: "error",
          rule: "ref",
          where: c.id,
          message: { en: `shapedBy "${id}" is not an influence.`, zh: `shapedBy「${id}」不是一个 influence。` },
        });
  }

  for (const row of promptRows(data)) {
    const at = rowLabel(row);
    const base = { where: row.conviction, row: row.key };
    for (const [field, text] of [
      ["text", row.text],
      ["title", row.title],
      ["facet", row.facet],
    ] as const) {
      for (const l of missing(text))
        push({ ...base, level: "error", rule: "bilingual", message: lang(`${at}.${field}`, l) });
      for (const l of unbalanced(text))
        push({ ...base, level: "warn", rule: "marks", message: marks(`${at}.${field}`, l) });
    }
    if (row.from) {
      const name = bothNames(row.from.name);
      for (const l of missing(name))
        push({ ...base, level: "warn", rule: "bilingual", message: lang(`${at} name`, l) });
      if (row.from.ref && !influences.has(row.from.ref))
        push({
          ...base,
          level: "error",
          rule: "ref",
          message: {
            en: `${at} is attributed to "${row.from.ref}", which is not an influence.`,
            zh: `${at} 的出处指向「${row.from.ref}」，它不是一个 influence。`,
          },
        });
      const could = influenceByName.get(voiceKey(row.from.name));
      if (!row.from.ref && could)
        push({
          ...base,
          level: "info",
          rule: "could-link",
          message: {
            en: `${at} quotes ${name.en}, who has an entry ("${could}"); add ref to link it.`,
            zh: `${at} 引的是 ${name.zh}，他有自己的条目（「${could}」）；加上 ref 就能链过去。`,
          },
        });
    }
    if (row.ref) {
      if (!convictions.has(row.ref) && !influences.has(row.ref))
        push({
          ...base,
          level: "error",
          rule: "ref",
          message: {
            en: `${at} is filed under "${row.ref}", which is not an entry.`,
            zh: `${at} 挂在「${row.ref}」下，但没有这个条目。`,
          },
        });
      if (row.ref === row.conviction)
        push({
          ...base,
          level: "warn",
          rule: "self-ref",
          message: { en: `${at} refs its own entry.`, zh: `${at} 的 ref 指向它自己所在的条目。` },
        });
    }
  }

  // The same sentence twice, anywhere.
  const texts = new Map<string, string>();
  for (const row of promptRows(data)) {
    const t = plainMarks(row.text.en).trim().toLowerCase();
    if (t.length < 12) continue;
    const first = texts.get(t);
    if (first)
      push({
        level: "warn",
        rule: "duplicate",
        where: row.conviction,
        row: row.key,
        message: { en: `Same sentence as ${first}.`, zh: `和 ${first} 是同一句话。` },
      });
    else texts.set(t, row.key);
  }

  // An influence nothing points at is a page nobody reaches from a belief.
  const used = new Set(promptEdges(data).map((e) => e.from));
  for (const i of data.influences)
    if (!used.has(i.id))
      push({
        level: "info",
        rule: "orphan-influence",
        where: i.id,
        message: {
          en: "No conviction is shaped by it or quotes it by ref.",
          zh: "没有哪条原则在 shapedBy 里列它，或用 ref 引它。",
        },
      });

  const rank = { error: 0, warn: 1, info: 2 } as const;
  return issues.sort((a, b) => rank[a.level] - rank[b.level]);
}

function lang(field: string, l: "en" | "zh"): BilingualText {
  return l === "en"
    ? { en: `${field} has no English.`, zh: `${field} 缺英文。` }
    : { en: `${field} has no Chinese.`, zh: `${field} 缺中文。` };
}

function marks(field: string, l: "en" | "zh"): BilingualText {
  return {
    en: `${field} (${l}) has an odd number of *: a mark is left open.`,
    zh: `${field}（${l}）里的 * 是奇数个：有一个标记没闭合。`,
  };
}
