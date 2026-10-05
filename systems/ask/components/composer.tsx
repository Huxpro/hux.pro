"use client";

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
import { useLocale } from "@/services";
import { VoiceButton, VoiceGlow } from "@/systems/command/voice";
import { useVoiceInput, VOICE_LANG } from "@/systems/voice";
import { Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ASK_EFFORTS, ASK_MODELS, type AskEffort } from "../lib/models";
import { contextsToSend, usePageContext } from "../lib/page-context";
import { useAskPrefs, useAskSession } from "../lib/use-ask";
import { useAskDocs } from "./cards";
import { ContextTag } from "./context-tag";
import { askStrings } from "../strings";

// =============================================================================
// Where a question is written: the field, the model, how hard it thinks, the
// microphone, send / stop. One piece of every surface that shows Ask.
//
// The microphone sits beside send, at the trailing end, where the hand
// already is (as Claude and ChatGPT have it); the pickers lead.
//
// A question sent is gone from the field, and stays gone. Two things used to
// write it back: words still arriving from the microphone (the recognizer
// settles its last phrase after the speaker stops, which can be after ↵), and
// a phone keyboard's composition (pinyin, a suggestion), which commits its
// last words once more after the field was cleared. Sending aborts the
// microphone, and a commit of the sent words just after sending is dropped.
// =============================================================================

/** How soon after sending a keyboard's late commit can arrive, ms. */
const LATE_COMMIT_MS = 600;

export function AskComposer() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { status, stop, busy, send, messages } = useAskSession();
  const { model, setModel, effort, setEffort } = useAskPrefs();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sent = useRef<{ text: string; at: number } | null>(null);

  // What the reader has open goes with the question, shown as a tag until
  // they leave it out (× , for this page, until they move to another).
  const page = usePageContext(useAskDocs());
  const [left, setLeft] = useState<string | null>(null);
  const context = page && page.doc.id !== left ? page : null;

  const voice = useVoiceInput({
    lang: VOICE_LANG[locale],
    onInterim: (said) => setInput(said),
    onFinal: (said) => setInput(said.trim()),
  });

  // The field takes focus when it mounts: always with a mouse, and on a
  // touch screen only when there is nothing yet to read, so opening Ask to
  // read an answer does not raise the keyboard over it. Decided once: the
  // conversation growing later is no reason to take focus.
  const [focusOnMount] = useState(
    () => messages.length === 0 || window.matchMedia("(pointer: fine)").matches,
  );
  useEffect(() => {
    if (!focusOnMount) return;
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [focusOnMount]);

  return (
    <PromptInput
      onSubmit={() => {
        const text = input.trim();
        if (!send(text, contextsToSend(context, messages))) return;
        voice.abort();
        sent.current = { text, at: performance.now() };
        setInput("");
      }}
      className="relative rounded-xl bg-transparent"
    >
      {context && (
        <div className="flex w-full px-3 pt-2.5">
          <ContextTag
            context={{
              kind: "page",
              doc: context.doc.id,
              title: context.doc.title,
              href: context.doc.href,
              heading: context.heading,
            }}
            onRemove={() => setLeft(context.doc.id)}
          />
        </div>
      )}
      <PromptInputBody>
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const last = sent.current;
            const late =
              last && performance.now() - last.at < LATE_COMMIT_MS && value.trim() && last.text.endsWith(value.trim());
            setInput(late ? "" : value);
          }}
          placeholder={s.placeholder}
          className="min-h-12 font-sans text-[16px] sm:text-sm"
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputSelect
            value={model}
            onValueChange={(value) => typeof value === "string" && setModel(value)}
          >
            <PromptInputSelectTrigger aria-label={s.model}>
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
          <PromptInputSelect
            value={effort}
            onValueChange={(value) => typeof value === "string" && setEffort(value)}
          >
            <PromptInputSelectTrigger aria-label={s.effort}>
              <Brain className="size-3.5 text-muted-foreground" />
              <PromptInputSelectValue>
                {(value: AskEffort) => s.efforts[value] ?? value}
              </PromptInputSelectValue>
            </PromptInputSelectTrigger>
            <PromptInputSelectContent>
              {ASK_EFFORTS.map((e) => (
                <PromptInputSelectItem key={e} value={e}>
                  {s.efforts[e]}
                </PromptInputSelectItem>
              ))}
            </PromptInputSelectContent>
          </PromptInputSelect>
        </PromptInputTools>
        <div className="flex shrink-0 items-center gap-1">
          {/* The toolbar's size and shape, not the search field's. */}
          <VoiceButton voice={voice} className="size-8 rounded-4xl" />
          <PromptInputSubmit status={status} onStop={() => void stop()} disabled={!busy && !input.trim()} />
        </div>
      </PromptInputFooter>
      <VoiceGlow voice={voice} />
    </PromptInput>
  );
}
