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
│   ├── prefs.ts       # the last model and thinking level picked, what a new conversation starts on (no AI SDK, so the devtool can read it)
│   ├── storage.ts     # JSON in localStorage, where storage allows
│   ├── config.ts      # how Ask behaves: every setting, a preset per platform (desk / phone)
│   ├── history.ts     # past conversations, in localStorage
│   ├── page-context.ts # what the reader has open: the post and section, the entry, the commit
│   ├── pending-context.ts # what they pointed at for the next question (a selection, a drop)
│   ├── pointed.ts     # a selection or a drop, as a context
│   ├── use-ask.ts     # the hooks surfaces are built from: useAskSession / useAskHistory / useAskPrefs / useAskRunning / useAskRequest
│   ├── actions.ts     # the browser host for navigation, media and command clicks
│   ├── command-tools.ts # offer-only tools generated from systems/command/catalog.ts
│   ├── command-state.ts # successful taps recorded in tool outputs and history
│   ├── models.ts      # the models the picker offers and the route accepts
│   └── intent.ts      # is this a question or a search?
├── components/
│   ├── messages.tsx   # AskMessages: the conversation, steps, copy / regenerate
│   ├── command-card.tsx # compact command actions and the expandable discovery menu
│   ├── cards.tsx      # AskCards: what the agent presented (a strip) and what an answer used (rows)
│   ├── context-tag.tsx # what a question is about, as a tag
│   ├── selection.tsx  # "Ask about this" over words selected on the page
│   ├── actions-host.ts # the agent's hands: open a page at a spot, play a talk
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

**Tab** enters Ask from anywhere in search mode, and asks what is typed when
there is a query. Its `Ask AI` `tab` hint stays at the field's trailing edge
while typing (`AI` `tab` on a narrower keyboard viewport), after the microphone: voice
is another way to fill the field; Ask is where the field goes. Touch-only
devices get neither keyboard hint. Voice keeps a spoken question whole
(`toFieldText` in `systems/command/voice.tsx`): commands are still stripped to
a query ("open the writing" → "writing"), questions are not.

Ask is the palette's fourth mode, beside search, slash and load-bundle
(`isAskMode` in the command provider). On the desktop it replaces the results
inside the same card; on a phone, asking puts the palette away and opens
Ask's own bottom drawer. Escape (or ←) goes back to search and keeps the
conversation; the ✎ button starts a new one. A link in an answer to a page of
this site navigates there and the palette leaves, as a command would.

With a Gateway voice model, Ask's composer folds into one line while recording
or transcribing. It shows the current action where the text field was, with
the microphone button still available. A short tap followed by Stop leaves
the transcript in the editor. Holding and releasing inside the composer sends
the transcript as soon as transcription completes; sliding outside cancels.
The browser recognizer retains its earlier tap-to-listen flow.

## Where Ask sits

On a desk: one conversation, three places, and a pill. On a phone: one bottom
drawer. Where it is is the command provider's `askPlacement`; the
conversation is the session's, so moving Ask moves nothing else.

| place | what it is | from |
|---|---|---|
| **center** | the ⌘K card turned into a chat: the search card's width and place, a little taller; its sidebar button opens the history beside the conversation and grows the card to 960px, a chat app. A window: it drags anywhere. On a phone, a bottom drawer the screen's height, of its own | the palette's Ask mode (`chat.tsx`); `panel.tsx` in `SurfaceSheet` on a phone |
| **side** | a 440px panel docked at the trailing edge; the page beside it stays live, and from 1280px the page makes room (`data-ask-docked`) | `panel.tsx`, `SurfacePanel` |
| **top** | the Dock's panel, hanging from the top | `activity.tsx`, `LiveActivity` |
| **pill** | minimized: a pill in the Dock saying what the agent is doing, then the answer's first words, with the site's glow while it works | the same activity, collapsed |

What follows is the desk's preset; every line of it is a setting (below).

- **Which place.** Asking from the palette (the Ask row, Tab, `/` `K`) morphs
  the card into the center chat, unless Ask is already open at the side or
  the top, which then takes the question. K and the Ask button open it
  beside a page to read (/writing, /works, /prompt, /about, /docs;
  `onReadingPage`) when the 440px panel and the reading column genuinely fit
  (1280px and up), so the page stays in view, and in the center elsewhere.
  Arriving on a reading page with the center chat already up moves it to the
  side. A drag or placement-menu choice is a manual override for the current
  page context: closing and reopening Ask still honors it, while navigation
  clears it and lets the new page decide again. Command parking is explicitly
  temporary and never becomes a preference. The separate place buttons, when
  enabled instead of the menu, additionally remember a default for a later
  call of the same page kind (`hux_ask_placement`).
- **The way back.** Leaving the center goes back to search only when search
  was the way in (the Ask row, Tab, `/` `K`): there is a back button, and
  Escape returns to the field. Reached directly (K, the Ask button, a move
  from another place) it has no search behind it: no back button, and Escape
  closes it (`askEntry` in the command provider).
- **Moving.** Minimize and one placement menu stay in the header; the three
  always-visible place buttons are off. The whole title bar is the handle.
  With a mouse it drags immediately; with touch, a 360ms hold arms the drag.
  The center is a free window, and the side panel and Dock panel follow the
  pointer too. A narrow trailing-edge lane admits the side and a narrow top
  band admits the Dock; once admitted, wider leave bands keep the target
  stable, so a diagonal drag does not flicker between places. The place it
  would land is drawn while the pointer is over a different one
  (`AskDragOverlay`). The placement menu is the keyboard and assistive
  technology path to the same three commands; Side is disabled when it cannot
  coexist with the page. If Side temporarily stops fitting, Ask falls back to
  Center (or a pill while Command owns Center) but keeps its automatic or
  manual origin and returns to Side when room comes back. Every effective
  placement records whether it came from automation, the user, Command
  parking, capacity, or navigation (`askProvenance` in the command state machine).
- **Both at once.** ⌘K, or `/` outside a field, while Ask is the center chat
  or (on a desk) the dock, parks it — at the side when both panes fit, as a
  Dock pill on a narrower desk, and at the top on a phone — and opens the
  palette. The side panel and the card share the screen: the card centers in
  the room that is left, and clicks on the panel stay the panel's. The parked
  chat does not take the keyboard. Closing the palette restores the place Ask
  had before this temporary move; navigation commits the parked place instead
  of teleporting it over the new page. Ask already on the side is left there.
  `/` in the composer is a character.
- **The pill.** Minimize (or the Dock's chevron at the top, or a route change
  while it is there) leaves the pill; tapping it opens the top place. Closing
  Ask while a reply is still being written leaves the pill too. ✕ closes it
  for good.
- **Links.** In the center, a link navigates and Ask becomes the side panel,
  so the page is read beside the conversation; on a phone the palette leaves.
  At the side a link navigates under the panel, which stays; at the top it
  navigates and collapses to the pill.
- **Phones.** A bottom drawer, and nothing else. Ask is big and stays a while,
  which is a drawer's job; the Dock's Live Activity is for small things in
  passing. So the phone's preset has no place buttons, no minimize and no
  pill: the drawer's header is history, ✎ and ✕, it swipes down to close, and
  the Ask button brings the same conversation back. Asking from search puts
  the palette away and opens the drawer. A link followed in it closes it, so
  the page shows.
- **Entries.** The Ask button is a ball beside the search bar on every page
  (`fab.tsx`, `AskBall`), lit while Ask is open: right of the prompt on the
  home, left of the ⌘K button in a desk's corner, above it on a phone. It is
  outside the bar's flow, so the bar lays out and morphs exactly as it does
  alone, and it has no animation of its own: a navigation's View Transition
  slides it straight to its new place as a shared element (`ask-ball`, as
  λhux moves), and for every frame of the bar's own settle it stands beside
  the bar as drawn (read in framer's postRender, and on every write to the
  bar's style, before the paint). Away from the home both step aside for the
  side panel.

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
| `fromCall` | where K / the Ask button opens it, off a reading page: where the place buttons last put it, or one place | center | center |
| `onReadingPage` | on /writing, /works, /prompt, /about, /docs, a call opens at the side (asking from the palette still morphs the card) | side | same |
| `placeButtons` | center / side / top as separate header buttons. Off where drag is available: one keyboard-accessible placement menu remains, while drag and the moment move Ask | off | off |
| `drag` | the whole title bar drags between places immediately with a mouse, after a long press with touch | on | off |
| `minimize` | `dock`: into the Dock as a pill; `off`: no minimize button, and the Dock's collapse closes | dock | off |
| `backgroundPill` | a reply still being written after Ask closed shows as a pill | on | off |
| `glowDelay` | ms the field listens before the voice glow comes up | 180 | 180 |
| `keyboardDelay` | ms more when the microphone just sent a keyboard down | 0 | 320 |

A platform is the surfaces' `sm`: under 640px, a phone. Side capacity is a
separate spatial decision: it begins at 1280px, where the page already reserves
the panel's width.

## A chat, not a box

- **Shortcuts.** K opens Ask from anywhere outside a text field — beside a page
  being read, in the center elsewhere — and closes it again. `/` `K` from the
  slash list and Tab or the Ask row from search morph the card into the chat. ⌘K,
  or `/` outside a field, parks a center chat (or the dock, on a desk) aside
  and opens the palette in front of it.
- **History.** Every conversation is saved from its first question
  (`lib/history.ts`): the newest 30, in this browser only, read results
  trimmed. The sidebar (the clock on a narrow screen) lists them; picking one
  makes it current. ✎ starts a new one.
- **A new post, a new chat.** The conversation continues on the same post,
  and a paragraph of that post is still that post. Another post is a new
  context (`lib/chat-continuity.ts`), and that is the hint for a new chat:
  closing Ask (a phone does, when a link in it is followed) and opening it
  on the next post starts a fresh one, and so does asking about a paragraph
  there. The other language of a post is its own page, because the text it
  carries is the other one. The previous chat stays in the history. Picking
  one from the history keeps it on the post that is open, until the post
  changes again.
- **Side by side.** Moving to another conversation does not stop the one
  being answered: it goes on in the background, tools and all, and saves
  itself when it ends; its row in the history spins until then. Every
  conversation opened this visit stays live, so going back to a running one
  shows it running (`live` in `lib/chat.ts`).
- **Model and thinking level, per conversation.** Each conversation runs on
  its own model and Quick / Balanced / Deep (the AI SDK's portable
  `reasoning`, low / medium / high), kept with it in the history: going back
  to one puts its pickers back, and changing them changes that conversation.
  A new conversation starts on the last ones picked (`lib/prefs.ts`). The
  route accepts only the listed models and those three levels.
- **Message actions.** On a question: Copy, and Edit (ask it again,
  changed: the AI SDK's `sendMessage` with the replaced message's id drops
  everything after it). On an answer: Copy (its Markdown), Regenerate on the
  last one, and Rewind to here on an earlier one (two presses: the first asks
  "Drop what follows?"). Edit and rewind wait while a reply is written, and a
  rewound conversation is saved as it now is. A question's actions sit right
  beside its bubble and show on demand: a hover with a mouse, a tap or a long
  press on a touch screen (a tap elsewhere puts them away). Escape cancels an edit without
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
                                                 tools: search_site, read, present,
                                                 open_page, play, list_commands,
                                                 command_* (no execute)
                                                 model (gateway / provider / stand-in)
          ◀──────── streamed turn ends in tool calls
run them against public/ask/index.json
          ─────────── tool results ─────────────▶ next step
          ◀──────── streamed answer, with links
```

- **It speaks as Hux.** First person, so a visitor feels they are talking
  with him: logical (verdict first, then the model behind it), opinionated
  (takes a side, owns the bias), entertaining (self-deprecating, a punchline,
  "lol" at most once). The persona comes from his own writing: the About and
  /prompt, the posts he wrote in each language (most English posts are
  machine-translated from Chinese, so not his phrasing), and his posts on X,
  a few of which are in the prompt verbatim (`ASK_VOICE`). Facts about him
  come from the site and are never invented; takes may go past it, said as
  takes. It says it is an AI as soon as someone asks or relies on it, makes no
  promises in his name, and keeps employers' internals and private people out.
  All of it is `prompts.ts`.
- **The route is thin.** It holds the key and pins everything the model is
  given: system prompt, tool definitions, the model list, the output cap. A
  request carries the conversation, listed model/effort, available command ids
  and an optional finalize flag. It
  never reads the index.
- **The tools run in the page.** They are declared in `tools.ts` without an
  `execute`, so a call comes back to the browser, where `chat.ts` runs it
  against the loaded index (or returns a command offer) and resubmits (AI SDK `onToolCall` +
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
- **What it found, as cards.** A talk is more than its title: under an
  answer, the docs it links to (and the ones it read) come back as cards
  (`components/cards.tsx`), and the `present` tool lets the model put cards
  where they belong in the reply when the things themselves are the answer
  ("which talks…", "where can I watch…"). A work's card is its commit from
  /works (`lib/log-client`): the cover the contact strip shows, venue and
  year, and a button per kind of attachment (watch, slides, photos, link)
  that opens it through systems/attachments, as /works does. A post's card
  has its first picture (the index's `cover`); a conviction's, its line. The
  card is a link to the exact spot. One card per thing: a doc per language
  collapses to the reader's. Opening a talk from the center moves Ask to the
  side first (the palette sits above the stage), and the stage takes Escape
  before the panel does.
- **It knows what you are reading.** A question goes with what the reader
  has open (`lib/page-context.ts`): on a post, the post at the section in
  view (the last heading above the reading line); on /prompt, the entry
  open; on /works, the commit open or the one the address points at; on the
  PL chart, the language open. It shows as a tag over the composer, × to
  leave it out (for that page), and on the sent question as a link back. It
  travels as a `data-context` part of the user's message, with that
  section's text from the index (cut at 4000 characters); the route checks
  and caps it and hands it to the model as a `<context>` block before the
  question (`ASK_CONTEXT`), and the instructions say "this" means it. A
  second question about the same spot does not send it again. A question
  handed over from the palette takes the page's context too. On a page with
  something to ask about, an empty conversation offers questions about it
  first ("Sum this up in three lines"). Editing a question keeps its context.
- **Ask about this.** Words selected on the page (in its content, not in a
  field or Ask itself) get an "Ask about this" button under them
  (`components/selection.tsx`, mounted once in the root layout): the words,
  with the page and section they are in, go on the next question
  (`lib/pending-context.ts`) and Ask opens where it would. Anything from the
  page dropped on the composer is something to ask about, never text in the
  field (`lib/pointed.ts`): a link to something on the site (a commit's hash
  on /works, an entry's id on /prompt, which now drags as its link, a post, a
  card) brings that thing with its text; a picture brings the commit or post
  it belongs to; plain words are a quote. Each shows as a tag until sent, ×
  to drop it; a quote from the page open stands in for the page's own tag.
  The model reads them as `<context>` blocks too (`kind` quote and item).
- **It can act on the site.** Two tools do, in the page like the others,
  through hands a component registers (`lib/actions.ts`,
  `components/actions-host.ts`, from AskSide, which is always mounted):
  `open_page` takes the reader to a page or a spot on it (`lib/follow-href.ts`,
  landing as every link does: a /prompt entry opens), and
  with a quote scrolls to the passage and highlights it once the link's own
  landing is done (`lib/highlight-quote.ts`, the CSS Custom Highlight API);
  `play` opens a talk's recording, slides, photos or link through
  systems/attachments. The conversation stays in view: from the center Ask
  moves to the side; on a phone the drawer goes down so the page shows.
  Only when the reader asks (the instructions say so), and only for the
  conversation on screen: one answering in the background is refused, so it
  never moves the reader around. The stand-in opens or plays when a question
  starts with "open" or "play", so the loop runs without a model.
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
| Qwen 3.5 Flash (`alibaba/qwen3.5-flash`) | 0.10 / 0.40 | default; searches eagerly, the tool budget makes it answer |
| Gemini 2.5 Flash (`google/gemini-2.5-flash`) | 0.30 / 2.50 | searches less; answers well |

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
| `post` | `content/blog/*.mdx`, one doc per language, cut at headings | `/writing/<slug>/<lang>`, a passage's `#<heading id>` |
| `conviction`, `influence` | `content/prompts.json` | `/prompt#<anchor>` |
| `era` | `content/log.json` | `/works` |
| `work` | `content/log.json` | `/works#<commit hash>` |
| `language` | `content/languages.json` | `/writing/pl-chart/<lang>#<id>` |

### Links that land

Every link Ask gives goes to the exact spot: a passage's link is its post at
the heading it sits under (the nearest h1 to h3, whose id the page and the
index both take from `lib/heading-id.ts`), a talk's or a project's is its
commit's permalink on /works, a conviction's is its entry on /prompt. The
system prompt's map carries the same permalinks, and tells the model to keep
the `#` part.

The pages travel there on arrival and on every `hashchange`
(`lib/use-hash-landing.ts`): the commit row, the post heading and the PL
chart's row are scrolled to and washed; a /prompt entry also opens, with the
filter lifted if it hid the entry. A link to the page already open is no
route change, so Ask follows its links with `lib/follow-href.ts`, which
writes the hash and fires `hashchange` itself: a source at the side of
/works goes to its row.

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

## Command tools

`systems/command/catalog.ts` gives every command a model-facing description,
bilingual title and finite target values. `CommandAction.id` is a catalog id,
so adding a command without a description fails type checking. Ask generates
one `command_<id>` tool per command; their implementations stay in
`useCommandActions`, shared with the palette. There are 19 commands (including
the search-only Sky Window), five content/navigation tools and `list_commands`:
25 declarations in total. Voice is only active where recognition is supported;
Install is only active before installation. The client sends those available
ids on every request; the route filters them against the catalog and uses
`activeTools`, retaining all definitions to interpret history.

Each command has a required `policy.execution`: `on-request` or
`user-gesture`, with stricter target overrides for `location=gps` and
`music=play`. The schema and descriptions are generated from that policy.
`execution=offer` is the default. The model uses `execution=apply` only when
the reader explicitly asks to act. `executeAskCommand` checks availability,
allowed targets, policy and whether the conversation is current and visible
before calling the browser host. The model interprets intent; the runtime
owns the execution boundary. Missing targets never trigger a cycle/toggle.

| Policy | Actions |
| --- | --- |
| Automatic read/presentation | `search_site`, `read`, `present`, `list_commands` |
| On explicit request | Theme, language, glass, tint, wallpaper styles/picker, approximate IP location, pause music, navigation, About, Ask, install guide, Sky Window explanation; existing `open_page` and `play` open pages/attachments |
| User tap | Voice microphone, accurate GPS, start background music, developer panel toggle; sensor consent and actual installation remain inside their existing UI |

A checked offer becomes a compact card; exact targets such as `language=zh`
or `theme=dark` are one button, and an unspecified target offers the choices.
The same setter implementations serve direct execution and taps, shared with
the palette. Wallpaper targets use the existing image/shuffle/loop picker or
real weather styles, not a fabricated forecast. Sky Window selects the sky
background and opens its explanation; opening that explanation does not
request motion/location permission. The install command opens a guide; it
does not install the app. A failed action returns an error and is never
reported as completed. Successful direct executions return `executed` and
render as completed cards, saved with the conversation.

`list_commands({ ids: [...] })` always only presents the model's selection,
in its chosen order. Capability questions get 1–2 relevant examples, with no
setting changes; a full menu requires an explicit request. Specific requests
use one or two `command_*` calls. Background or hidden conversations may
offer controls but cannot apply them. The host rechecks availability/targets,
keeps gesture actions in the card click's task, and moves Ask aside for
navigation or a new surface. Applying a weather style stays in Ask.

Successful taps update the existing tool output with `executed`, saved to
history without making a new model request. Placement changes and reloads
keep completion state; the next question tells the model what actually ran.
A discovery menu remains reusable. The keyless stand-in exercises these
paths with scripted requests and two fixed discovery examples (theme and
Sky Window). It verifies wiring and UI, not model intelligence, and is not
used when a model is configured.

### Tool-count benchmark

`pnpm ask:benchmark` is offline: it compares experimental lexical shortlists of
12 and 18 tools against all 25 on 34 bilingual cases. It measures schema bytes
and whether the expected tool survives selection, **not model accuracy**. The
shortlister never sees the expected answer. All six non-command tools are kept.
The current offline run retains 31/34 cases at 12 tools, 33/34 at 18 and 34/34
at 25; the indirect phone/sun/moon request loses Sky Window in both shortlists,
and the smaller list also loses a Chinese theme request and one of the commands
in a dual-change request. Full schemas are
about 14.6 KB. Production therefore keeps all available commands pending live
measurements; the experimental pruning is confined to the benchmark.

With `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` in the environment:

```sh
pnpm ask:benchmark --run --models=all --repeats=3
# A smaller smoke run:
pnpm ask:benchmark --run --cases=dark-en,language-zh,sky-indirect,discover-zh,hello
```

The live benchmark uses the production system prompt, the exact tool schemas,
low reasoning and real configured Gemini/Qwen models. It executes no tools.
It records first-call correctness (tool names, every explicit target, effective
apply/offer outcome under the catalog policy, and extra calls),
including two requested changes, limiting capability suggestions to 1–2 actions,
and allowing the full list only for an explicit full-list request. Boundary
cases include a dark-mode preview, a how-to question and starting music. It also records
how many actions would be shown,
provider errors, latency and input/output token usage, rotating variant order
across repetitions. JSON reports land in ignored `shots/`; `--output=path`
changes the destination. It does not measure browser execution or final-answer
quality. No live accuracy numbers are available from the current credential-free
checkout.

Google's [function-calling guidance](https://ai.google.dev/gemini-api/docs/function-calling#best-practices)
suggests an active set of 10–20 tools. That is a useful experiment range, not a
measured cutoff for this site's Gemini 2.5 Flash or Qwen 3.5 Flash. Enable pruning
only after repeated live trials demonstrate a benefit without losing indirect
requests, bilingual settings or capability discovery.

Regression checks for the click boundary and persisted tool results:

```sh
pnpm ask:test
```

## Not yet

- Filtering /works or /prompt by a facet, opening a row on /works in place.
- Rate limiting on the route beyond its input caps, and a spend cap.
- An eval set, to choose the default model and the map's detail.

### Context controls

The composer can restore a dismissed page, pin the section currently being read, and add other indexed sources with **+**. Up to three visible sources are sent; an automatic page yields its slot to explicit attachments. Extra attachments are refused with a message rather than evicting an existing source. Pending sources and dismissed pages belong to each conversation and survive moving Ask between surfaces. Suggestions and command-palette questions use the same draft, and each question includes its current sources even when earlier messages have left the server history window.

Quote tags show the opening and closing words; their tooltip and sent context retain the passage. On touch screens the selection action uses the opposite half-screen placement to the native menu, clamped to the visual viewport. Native text drags preserve the original source; heading links, prompt ids and commit hashes describe their drag affordance. Unsupported drops show feedback, and **+** provides a keyboard/touch alternative to dragging.

### Action lifetime

Navigation and playback require an explicit English or Chinese action request in the latest question; quoted commands and negative requests do not grant it. Closed, minimized and background conversations cannot start an action. A pending quote highlight rechecks its originating conversation and destination, waits for the destination content, and cancels when the reader takes over scrolling. It reports success after placing the highlight, not before a delayed callback. Full sentences are highlighted when available, with a short prefix fallback. On phones both card media and agent playback put Ask away before opening the attachment surface.
