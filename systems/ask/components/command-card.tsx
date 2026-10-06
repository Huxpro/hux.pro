"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommandActions, type CommandAction } from "@/systems/command/actions";
import { commandDefinition, validCommandValue, type CommandId } from "@/systems/command/catalog";
import { Check, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { getAskActions } from "../lib/actions";
import { askStrings } from "../strings";
import type { CommandExecutions } from "../lib/command-tools";
import { completeAskCommand } from "../lib/chat";
import { useAskSession } from "../lib/use-ask";

const BUTTON = "pressable flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground";

function CommandCard({ action, value, compact = false, callId, executed = false }: { action: CommandAction; value?: string; compact?: boolean; callId: string; executed?: boolean }) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const definition = commandDefinition(action.id);
  const [expanded, setExpanded] = useState(!compact);
  const { chat } = useAskSession();
  const done = executed;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const executing = useRef(false);
  const options = definition.options?.filter((o) => value === undefined || o.value === value);
  const title = definition.title[locale];

  const run = async (target?: string) => {
    if (executing.current) return;
    const host = getAskActions();
    if (!host || !validCommandValue(action.id, target)) { setError(s.commandUnavailable); return; }
    executing.current = true;
    setBusy(true);
    setError(null);
    try {
      await host.runCommand(action.id, target);
      completeAskCommand(chat, callId, action.id, target);
    } catch {
      setError(s.commandFailed);
    } finally {
      executing.current = false;
      setBusy(false);
    }
  };

  return (
    <div data-ask-command={action.id} className={compact ? "rounded-md" : "rounded-lg border border-border/50 bg-muted/30 p-2"}>
      <button type="button" disabled={busy || (!compact && done)}
        onClick={() => options?.length && value === undefined ? setExpanded((v) => !v) : void run(value)}
        aria-expanded={options?.length && value === undefined ? expanded : undefined}
        className={cn(BUTTON, "w-full text-left")}>
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">{action.icon ?? <ChevronRight className="size-4" />}</span>
        <span className="min-w-0 flex-1">{value ? `${title} · ${options?.[0]?.[locale] ?? value}` : action.label ?? title}</span>
        {done ? <Check className="size-4" aria-label={s.commandDone} /> : <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", expanded && options?.length && "rotate-90")} />}
      </button>
      {expanded && value === undefined && !!options?.length && (compact || !done) && (
        <div className="flex flex-wrap gap-1 px-2 pt-1 pb-2">
          {options.map((option) => (
            <button key={option.value} type="button" disabled={busy} onClick={() => void run(option.value)}
              className={cn(BUTTON, "border border-border/50 bg-background/40")}>
              {option[locale]}
            </button>
          ))}
        </div>
      )}
      <span role="status" className={cn("block px-2.5 text-xs text-muted-foreground", !error && !done && "sr-only")}>{error ?? (done ? s.commandDone : "")}</span>
    </div>
  );
}

/** Only checked tool outputs become controls. Reopened history also checks
 * the browser's current command list (voice/install can disappear). */
export function AskCommandCards({ ids, value, menu = false, callId, executed }: { ids: readonly CommandId[]; value?: string; menu?: boolean; callId: string; executed?: CommandExecutions }) {
  const actions = useCommandActions();
  const { locale } = useLocale();
  const s = askStrings(locale);
  const shown = ids.flatMap((id) => {
    const action = actions.find((c) => c.id === id);
    return action && validCommandValue(id, value) ? [action] : [];
  });
  if (!shown.length) return <p role="status" className="text-xs text-muted-foreground">{s.commandUnavailable}</p>;
  return (
    <div data-ask-commands="" className="space-y-1.5">
      {menu && <p className="px-1 text-xs text-muted-foreground">{s.commandHint}</p>}
      <div role="group" aria-label={s.commandMenu} className={cn(menu && "max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-muted/30 p-1")}>
        {shown.map((action) => <CommandCard key={action.id} action={action} value={value} compact={menu} callId={callId} executed={!!executed?.[action.id]} />)}
      </div>
    </div>
  );
}
