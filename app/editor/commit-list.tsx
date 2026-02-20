"use client";

import { cn } from "@/lib/utils";
import type { LogData } from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import { localize, sortTagsByDate, sortCommitsByDate } from "@/lib/log";
import { commitIcons } from "@/components/log/icons";
import { Plus, Settings, Film, Image, Link2, Code } from "lucide-react";

interface CommitListProps {
  data: LogData;
  locale: Locale;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddCommit: (tagId: string) => void;
  onEditTag: (tagId: string) => void;
}

export function CommitList({
  data,
  locale,
  selectedId,
  onSelect,
  onAddCommit,
  onEditTag,
}: CommitListProps) {
  const sortedTags = sortTagsByDate(data.tags);

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedTags.map((tag) => {
        const tagCommits = sortCommitsByDate(
          data.commits.filter((c) => c.tagId === tag.id)
        );

        return (
          <div key={tag.id}>
            {/* Tag header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 truncate">
                  {localize(tag.title, locale)}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/40">
                  {tagCommits.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEditTag(tag.id)}
                  className="p-1 text-muted-foreground/40 hover:text-muted-foreground rounded transition-colors"
                  title="Edit tag"
                >
                  <Settings className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onAddCommit(tag.id)}
                  className="p-1 text-muted-foreground/40 hover:text-muted-foreground rounded transition-colors"
                  title="Add commit"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Commits */}
            {tagCommits.map((commit) => {
              const Icon = commitIcons[commit.type];
              const isSelected = commit.id === selectedId;

              return (
                <button
                  key={commit.id}
                  onClick={() => onSelect(commit.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-b border-border/30",
                    isSelected
                      ? "bg-muted/20"
                      : "hover:bg-muted/10"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">
                      {localize(commit.title, locale)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground/50 uppercase">
                        {commit.type}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/40">
                        {commit.date}
                      </span>
                      {commit.listed === false && (
                        <span className="text-[10px] text-muted-foreground/40 italic">
                          unlisted
                        </span>
                      )}
                      {(commit.media ?? []).length > 0 && (
                        <span className="flex items-center gap-0.5 ml-auto">
                          {(commit.media ?? []).map((m, i) => {
                            const MIcon =
                              m.type === "video" ? Film :
                              m.type === "embed" ? Code :
                              m.type === "image" ? Image :
                              Link2;
                            return <MIcon key={i} className="w-2.5 h-2.5 text-muted-foreground/40" />;
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
