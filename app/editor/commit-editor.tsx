"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Commit, CommitType, Tag } from "@/lib/log";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CommitEditorProps {
  commit: Commit;
  tags: Tag[];
  onUpdate: (commit: Commit) => void;
  onDelete: () => void;
  onBack: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared field components
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors";

  return (
    <label className="flex items-start gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right pt-1.5">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cn(cls, "resize-y")}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-sm focus:outline-none focus:border-foreground/30 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 w-20 shrink-0 text-right">
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/40 pt-2">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific field defaults for when changing commit type
// ─────────────────────────────────────────────────────────────────────────────

function defaultFieldsForType(type: CommitType): Partial<Commit> {
  switch (type) {
    case "project":
      return { links: [], techStack: [] };
    case "talk":
      return { conference: { name: "" } };
    case "post":
      return { url: "", publication: { name: "" } };
    case "role":
      return {
        company: { en: "", zh: "" },
        roleTitle: { en: "", zh: "" },
      };
    case "social":
      return { platform: "", url: "" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main editor
// ─────────────────────────────────────────────────────────────────────────────

export function CommitEditor({
  commit,
  tags,
  onUpdate,
  onDelete,
  onBack,
}: CommitEditorProps) {
  const [tab, setTab] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(commit, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync JSON text when switching to JSON tab or when commit changes externally
  const switchToJson = () => {
    setJsonText(JSON.stringify(commit, null, 2));
    setJsonError(null);
    setTab("json");
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.id || !parsed.type || !parsed.tagId) {
        throw new Error("Missing required fields: id, type, tagId");
      }
      onUpdate(parsed as Commit);
      setJsonError(null);
      setTab("form");
      toast.success("JSON applied");
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const update = (partial: Record<string, unknown>) => {
    onUpdate({ ...commit, ...partial } as Commit);
  };

  const handleTypeChange = (newType: CommitType) => {
    const base = {
      id: commit.id,
      tagId: commit.tagId,
      date: commit.date,
      endDate: commit.endDate,
      title: commit.title,
      description: commit.description,
      commentary: commit.commentary,
      tags: commit.tags,
      listed: commit.listed,
    };
    onUpdate({
      ...base,
      type: newType,
      ...defaultFieldsForType(newType),
    } as Commit);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <div className="flex border border-border/50 rounded overflow-hidden">
            <button
              onClick={() => setTab("form")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                tab === "form"
                  ? "bg-muted/30 text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              Form
            </button>
            <button
              onClick={switchToJson}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                tab === "json"
                  ? "bg-muted/30 text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              JSON
            </button>
          </div>
          <button
            onClick={onDelete}
            className="p-1 text-muted-foreground/40 hover:text-red-500 rounded transition-colors"
            title="Delete commit"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === "json" ? (
          <div className="space-y-2">
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setJsonError(null);
              }}
              className="w-full h-[60vh] bg-transparent border border-border/50 rounded p-2 font-mono text-xs resize-y focus:outline-none focus:border-foreground/30"
              spellCheck={false}
            />
            {jsonError && (
              <p className="text-xs text-red-500 font-mono">{jsonError}</p>
            )}
            <button
              onClick={applyJson}
              className="px-3 py-1.5 text-xs font-mono bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
            >
              Apply JSON
            </button>
          </div>
        ) : (
          <FormFields
            commit={commit}
            tags={tags}
            onUpdate={update}
            onTypeChange={handleTypeChange}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form fields
// ─────────────────────────────────────────────────────────────────────────────

function FormFields({
  commit,
  tags,
  onUpdate,
  onTypeChange,
}: {
  commit: Commit;
  tags: Tag[];
  onUpdate: (partial: Record<string, unknown>) => void;
  onTypeChange: (type: CommitType) => void;
}) {
  const commitTypes: CommitType[] = ["project", "talk", "post", "role", "social"];

  return (
    <div className="space-y-2">
      {/* Core fields */}
      <Field label="ID" value={commit.id} onChange={(v) => onUpdate({ id: v })} />
      <SelectField
        label="Type"
        value={commit.type}
        options={commitTypes.map((t) => ({ value: t, label: t }))}
        onChange={(v) => onTypeChange(v as CommitType)}
      />
      <SelectField
        label="Tag"
        value={commit.tagId}
        options={tags.map((t) => ({ value: t.id, label: t.title.en }))}
        onChange={(v) => onUpdate({ tagId: v })}
      />
      <Field
        label="Date"
        value={commit.date}
        onChange={(v) => onUpdate({ date: v })}
        placeholder="YYYY-MM or YYYY-MM-DD"
      />
      <Field
        label="End Date"
        value={commit.endDate ?? ""}
        onChange={(v) => onUpdate({ endDate: v || undefined })}
        placeholder="YYYY-MM or empty"
      />
      <CheckField
        label="Listed"
        checked={commit.listed !== false}
        onChange={(v) => onUpdate({ listed: v ? undefined : false })}
      />

      <SectionLabel>Title</SectionLabel>
      <Field
        label="EN"
        value={commit.title.en}
        onChange={(v) => onUpdate({ title: { ...commit.title, en: v } })}
      />
      <Field
        label="ZH"
        value={commit.title.zh}
        onChange={(v) => onUpdate({ title: { ...commit.title, zh: v } })}
      />

      <SectionLabel>Description</SectionLabel>
      <Field
        label="EN"
        value={commit.description.en}
        onChange={(v) => onUpdate({ description: { ...commit.description, en: v } })}
        multiline
      />
      <Field
        label="ZH"
        value={commit.description.zh}
        onChange={(v) => onUpdate({ description: { ...commit.description, zh: v } })}
        multiline
      />

      <SectionLabel>Commentary</SectionLabel>
      <Field
        label="EN"
        value={commit.commentary?.en ?? ""}
        onChange={(v) =>
          onUpdate({
            commentary: v || commit.commentary?.zh
              ? { en: v, zh: commit.commentary?.zh ?? "" }
              : undefined,
          })
        }
        multiline
      />
      <Field
        label="ZH"
        value={commit.commentary?.zh ?? ""}
        onChange={(v) =>
          onUpdate({
            commentary: v || commit.commentary?.en
              ? { en: commit.commentary?.en ?? "", zh: v }
              : undefined,
          })
        }
        multiline
      />

      <SectionLabel>Tags</SectionLabel>
      <Field
        label="Tags"
        value={(commit.tags ?? []).join(", ")}
        onChange={(v) =>
          onUpdate({
            tags: v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="Comma-separated"
      />

      {/* Type-specific fields */}
      <TypeSpecificFields commit={commit} onUpdate={onUpdate} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific field sections
// ─────────────────────────────────────────────────────────────────────────────

function TypeSpecificFields({
  commit,
  onUpdate,
}: {
  commit: Commit;
  onUpdate: (partial: Record<string, unknown>) => void;
}) {
  switch (commit.type) {
    case "project":
      return (
        <>
          <SectionLabel>Project</SectionLabel>
          <Field
            label="Tech Stack"
            value={(commit.techStack ?? []).join(", ")}
            onChange={(v) =>
              onUpdate({
                techStack: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Comma-separated"
          />
          <Field
            label="Stars"
            value={commit.stats?.stars?.toString() ?? ""}
            onChange={(v) =>
              onUpdate({
                stats: {
                  ...commit.stats,
                  stars: v ? parseInt(v, 10) || undefined : undefined,
                },
              })
            }
          />
          <Field
            label="Users"
            value={commit.stats?.users ?? ""}
            onChange={(v) =>
              onUpdate({
                stats: { ...commit.stats, users: v || undefined },
              })
            }
          />
          <SectionLabel>Links (use JSON tab for complex edits)</SectionLabel>
          <div className="text-xs text-muted-foreground/50 font-mono pl-[88px]">
            {commit.links.length} link(s)
            {commit.links.map((l, i) => (
              <div key={i} className="truncate">
                {l.label}: {l.url}
              </div>
            ))}
          </div>
        </>
      );

    case "talk":
      return (
        <>
          <SectionLabel>Talk</SectionLabel>
          <Field
            label="Conference"
            value={commit.conference.name}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, name: v },
              })
            }
          />
          <Field
            label="City"
            value={commit.conference.city ?? ""}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, city: v || undefined },
              })
            }
          />
          <Field
            label="Conf URL"
            value={commit.conference.url ?? ""}
            onChange={(v) =>
              onUpdate({
                conference: { ...commit.conference, url: v || undefined },
              })
            }
          />
          <SectionLabel>Video</SectionLabel>
          <Field
            label="Video URL"
            value={commit.video?.url ?? ""}
            onChange={(v) =>
              onUpdate({
                video: v
                  ? {
                      ...commit.video,
                      url: v,
                      platform: commit.video?.platform ?? "youtube",
                    }
                  : undefined,
              })
            }
          />
          <Field
            label="Thumbnail"
            value={commit.video?.thumbnail ?? ""}
            onChange={(v) =>
              onUpdate({
                video: commit.video
                  ? { ...commit.video, thumbnail: v || undefined }
                  : undefined,
              })
            }
          />
          <SelectField
            label="Platform"
            value={commit.video?.platform ?? "youtube"}
            options={[
              { value: "youtube", label: "YouTube" },
              { value: "bilibili", label: "Bilibili" },
              { value: "other", label: "Other" },
            ]}
            onChange={(v) =>
              onUpdate({
                video: commit.video
                  ? { ...commit.video, platform: v }
                  : undefined,
              })
            }
          />
          <Field
            label="Slides URL"
            value={commit.slides?.url ?? ""}
            onChange={(v) =>
              onUpdate({ slides: v ? { url: v } : undefined })
            }
          />
        </>
      );

    case "post":
      return (
        <>
          <SectionLabel>Post</SectionLabel>
          <Field
            label="URL"
            value={commit.url}
            onChange={(v) => onUpdate({ url: v })}
          />
          <Field
            label="Publication"
            value={commit.publication.name}
            onChange={(v) =>
              onUpdate({
                publication: { ...commit.publication, name: v },
              })
            }
          />
        </>
      );

    case "role":
      return (
        <>
          <SectionLabel>Role</SectionLabel>
          <Field
            label="Company EN"
            value={commit.company.en}
            onChange={(v) =>
              onUpdate({ company: { ...commit.company, en: v } })
            }
          />
          <Field
            label="Company ZH"
            value={commit.company.zh}
            onChange={(v) =>
              onUpdate({ company: { ...commit.company, zh: v } })
            }
          />
          <Field
            label="Role EN"
            value={commit.roleTitle.en}
            onChange={(v) =>
              onUpdate({ roleTitle: { ...commit.roleTitle, en: v } })
            }
          />
          <Field
            label="Role ZH"
            value={commit.roleTitle.zh}
            onChange={(v) =>
              onUpdate({ roleTitle: { ...commit.roleTitle, zh: v } })
            }
          />
          <Field
            label="Location"
            value={commit.location ?? ""}
            onChange={(v) => onUpdate({ location: v || undefined })}
          />
          <Field
            label="URL"
            value={commit.url ?? ""}
            onChange={(v) => onUpdate({ url: v || undefined })}
          />
        </>
      );

    case "social":
      return (
        <>
          <SectionLabel>Social</SectionLabel>
          <Field
            label="Platform"
            value={commit.platform}
            onChange={(v) => onUpdate({ platform: v })}
          />
          <Field
            label="URL"
            value={commit.url}
            onChange={(v) => onUpdate({ url: v })}
          />
        </>
      );

    default:
      return null;
  }
}
