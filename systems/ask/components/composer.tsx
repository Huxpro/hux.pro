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
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { VoiceButton, VoiceGlow } from "@/systems/command/voice";
import { useVoiceInput } from "@/systems/voice";
import { Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ASK_EFFORTS, ASK_MODELS, type AskEffort } from "../lib/models";
import { useAskPrefs, useAskSession } from "../lib/use-ask";
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

const LANG = { en: "en-US", zh: "zh-CN" } as const;

export interface AskComposerProps {
  /** Focus the field when it mounts. */
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

export function AskComposer({ autoFocus = true, placeholder, className }: AskComposerProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { status, stop, busy, send } = useAskSession();
  const { model, setModel, effort, setEffort } = useAskPrefs();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sent = useRef<{ text: string; at: number } | null>(null);

  const voice = useVoiceInput({
    lang: LANG[locale],
    onInterim: (said) => setInput(said),
    onFinal: (said) => setInput(said.trim()),
  });

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  return (
    <PromptInput
      onSubmit={() => {
        const text = input.trim();
        if (!send(text)) return;
        voice.abort();
        sent.current = { text, at: performance.now() };
        setInput("");
      }}
      className={cn("relative rounded-xl bg-transparent", className)}
    >
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
          placeholder={placeholder ?? s.placeholder}
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
