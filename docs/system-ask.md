# Ask

The command palette, asked a question instead of a search: an agent that
reads the site and answers with links to where it says so.

```
systems/ask/
├── lib/
│   ├── corpus.ts      # the index's shape: docs (a post in one language, a conviction, a commit…) cut into chunks
│   ├── tokenize.ts    # words in both languages (Intl.Segmenter), the same at build time and in the browser
│   ├── search.ts      # the index in the browser: fetched once, BM25 (MiniSearch), search + read
│   ├── tools.ts       # the agent's tools (search_site, read): declared once, run in the page
│   ├── chat.ts        # the conversation and the agent loop (AI SDK Chat), one per page load
│   ├── models.ts      # the models the picker offers and the route accepts
│   └── intent.ts      # is this a question or a search?
├── components/chat.tsx  # the conversation, from AI Elements; lazy-loaded
└── strings.ts           # en / zh

lib/ask-corpus.ts      # reads the site into the index (Node, build time)
lib/ask-prompt.ts      # the system prompt: who, how to answer, a map of the site
scripts/ask-index.ts   # writes public/ask/index.json (`pnpm ask:index`; predev and build run it)
app/api/chat/route.ts  # the one server route: key, prompt, tools, stream
components/ai-elements/  # AI Elements, as the registry ships them (see below)
```

## From search to ask

Every query in ⌘K can also be asked. The **Ask row** is in the results
whenever the field has text:

| the query | where Ask is | ↵ does |
|---|---|---|
| reads as a question (`intent.ts`: a `?`, a question word up front, ≥ 5 words, ≥ 10 Han characters) | first, selected | asks |
| anything else | last | opens the best match; ↓ or **Tab** reaches Ask |

**Tab** asks what is typed from anywhere in search mode. Voice keeps a spoken
question whole (`toFieldText` in `systems/command/voice.tsx`): commands are
still stripped to a query ("open the writing" → "writing"), questions are not.

Ask is the palette's fourth mode, beside search, slash and load-bundle
(`isAskMode` in the command provider). On the desktop it replaces the results
inside the same card; on a phone it is a full-height sheet stacked on the
palette, like the slash sheet. Escape (or ←) goes back to search and keeps the
conversation; the ✎ button starts a new one. A link in an answer to a page of
this site navigates there and the palette leaves, as a command would.

## The agent

```
browser                                         /api/chat (Vercel function)
───────                                         ──────────
question ──────────────────────────────────────▶ system prompt + map of the site
                                                 tools: search_site, read (no execute)
                                                 model (gateway / provider / stand-in)
          ◀──────── streamed turn ends in tool calls
run them against public/ask/index.json
          ─────────── tool results ─────────────▶ next step
          ◀──────── streamed answer, with links
```

- **The route is thin.** It holds the key and pins everything the model is
  given: system prompt, tool definitions, the model list, the output cap. A
  request carries only the conversation and a model id from the list. It
  never reads the index.
- **The tools run in the page.** They are declared in `tools.ts` without an
  `execute`, so a call comes back to the browser, where `chat.ts` runs it
  against the loaded index and resubmits (AI SDK `onToolCall` +
  `sendAutomaticallyWhen`). At most 8 tool calls per turn.
- **The map, then the text.** The system prompt carries a map of the site
  (every post, conviction, era, project and language by title, link and doc
  id: a few thousand tokens, byte-identical across requests, so a provider's
  prompt cache can hold it). The text behind an entry the model fetches with
  `search_site` / `read`. The whole site in every request would be a few
  hundred thousand tokens; the map and a few reads are a small fraction.
- **Vendor-neutral.** AI SDK throughout. Model ids are Vercel AI Gateway's
  (`anthropic/claude-opus-5.5`, `openai/…`, `google/…`); each also has its
  provider-native id for running on that provider's own key.

### Which provider runs it

First match wins (`resolveModel` in the route):

| set in the environment | runs |
|---|---|
| `AI_GATEWAY_API_KEY` (or Vercel's OIDC token on a deployment with the gateway enabled) | any model in the list, via the gateway |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | that provider's models, directly |
| neither | **the stand-in**: a scripted turn that asks the page to search for the question, then lists what it found. The whole loop (route → tool call → browser search → resubmit → answer) works with no key, for development and previews. |

## The index

`pnpm ask:index` reads the site into `public/ask/index.json` (generated, not
committed; `predev` and `build` run it):

| doc kind | from | href |
|---|---|---|
| `post` | `content/blog/*.mdx`, one doc per language, cut at headings | `/writing/<slug>/<lang>` |
| `conviction`, `influence` | `content/prompts.json` | `/prompt#<anchor>` |
| `era`, `work` | `content/log.json` | `/works` |
| `language` | `content/languages.json` | `/writing/pl-chart/<lang>` |

Chunks are at most ~1200 characters. About 230 docs and 760 chunks today:
~560 KB, ~230 KB gzipped (much of it Chinese, which compresses less). One file with the text in it: the browser fetches it
the first time something asks (opening Ask, or two characters in the palette's
field) and never with the page. Splitting it (an index without text, a file
per doc for `read`) saved about 50 KB on the first fetch and cost a round trip
per read, so it is one file until the site outgrows that.

The same index gives the palette **full-text search**: a post whose body
matches the query and whose title did not still shows, ranked under the title
matches (`usePaletteFilter` in `systems/command/results.tsx`).

## AI Elements, on Base UI

The chat is built from [AI Elements](https://elements.ai-sdk.dev) (shadcn
registry, copied into `components/ai-elements/`) on shadcn's **Base UI**
primitives (`components.json` style `base-maia`; the primitives land in
`components/ui/`). They take the site's tokens (`--muted`, `--accent`,
`--popover`, …) as they are, so they already wear the site's colours. The
plan is to take them over one at a time; until then, changes to them are kept
to what Base UI and this repo require:

- `asChild` → Base UI's `render` (the CLI converts most; the tooltip triggers
  were fixed by hand: nested buttons otherwise).
- `@radix-ui/react-use-controllable-state` → `lib/use-controllable-state.ts`.
  The site has no Radix dependency of its own; cmdk still brings
  `@radix-ui/react-dialog` with it.
- Menu items select on `onClick` (Radix: `onSelect`); preview-card delays live
  on the trigger.
- Popups' positioners sit at `z-[10060]`, above the palette (`z-[10050]`).
- Streamdown plugins trimmed to `cjk` + `code` (no mermaid, no TeX), and its
  `@source` lines are in `globals.css` so Tailwind generates its classes.
- The code block reads shiki 1 (the site's), and keeps its async result in
  state rather than a ref read during render.

## Not yet

- Tools that act on the site (`navigate`, open a post, play music): the
  palette's commands are the obvious set.
- Rate limiting on the route beyond its input caps, and a spend cap.
- An eval set, to choose the default model and the map's detail.
