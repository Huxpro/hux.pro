"use client";

/**
 * /works, selected — a few works printed in full, the whole log behind one
 * line.
 *
 * The other simplifications of this page take chrome off every row. This
 * one takes rows off the page: the log's row — hash, mark, title, venue,
 * two lines, a strip of covers — was designed carefully and reads well one
 * at a time; it is thirty-five of them in a column that nobody reads. So
 * the page prints the handful the author selected (`works-selected` in
 * `log.json`, the way the home widgets take theirs), each in the covers
 * form it was designed for, and then one line in the log's own voice:
 *
 *   git log --all · 35
 *
 * which unfolds the complete log as the index — one line per commit, the
 * chapters marking the eras — for the reader who came for everything. No
 * toolbar: the selection answered "what matters" and the index answers
 * "what else"; a type filter would be a third answer to a question the
 * page no longer asks. `?type=` in the URL still works — it opens the log
 * filtered, since a link that asked for the talks should land on them.
 *
 * The hash column stays, and so does `/works#<hash>`: a link to a commit
 * outside the selection opens the log on the way in.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { Commit } from "@/components/log/commit-embed";
import { LogTimeline } from "@/components/log/log-timeline";
import { useCommitAnchor } from "@/components/log/use-commit-anchor";
import { t, useLocale } from "@/services";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import {
  buildTimelineData,
  computeCommitHash,
  isRowVisible,
  resolveGroupCommits,
  type Commit as CommitData,
  type LogData,
} from "@/lib/log";
import { parseViewState } from "@/lib/log-view";

/** The group in `log.json` that names the selection. */
const SELECTED_GROUP_ID = "works-selected";

interface WorksSelectedProps {
  logData: LogData;
}

export function WorksSelected({ logData }: WorksSelectedProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const selectHash = useCommitAnchor();

  const data = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );

  const selected = useMemo<CommitData[]>(() => {
    const group = logData.groups?.find((g) => g.id === SELECTED_GROUP_ID);
    return group
      ? resolveGroupCommits(group, logData.commits, undefined, locale)
      : [];
  }, [logData, locale]);

  // A filter in the URL is a request for the log, not the selection.
  const types = useMemo(
    () => parseViewState(new URLSearchParams(searchParams.toString())).types,
    [searchParams],
  );
  const [opened, setOpened] = useState(false);
  const open = opened || types.length > 0;

  // A permalink to a commit the selection does not print opens the log on
  // the way in, so the address still lands. Read on the client only — the
  // hash is not part of the server's render.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!/^[0-9a-f]{7}$/.test(hash)) return;
    if (selected.some((c) => computeCommitHash(c.id) === hash)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: the hash is client-only
    setOpened(true);
  }, [selected]);

  const total = useMemo(
    () =>
      data.reduce(
        (n, { commits }) => n + commits.filter((c) => isRowVisible(c)).length,
        0,
      ),
    [data],
  );
  const hasMatches = useMemo(
    () => data.some(({ commits }) => commits.some((c) => isRowVisible(c, types))),
    [data, types],
  );

  const toggle = useCallback(() => setOpened((v) => !v), []);

  return (
    <PageLayout page="works">
      {/* The selection: the log's own row, in the form it was designed
          for, for the few it was designed for. */}
      <div className={cn(TYPE.label, "mb-2")}>{t(locale, "logSelectedWorks")}</div>
      <div className="space-y-0">
        {selected.map((commit) => (
          <Commit
            key={commit.id}
            commit={commit}
            locale={locale}
            variant="timeline"
            form="covers"
            onSelectHash={selectHash}
          />
        ))}
      </div>

      {/* The rest, behind one line in the log's voice. `git init` closes the
          unfolded log as it always did; folded, this line is the page's
          last word instead. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="works-log"
        className={cn(
          "pressable mt-8 -mx-2 rounded px-2 py-2 font-mono text-xs transition-colors duration-200",
          open
            ? "text-foreground"
            : "text-tertiary-foreground hover:text-foreground",
        )}
      >
        <span aria-hidden className="mr-1.5 text-quaternary-foreground">$</span>
        git log --all
        <span className="ml-2 tabular-nums text-quaternary-foreground">{total}</span>
      </button>

      {open && (
        <div id="works-log" className="mt-4">
          <LogTimeline
            data={data}
            locale={locale}
            identities={logData.identities}
            form="index"
            activeTypes={types}
            onSelectHash={selectHash}
          />
          <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
            {t(locale, hasMatches ? "logInit" : "logNoMatches")}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
