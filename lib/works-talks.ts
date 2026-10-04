/**
 * How a project carries the talks that present it. On trial: the DevTool's
 * Works module picks one, and /works rearranges its rows before it draws them.
 *
 *  - `beam`:    today. The talk is its own row; `attachedTo` lights a
 *               connector on the graph while either end is hovered.
 *  - `cover`:   the talk's recording joins the project's covers, captioned
 *               with its venue. The talk keeps its own row too.
 *  - `absorb`:  the same cover, and the talk row leaves the log: the project
 *               is where the talk lives.
 *  - `trailer`: git trailers under the project's text, one per talk
 *               (`Presented-at: VueConf 2026`), each a link to the talk's row.
 *               The talk keeps its row.
 *  - `decorate`: `git log --decorate` refs on the project's title line,
 *               `(talks: VueConf 2026, D2 2025)`, each a link to the talk's
 *               row. The talk keeps its row.
 *  - `nest`:    the talk row moves up under its project and folds to a quiet
 *               line, the way a branch hangs off the commit it forked from.
 *
 * Pure data: the rows are copies, so the log the rest of the site reads is
 * untouched.
 */

import { localize, type Commit, type Media, type TimelineData } from "@/lib/log";
import type { Locale } from "@/lib/i18n";

export const WORKS_TALKS = ["beam", "cover", "absorb", "trailer", "decorate", "nest"] as const;
export type WorksTalks = (typeof WORKS_TALKS)[number];
export const WORKS_TALKS_DEFAULT: WorksTalks = "beam";

/**
 * Talks that present a project but are not (yet) `attachedTo` it in the log.
 * Exploration only: enough rows to see how each arrangement scales past one.
 */
const ALSO_PRESENTS: Record<string, string> = {
  "d2-2025-lynx": "lynx-framework",
  "react-summit-2025-unlock-native": "lynx-framework",
  "react-universe-2025-two-threads": "lynx-framework",
};

/** A talk's venue as a short label: `VueConf 2026`, `React Summit 2025`. */
function venueLabel(talk: Commit): string {
  const name = talk.type === "talk" ? talk.conference.name : localize(talk.title, "en");
  const year = talk.date.slice(0, 4);
  return name.includes(year) ? name : `${name} ${year}`;
}

/** Marks a cover that stands for a talk, so the strip can caption it. */
export interface TalkCover {
  talkId: string;
  venue: string;
}

export type MediaWithTalk = Media & { talk?: TalkCover };

/** The talk's best cover: its recording, else its deck. */
function talkCover(talk: Commit): Media | null {
  const media = talk.media ?? [];
  return (
    media.find((m) => m.kind === "video") ??
    media.find((m) => m.kind === "slides") ??
    null
  );
}

export interface Trailer {
  key: string;
  /** Inline-link markup (lib/inline-links.ts). */
  value: string;
}

export type CommitWithTrailers = Commit & { trailers?: Trailer[]; decorations?: string[] };

export function arrangeTalks<T extends TimelineData>(
  data: T[],
  mode: WorksTalks,
  locale: Locale,
): T[] {
  // Which project each talk presents.
  const presents = (c: Commit): string | null => {
    if (c.type !== "talk") return null;
    if (typeof c.attachedTo === "string") return c.attachedTo;
    return ALSO_PRESENTS[c.id] ?? null;
  };

  const all = data.flatMap((d) => d.commits);
  const projectIds = new Set(all.filter((c) => c.type === "project").map((c) => c.id));
  const talksOf = new Map<string, Commit[]>();
  for (const c of all) {
    const p = presents(c);
    if (!p || !projectIds.has(p)) continue;
    const list = talksOf.get(p) ?? [];
    list.push(c);
    talksOf.set(p, list);
  }
  // Oldest first, the order they were given in.
  for (const list of talksOf.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const absorbed = new Set<string>();
  if (mode === "absorb") for (const list of talksOf.values()) for (const t of list) absorbed.add(t.id);

  return data.map((block) => {
    const { commits } = block;
    let rows: Commit[] = commits
      .filter((c) => !absorbed.has(c.id))
      .map((c) => {
        // Every talk that presents a project points at it, so `beam` can
        // draw the connector for the added ones too.
        const p = presents(c);
        const row: CommitWithTrailers =
          p && c.attachedTo !== p ? { ...c, attachedTo: p } : { ...c };
        const talks = c.type === "project" ? talksOf.get(c.id) : undefined;
        if (!talks) return row;

        if (mode === "cover" || mode === "absorb") {
          const extra: MediaWithTalk[] = [];
          for (const t of talks) {
            const m = talkCover(t);
            if (m) extra.push({ ...m, talk: { talkId: t.id, venue: venueLabel(t) } });
          }
          row.media = [...(row.media ?? []), ...extra];
        }
        if (mode === "decorate") {
          row.decorations = talks
            .slice()
            .reverse()
            .map((t) => `[${venueLabel(t)}](commit:${t.id})`);
        }
        if (mode === "trailer") {
          row.trailers = talks.map((t) => ({
            key: locale === "zh" ? "演讲" : "Presented-at",
            value: `[${venueLabel(t)}](commit:${t.id})`,
          }));
        }
        return row;
      });

    if (mode === "nest") {
      // Hang each talk under its project, folded to a quiet line.
      const nested = new Set<string>();
      for (const list of talksOf.values()) for (const t of list) nested.add(t.id);
      const out: Commit[] = [];
      for (const r of rows) {
        if (nested.has(r.id) && rows.some((x) => x.id === presents(r))) continue;
        out.push(r);
        const talks = r.type === "project" ? talksOf.get(r.id) : undefined;
        if (!talks) continue;
        for (const t of [...talks].reverse()) {
          const here = rows.find((x) => x.id === t.id);
          if (!here || here.type !== "talk") continue;
          // A branch glyph, so the line reads as hanging off the project
          // rather than as one more aside in the column.
          out.push({
            ...here,
            present: "aside",
            asideLine: "venue",
            conference: { ...here.conference, name: `↳ ${venueLabel(here)}` },
          });
        }
      }
      rows = out;
    }

    return { ...block, commits: rows };
  });
}
