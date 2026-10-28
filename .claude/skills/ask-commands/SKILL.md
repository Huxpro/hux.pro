---
name: ask-commands
description: Ask (⌘K's AI) and the command catalog it acts through. Use when adding or changing a ⌘K command, Ask's tools, prompts, search index, models or chat route, the AI Elements components, or when running Ask's tests or benchmark.
---

# Ask and commands

- **A command is one entry** in `systems/command/catalog.ts`: a bilingual
  title, a description written for the model, finite targets, and a
  `policy.execution` (`on-request` or `user-gesture`). Ask generates a
  `command_<id>` tool from each; a missing description fails type checking.
- **The runtime owns the boundary**: `executeAskCommand` checks availability,
  targets, policy, and that the conversation is current and visible. A
  failed action is never reported as done; a missing target never toggles.
- **Tools run in the page.** `systems/ask/lib/tools.ts` declares them with no
  `execute`; `systems/ask/lib/chat.ts` runs them against `public/ask/index.json`. The
  route (`app/api/chat/route.ts`) holds the key, pins prompt, tools and
  models, and never reads the index.
  The route's `TOOL_BUDGET` (6) forces an answer; the page's
  `MAX_TOOL_CALLS` (10) must stay above it.
- **Every word the model reads** is in `systems/ask/prompts.ts`; the system
  prompt stays byte-identical (prompt cache), per-request facts go in
  `data-context` parts.
- **Behaviour choices are settings** in `systems/ask/lib/config.ts`, one
  preset per platform (desk / phone), shown in the devtool's Ask section.
- **Models** are `systems/ask/lib/models.ts` only, all on the gateway's free
  tier; the first is the default.
- **Index**: `pnpm ask:index` (run by `predev` and `build`); heading anchors
  come from `lib/heading-id.ts`, shared with the pages.
- **Without a key** a scripted stand-in runs the whole loop: it proves the
  wiring, not the answers.
- **AI Elements** (`components/ai-elements/`) are on Base UI: `render`, not
  `asChild`; menu items take `onClick`; popups sit at `z-[10060]`, above the
  palette.

Tests: `pnpm ask:test`, `pnpm command:test`; `pnpm ask:benchmark` measures
tool choice offline (`--run` needs a gateway key). More: `docs/system-ask.md`,
`docs/system-command.md`.
