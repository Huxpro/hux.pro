# Ask

> The checklist form of this page is the skill `.claude/skills/ask-commands` (with [system-command.md](./system-command.md) for the palette side).

The command palette, asked a question instead of a search: an agent that
reads the site and answers with links to where it says so. The model is on
the server; its tools run in the page, over an index of the site the browser
fetches once. With no key configured, a scripted stand-in runs the same loop.

## What it looks like done well

- **One conversation, wherever it sits.** On a desk it is the palette's
  center card, a side panel beside the page, the Dock's top panel, or a pill
  in the Dock; moving it between them moves nothing else. On a phone it is
  one bottom drawer.
- **The page stays in view.** Called (K, the Ask button) on a page to read,
  it opens at the side, and from 1280px the page makes room for it rather
  than sliding under it.
- **It shows its work.** A finished answer keeps its steps (what it searched,
  what it read) folded under "Looked through the site", the things it found
  as cards, and links that land on the exact heading, entry or commit.
- **It always answers.** A model that keeps searching is made to stop and
  reply; one that only reasoned is asked once more.
- **It acts only when asked.** A request to change a setting is a card to
  tap, or a change made and shown as done; a question about a setting is
  never a change.

![Ask at 1280px on a desk, in its four places: the center card over the home, the side panel beside a post (the post's column has moved left to make room), the Dock's top panel over the same post, and the pill at the top of the screen.](/img/docs/system-ask/places.png)

The same stand-in conversation in the four desk places (headless, 1280×860):
center over the home (top left), the side panel beside a post (top right;
the column has stepped left, `data-ask-docked`), the Dock's top panel (bottom
left), and the pill it collapses to, saying the answer's first words (bottom
right). Only the placement menu (⋯) and the collapse chevron moved it.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-ask/phone-answer.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="Ask on a phone: a full-height bottom drawer with history, new chat and close in its header; the question, the steps opened to show the search and the five passages it found, then a strip of talk cards, and the composer at the bottom." />
  <img src="/img/docs/system-ask/command-offer.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The side panel answering 'Can I change the theme?': a command card titled 'Appearance: Follow the Sun' with Light, Dark, Follow the System and Follow the Sun buttons, and the stand-in's note that nothing has been applied." />
</div>

Left: a phone (iPhone 15 Pro, headless), the drawer at the screen's height
with no place buttons and no minimize; the steps are open (one
`search_site`, five passages) and the cards the answer `present`ed follow.
Right: a question about a setting gets an offer, not a change: the theme's
card with its four targets, the current one in the title.

## How it works

![The agent loop: the browser's chat.ts posts the conversation to app/api/chat; the route sanitizes it, resolves a model (gateway, a direct provider, or the stand-in), decides whether the turn must answer now, and streams a step; tool calls come back to the page, which runs them against public/ask/index.json and resubmits until the model answers.](/img/docs/system-ask/agent-loop.svg)

The loop, one question long. The page sends the conversation; the route
streams a step; when the step ends in tool calls, `chat.ts` runs each one in
the page and sends the conversation back for the next step. It ends when the
model writes an answer.

- **The route is thin.** It holds the key and pins everything the model is
  given: system prompt, tool definitions, the model list, the output cap
  (`maxOutputTokens` 4000). A request carries the conversation (the last 24
  messages, 4000 characters a question), a listed model and effort, the
  command ids available in this browser, and an optional `finalize` flag. It
  never reads the index.
- **The tools run in the page.** They are declared in `tools.ts` without an
  `execute`, so a call comes back to the browser, where `chat.ts` runs it
  against the loaded index (or returns a command offer) and resubmits (AI
  SDK `onToolCall` + `sendAutomaticallyWhen`).
- **It always answers.** After 6 tool calls in a turn the route runs the
  next step with `toolChoice: "none"` and an instruction to answer from what
  it has (`TOOL_BUDGET`, `ASK_ANSWER_NOW`); the page stops resubmitting at 10
  (`MAX_TOOL_CALLS`). A step that ends with neither text nor a tool call (a
  model that only reasoned) is sent back once with `finalize: true`, which
  does the same. Qwen 3.5 Flash, which kept searching and never replied, is
  why.
- **The session is module state** (`lib/chat.ts`), so any surface (the
  palette, a panel, a page) shows the same conversation, and building a new
  surface is arranging `AskMessages`, `AskComposer` and `AskHistory`.
- **Heavy parts load late.** AI Elements, streamdown and the AI SDK client
  load the first time Ask opens (`components/entry.tsx`, `askLazy`); the
  shell (the card, the panel, the drawer) is up at once with a skeleton, and
  the conversation fades in over it.
- **Without a key, the stand-in.** `standIn()` in the route plays one round
  of the real loop: it asks the page to `search_site` for the question as
  typed, then `present`s the first three docs found as cards, then answers
  with the links. "open …" and "play …" questions call `open_page` / `play`
  with the first hit; command questions get scripted `command_*` or
  `list_commands` calls (`lib/stand-in-command.ts`). It proves the wiring
  and the UI, not the answers, and is never used when a model is configured.

## From search to ask

Every query in ⌘K can also be asked. The **Ask row** is in the results
whenever the field has text:

| the query | where Ask is | ↵ does |
|---|---|---|
| reads as a question (`intent.ts`: ends in `?`, a question word up front, ≥ 5 words, ≥ 10 Han characters, a Chinese question ending) | first, selected | asks |
| anything else | last | opens the best match; ↓ or **Tab** reaches Ask |

**Tab** enters Ask from anywhere in search mode, and asks what is typed when
there is a query. Its `Ask AI` `tab` hint stays at the field's trailing edge
while typing (`AI` `tab` below `md`), after the microphone: voice is another
way to fill the field; Ask is where the field goes. Touch-only devices get
neither keyboard hint. Voice keeps a spoken question whole (`toFieldText` in
`systems/command/voice.tsx`): commands are still stripped to a query ("open
the writing" → "writing"), questions are not.

Ask is the palette's fourth mode, beside search, slash and load-bundle
(`isAskMode` in the command provider). On the desktop it replaces the results
inside the same card; on a phone, asking puts the palette away and opens
Ask's own bottom drawer. Escape (or the back button) goes back to search and
keeps the conversation; the ✎ button starts a new one. A link in an answer to
a page of this site navigates there and the palette leaves, as a command
would.

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
| **center** | the ⌘K card turned into a chat: the search card's width (700px) and place, a little taller; its sidebar button opens the history beside the conversation and grows the card to 960px, a chat app. A window: it drags anywhere. On a phone, a bottom drawer the screen's height, of its own | the palette's Ask mode (`chat.tsx`); `panel.tsx` in `SurfaceSheet` on a phone |
| **side** | a 440px panel docked at the trailing edge; the page beside it stays live, and from 1280px the page makes room (`data-ask-docked`, not on the home) | `panel.tsx`, `SurfacePanel` |
| **top** | the Dock's panel, hanging from the top | `activity.tsx`, `LiveActivity` |
| **pill** | minimized: a pill in the Dock saying what the agent is doing, then the answer's first words, with the site's glow while it works | the same activity, collapsed |

What follows is the desk's preset; every line of it is a setting (below).

- **Which place.** Asking from the palette (the Ask row, Tab, `/` `K`) morphs
  the card into the center chat, unless Ask is already open at the side or
  the top, which then takes the question. K and the Ask button open it
  beside a page to read (/writing, /works, /prompt, /about, /docs;
  `onReadingPage`, `isReadingPage`) when the 440px panel and the reading
  column genuinely fit (1280px and up, `ASK_SIDE_MIN_WIDTH`), so the page
  stays in view, and in the center elsewhere. Arriving on a reading page
  with the center chat already up moves it to the side. A drag or
  placement-menu choice is a manual override for the current page context:
  closing and reopening Ask still honors it, while navigation clears it and
  lets the new page decide again. Command parking is explicitly temporary
  and never becomes a preference. The separate place buttons, when enabled
  instead of the menu, additionally remember a default for a later call of
  the same page kind (`hux_ask_placement`).
- **The way back.** Leaving the center goes back to search only when search
  was the way in (the Ask row, Tab, `/` `K`): there is a back button, and
  Escape returns to the field. Reached directly (K, the Ask button, a move
  from another place) it has no search behind it: no back button, and Escape
  closes it (`askEntry` in the command provider).
- **Moving.** Minimize and one placement menu (⋯) stay in the header; the
  three always-visible place buttons are off. The whole title bar is the
  handle. With a mouse it drags immediately; with touch, a 360ms hold arms
  the drag (`LONG_PRESS_MS`). The center is a free window, and the side
  panel and Dock panel follow the pointer too. A narrow trailing-edge lane
  admits the side and a narrow top band admits the Dock; once admitted,
  wider leave bands keep the target stable, so a diagonal drag does not
  flicker between places. The place it would land is drawn while the pointer
  is over a different one (`AskDragOverlay`). The placement menu is the
  keyboard and assistive technology path to the same three commands; Side is
  disabled when it cannot coexist with the page. If Side temporarily stops
  fitting, Ask falls back to Center (or a pill while Command owns Center)
  but keeps its automatic or manual origin and returns to Side when room
  comes back. Every effective placement records whether it came from
  automation, the user, Command parking, capacity, or navigation
  (`askProvenance` in `systems/command/ask-state.ts`).
- **Both at once.** ⌘K, or `/` outside a field, while Ask is the center chat
  or (on a desk) the dock, parks it (at the side when both panes fit, as a
  Dock pill on a narrower desk, and at the top on a phone) and opens the
  palette. The side panel and the card share the screen: the card centers in
  the room that is left, and clicks on the panel stay the panel's. The parked
  chat does not take the keyboard. Closing the palette restores the place Ask
  had before this temporary move; navigation commits the parked place instead
  of teleporting it over the new page. Ask already on the side is left there.
  `/` in the composer is a character.
- **The pill.** Minimize (or the collapse chevron in the top place, or a
  route change while it is there) leaves the pill; tapping it opens the top
  place. Closing Ask while a reply is still being written leaves the pill
  too. ✕ closes it for good.
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
  the page shows. How its composer meets the keyboard is
  [keyboard-input.md](./keyboard-input.md).
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
| `fromCall` | where K / the Ask button opens it, off a reading page: `last` (where the place buttons last put it), or one place | center | center |
| `onReadingPage` | `side`: on /writing, /works, /prompt, /about, /docs, a call opens at the side (asking from the palette still morphs the card); `same`: as elsewhere | side | same |
| `placeButtons` | center / side / top as separate header buttons. Off: where `drag` is on, one keyboard-accessible placement menu remains, while drag and the moment move Ask | off | off |
| `drag` | the whole title bar drags between places immediately with a mouse, after a long press with touch; also what shows the placement menu | on | off |
| `minimize` | `dock`: into the Dock as a pill; `off`: no minimize button, and the Dock's collapse closes | dock | off |
| `backgroundPill` | a reply still being written after Ask closed shows as a pill | on | off |
| `glowDelay` | ms the field listens before the voice glow comes up | 0 | 0 |
| `keyboardDelay` | ms more when the microphone just sent a keyboard down | 0 | 320 |

A platform is the surfaces' `sm`: under 640px, a phone. Side capacity is a
separate spatial decision: it begins at 1280px, where the page already reserves
the panel's width.

## A chat, not a box

- **Shortcuts.** K opens Ask from anywhere outside a text field (beside a
  page being read, in the center elsewhere) and closes it again. `/` `K` from
  the slash list and Tab or the Ask row from search morph the card into the
  chat. ⌘K, or `/` outside a field, parks a center chat (or the dock, on a
  desk) aside and opens the palette in front of it.
- **History.** Every conversation is saved from its first question
  (`lib/history.ts`): the newest 30, in this browser only, read results
  trimmed to 600 characters. The sidebar (the clock on a narrow screen)
  lists them; picking one makes it current. ✎ starts a new one.
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
  `reasoning`, low / medium / high; low by default), kept with it in the
  history: going back to one puts its pickers back, and changing them
  changes that conversation. A new conversation starts on the last ones
  picked (`lib/prefs.ts`, `hux_ask_model` / `hux_ask_effort`). The route
  accepts only the listed models and those three levels.
- **Message actions.** On a question: Copy, and Edit (ask it again,
  changed: the AI SDK's `sendMessage` with the replaced message's id drops
  everything after it). On an answer: Copy (its Markdown), Regenerate on the
  last one, and Rewind to here on an earlier one (two presses: the first asks
  "Drop what follows?"). Edit and rewind wait while a reply is written, and a
  rewound conversation is saved as it now is. A question's actions sit right
  beside its bubble and show on demand: a hover with a mouse, a tap or a long
  press on a touch screen (a tap elsewhere puts them away). Escape cancels an
  edit without leaving Ask (the palette and the panel skip an Escape already
  handled).
- **Voice.** The microphone sits beside send, at the trailing end, as Claude
  and ChatGPT have it; the pickers lead. On a touch screen it lets the field
  go, so the keyboard slides down while it listens. A press answers at once:
  the field gives way to the recording row and the glow sweeps in
  (`glowDelay`, 0), breathing until the voice drives it. Only while a keyboard
  is going down does it wait (`keyboardDelay`): the slide and the glow's first
  frames together drop frames on a phone. Both waits apply to the palette's
  field too (`systems/command/voice.tsx`).
- **A sent question stays gone.** Sending aborts the microphone (its last
  phrase can settle after ↵), and a phone keyboard's late commit of the sent
  words (pinyin, a suggestion) is dropped, so the field is never refilled.
- **Errors say what failed.** The route passes the provider's message through
  (`describe`), shown under "Something went wrong."

## The agent

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
- **The map, then the text.** The system prompt (`lib/ask-prompt.ts`,
  `askSystemPrompt`) carries a map of the site (every post, conviction, era,
  project and language by title, link and doc id: a few thousand tokens,
  built once per server instance and byte-identical across requests, so a
  provider's prompt cache can hold it). The text behind an entry the model
  fetches with `search_site` / `read`. The whole site in every request would
  be a few hundred thousand tokens; the map and a few reads are a small
  fraction.
- **What it found, as cards.** A talk is more than its title: under an
  answer, the docs it links to (and the ones it read) come back as cards
  (`components/cards.tsx`), and the `present` tool (1 to 6 ids) lets the
  model put cards where they belong in the reply when the things themselves
  are the answer ("which talks…", "where can I watch…"). A work's card is
  its commit from /works (`lib/log-client`): the cover the contact strip
  shows, venue and year, and a button per kind of attachment (watch, slides,
  photos, link) that opens it through systems/attachments, as /works does. A
  post's card has its first picture (the index's `cover`); a conviction's,
  its line. The card is a link to the exact spot. One card per thing: a doc
  per language collapses to the reader's (`lib/doc-href.ts`). Opening a talk
  from the center moves Ask to the side first (the palette sits above the
  stage), and the stage takes Escape before the panel does.
- **It knows what you are reading.** A question goes with what the reader
  has open (`lib/page-context.ts`): on a post, the post at the section in
  view (the last heading above the reading line); on /prompt, the entry
  open; on /works, the commit open or the one the address points at; on the
  PL chart, the language open. It shows as a tag over the composer, × to
  leave it out (for that page), and on the sent question as a link back. It
  travels as a `data-context` part of the user's message, with that
  section's text from the index (cut at 4000 characters); the route checks
  and caps it (4500) and hands it to the model as a `<context>` block before
  the question (`ASK_CONTEXT`), and the instructions say "this" means it. A
  second question about the same spot does not send it again. A question
  handed over from the palette takes the page's context too. On a page with
  something to ask about, an empty conversation offers questions about it
  first ("Sum this up in three lines"). Editing a question keeps its context.
- **Ask about this.** Words selected on the page (in its content, not in a
  field or Ask itself) get an "Ask about this" button under them
  (`components/selection.tsx`, mounted once in the root layout as
  `AskSelection`): the words, with the page and section they are in, go on
  the next question (`lib/pending-context.ts`) and Ask opens where it would.
  Anything from the page dropped on the composer is something to ask about,
  never text in the field (`lib/pointed.ts`): a link to something on the site
  (a commit's hash on /works, an entry's id on /prompt, which now drags as
  its link, a post, a card) brings that thing with its text; a picture
  brings the commit or post it belongs to; plain words are a quote. Each
  shows as a tag until sent, × to drop it; a quote from the page open stands
  in for the page's own tag. The model reads them as `<context>` blocks too
  (`kind` quote and item).
- **It can act on the site.** Two tools do, in the page like the others,
  through hands a component registers (`lib/actions.ts`,
  `components/actions-host.ts`, from AskSide, which is always mounted):
  `open_page` takes the reader to a page or a spot on it
  (`lib/follow-href.ts`, landing as every link does: a /prompt entry opens),
  and with a quote scrolls to the passage and highlights it once the link's
  own landing is done (`lib/highlight-quote.ts`, the CSS Custom Highlight
  API); `play` opens a talk's recording, slides, photos or link through
  systems/attachments. The conversation stays in view: from the center Ask
  moves to the side; on a phone the drawer goes down so the page shows.
  Only when the reader asks, and only for the conversation on screen: one
  answering in the background is refused, so it never moves the reader
  around.
- **Vendor-neutral.** AI SDK throughout. Model ids are Vercel AI Gateway's
  (`provider/model`); changing models is changing `models.ts`.

### Context controls

The composer can restore a dismissed page, pin the section currently being
read, and add other indexed sources with **+**. Up to three visible sources
are sent (`MAX_CONTEXTS` in `lib/context-policy.ts`, shared with the route);
an automatic page yields its slot to explicit attachments. Extra attachments
are refused with a message rather than evicting an existing source. Pending
sources and dismissed pages belong to each conversation and survive moving
Ask between surfaces. Suggestions and command-palette questions use the same
draft, and each question includes its current sources even when earlier
messages have left the server history window.

Quote tags show the opening and closing words (`quoteLabel`); their tooltip
and sent context retain the passage. On touch screens the selection action
uses the opposite half-screen placement to the native menu, clamped to the
visual viewport (`lib/selection-layout.ts`). Native text drags preserve the
original source; heading links, prompt ids and commit hashes describe their
drag affordance. Unsupported drops show feedback, and **+** provides a
keyboard/touch alternative to dragging.

### Action lifetime

Navigation and playback require an explicit English or Chinese action
request in the latest question (`requestedAction` in
`lib/action-policy.ts`); quoted commands and negative requests do not grant
it. Closed, minimized and background conversations cannot start an action. A
pending quote highlight rechecks its originating conversation and
destination, waits for the destination content, and cancels when the reader
takes over scrolling. It reports success after placing the highlight, not
before a delayed callback. Full sentences are highlighted when available,
with a short prefix fallback. On phones both card media and agent playback
put Ask away before opening the attachment surface.

### Which models

`systems/ask/lib/models.ts` is the whole list: the picker shows it, the
route accepts nothing else (an unknown id falls back to the first, the
default). It is chosen to run on the gateway's **free tier** and to cost
little: every entry is `availableToFreeTier` in the gateway's catalog, takes
tools, reasons, reads both languages, and is served without training on
prompts. The picker shows each maker's mark (`components/model-icon.tsx`,
from Lobe Icons), keyed by the id's provider.

| model | $ / M tokens (in / out) | |
|---|---|---|
| Qwen 3.5 Flash (`alibaba/qwen3.5-flash`) | 0.10 / 0.40 | default; searches eagerly, the tool budget makes it answer |
| Gemini 2.5 Flash (`google/gemini-2.5-flash`) | 0.30 / 2.50 | searches less; answers well |

A question costs well under a cent on either (≈10k tokens in, ≈600 out).
Claude, GPT and Gemini 3 are not on the free tier; they need purchased
gateway credits, and go in the list then. The free `$0` models were left
out: the ones that are free are served with no promise against training on
what visitors ask. Set a budget on the project in the gateway's dashboard
either way. Tried and taken out: Kimi K2 Thinking (did not connect through
the gateway), Qwen 3.8 Flash and DeepSeek V4.1 Flash (`-fast`) (not on the
free tier).

### Which provider runs it

First match wins (`resolveModel` in the route):

| set in the environment | runs |
|---|---|
| a Vercel deployment (`VERCEL=1`), `AI_GATEWAY_API_KEY`, or a pulled `VERCEL_OIDC_TOKEN` | any model in the list, via the gateway. A deployment needs no key: the gateway provider authenticates with the project's OIDC token per request. A key is for running it elsewhere (local, CI, this repo's cloud sessions). |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | that provider's models directly, for an entry with a `direct` id |
| neither | **the stand-in** (see [How it works](#how-it-works)): the whole loop (route → tool call → browser search → resubmit → cards → answer) with no key, for development and previews. |

## The index

`pnpm ask:index` reads the site into `public/ask/index.json` (generated, not
committed; `predev` and `build` run it). `lib/ask-corpus.ts` reads the
content; `systems/ask/lib/corpus.ts` is the shape.

| doc kind | from | href |
|---|---|---|
| `post` | `content/blog/*.mdx`, one doc per language, cut at headings | `/writing/<slug>/<lang>`, a passage's `#<heading id>` |
| `conviction`, `influence` | `content/prompts.json` | `/prompt#<anchor>` |
| `era` | `content/log.json` | `/works` |
| `work` | `content/log.json` | `/works#<commit hash>` |
| `language` | `content/languages.json` | `/writing/pl-chart/<lang>#<id>` |

Chunks are at most 1200 characters. About 230 docs and 770 chunks today:
~580 KB, ~230 KB gzipped (much of it Chinese, which compresses less). One
file with the text in it: the browser fetches it the first time something
asks (opening Ask, or two characters in the palette's field) and never with
the page, and builds a BM25 index on arrival (`lib/search.ts`, MiniSearch,
words cut by `lib/tokenize.ts` the same way at build time and in the
browser). `read` returns up to 12,000 characters. Splitting the file (an
index without text, a file per doc for `read`) saved about 50 KB on the
first fetch and cost a round trip per read, so it is one file until the
site outgrows that.

The same index gives the palette **full-text search**: a post whose body
matches the query and whose title did not still shows, ranked under the title
matches (`usePaletteFilter` in `systems/command/results.tsx`).

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

## Command tools

`systems/command/catalog.ts` gives every command a model-facing description,
bilingual title and finite target values. `CommandAction.id` is a catalog id,
so adding a command without a description fails type checking. Ask generates
one `command_<id>` tool per command (`lib/command-tools.ts`); their
implementations stay in `useCommandActions` (`systems/command/actions.tsx`),
shared with the palette. There are 19 commands (including the search-only
Sky Window), five content/navigation tools (`search_site`, `read`,
`present`, `open_page`, `play`) and `list_commands`: 25 declarations in
total. Voice is only active where recognition is supported; Install is only
active before installation. The client sends those available ids on every
request; the route filters them against the catalog and uses `activeTools`,
retaining all definitions to interpret history.

Each command has a required `policy.execution`: `on-request` or
`user-gesture`, with stricter target overrides (`gestureValues`) for
`location=gps` and `music=play`. The schema and descriptions are generated
from that policy. `execution=offer` is the default. The model uses
`execution=apply` only when the reader explicitly asks to act.
`executeAskCommand` (`lib/execute-command.ts`) checks availability, allowed
targets, policy and whether the conversation is current and visible before
calling the browser host. The model interprets intent; the runtime owns the
execution boundary. Missing targets never trigger a cycle/toggle.

| Policy | Actions |
| --- | --- |
| Automatic read/presentation | `search_site`, `read`, `present`, `list_commands` |
| On explicit request | Theme, language, glass, tint, wallpaper styles/picker, approximate IP location, pause music, navigation, About, Ask, install guide, Sky Window explanation; existing `open_page` and `play` open pages/attachments |
| User tap | Voice microphone, accurate GPS, start background music, developer panel toggle; sensor consent and actual installation remain inside their existing UI |

A checked offer becomes a compact card (`components/command-card.tsx`);
exact targets such as `language=zh` or `theme=dark` are one button, and an
unspecified target offers the choices. The same setter implementations serve
direct execution and taps, shared with the palette. Wallpaper targets use the
existing image/shuffle/loop picker or real weather styles, not a fabricated
forecast. Sky Window selects the sky background and opens its explanation;
opening that explanation does not request motion/location permission. The
install command opens a guide; it does not install the app. A failed action
returns an error and is never reported as completed. Successful direct
executions return `executed` and render as completed cards, saved with the
conversation.

`list_commands({ ids: [...] })` always only presents the model's selection,
in its chosen order (`commandsToPresent`). Capability questions get 1–2
relevant examples, with no setting changes; a full menu requires an explicit
request. Specific requests use one or two `command_*` calls. Background or
hidden conversations may offer controls but cannot apply them. The host
rechecks availability/targets, keeps gesture actions in the card click's
task, and moves Ask aside for navigation or a new surface. Applying a
weather style stays in Ask.

Successful taps update the existing tool output with `executed`
(`recordCommandExecution` in `lib/command-state.ts`), saved to history
without making a new model request. Placement changes and reloads keep
completion state; the next question tells the model what actually ran. A
discovery menu remains reusable. The keyless stand-in exercises these paths
with scripted requests and two fixed discovery examples (theme and Sky
Window).

### Tool-count benchmark

`pnpm ask:benchmark` is offline: it compares experimental lexical shortlists of
12 and 18 tools against all 25 on 34 bilingual cases. It measures schema bytes
and whether the expected tool survives selection, **not model accuracy**. The
shortlister never sees the expected answer. All six non-command tools are kept.
The current offline run retains 31/34 cases at 12 tools, 33/34 at 18 and 34/34
at 25; the indirect phone/sun/moon request loses Sky Window in both shortlists,
and the smaller list also loses a Chinese theme request and one of the commands
in a dual-change request. Full schemas are about 14.6 KB. Production
therefore keeps all available commands pending live measurements; the
experimental pruning is confined to the benchmark.

The live run (`--run`, below) uses the production system prompt, the exact
tool schemas, low reasoning and the configured Gemini/Qwen models. It
executes no tools. It records first-call correctness (tool names, every
explicit target, effective apply/offer outcome under the catalog policy, and
extra calls), including two requested changes, limiting capability
suggestions to 1–2 actions, and allowing the full list only for an explicit
full-list request. Boundary cases include a dark-mode preview, a how-to
question and starting music. It also records how many actions would be
shown, provider errors, latency and input/output token usage, rotating
variant order across repetitions. JSON reports land in ignored `shots/`;
`--output=path` changes the destination. It does not measure browser
execution or final-answer quality. No live accuracy numbers are available
from a credential-free checkout.

Google's [function-calling guidance](https://ai.google.dev/gemini-api/docs/function-calling#best-practices)
suggests an active set of 10–20 tools. That is a useful experiment range, not a
measured cutoff for this site's Gemini 2.5 Flash or Qwen 3.5 Flash. Enable pruning
only after repeated live trials demonstrate a benefit without losing indirect
requests, bilingual settings or capability discovery.

## Rules

Each of these, broken, has a visible failure.

| Rule | Why | What breaks |
|---|---|---|
| Tools are declared in `tools.ts` with no `execute`, and run in `chat.ts`'s `onToolCall` | The index lives in the browser; the route never reads it | A tool with `execute` runs on the server, which has no index; the page never sees the call |
| The page's cap stays above the route's budget (`MAX_TOOL_CALLS` 10 in `chat.ts`, `TOOL_BUDGET` 6 in the route) | The route forces the answer step; the page's cap is only the backstop | A cap at or under the budget stops the loop before the forced answer: a page of steps and no reply |
| Every word the model reads is in `prompts.ts` | One place for the voice, the instructions and the tool descriptions | Wording scattered over components drifts from the persona and the benchmark's schemas |
| The system prompt stays byte-identical (`askSystemPrompt`, built once); anything per request travels as a `data-context` part | The provider's prompt cache holds the few-thousand-token map | A date or the page in the system prompt pays for the whole map on every step |
| Models only in `models.ts`, each on the gateway's free tier; the first is the default | The route accepts only these (`askModelOf`), and a deployment has no credits | An id elsewhere is silently replaced by the default; a paid model fails on the deployment |
| Side effects (`open_page`, `play`, a command's `apply`) run only for an explicit request in the current, visible conversation (`requestedAction`, `executeAskCommand`) | The model chooses intent; the runtime owns the boundary | A background conversation, or a question that only mentions a page, moves the reader or changes a setting |
| A command is a catalog entry plus its implementation in `useCommandActions`, never an Ask-only setter | A tap in the palette and in Ask must do exactly the same thing | Two code paths that disagree; a missing description fails `tsc` |
| A behaviour choice is a setting in `config.ts` (both presets, a `valid()` case), read with `useAskConfig` / `askConfigNow` | The devtool shows and overrides it per platform | A branch in a component the devtool cannot see or change |
| Heading ids come from `lib/heading-id.ts`, on the page and in the index | The same function makes the anchor and the link | Links land at the top of the post instead of the passage |
| AI Elements, streamdown and the AI SDK client are imported only from lazily loaded modules (`entry.tsx`, `askLazy`, the panel) | None of it is the page's business until Ask opens | Every page pays for the chat on first load |
| The phone drawer keeps `height={detentHeight(1)}` and `restoreFocus={false}` | The composer's keyboard handling depends on both ([keyboard-input.md](./keyboard-input.md)) | The field sits behind the keyboard, or a keyboard opens on the next touch |
| Changes to `components/ai-elements/` stay to what Base UI and this repo need (below) | They are to be taken over one at a time; until then they track the registry | A registry update cannot be diffed in |

## What is free to choose

- **Which free-tier models, and their order.** The first is the default.
- **Every setting's preset**, per platform, in `ASK_PRESETS`.
- **The persona and the instructions**, in `prompts.ts`, within the
  constraints above (facts from the site, says it is an AI, no promises).
- **The numbers**: `TOOL_BUDGET` (as long as it is under `MAX_TOOL_CALLS`),
  `MAX_MESSAGES` 24, the history's 30 conversations, `MAX_CHUNK` 1200,
  `MAX_READ` 12,000, the output cap.
- **The cards and steps' look**, and the suggested questions
  (`ASK_SUGGESTIONS`, `ASK_CONTEXT_SUGGESTIONS`).
- **Tool shortlisting**: off in production; the benchmark is where to try it.

## Recipes

**Add a command.** An entry in `systems/command/catalog.ts` (bilingual
title, a description for the model, `options` for finite targets, a
`policy.execution`), its implementation in `useCommandActions`, a case in
`scripts/ask-tools-benchmark.mjs`. Then `pnpm ask:test`, `pnpm command:test`
and `pnpm ask:benchmark`.

**Add a model.** Check the gateway's catalog (`availableToFreeTier`, tools,
reasoning, no training on prompts), add it to `ASK_MODELS`, and give its
maker a mark in `components/model-icon.tsx` if it is new.

**Add a content tool.** Declare it in `tools.ts` (`jsonSchema`, no
`execute`), its words in `ASK_TOOLS` in `prompts.ts`, run it in `chat.ts`'s
`onToolCall`, show its step in `components/messages.tsx`.

**Add a setting.** A field in `AskConfig` with a doc comment, a value in both
presets, a case in `valid()`, a row in the devtool's Ask section
(`systems/devtool/panel.tsx`), and a row in the settings table above.

**Build a new surface.** Arrange `AskMessages`, `AskComposer` and
`AskHistory` with the hooks in `lib/use-ask.ts` (`useAskSession`,
`useAskHistory`, `useAskPrefs`, `useAskRunning`, `useAskRequest`,
`useAskContinuity`), from a lazily loaded module.

**Try it without a key.** `pnpm dev` and ask anything: the stand-in searches,
shows cards and lists links. "open …" / "play …" exercise the actions; "Can I
change the theme?" gets an offer card, "Switch to dark mode" applies it, and
"What can you do?" shows the two-command discovery menu.

**Check it.** `pnpm ask:test` (the click boundary and persisted tool
results), `pnpm command:test`, `pnpm ask:benchmark` offline. With
`AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` in the environment, the live
benchmark:

```sh
pnpm ask:benchmark --run --models=all --repeats=3
# A smaller smoke run:
pnpm ask:benchmark --run --cases=dark-en,language-zh,sky-indirect,discover-zh,hello
```

## Reference

### Files

```
systems/ask/
├── index.ts           # AskChat (lazy), and which pieces to import for a surface of its own
├── lib/
│   ├── corpus.ts      # the index's shape: docs (a post in one language, a conviction, a commit…) cut into chunks
│   ├── tokenize.ts    # words in both languages (Intl.Segmenter), the same at build time and in the browser
│   ├── search.ts      # the index in the browser: fetched once, BM25 (MiniSearch), search + read
│   ├── doc-href.ts    # the doc a link points at, in the reader's language
│   ├── tools.ts       # the agent's content tools (search_site, read, present, open_page, play): declared once, run in the page
│   ├── chat.ts        # the session: current conversation, the agent loop (AI SDK Chat)
│   ├── chat-continuity.ts # another post is a new chat
│   ├── prefs.ts       # the last model and thinking level picked, what a new conversation starts on (no AI SDK, so the devtool can read it)
│   ├── storage.ts     # JSON in localStorage, where storage allows
│   ├── config.ts      # how Ask behaves: every setting, a preset per platform (desk / phone)
│   ├── history.ts     # past conversations, in localStorage
│   ├── page-context.ts # what the reader has open: the post and section, the entry, the commit
│   ├── pending-context.ts # what they pointed at for the next question (a selection, a drop), per conversation
│   ├── context-policy.ts # MAX_CONTEXTS (3), shared with the route
│   ├── pointed.ts     # a selection or a drop, as a context
│   ├── selection-layout.ts # where "Ask about this" stands; a quote tag's label
│   ├── use-ask.ts     # the hooks surfaces are built from: useAskSession / useAskHistory / useAskPrefs / useAskRunning / useAskRequest / useAskContinuity
│   ├── actions.ts     # the browser host for navigation, media and command clicks
│   ├── action-policy.ts # requestedAction: was open / play explicitly asked for; siteActionHref
│   ├── command-tools.ts # offer-only tools generated from systems/command/catalog.ts, and list_commands
│   ├── execute-command.ts # executeAskCommand: availability, targets, policy, foreground
│   ├── command-state.ts # successful taps recorded in tool outputs and history
│   ├── stand-in-command.ts # the keyless stand-in's scripted command calls
│   ├── models.ts      # the models the picker offers and the route accepts; the thinking levels
│   └── intent.ts      # is this a question or a search?
├── components/
│   ├── entry.tsx      # AskChat / AskPanel, lazily loaded over a skeleton
│   ├── lazy-view.tsx  # askLazy, FadeSlot: load a piece, fade it in over the skeleton
│   ├── skeleton.tsx   # what a surface shows while the conversation loads
│   ├── messages.tsx   # AskMessages: the conversation, steps, copy / regenerate
│   ├── command-card.tsx # compact command actions and the expandable discovery menu
│   ├── cards.tsx      # AskCards: what the agent presented (a strip) and what an answer used (rows)
│   ├── context-tag.tsx # what a question is about, as a tag
│   ├── selection.tsx  # "Ask about this" over words selected on the page
│   ├── actions-host.ts # the agent's hands: open a page at a spot, play a talk, run a command
│   ├── composer.tsx   # AskComposer: field, model, thinking level, voice, send / stop
│   ├── model-icon.tsx # each model maker's mark, for the picker
│   ├── history.tsx    # AskHistory: past conversations
│   ├── chat.tsx       # the center place: the palette, widened into two panes (lazy-loaded)
│   ├── panel.tsx      # the side place, and the phone's drawer
│   ├── activity.tsx   # the top place and the pill: a Live Activity in the Dock
│   ├── activity-body.tsx # the Dock panel's conversation, and the session bridge for the pill
│   └── placement.tsx  # the placement menu / buttons, minimize, the drag handle, the drag's overlay
├── prompts.ts           # every word the model reads (system prompt, voice, answer-now, context, tool descriptions) and the suggested questions
├── surfaces.tsx         # AskSide, AskDock, AskDragging, AskSelection: mounted once in the root layout
└── strings.ts           # en / zh

lib/ask-corpus.ts      # reads the site into the index (Node, build time)
lib/ask-prompt.ts      # fills in the system prompt: the About and a map of the site
lib/follow-href.ts     # follow a link on this site, firing hashchange for the page already open
lib/highlight-quote.ts # open_page's highlight (CSS Custom Highlight API)
lib/use-hash-landing.ts # pages land on #anchors: scroll, wash, open
scripts/ask-index.ts   # writes public/ask/index.json (`pnpm ask:index`; predev and build run it)
scripts/ask-tools-benchmark.mjs # `pnpm ask:benchmark`
scripts/tests/ask-commands.test.mjs # `pnpm ask:test`
app/api/chat/route.ts  # the one server route: key, prompt, tools, stream, the stand-in
components/ai-elements/  # AI Elements, as the registry ships them (see below)
```

### AI Elements, on Base UI

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
- Streamdown plugins trimmed to `cjk` + `code` in messages (`cjk` alone in
  reasoning; no mermaid, no TeX), and its `@source` lines are in
  `globals.css` so Tailwind generates its classes.
- The code block reads shiki 1 (the site's), and keeps its async result in
  state rather than a ref read during render.

### Not yet

- Filtering /works or /prompt by a facet, opening a row on /works in place.
- Rate limiting on the route beyond its input caps, and a spend cap.
- An eval set, to choose the default model and the map's detail.
