"use client";

import { AskPage } from "@/systems/ask";
import { useTransitionRouter } from "next-view-transitions";
import { useSearchParams } from "next/navigation";

/**
 * /ask: the address and the router, handed to the app (systems/ask). A
 * question arrives as `?q=…` from the palette (its Ask row, Tab) or a link;
 * the app sends it once and the address drops it, with no history entry.
 */
export function AskView() {
  const question = useSearchParams().get("q");
  const router = useTransitionRouter();
  return (
    <AskPage
      question={question}
      onQuestionTaken={takeQuestion}
      onNavigate={(href) => router.push(href)}
    />
  );
}

/** Off the address, in place. The native call, which the App Router follows
 *  (`useSearchParams` reads null after it) without asking the server for
 *  the page again, as `router.replace` would. */
function takeQuestion() {
  window.history.replaceState(null, "", "/ask");
}
