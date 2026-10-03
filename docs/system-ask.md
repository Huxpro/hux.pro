# Ask

A page of its own, `/ask`: an agent that reads the site and answers with
links to where it says so. The command palette hands it questions.

```
systems/ask/
├── lib/
│   ├── corpus.ts      # the index's shape: docs (a post in one language, a conviction, a commit…) cut into chunks
│   ├── tokenize.ts    # words in both languages (Intl.Segmenter), the same at build time and in the browser
│   ├── search.ts      # the index in the browser: fetched once, BM25 (MiniSearch), search + read
│   ├── tools.ts       # the agent's tools (search_site, read): declared once, run in the page
│   ├── chat.ts        # the session: current conversation, model + effort, the agent loop (AI SDK Chat)
│   ├── history.ts     # past conversations, in localStorage
│   ├── use-ask.ts     # the hooks surfaces are built from: useAskSession / useAskHistory / useAskPrefs / useAskRequest
│   ├── models.ts      # the models the picker offers and the route accepts
│   └── intent.ts      # is this a question or a search?
├── components/
│   ├── messages.tsx   # AskMessages: the conversation, steps, sources, copy / regenerate
│   ├── composer.tsx   # AskComposer: field, model, thinking level, voice, send / stop
│   ├── history.tsx    # AskHistory: past conversations
│   └── page.tsx       # AskPage: those three, as /ask lays them out (lazy-loaded)
└── strings.ts           # en / zh

app/ask/               # the route: metadata, card, and the view that reads `?q=`

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

Asking leaves the palette for the page: `openAsk(text)` in the command
provider navigates to `/ask?q=<text>` and closes the palette. The page sends
the question once (`useAskRequest`, numbered so a remount never sends it
twice) and takes it off the address with `history.replaceState`, so a reload
does not ask again. A link with `?q=` in it asks the same way.

## The page

```
desktop                                          phone
┌────────────┬─────────────────────────────┐     ┌──────────────────┐
│ λhux       │                             │     │ λhux   ask   ◷ ✎ │
│ ✎ New chat │     the conversation,       │     │                  │
│ history    │     in the 680px column     │     │ the conversation │
│ ▸ current  │                             │     │                  │
│   older    │   ┌─────────────────────┐   │     │ ┌──────────────┐ │
│            │   │ composer            │   │     │ │ composer     │ │
└────────────┴───┴─────────────────────┴───┘     └─┴──────────────┴─┘
```

- **Desktop.** History in a glass sidebar (New chat on top, the current
  conversation highlighted), the conversation in the site's reading column,
  the composer pinned under it. Empty, the column says
  *what would you like to know?* in the serif, with suggestions under it.
- **Phone.** One column. The header's clock opens history in a
  `SurfaceSheet` at the site's detents; picking a conversation closes it.
- **Links** in an answer navigate as any link would: there is no palette to
  close.
- The command FAB is not drawn on `/ask`: the composer has the bottom of the
  screen, and ⌘K still opens the palette.

## A chat, not a box

- **Ways in.** ⌘J (Ctrl+J) goes to `/ask` from anywhere; on the page it
  focuses the field. `/` `J`, or Ask in the palette's Navigation; the Ask
  button beside the home's search bar; Tab or the Ask row from search, which
  carry the question.
- **History.** Every finished turn is saved (`lib/history.ts`): the newest 30
  conversations, in this browser only, read results trimmed. The sidebar
  (the header's clock on a phone) lists them; picking one makes it current.
  New chat starts another.
- **Thinking level.** Quick / Balanced / Deep in the composer, the AI SDK's
  portable `reasoning` (low / medium / high), remembered per viewer like the
  model. The route accepts only those three.
- **Message actions.** Copy on every message (the Markdown of an answer),
  Regenerate on the last answer.
- **Errors say what failed.** The route passes the provider's message through
  (`describe`), shown under "Something went wrong."

The session is module state (`lib/chat.ts`), so any surface (the page, a
panel, a palette view) shows the same conversation, and building a new
surface is arranging `AskMessages`, `AskComposer` and `AskHistory`.

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
  `sendAutomaticallyWhen`).
- **It always answers.** After 6 tool calls in a turn the route runs the
  next step with `toolChoice: "none"` and an instruction to answer from what
  it has (`TOOL_BUDGET`); the page stops resubmitting at 10. A step that ends
  with neither text nor a tool call (a model that only reasoned) is sent back
  once with `finalize: true`, which does the same. Qwen 3.5 Flash, which
  kept searching and never replied, is why.
- **The map, then the text.** The system prompt carries a map of the site
  (every post, conviction, era, project and language by title, link and doc
  id: a few thousand tokens, byte-identical across requests, so a provider's
  prompt cache can hold it). The text behind an entry the model fetches with
  `search_site` / `read`. The whole site in every request would be a few
  hundred thousand tokens; the map and a few reads are a small fraction.
- **Vendor-neutral.** AI SDK throughout. Model ids are Vercel AI Gateway's
  (`provider/model`); changing models is changing `models.ts`.

### Which models

`systems/ask/lib/models.ts` is the whole list: the picker shows it, the
route accepts nothing else (an unknown id falls back to the first, the
default). It is chosen to run on the gateway's **free tier** and to cost
little: every entry is `availableToFreeTier` in the gateway's catalog, takes
tools, reasons, reads both languages, and is served without training on
prompts.

| model | $ / M tokens (in / out) | |
|---|---|---|
| Gemini 2.5 Flash (`google/gemini-2.5-flash`) | 0.30 / 2.50 | default; the best of those tried |
| Qwen 3.5 Flash (`alibaba/qwen3.5-flash`) | 0.10 / 0.40 | searches eagerly; the tool budget makes it answer |

Kimi K2 Thinking was tried and did not connect through the gateway.

A question costs well under a cent on either (≈10k tokens in, ≈600 out). Claude, GPT and Gemini 3 are not on the free tier; they need
purchased gateway credits, and go in the list then. The free `$0` models were
left out: the ones that are free are served with no promise against training
on what visitors ask. Set a budget on the project in the gateway's dashboard
either way.

### Which provider runs it

First match wins (`resolveModel` in the route):

| set in the environment | runs |
|---|---|
| a Vercel deployment (`VERCEL=1`), `AI_GATEWAY_API_KEY`, or a pulled `VERCEL_OIDC_TOKEN` | any model in the list, via the gateway. A deployment needs no key: the gateway provider authenticates with the project's OIDC token per request. A key is for running it elsewhere (local, CI, this repo's cloud sessions). |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | that provider's models directly, for an entry with a `direct` id |
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
