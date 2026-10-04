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
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { BookOpen, Check, Copy, FileText, RefreshCw, Search } from "lucide-react";
import { useState, type MouseEvent } from "react";
import type { AskUIMessage } from "../lib/tools";
import { useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";

// =============================================================================
// The conversation: messages, the agent's steps, sources, and what can be done
// to a message (copy, regenerate). One piece of every surface that shows Ask.
//
// Built from AI Elements, as the registry ships them, restyled only through
// the site's tokens. What is ours is the arrangement: each run of tool calls
// as one chain of thought, the pages a turn used as sources under its
// answer, and links that stay on the site (`onNavigate`).
// =============================================================================

type Part = AskUIMessage["parts"][number];
type ToolPart = Extract<Part, { type: "tool-search_site" | "tool-read" }>;

/** A message's parts, with each run of tool calls gathered into one block. */
type Block =
  | { kind: "text"; key: string; text: string }
  | { kind: "reasoning"; key: string; text: string; streaming: boolean }
  | { kind: "tools"; key: string; parts: ToolPart[] };

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
    } else if (part.type === "tool-search_site" || part.type === "tool-read") {
      const last = blocks.at(-1);
      if (last?.kind === "tools") last.parts.push(part);
      else blocks.push({ kind: "tools", key, parts: [part] });
    }
  });
  return blocks;
}

/** What a message says, as Markdown: what Copy copies. */
export function textOf(message: AskUIMessage): string {
  return message.parts
    .map((p) => (p.type === "text" ? p.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

/** The pages a turn read, and the ones its answer links to. */
function sourcesOf(message: AskUIMessage): { href: string; title: string }[] {
  const answer = textOf(message);
  const seen = new Map<string, string>();
  for (const part of message.parts) {
    if (part.type === "tool-read" && part.state === "output-available") {
      const out = part.output;
      if ("href" in out) seen.set(out.href, out.title);
    } else if (part.type === "tool-search_site" && part.state === "output-available") {
      for (const hit of part.output) {
        if (answer.includes(`](${hit.href}`)) seen.set(hit.href, hit.title);
      }
    }
  }
  return [...seen].map(([href, title]) => ({ href, title }));
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
            />
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

function AssistantMessage({
  message,
  live,
  last,
  onRegenerate,
}: {
  message: AskUIMessage;
  live: boolean;
  last: boolean;
  onRegenerate: () => void;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const sources = live ? [] : sourcesOf(message);
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
          return <ToolSteps key={block.key} parts={block.parts} live={live} />;
        })}
        {sources.length > 0 && (
          <Sources>
            <SourcesTrigger count={sources.length}>
              <span className="text-xs text-muted-foreground">{s.sources(sources.length)}</span>
            </SourcesTrigger>
            <SourcesContent>
              {sources.map((src) => (
                <Source key={src.href} href={src.href} title={src.title} target="_self" rel={undefined}>
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{src.title}</span>
                </Source>
              ))}
            </SourcesContent>
          </Sources>
        )}
      </MessageContent>
      {!live && (
        <MessageActions className="-ml-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <CopyAction text={textOf(message)} />
          {last && (
            <MessageAction tooltip={s.regenerate} onClick={onRegenerate}>
              <RefreshCw className="size-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      )}
    </Message>
  );
}

function UserMessage({ message }: { message: AskUIMessage }) {
  return (
    // Copy sits beside the bubble, not under it: a row under every question
    // that only shows on hover left a gap the height of a button.
    <Message from="user" className="flex-row-reverse items-center">
      <MessageContent>
        {message.parts.map((p, j) =>
          p.type === "text" ? (
            <p key={j} className="whitespace-pre-wrap">
              {p.text}
            </p>
          ) : null,
        )}
      </MessageContent>
      <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyAction text={textOf(message)} />
      </MessageActions>
    </Message>
  );
}

export interface AskMessagesProps {
  /** A link to a page on this site was followed. */
  onNavigate: (href: string) => void;
  className?: string;
  contentClassName?: string;
}

export function AskMessages({ onNavigate, className, contentClassName }: AskMessagesProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { messages, status, error, busy, send, regenerate } = useAskSession();

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
      <ConversationContent className={cn("gap-6 px-4 py-4", contentClassName)}>
        {messages.length === 0 ? (
          <ConversationEmptyState className="gap-4 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">{s.emptyTitle}</h3>
              <p className="text-sm text-muted-foreground">{s.emptyHint}</p>
            </div>
            <div className="flex w-full max-w-sm flex-col items-stretch gap-2 pt-2">
              {s.suggestions.map((q) => (
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
              <UserMessage key={m.id} message={m} />
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                live={busy && i === messages.length - 1}
                last={i === messages.length - 1}
                onRegenerate={() => void regenerate()}
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
