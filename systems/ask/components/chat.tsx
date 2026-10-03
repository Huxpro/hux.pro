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
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { VoiceButton, VoiceGlow } from "@/systems/command/voice";
import { useVoiceInput } from "@/systems/voice";
import { useChat } from "@ai-sdk/react";
import { BookOpen, ChevronLeft, FileText, Search, SquarePen } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { getAskChat, getAskModel, resetAskChat, setAskModel } from "../lib/chat";
import { ASK_MODELS } from "../lib/models";
import type { AskUIMessage } from "../lib/tools";
import { askStrings } from "../strings";

// =============================================================================
// Ask: the palette as a conversation.
//
// Built from AI Elements (components/ai-elements), as the registry ships
// them, restyled only through the site's tokens; each can be taken over and
// made the site's own one at a time. What is ours is the arrangement: the
// agent's steps (searches, reads) as one chain of thought per run of tool
// calls, the pages it used as sources under the answer, and links that stay
// on the site (a click navigates and the palette leaves, as a command would).
//
// The shells (systems/command/popover.tsx, sheet.tsx) load this lazily, the
// first time Ask opens, so none of it costs anything until then.
// =============================================================================

const LANG = { en: "en-US", zh: "zh-CN" } as const;

/** The last `askRequest` sent, so a remount never sends one twice. */
let consumedRequest = 0;

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

/** The pages a turn read, and the ones its answer links to. */
function sourcesOf(message: AskUIMessage): { href: string; title: string }[] {
  const answer = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n");
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
            const input = part.input;
            const hits = part.state === "output-available" ? part.output : [];
            return (
              <ChainOfThoughtStep
                key={part.toolCallId}
                icon={Search}
                label={s.searched(input?.query ?? "…")}
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
          const input = part.input;
          const out = part.state === "output-available" ? part.output : null;
          const title = out && "title" in out ? out.title : (input?.id ?? "…");
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

function AssistantMessage({ message, live }: { message: AskUIMessage; live: boolean }) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const sources = live ? [] : sourcesOf(message);
  return (
    <Message from="assistant">
      <MessageContent className="w-full">
        {blocksOf(message, live).map((block) => {
          if (block.kind === "text") return <MessageResponse key={block.key}>{block.text}</MessageResponse>;
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
    </Message>
  );
}

export interface AskChatProps {
  /** A question to send on arrival, from the palette's field. */
  request: { text: string; n: number } | null;
  onBack: () => void;
  /** A link to a page on this site was followed. */
  onNavigate: (href: string) => void;
  /** The shell's own controls at the end of the header (a close button). */
  trailing?: ReactNode;
  className?: string;
}

export default function AskChat({ request, onBack, onNavigate, trailing, className }: AskChatProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const [chat, setChat] = useState(getAskChat);
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({ chat });
  const [input, setInput] = useState("");
  const [model, setModel] = useState(getAskModel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput({
    lang: LANG[locale],
    onInterim: (said) => setInput(said),
    onFinal: (said) => setInput(said.trim()),
  });

  // The question the palette opened with: sent once.
  useEffect(() => {
    if (!request || request.n <= consumedRequest) return;
    consumedRequest = request.n;
    void sendMessage({ text: request.text });
  }, [request, sendMessage]);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    void sendMessage({ text: question });
  };

  // Links in answers and sources: this site's pages open here, in the page
  // under the palette; anything else keeps its own behaviour.
  const onClickCapture = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(href);
  };

  return (
    // The chat sits inside the palette's cmdk root, which takes ↑ ↓ ↵ Home
    // End for its list. In here they belong to the text: only Escape (back
    // to search, handled by the palette) goes on up.
    <div
      className={cn("flex min-h-0 flex-col", className)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") e.stopPropagation();
      }}
    >
      <div className="relative flex shrink-0 items-center gap-2 border-b border-border/50 px-2 py-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={s.backToSearch}
          title={s.backToSearch}
          className="pressable flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 font-sans text-sm font-medium text-muted-foreground">{s.ask}</span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setChat(resetAskChat());
              setInput("");
              textareaRef.current?.focus();
            }}
            aria-label={s.newChat}
            title={s.newChat}
            className="pressable flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        )}
        {trailing}
      </div>

      <Conversation className="min-h-0 flex-1" onClickCapture={onClickCapture}>
        <ConversationContent className="gap-6 px-4 py-4">
          {messages.length === 0 ? (
            <ConversationEmptyState title={s.emptyTitle} description={s.emptyHint} className="gap-4 p-4">
              <div className="flex w-full max-w-sm flex-col items-stretch gap-2 pt-2">
                {s.suggestions.map((q) => (
                  <Suggestion key={q} suggestion={q} onClick={send} className="h-auto justify-start whitespace-normal py-2 text-left" />
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m, i) =>
              m.role === "user" ? (
                <Message key={m.id} from="user">
                  <MessageContent>
                    {m.parts.map((p, j) => (p.type === "text" ? <p key={j} className="whitespace-pre-wrap">{p.text}</p> : null))}
                  </MessageContent>
                </Message>
              ) : (
                <AssistantMessage key={m.id} message={m} live={busy && i === messages.length - 1} />
              ),
            )
          )}
          {status === "submitted" && messages.at(-1)?.role === "user" && (
            <Shimmer className="text-sm">{s.thinking}</Shimmer>
          )}
          {error && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{s.error}</span>
              <button type="button" onClick={() => void regenerate()} className="underline underline-offset-4 hover:text-foreground">
                {s.retry}
              </button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 p-2 pt-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <PromptInput
          onSubmit={() => send(input)}
          className="relative rounded-xl bg-transparent"
        >
          <PromptInputBody>
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder={s.placeholder}
              className="min-h-12 font-sans text-[16px] sm:text-sm"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputSelect
                value={model}
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  setAskModel(value);
                  setModel(value);
                }}
              >
                <PromptInputSelectTrigger aria-label={s.model} className="h-8 text-xs">
                  <PromptInputSelectValue>
                    {(value: string) => ASK_MODELS.find((m) => m.id === value)?.label ?? value}
                  </PromptInputSelectValue>
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {ASK_MODELS.map((m) => (
                    <PromptInputSelectItem key={m.id} value={m.id}>
                      {m.label}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
              <VoiceButton voice={voice} />
            </PromptInputTools>
            <PromptInputSubmit
              status={status}
              onStop={() => void stop()}
              disabled={!busy && !input.trim()}
            />
          </PromptInputFooter>
          <VoiceGlow voice={voice} />
        </PromptInput>
      </div>
    </div>
  );
}
