"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { Check, Copy, FileText, Navigation, Pencil, Play, RefreshCw, Search, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { AskDoc } from "../lib/corpus";
import { contextsOf, textOf, type AskUIMessage } from "../lib/tools";
import { usePageContext, contextText } from "../lib/page-context";
import { ASK_CONTEXT_SUGGESTIONS } from "../prompts";
import { loadedAskSearch } from "../lib/search";
import { AskCards, docForHref, useAskDocs } from "./cards";
import { ContextTag } from "./context-tag";
import { useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";

// =============================================================================
// The conversation: messages, the agent's steps, sources, and what can be done
// to a message. One piece of every surface that shows Ask.
//
//   a question   copy; edit (ask it again, changed: what came after it goes)
//   an answer    copy; regenerate (the last one); rewind to here (an earlier
//                one: what came after it goes, after a second press to confirm)
//
// Edit and rewind are the AI SDK's own moves (`sendMessage` with the id of
// the message it replaces; the message list cut short), ../lib/chat.ts. They
// wait while a reply is being written. A question's actions show on hover
// with a mouse, and on a tap or a long press on a touch screen.
//
// Built from AI Elements, as the registry ships them, restyled only through
// the site's tokens. What is ours is the arrangement: each run of tool calls
// as one chain of thought, what the agent presents as cards where it
// presented them, the pages its answer used as cards under it (./cards.tsx),
// and links that stay on the site (`onNavigate`).
// =============================================================================

type Part = AskUIMessage["parts"][number];
type ToolPart = Extract<Part, { type: "tool-search_site" | "tool-read" | "tool-open_page" | "tool-play" }>;

/** A message's parts, with each run of tool calls gathered into one block. */
type Block =
  | { kind: "text"; key: string; text: string }
  | { kind: "reasoning"; key: string; text: string; streaming: boolean }
  | { kind: "tools"; key: string; parts: ToolPart[] }
  | { kind: "cards"; key: string; ids: readonly string[] };

function blocksOf(message: AskUIMessage, live: boolean): Block[] {
  const blocks: Block[] = [];
  message.parts.forEach((part, i) => {
    const key = `${message.id}-${i}`;
    if (part.type === "text") {
      if (part.text.trim()) blocks.push({ kind: "text", key, text: part.text });
    } else if (part.type === "reasoning") {
      if (part.text.trim()) {
        blocks.push({ kind: "reasoning", key, text: part.text, streaming: live && part.state === "streaming" });
      }
    } else if (
      part.type === "tool-search_site" ||
      part.type === "tool-read" ||
      part.type === "tool-open_page" ||
      part.type === "tool-play"
    ) {
      const last = blocks.at(-1);
      if (last?.kind === "tools") last.parts.push(part);
      else blocks.push({ kind: "tools", key, parts: [part] });
    } else if (part.type === "tool-present" && part.input?.ids?.length) {
      // Drawn as soon as the ids are in; once the page has checked them,
      // only the ones that exist.
      const out = part.state === "output-available" ? part.output : null;
      if (out && "error" in out) return;
      blocks.push({
        kind: "cards",
        key,
        ids: (out ? out.shown : part.input.ids).filter((id): id is string => typeof id === "string"),
      });
    }
  });
  return blocks;
}

/** The docs for these ids (a passage id stands for its doc), once each. */
function docsFor(docs: Map<string, AskDoc>, ids: readonly string[]): AskDoc[] {
  const out = new Map<string, AskDoc>();
  for (const id of ids) {
    const doc = docs.get(id.split("#")[0]);
    if (doc) out.set(doc.id, doc);
  }
  return [...out.values()];
}

/** A doc id without its language: the post or talk itself. */
function thingOf(id: string) {
  return id.replace(/:(en|zh)$/, "");
}

/** What a turn used, as docs: the ones its answer links to, then the ones
 *  it read, less what it already presented. */
function sourcesOf(message: AskUIMessage, docs: Map<string, AskDoc>, locale: Locale): AskDoc[] {
  const out = new Map<string, AskDoc>();
  const presented = new Set<string>();
  for (const m of textOf(message).matchAll(/\]\((\/[^)\s]*)\)/g)) {
    const doc = docForHref(docs, m[1], locale);
    if (doc) out.set(doc.id, doc);
  }
  for (const part of message.parts) {
    if (part.type === "tool-read" && part.state === "output-available" && "doc" in part.output) {
      const doc = docs.get(part.output.doc);
      if (doc && !out.has(doc.id)) out.set(doc.id, doc);
    } else if (part.type === "tool-present" && part.state === "output-available" && "shown" in part.output) {
      part.output.shown.forEach((id) => presented.add(thingOf(id)));
    }
  }
  return [...out.values()].filter((d) => !presented.has(thingOf(d.id)));
}

function ToolSteps({ parts, live }: { parts: ToolPart[]; live: boolean }) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  return (
    <ChainOfThought defaultOpen={live}>
      <ChainOfThoughtHeader>{s.steps}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {parts.map((part) => {
          const done = part.state === "output-available" || part.state === "output-error";
          const status = done ? "complete" : "active";
          if (part.type === "tool-search_site") {
            const hits = part.state === "output-available" ? part.output : [];
            return (
              <ChainOfThoughtStep
                key={part.toolCallId}
                icon={Search}
                label={s.searched(part.input?.query ?? "…")}
                description={
                  part.state === "output-error"
                    ? part.errorText
                    : done
                      ? hits.length
                        ? s.results(hits.length)
                        : s.noResults
                      : undefined
                }
                status={status}
              >
                {hits.length > 0 && (
                  <ChainOfThoughtSearchResults>
                    {[...new Map(hits.map((h) => [h.doc, h])).values()].slice(0, 4).map((h) => (
                      <ChainOfThoughtSearchResult key={h.doc}>
                        <a href={h.href}>{h.title}</a>
                      </ChainOfThoughtSearchResult>
                    ))}
                  </ChainOfThoughtSearchResults>
                )}
              </ChainOfThoughtStep>
            );
          }
          if (part.type === "tool-open_page" || part.type === "tool-play") {
            const out = part.state === "output-available" ? part.output : null;
            const failed = part.state === "output-error" ? part.errorText : out && "error" in out ? out.error : undefined;
            const label =
              part.type === "tool-open_page"
                ? s.opened(part.input?.href ?? "…")
                : s.played(out && "playing" in out ? out.playing : (part.input?.id ?? "…"));
            return (
              <ChainOfThoughtStep
                key={part.toolCallId}
                icon={part.type === "tool-open_page" ? Navigation : Play}
                label={label}
                description={failed ?? (part.type === "tool-open_page" && out && "highlighted" in out && out.highlighted ? s.highlighted : undefined)}
                status={status}
              />
            );
          }
          const out = part.state === "output-available" ? part.output : null;
          const title = out && "title" in out ? out.title : (part.input?.id ?? "…");
          return (
            <ChainOfThoughtStep
              key={part.toolCallId}
              icon={FileText}
              label={s.read(title)}
              description={
                part.state === "output-error" ? part.errorText : out && "error" in out ? out.error : undefined
              }
              status={status}
            >
              {out && "href" in out && (
                <ChainOfThoughtSearchResults>
                  <ChainOfThoughtSearchResult>
                    <a href={out.href}>{out.title}</a>
                  </ChainOfThoughtSearchResult>
                </ChainOfThoughtSearchResults>
              )}
            </ChainOfThoughtStep>
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

function CopyAction({ text }: { text: string }) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <MessageAction
      tooltip={copied ? s.copied : s.copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard refused (permissions, an insecure origin): nothing to say.
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </MessageAction>
  );
}

/** Rewind to here, in two presses: the first asks (for a few seconds), the
 *  second drops. */
function RewindAction({ onRewind }: { onRewind: () => void }) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);
  return asking ? (
    <MessageAction
      size="sm"
      label={s.rewind}
      onClick={onRewind}
      className="h-7 gap-1.5 px-2 text-xs text-foreground"
    >
      <Undo2 className="size-3.5" />
      {s.rewindConfirm}
    </MessageAction>
  ) : (
    <MessageAction tooltip={s.rewind} onClick={() => setAsking(true)}>
      <Undo2 className="size-3.5" />
    </MessageAction>
  );
}

function AssistantMessage({
  message,
  live,
  last,
  busy,
  onRegenerate,
  onRewind,
}: {
  message: AskUIMessage;
  live: boolean;
  last: boolean;
  /** A reply is being written (this one or a later one). */
  busy: boolean;
  onRegenerate: () => void;
  onRewind: () => void;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const docs = useAskDocs();
  const sources = live || !docs ? [] : sourcesOf(message, docs, locale);
  return (
    <Message from="assistant">
      <MessageContent className="w-full">
        {blocksOf(message, live).map((block) => {
          if (block.kind === "text") {
            return (
              // Links are links: Streamdown's link safety turns each into a
              // button that confirms, then opens a new tab, so a link to a
              // page of this site never navigated. The answers link to this
              // site (onNavigate) and to sources the model found there.
              <MessageResponse key={block.key} linkSafety={{ enabled: false }}>
                {block.text}
              </MessageResponse>
            );
          }
          if (block.kind === "reasoning") {
            return (
              <Reasoning key={block.key} isStreaming={block.streaming}>
                <ReasoningTrigger />
                <ReasoningContent>{block.text}</ReasoningContent>
              </Reasoning>
            );
          }
          if (block.kind === "cards") {
            return docs ? <AskCards key={block.key} docs={docsFor(docs, block.ids)} /> : null;
          }
          return <ToolSteps key={block.key} parts={block.parts} live={live} />;
        })}
        {sources.length > 0 && <AskCards docs={sources} compact />}
      </MessageContent>
      {!live && (
        <MessageActions className="-ml-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <CopyAction text={textOf(message)} />
          {last && (
            <MessageAction tooltip={s.regenerate} onClick={onRegenerate}>
              <RefreshCw className="size-3.5" />
            </MessageAction>
          )}
          {!last && !busy && <RewindAction onRewind={onRewind} />}
        </MessageActions>
      )}
    </Message>
  );
}

/**
 * A question's actions, out of sight until asked for: a hover with a mouse
 * (Tailwind's `hover:` only applies where there is hover), a tap or a long
 * press on a touch screen (`data-revealed`), keyboard focus anywhere.
 * Hidden, they take no taps.
 */
const REVEAL =
  "pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 data-[revealed]:pointer-events-auto data-[revealed]:opacity-100";

/** A press this long on a question is a long press, ms. */
const LONG_PRESS_MS = 450;

function UserMessage({
  message,
  busy,
  onEdit,
}: {
  message: AskUIMessage;
  busy: boolean;
  onEdit: (text: string) => void;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const text = textOf(message);
  const [draft, setDraft] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [revealed, setRevealed] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: number; type: string; long: boolean } | null>(null);

  // Revealed by a touch, put away by a touch anywhere else.
  useEffect(() => {
    if (!revealed) return;
    const onDown = (e: PointerEvent) => {
      if (!row.current?.contains(e.target as Node)) setRevealed(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [revealed]);

  useEffect(() => {
    if (draft === null) return;
    const el = field.current;
    if (!el || document.activeElement === el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [draft]);

  if (draft !== null) {
    const send = () => {
      if (!draft.trim()) return;
      onEdit(draft);
      setDraft(null);
    };
    return (
      <Message from="user" className="max-w-full">
        <div className="w-full rounded-xl border border-border/60 bg-background/60 focus-within:border-ring/50">
          <textarea
            ref={field}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setDraft(null);
              } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            aria-label={s.edit}
            rows={Math.min(6, Math.max(2, draft.split("\n").length))}
            className="block w-full resize-none bg-transparent px-3.5 pt-3 pb-1 font-sans text-[16px] outline-none sm:text-sm"
          />
          <div className="flex justify-end gap-1.5 px-2 pb-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="pressable h-7 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.editCancel}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || draft.trim() === text}
              className="pressable h-7 rounded-md bg-foreground px-2.5 text-xs text-background transition-opacity disabled:opacity-40"
            >
              {s.editSend}
            </button>
          </div>
        </div>
      </Message>
    );
  }

  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };

  const contexts = contextsOf(message);
  const bubble = (
    // The actions sit beside the bubble, not under it: a row under every
    // question that only shows on demand left a gap the height of a button.
    // Packed to the trailing edge (`justify-start`, reversed), the bubble
    // without its own `ml-auto`, which pushed the actions to the far side.
    <Message ref={row} from="user" className="flex-row-reverse items-center justify-start">
      <MessageContent
        className="group-[.is-user]:ml-0"
        // A tap shows or hides the actions; a long press shows them (and
        // leaves the system's text selection be). A mouse has hover.
        onPointerDown={(e) => {
          endPress();
          if (e.pointerType === "mouse") return;
          const p = { type: e.pointerType, long: false, timer: 0 };
          p.timer = window.setTimeout(() => {
            p.long = true;
            setRevealed(true);
          }, LONG_PRESS_MS);
          press.current = p;
        }}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={endPress}
        onClick={() => {
          const p = press.current;
          // The click a long press ends with is not a tap.
          if (p && p.type !== "mouse" && !p.long) setRevealed((v) => !v);
        }}
      >
        {message.parts.map((p, j) =>
          p.type === "text" ? (
            <p key={j} className="whitespace-pre-wrap">
              {p.text}
            </p>
          ) : null,
        )}
      </MessageContent>
      <MessageActions className={REVEAL} data-revealed={revealed || undefined}>
        <CopyAction text={text} />
        {!busy && (
          <MessageAction tooltip={s.edit} onClick={() => setDraft(text)}>
            <Pencil className="size-3.5" />
          </MessageAction>
        )}
      </MessageActions>
    </Message>
  );
  if (!contexts.length) return bubble;
  return (
    // What it was asked about, over the question.
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex max-w-[80%] flex-wrap justify-end gap-1">
        {contexts.map((c, i) => (
          <ContextTag key={i} context={c} />
        ))}
      </div>
      {bubble}
    </div>
  );
}

export interface AskMessagesProps {
  /** A link to a page on this site was followed. */
  onNavigate: (href: string) => void;
  className?: string;
}

export function AskMessages({ onNavigate, className }: AskMessagesProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { messages, status, error, busy, send, regenerate, rewind, edit } = useAskSession();
  const page = usePageContext(useAskDocs());
  const site = loadedAskSearch();
  const kind = page?.doc.kind;
  const about = page
    ? ASK_CONTEXT_SUGGESTIONS[locale][
        kind === "post" ? "post" : kind === "conviction" || kind === "influence" ? "conviction" : kind === "work" ? "work" : "other"
      ]
    : [];

  // Links in answers and sources: this site's pages open here, in the page
  // under the surface; anything else keeps its own behaviour.
  const onClickCapture = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(href);
  };

  return (
    <Conversation
      className={cn("min-h-0 flex-1", className)}
      onClickCapture={onClickCapture}
      // Opened at the latest message, not scrolled there from the top: on a
      // phone the list starting at the top let the drawer take the first drag
      // (a sheet swipes when its scroller is at the top), and the scroll
      // animation fought the finger. New words still arrive smoothly.
      initial="instant"
    >
      <ConversationContent className="gap-6 px-4 py-4">
        {messages.length === 0 ? (
          <ConversationEmptyState className="gap-4 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">{s.emptyTitle}</h3>
              <p className="text-sm text-muted-foreground">{s.emptyHint}</p>
            </div>
            <div className="flex w-full max-w-sm flex-col items-stretch gap-2 pt-2">
              {/* On a page with something to ask about, about it first (sent
                  with it, whatever the composer's tag says: the question is
                  about "this"). */}
              {about.map((q) => (
                <Suggestion
                  key={q}
                  suggestion={q}
                  onClick={(text) => send(text, page && site ? [contextText(page, site)] : [])}
                  className="h-auto justify-start whitespace-normal py-2 text-left"
                />
              ))}
              {s.suggestions.slice(0, about.length ? 2 : undefined).map((q) => (
                <Suggestion
                  key={q}
                  suggestion={q}
                  onClick={send}
                  className="h-auto justify-start whitespace-normal py-2 text-left"
                />
              ))}
            </div>
          </ConversationEmptyState>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <UserMessage key={m.id} message={m} busy={busy} onEdit={(text) => void edit(m.id, text)} />
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                live={busy && i === messages.length - 1}
                last={i === messages.length - 1}
                busy={busy}
                onRegenerate={() => void regenerate()}
                onRewind={() => void rewind(m.id)}
              />
            ),
          )
        )}
        {status === "submitted" && messages.at(-1)?.role === "user" && (
          <Shimmer className="text-sm">{s.thinking}</Shimmer>
        )}
        {error && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="min-w-0">
              {s.error}
              {/* The route's own words for it (which provider, what it said). */}
              {error.message && <span className="block truncate text-xs text-tertiary-foreground">{error.message}</span>}
            </span>
            <button
              type="button"
              onClick={() => void regenerate()}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {s.retry}
            </button>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
