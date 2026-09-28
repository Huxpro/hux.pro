/**
 * Glossary bookkeeping — the deterministic half of the post glossary.
 *
 *   pnpm glossary:pending [--post <slug.lang>] [--limit N]   # what needs judging, as JSON
 *   pnpm glossary:apply <results.json>                        # validate + merge a judgement
 *   pnpm glossary:check                                       # CI-style completeness check
 *
 * The judging half is a coding agent following docs/glossary.md,
 * not an API call: this script only hashes paragraphs, matches known forms,
 * and refuses results that do not hold up. Nothing here needs a network or a key.
 *
 * Files
 *  - content/glossary.json        terms → senses → glosses, plus `ignored`
 *                                 forms and the `scope` of posts under watch.
 *                                 Reviewed by hand; `proposed: true` marks what
 *                                 the agent added and a human has not approved.
 *  - content/glossary-index.json  post → paragraph hash → { form: senseId | null }.
 *                                 Derived. A hash present means "judged"; null
 *                                 means "matched a known form, but not that term here".
 *
 * A paragraph is pending when
 *  - its hash is not in the index ("scan": find new terms, resolve known ones), or
 *  - a known form matches in it that its record does not resolve ("resolve") —
 *    which is how a newly added term backfills every older post.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// --- Types -------------------------------------------------------------------

interface Sense {
  id: string;
  gloss: { zh: string; en: string };
  proposed?: true;
}
interface Term {
  id: string;
  forms: string[];
  senses: Sense[];
  proposed?: true;
}
interface Ignored {
  form: string;
  reason: string;
}
interface Glossary {
  scope: string[];
  terms: Term[];
  ignored: Ignored[];
}
type Index = Record<string, Record<string, Record<string, string | null>>>;

interface Paragraph {
  hash: string;
  text: string; // matchable text: link targets, inline code and tags removed
}

interface Results {
  terms?: Term[];
  ignore?: Ignored[];
  paragraphs?: { post: string; hash: string; occurrences: Record<string, string | null> }[];
}

// --- Files -------------------------------------------------------------------

const ROOT = process.cwd();
const BLOG = path.join(ROOT, "content", "blog");
const GLOSSARY_PATH = path.join(ROOT, "content", "glossary.json");
const INDEX_PATH = path.join(ROOT, "content", "glossary-index.json");

const readJSON = <T>(p: string, fallback: T): T =>
  fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as T) : fallback;
const writeJSON = (p: string, v: unknown) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

function postPath(key: string): string {
  const m = key.match(/^(.+)\.(en|zh)$/);
  if (!m) throw new Error(`Bad post key "${key}" — expected <slug>.<en|zh>`);
  const flat = path.join(BLOG, `${m[1]}.${m[2]}.mdx`);
  return fs.existsSync(flat) ? flat : path.join(BLOG, m[1], `index.${m[2]}.mdx`);
}

// --- Paragraphs ----------------------------------------------------------------

/** Prose paragraphs of a post. Headings, code fences, JSX and import lines are
 *  not annotated, so they are not tracked. The hash covers the raw source, so
 *  any edit to a paragraph — even to a link target — asks for a re-judge. */
export function paragraphs(source: string): Paragraph[] {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/```[\s\S]*?```/g, "");
  const out: Paragraph[] = [];
  for (const raw of body.split(/\n\s*\n/)) {
    const block = raw.trim();
    if (!block || /^(#|<|import |export )/.test(block)) continue;
    const text = block
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\]\([^)]*\)/g, "]")
      .replace(/`[^`]*`/g, "")
      .replace(/<[^>]+>/g, "");
    const hash = crypto.createHash("sha1").update(block).digest("hex").slice(0, 12);
    out.push({ hash, text });
  }
  return out;
}

// --- Matching ------------------------------------------------------------------

const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9_]/.test(c);

/** Known forms found in `text`, longest form first, no overlaps. Case-sensitive;
 *  a form that starts or ends with a Latin letter or digit must sit on a word
 *  boundary there (so "Web" never matches inside "WebAssembly"). CJK needs no
 *  segmentation: it is plain substring search. */
export function match(text: string, forms: string[]): string[] {
  const taken = new Uint8Array(text.length);
  const found = new Set<string>();
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    for (let i = text.indexOf(form); i >= 0; i = text.indexOf(form, i + 1)) {
      const j = i + form.length;
      if (isWordChar(form[0]) && isWordChar(text[i - 1])) continue;
      if (isWordChar(form[form.length - 1]) && isWordChar(text[j])) continue;
      if (taken.subarray(i, j).some(Boolean)) continue;
      taken.fill(1, i, j);
      found.add(form);
    }
  }
  return [...found];
}

function formsOf(g: Glossary): Map<string, Term[]> {
  const byForm = new Map<string, Term[]>();
  for (const t of g.terms) for (const f of t.forms) byForm.set(f, [...(byForm.get(f) ?? []), t]);
  return byForm;
}

// --- Pending -------------------------------------------------------------------

function pending(g: Glossary, index: Index, only?: string) {
  const byForm = formsOf(g);
  const senseIds = new Set(g.terms.flatMap((t) => t.senses.map((s) => s.id)));
  const items = [];
  for (const post of g.scope) {
    if (only && post !== only) continue;
    const record = index[post] ?? {};
    for (const p of paragraphs(fs.readFileSync(postPath(post), "utf8"))) {
      const matched = match(p.text, [...byForm.keys()]);
      const known = record[p.hash];
      const unresolved = known
        ? matched.filter((f) => !(f in known) || (known[f] !== null && !senseIds.has(known[f]!)))
        : matched;
      if (known && unresolved.length === 0) continue;
      items.push({
        post,
        hash: p.hash,
        kind: known ? "resolve" : "scan",
        text: p.text,
        matches: unresolved.map((form) => ({
          form,
          senses: byForm.get(form)!.flatMap((t) => t.senses.map((s) => ({ id: s.id, gloss: s.gloss.zh }))),
        })),
      });
    }
  }
  return items;
}

// --- Apply ---------------------------------------------------------------------

function apply(g: Glossary, index: Index, results: Results): string[] {
  const errors: string[] = [];
  const ignored = new Set(g.ignored.map((i) => i.form));

  // 1. Terms: new ids arrive proposed; known ids gain forms and senses.
  for (const incoming of results.terms ?? []) {
    for (const f of incoming.forms) if (ignored.has(f)) errors.push(`term ${incoming.id}: form "${f}" is in ignored`);
    for (const s of incoming.senses) {
      if (!s.gloss?.zh?.trim() || !s.gloss?.en?.trim()) errors.push(`sense ${s.id}: needs both zh and en gloss`);
    }
    const existing = g.terms.find((t) => t.id === incoming.id);
    if (!existing) {
      g.terms.push({
        id: incoming.id,
        forms: incoming.forms,
        senses: incoming.senses.map((s) => ({ ...s, proposed: true })),
        proposed: true,
      });
      continue;
    }
    for (const f of incoming.forms) if (!existing.forms.includes(f)) existing.forms.push(f);
    for (const s of incoming.senses) {
      if (!existing.senses.some((e) => e.id === s.id)) existing.senses.push({ ...s, proposed: true });
    }
  }
  const allSenseIds = g.terms.flatMap((t) => t.senses.map((s) => s.id));
  for (const id of new Set(allSenseIds)) {
    if (allSenseIds.indexOf(id) !== allSenseIds.lastIndexOf(id)) errors.push(`sense id "${id}" is used twice`);
  }

  // 2. Ignored forms.
  for (const i of results.ignore ?? []) {
    if (!i.reason?.trim()) errors.push(`ignore "${i.form}": needs a reason`);
    if (!ignored.has(i.form)) g.ignored.push(i);
  }

  // 3. Paragraph judgements must cover every known form the paragraph matches.
  const byForm = formsOf(g);
  const senseIds = new Set(allSenseIds);
  const current = new Map<string, Map<string, Paragraph>>();
  for (const post of g.scope) {
    current.set(post, new Map(paragraphs(fs.readFileSync(postPath(post), "utf8")).map((p) => [p.hash, p])));
  }
  for (const r of results.paragraphs ?? []) {
    const p = current.get(r.post)?.get(r.hash);
    if (!p) {
      errors.push(`${r.post}#${r.hash}: no such paragraph in scope (edited since pending ran?)`);
      continue;
    }
    for (const [form, sense] of Object.entries(r.occurrences)) {
      if (!p.text.includes(form)) errors.push(`${r.post}#${r.hash}: "${form}" is not in the paragraph`);
      if (sense !== null && !senseIds.has(sense)) errors.push(`${r.post}#${r.hash}: unknown sense "${sense}"`);
      if (sense !== null && !byForm.get(form)?.some((t) => t.senses.some((s) => s.id === sense))) {
        errors.push(`${r.post}#${r.hash}: "${form}" is not a form of the term that owns "${sense}"`);
      }
    }
    const merged = { ...(index[r.post]?.[r.hash] ?? {}), ...r.occurrences };
    for (const form of match(p.text, [...byForm.keys()])) {
      if (!(form in merged)) errors.push(`${r.post}#${r.hash}: "${form}" matches but was not resolved`);
    }
    (index[r.post] ??= {})[r.hash] = merged;
  }

  // 4. Drop records of paragraphs that no longer exist, and forms no longer known.
  for (const post of Object.keys(index)) {
    const live = current.get(post);
    if (!live) {
      delete index[post];
      continue;
    }
    for (const hash of Object.keys(index[post])) {
      if (!live.has(hash)) delete index[post][hash];
      else for (const f of Object.keys(index[post][hash])) if (!byForm.has(f)) delete index[post][hash][f];
    }
  }
  return errors;
}

// --- Check ---------------------------------------------------------------------

function check(g: Glossary, index: Index): string[] {
  const errors: string[] = [];
  for (const post of g.scope) if (!fs.existsSync(postPath(post))) errors.push(`scope: ${post} does not exist`);
  const ids = g.terms.map((t) => t.id);
  if (new Set(ids).size !== ids.length) errors.push("terms: duplicate term id");
  for (const t of g.terms) {
    if (t.proposed || t.senses.some((s) => s.proposed)) errors.push(`term ${t.id}: still proposed — approve or ignore it`);
  }
  const waiting = pending(g, index);
  if (waiting.length) errors.push(`${waiting.length} paragraph(s) pending — run the glossary skill`);
  const scoped = new Set(g.scope);
  for (const post of Object.keys(index)) if (!scoped.has(post)) errors.push(`index: ${post} is not in scope`);
  return errors;
}

// --- CLI -----------------------------------------------------------------------

const [cmd, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const glossary = readJSON<Glossary>(GLOSSARY_PATH, { scope: [], terms: [], ignored: [] });
const index = readJSON<Index>(INDEX_PATH, {});

if (cmd === "pending") {
  const items = pending(glossary, index, flag("--post"));
  const limit = Number(flag("--limit") ?? Infinity);
  console.log(
    JSON.stringify(
      {
        total: items.length,
        items: items.slice(0, limit),
        glossary: glossary.terms.map((t) => ({
          id: t.id,
          forms: t.forms,
          senses: t.senses.map((s) => ({ id: s.id, gloss: s.gloss.zh })),
        })),
        ignored: glossary.ignored.map((i) => i.form),
      },
      null,
      1,
    ),
  );
} else if (cmd === "apply" && args[0]) {
  const errors = apply(glossary, index, readJSON<Results>(args[0], {}));
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join("\n") + "\nNothing written.");
    process.exit(1);
  }
  writeJSON(GLOSSARY_PATH, glossary);
  writeJSON(INDEX_PATH, index);
  const left = pending(glossary, index).length;
  const proposed = glossary.terms.filter((t) => t.proposed || t.senses.some((s) => s.proposed)).length;
  console.log(`✓ applied. ${left} paragraph(s) still pending, ${proposed} term(s) awaiting review.`);
} else if (cmd === "check") {
  const errors = check(glossary, index);
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join("\n"));
    process.exit(1);
  }
  console.log(`✓ glossary: ${glossary.terms.length} terms, ${glossary.scope.length} posts, nothing pending.`);
} else {
  console.error("usage: glossary pending [--post <slug.lang>] [--limit N] | apply <results.json> | check");
  process.exit(2);
}
