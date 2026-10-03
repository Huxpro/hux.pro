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
// =============================================================================

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
        if (send(input)) setInput("");
      }}
      className={cn("relative rounded-xl bg-transparent", className)}
    >
      <PromptInputBody>
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
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
          <PromptInputSelect
            value={effort}
            onValueChange={(value) => typeof value === "string" && setEffort(value)}
          >
            <PromptInputSelectTrigger aria-label={s.effort} className="h-8 gap-1.5 text-xs">
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
          <VoiceButton voice={voice} />
        </PromptInputTools>
        <PromptInputSubmit status={status} onStop={() => void stop()} disabled={!busy && !input.trim()} />
      </PromptInputFooter>
      <VoiceGlow voice={voice} />
    </PromptInput>
  );
}
