"use client";

import { Check, Copy, FolderDown, Link2, Send, Sparkles, Undo2, RotateCcw } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import type { IntentsApi, LogEntry, Snapshot as IntentsSnapshot, Source } from "intents";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useLabStrings, type LabTable } from "../i18n";
import { LabButton, LabChip } from "./shell";

// =============================================================================
// The intent loop, in Inspect.
//
// An experience built with an intent tree (packages/intents) opens its loop as
// window.__intents. Here it is laid open while the experience plays: say
// something of a thing; drag a thing on the frame (the overlay sends drags);
// answer what the model asks; see each event's path (① resolve, ask, ② infer
// with its tier and whether a real model or the stand-in answered), the tree,
// who decided each intent; keep the tree (save), pass it on (share), open
// someone's (remix), lean as a viewer, or, on a dream told as a tree, tell a
// new one.
// =============================================================================

const en = {
  loop: "Intent loop",
  loopNote:
    "The model that made this wrote its intent tree with it. Everything since is a shortcut through the tree: code computes from it, you resolve it, and a model infers again (weak or strong) when no preset reads what you did. Drag things on the frame, or say something.",
  say: "Say",
  of: "of",
  scene: "the scene",
  placeholder: "帽子大一点 · 门慢一点 · 床头放一盏灯…",
  dream: "Tell a dream",
  dreamNote: "A new dream is a new tree, not new code: the strong model writes the cast and the beats; this player plays them.",
  dreamPlaceholder: "我梦到他从窗外看着我，然后…",
  asks: "Asked",
  asksModel: "The model is not sure, and it changes what you see:",
  asksReadings: (t: string) => `"${t}" reads more than one way:`,
  now: "Now",
  nowNote: "Each intent, and who decided it. A viewer's leaning tilts only what the author left open.",
  events: "Events",
  tree: "Intent tree",
  version: "Versions",
  versionNote: "The tree is the data: kept in the repo, passed on as a link, remixed by whoever opens it.",
  save: "Save",
  saving: "Saving…",
  saved: "Saved to content/scenes",
  saveFailed: (e: string) => `Not saved: ${e}`,
  share: "Copy a link",
  copied: "Link copied",
  open: "Open",
  openPlaceholder: "a link with #v=…",
  undo: "Undo",
  reset: "The model's tree",
  changes: "Since the model's tree",
  noChanges: "Nothing yet.",
  lineage: (id: string, parent: string | null, by: string) => `version ${id} · from ${parent ?? "—"} · by ${by}`,
  viewer: "As a viewer",
  viewerNote: "Lean, without changing the author's tree: a preference that holds wherever the author did not decide.",
  sources: { person: "you", viewer: "viewer", model: "model", code: "code", ask: "to ask" } satisfies Record<Source, string>,
  paths: { resolve: "① resolve", ask: "ask", infer: "② infer", context: "context" },
  tiers: { weak: "weak model", strong: "strong model" },
  standIn: "stand-in",
  live: "live",
  thinking: "the model is looking…",
  observation: "What the model was shown",
  forget: "forget",
  dirty: "unsaved",
};

const zh: typeof en = {
  loop: "意图回路",
  loopNote: "做出这个体验的模型，把它的意图树和代码一起写了下来。之后的一切都是穿过这棵树的捷径：代码据它计算，你来定，识别不了的再交给模型（弱的或强的）重新推断。在画面上拖东西，或者说一句。",
  say: "说一句",
  of: "对",
  scene: "场景",
  placeholder: "帽子大一点 · 门慢一点 · 床头放一盏灯…",
  dream: "讲一个梦",
  dreamNote: "新的梦是一棵新的树，不是新的代码：强模型写出角色和每一幕，这个播放器把它演出来。",
  dreamPlaceholder: "我梦到他从窗外看着我，然后…",
  asks: "要问你的",
  asksModel: "模型拿不准，而这会改变你看到的：",
  asksReadings: (t) => `「${t}」有不止一种读法：`,
  now: "此刻",
  nowNote: "每个意图，以及是谁定的。观看者的偏好只会影响作者没定的地方。",
  events: "事件",
  tree: "意图树",
  version: "版本",
  versionNote: "树就是数据：存进仓库，变成链接传给别人，打开的人可以接着改。",
  save: "保存",
  saving: "保存中…",
  saved: "已存进 content/scenes",
  saveFailed: (e) => `没存上：${e}`,
  share: "复制链接",
  copied: "已复制链接",
  open: "打开",
  openPlaceholder: "带 #v=… 的链接",
  undo: "撤销",
  reset: "回到模型的树",
  changes: "相对模型最初的树",
  noChanges: "还没有。",
  lineage: (id, parent, by) => `版本 ${id} · 来自 ${parent ?? "—"} · ${by}`,
  viewer: "作为观看者",
  viewerNote: "不改作者的树，只表达倾向：在作者没定的地方生效。",
  sources: { person: "你", viewer: "观看者", model: "模型", code: "代码", ask: "待问" },
  paths: { resolve: "① resolve", ask: "提问", infer: "② infer", context: "上下文" },
  tiers: { weak: "弱模型", strong: "强模型" },
  standIn: "替身",
  live: "真实模型",
  thinking: "模型在看…",
  observation: "给模型看的",
  forget: "忘掉",
  dirty: "未保存",
};

const STRINGS: LabTable<typeof en> = { en, zh };

/** The running experience's intent loop, once it has opened itself; and its snapshot, live. */
export function useIntentsApi(frame: RefObject<HTMLIFrameElement | null>): { api: IntentsApi | null; snap: IntentsSnapshot | null } {
  const [api, setApi] = useState<IntentsApi | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const found = frame.current?.contentWindow?.__intents;
        if (found) {
          setApi(() => found);
          clearInterval(id);
        }
      } catch {
        // Not yet (or not this origin).
      }
    }, 150);
    return () => clearInterval(id);
  }, [frame]);
  const snap = useSyncExternalStore(
    (fn) => (api ? api.subscribe(fn) : () => {}),
    () => (api ? api.get() : null),
    () => null,
  );
  return { api, snap };
}

function Badge({ tone, children }: { tone: "green" | "violet" | "amber" | "grey"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded px-1.5 font-mono text-[10px] leading-4",
        tone === "green" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        tone === "violet" && "bg-violet-500/15 text-violet-700 dark:text-violet-300",
        tone === "amber" && "bg-amber-500/20 text-amber-700 dark:text-amber-300",
        tone === "grey" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

const sourceTone = (s: Source) => (s === "person" ? "green" : s === "viewer" ? "violet" : s === "ask" ? "amber" : "grey");
const pathTone = (p: LogEntry["path"]) => (p === "resolve" ? "green" : p === "infer" ? "violet" : p === "ask" ? "amber" : "grey");

export function IntentsPanel({ api, snap }: { api: IntentsApi; snap: IntentsSnapshot }) {
  const S = useLabStrings(STRINGS);
  const { locale } = useLocale();
  const [text, setText] = useState("");
  const [dreamText, setDreamText] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const tree = snap.tree;
  const isDream = !!tree.phases?.length;
  const node = (id: string) => tree.nodes.find((n) => n.id === id);
  const label = (n: string, i: string, k: string) => node(n)?.intents[i]?.kinds[k]?.label[locale] ?? k;
  const tries = isDream
    ? ["他再近一点", "第一幕他站在窗边", "灯亮着", "门开大一点"]
    : ["帽子大一点", "门慢一点", "门开大一点", "大一点", "别看我", "站到窗边", "让他站远一点", "床头放一盏灯", "关灯", "床上有一只猫"];

  return (
    <section className="space-y-5 rounded-2xl border border-violet-500/30 bg-violet-500/[0.04] p-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={TYPE.label}>{S.loop}</h2>
          <span className={cn(TYPE.rowMeta, "text-[11px]")}>
            {tree.title[locale]} · {S.lineage(snap.version.id, snap.version.parent, snap.version.by)}
            {snap.dirty && <span className="ml-1 text-amber-600 dark:text-amber-400">· {S.dirty}</span>}
          </span>
        </div>
        <p className={cn(TYPE.caption, "mt-1")}>{S.loopNote}</p>
      </div>

      {/* Say: a sentence is an event, of a thing or of the scene. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn(TYPE.rowMeta, "text-[11px]")}>{S.say} · {S.of}</span>
          {[null, ...tree.nodes.map((n) => n.id)].map((id) => (
            <LabChip key={id ?? "scene"} on={target === id} onClick={() => setTarget(id)}>
              {id ? (node(id)?.label[locale] ?? id) : S.scene}
            </LabChip>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || snap.pending) return;
            void api.dispatch({ type: "say", text: text.trim(), node: target });
            setText("");
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={S.placeholder}
            className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-foreground/40"
          />
          <LabButton tone="primary" type="submit" disabled={snap.pending}>
            <Send />
            {S.say}
          </LabButton>
        </form>
        <div className="flex flex-wrap gap-1">
          {tries.map((t) => (
            <button
              key={t}
              type="button"
              disabled={snap.pending}
              onClick={() => void api.dispatch({ type: "say", text: t, node: target })}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* A new dream: only where the experience plays a tree's beats. */}
      {isDream && (
        <div className="space-y-2">
          <div className={TYPE.label}>{S.dream}</div>
          <p className={TYPE.caption}>{S.dreamNote}</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!dreamText.trim() || snap.pending) return;
              void api.dispatch({ type: "dream", text: dreamText.trim() });
              setDreamText("");
            }}
          >
            <input
              value={dreamText}
              onChange={(e) => setDreamText(e.target.value)}
              placeholder={S.dreamPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-foreground/40"
            />
            <LabButton tone="primary" type="submit" disabled={snap.pending}>
              <Sparkles />
              {S.dream}
            </LabButton>
          </form>
        </div>
      )}

      {/* Asked: the model unsure where it matters, or a sentence with two readings. */}
      {(snap.asks.length > 0 || snap.question) && (
        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-3">
          <div className={TYPE.label}>{S.asks}</div>
          {snap.question && (
            <div className="space-y-2">
              <p className="text-sm text-foreground">{S.asksReadings(snap.question.text)}</p>
              <div className="flex flex-wrap gap-1.5">
                {snap.question.readings.map((r) => (
                  <LabButton key={`${r.node}.${r.intent}.${r.kind}`} tone="primary" onClick={() => void api.dispatch({ type: "answer", node: r.node, intent: r.intent, kind: r.kind })}>
                    {node(r.node)?.label[locale]} · {node(r.node)?.intents[r.intent]?.label[locale]} → {label(r.node, r.intent, r.kind)}
                  </LabButton>
                ))}
              </div>
            </div>
          )}
          {snap.asks.map((a) => (
            <div key={a.key} className="space-y-2">
              <p className="text-sm text-foreground">
                {S.asksModel} <span className="font-medium">{node(a.node)?.label[locale]} · {node(a.node)?.intents[a.intent]?.label[locale]}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {a.kinds.map((k) => (
                  <LabButton key={k} tone="primary" onClick={() => void api.dispatch({ type: "answer", node: a.node, intent: a.intent, kind: k })}>
                    {label(a.node, a.intent, k)} · {Math.round((a.p[k] ?? 0) * 100)}%
                  </LabButton>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Now: each intent, its value, who decided it; a viewer can lean. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className={TYPE.label}>{S.now}</div>
          <div className="flex gap-1">
            <LabButton disabled={!snap.canUndo || snap.pending} onClick={() => api.undo()}>
              <Undo2 />
              {S.undo}
            </LabButton>
            <LabButton disabled={snap.pending} onClick={() => api.reset()}>
              <RotateCcw />
              {S.reset}
            </LabButton>
          </div>
        </div>
        <p className={TYPE.caption}>{S.nowNote}</p>
        <div className="grid gap-1.5">
          {Object.values(snap.values).map((v) => {
            const intent = node(v.node)?.intents[v.intent];
            if (!intent) return null;
            const leaning = snap.ctx.viewer[v.intent];
            return (
              <div key={v.key} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="text-muted-foreground">
                    {node(v.node)?.label[locale]} · {intent.label[locale]}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-foreground">{label(v.node, v.intent, v.kind)}</span>
                    <Badge tone={sourceTone(v.source)}>{S.sources[v.source]}{v.from ? ` · ${v.from}` : ""}</Badge>
                    {v.source === "person" && (
                      <button type="button" onClick={() => api.forget(v.node, v.intent)} className={cn(TYPE.rowMeta, "text-[10px] hover:text-foreground")}>
                        {S.forget}
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 pl-2">
                  <span className={cn(TYPE.rowMeta, "text-[10px]")}>{S.viewer}:</span>
                  {Object.keys(intent.kinds).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => void api.dispatch({ type: "lean", intent: v.intent, kind: leaning === k ? null : k })}
                      className={cn(
                        "rounded border px-1 text-[10px] leading-4 transition-colors",
                        leaning === k ? "border-violet-500 bg-violet-500/15 text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label(v.node, v.intent, k)}
                      {intent.kinds[k].learned ? "*" : ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className={cn(TYPE.caption, "text-[11px]")}>{S.viewerNote}</p>
      </div>

      {/* Events: the newest first. */}
      <div className="space-y-2">
        <div className={TYPE.label}>{S.events}</div>
        <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {snap.log.map((e) => (
            <div key={e.id} className="space-y-1 rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-foreground">{e.event}</span>
                <span className="flex gap-1">
                  <Badge tone={pathTone(e.path)}>{S.paths[e.path]}</Badge>
                  {e.tier && <Badge tone="grey">{S.tiers[e.tier]}</Badge>}
                  {e.path === "infer" && !e.pending && <Badge tone={e.live ? "green" : "grey"}>{e.live ? `${S.live}${e.by?.model ? ` · ${e.by.model}` : ""}` : S.standIn}</Badge>}
                </span>
              </div>
              <div className={cn(TYPE.rowMeta, "text-[11px]")}>
                {e.pending ? S.thinking : e.detail}
                {e.ms !== undefined && !e.pending && ` · ${e.ms} ms`}
              </div>
              {e.note && <div className="text-[12px] leading-snug text-foreground">{e.note[locale]}</div>}
              {(e.added.length > 0 || e.removed.length > 0) && (
                <pre className="overflow-x-auto font-mono text-[10px] leading-[1.5]">
                  {e.removed.map((l, i) => (
                    <div key={`r${i}`} className="text-red-600 dark:text-red-400">- {l.trim()}</div>
                  ))}
                  {e.added.map((l, i) => (
                    <div key={`a${i}`} className="text-emerald-700 dark:text-emerald-400">+ {l.trim()}</div>
                  ))}
                </pre>
              )}
              {e.observation && (
                <details>
                  <summary className={cn(TYPE.rowMeta, "cursor-pointer text-[11px]")}>{S.observation}</summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-[1.45]">{e.observation}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Versions: save, share, open; what this version changes. */}
      <div className="space-y-2">
        <div className={TYPE.label}>{S.version}</div>
        <p className={TYPE.caption}>{S.versionNote}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <LabButton
            tone="primary"
            disabled={snap.pending}
            onClick={() => {
              setStatus(S.saving);
              void api.save().then((r) => setStatus(r.ok ? S.saved : S.saveFailed(r.error ?? "")));
            }}
          >
            <FolderDown />
            {S.save}
          </LabButton>
          <LabButton
            onClick={() => {
              void api.share().then((v) => {
                const url = `${location.origin}/scenes/${snap.scene}/index.html#${v}`;
                setLink(url);
                void navigator.clipboard?.writeText(url).catch(() => {});
                setStatus(S.copied);
              });
            }}
          >
            <Copy />
            {S.share}
          </LabButton>
          {status && (
            <span className={cn(TYPE.rowMeta, "text-[11px]")}>
              <Check className="mr-0.5 inline h-3 w-3" />
              {status}
            </span>
          )}
        </div>
        {link && <input readOnly value={link} className="w-full truncate rounded border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[10px]" onFocus={(e) => e.target.select()} />}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem("link") as HTMLInputElement).value;
            void api.open(input);
          }}
        >
          <input name="link" placeholder={S.openPlaceholder} className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] outline-none" />
          <LabButton type="submit">
            <Link2 />
            {S.open}
          </LabButton>
        </form>
        <div className={cn(TYPE.rowMeta, "text-[11px]")}>{S.changes}</div>
        {snap.changes.length === 0 ? (
          <p className={cn(TYPE.rowMeta, "text-[11px]")}>{S.noChanges}</p>
        ) : (
          <ul className="space-y-0.5 font-mono text-[11px]">
            {snap.changes.map((c, i) => (
              <li key={i} className="text-foreground">
                {c.kind === "pick" ? "✓" : c.kind === "unpick" ? "○" : c.kind === "drawing" ? "✎" : "+"} {c.node}
                {c.intent ? `.${c.intent}` : ""}
                {c.value ? ` = ${c.intent ? label(c.node, c.intent, c.value) : c.value}` : ""}
                <span className="text-muted-foreground"> · {c.kind}{c.by ? ` · ${c.by}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The tree itself: the state. */}
      <details>
        <summary className={cn(TYPE.label, "cursor-pointer")}>{S.tree}</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-2.5 font-mono text-[10.5px] leading-[1.55] text-foreground">{snap.xml}</pre>
      </details>
    </section>
  );
}
