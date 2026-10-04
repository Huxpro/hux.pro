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
│   ├── chat.ts        # the session: current conversation, the agent loop (AI SDK Chat)
│   ├── prefs.ts       # the visitor's model and thinking level (no AI SDK, so the devtool can read it)
│   ├── config.ts      # how Ask behaves: every setting, a preset per platform (desk / phone)
│   ├── history.ts     # past conversations, in localStorage
│   ├── use-ask.ts     # the hooks surfaces are built from: useAskSession / useAskHistory / useAskPrefs / useAskRequest
│   ├── models.ts      # the models the picker offers and the route accepts
│   └── intent.ts      # is this a question or a search?
├── components/
│   ├── messages.tsx   # AskMessages: the conversation, steps, sources, copy / regenerate
│   ├── composer.tsx   # AskComposer: field, model, thinking level, voice, send / stop
│   ├── history.tsx    # AskHistory: past conversations
│   ├── chat.tsx       # the center place: the palette, widened into two panes (lazy-loaded)
│   ├── panel.tsx      # the side place: a panel beside the page
│   ├── activity.tsx   # the top place and the pill: a Live Activity in the Dock
│   └── placement.tsx  # the placement buttons, the drag handle, the drag's overlay
├── prompts.ts           # every word the model reads (system prompt, answer-now, tool descriptions) and the suggested questions
├── surfaces.tsx         # AskSide, AskDock, AskDragging: mounted once in the root layout
└── strings.ts           # en / zh

lib/ask-corpus.ts      # reads the site into the index (Node, build time)
lib/ask-prompt.ts      # fills in the system prompt: the About and a map of the site
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
inside the same card; on a phone, asking puts the palette away and opens
Ask's own bottom drawer. Escape (or ←) goes back to search and keeps the
conversation; the ✎ button starts a new one. A link in an answer to a page of
this site navigates there and the palette leaves, as a command would.

## Where Ask sits

On a desk: one conversation, three places, and a pill. On a phone: one bottom
drawer. Where it is is the command provider's `askPlacement`; the
conversation is the session's, so moving Ask moves nothing else.

| place | what it is | from |
|---|---|---|
| **center** | the ⌘K card, widened to 960px: history rail on the left, conversation on the right; on a phone, a bottom drawer the screen's height, of its own | the palette's Ask mode (`chat.tsx`); `panel.tsx` in `SurfaceSheet` on a phone |
| **side** | a 440px panel docked at the trailing edge; the page beside it stays live, and from 1280px the page makes room (`data-ask-docked`) | `panel.tsx`, `SurfacePanel` |
| **top** | the Dock's panel, hanging from the top | `activity.tsx`, `LiveActivity` |
| **pill** | minimized: a pill in the Dock saying what the agent is doing, then the answer's first words, with the site's glow while it works | the same activity, collapsed |

What follows is the desk's preset; every line of it is a setting (below).

- **Which place.** Asking from search (the Ask row, Tab) lands in the center,
  unless Ask is already open at the side or the top, which then takes the
  question. ⌘J, `/` `J` and the Ask button open it where the visitor last
  put it (`hux_ask_placement`), and close it again.
- **Moving.** Every surface's header has the placement buttons (center, side,
  top) and minimize. On a screen with room for the side panel, the header is
  also a handle: drag it and the three places light up where they would put
  it (`AskDragOverlay`); let go over one and Ask moves there. The surface
  being carried fades (`data-ask-dragging`).
- **The pill.** Minimize (or the Dock's chevron at the top, or a route change
  while it is there) leaves the pill; tapping it opens the top place. Closing
  Ask while a reply is still being written leaves the pill too. ✕ closes it
  for good.
- **Links.** In the center, a link navigates and the palette leaves; at the
  side it navigates under the panel, which stays; at the top it navigates and
  collapses to the pill.
- **Phones.** A bottom drawer, and nothing else. Ask is big and stays a while,
  which is a drawer's job; the Dock's Live Activity is for small things in
  passing. So the phone's preset has no place buttons, no minimize and no
  pill: the drawer's header is history, ✎ and ✕, it swipes down to close, and
  the Ask button brings the same conversation back. Asking from search puts
  the palette away and opens the drawer. A link followed in it closes it, so
  the page shows.
- **Entries.** The Ask button sits beside the search prompt on the home, and
  beside the ⌘K pill on every other page (`fab.tsx`), lit while Ask is open;
  away from the home it steps aside for the side panel.

### Settings, and a preset per platform

Every choice above is a setting in `lib/config.ts`, read where the choice is
made (the provider's `openAsk` / `minimizeAsk`, the header's controls, the
drag handle, the activity's pill, the voice glow). Everything is configurable
on every platform; a desk and a phone differ only in their preset. The
devtool's **Ask** section shows the presets and changes any setting, for
either platform (`hux_ask_config`, saved per platform, only where it differs
from the preset), along with the visitor's model and thinking level and their
defaults.

| setting | what it decides | desk | phone |
|---|---|---|---|
| `fromSearch` | where asking from search opens Ask | center | center (the drawer) |
| `fromCall` | where ⌘J / the Ask button opens it: where it was last, or one place | last | center |
| `placeButtons` | center / side / top in the header (side never on a phone: no room) | on | off |
| `drag` | the header drags between places (a mouse) | on | off |
| `minimize` | `dock`: into the Dock as a pill; `off`: no minimize button, and the Dock's collapse closes | dock | off |
| `backgroundPill` | a reply still being written after Ask closed shows as a pill | on | off |
| `glowDelay` | ms the field listens before the voice glow comes up | 180 | 180 |
| `keyboardDelay` | ms more when the microphone just sent a keyboard down | 0 | 320 |

A platform is the surfaces' `sm`: under 640px, a phone.

## A chat, not a box

- **Shortcuts.** ⌘J (Ctrl+J) opens Ask from anywhere, where it was last put,
  and closes it again; `/` `J` from the slash list; Tab or the Ask row from
  search.
- **History.** Every finished turn is saved (`lib/history.ts`): the newest 30
  conversations, in this browser only, read results trimmed. The header's
  clock lists them; picking one makes it current. ✎ starts a new one.
- **Thinking level.** Quick / Balanced / Deep in the composer, the AI SDK's
  portable `reasoning` (low / medium / high), remembered per viewer like the
  model. The route accepts only those three.
- **Message actions.** On a question: Copy, and Edit (ask it again,
  changed: the AI SDK's `sendMessage` with the replaced message's id drops
  everything after it). On an answer: Copy (its Markdown), Regenerate on the
  last one, and Rewind to here on an earlier one (two presses: the first asks
  "Drop what follows?"). Edit and rewind wait while a reply is written, and a
  rewound conversation is saved as it now is. The actions show on hover with
  a mouse and always on a touch screen. Escape cancels an edit without
  leaving Ask (the palette and the panel skip an Escape already handled).
- **Voice.** The microphone sits beside send, at the trailing end, as Claude
  and ChatGPT have it; the pickers lead. On a touch screen it lets the field
  go, so the keyboard slides down while it listens. The glow comes up a beat
  after listening starts (`glowDelay`), and later still while a keyboard is
  going down (`keyboardDelay`): the slide and the glow's first frames together
  drop frames on a phone. Both waits apply to the palette's field too.
- **A sent question stays gone.** Sending aborts the microphone (its last
  phrase can settle after ↵), and a phone keyboard's late commit of the sent
  words (pinyin, a suggestion) is dropped, so the field is never refilled.
- **Errors say what failed.** The route passes the provider's message through
  (`describe`), shown under "Something went wrong."

The session is module state (`lib/chat.ts`), so any surface (the palette, a
panel, a page) shows the same conversation, and building a new surface is
arranging `AskMessages`, `AskComposer` and `AskHistory`.

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
