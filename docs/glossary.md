# Post Glossary

Inline explanations for terms in blog posts: a reader hovers "Monad" and sees
what it means *in this blog*, in the post's language. This page covers the data
and the maintenance loop; rendering is not built yet.

## Why no API

Deciding what counts as a term, whether "IO" means input/output or Google I/O,
and whether "PWA" is the same thing as "Progressive Web App" is judgement work
static analysis cannot do. It is also low-volume: a new post adds a handful of
terms. So the judging is done by a **coding agent in a normal session** (Claude
Code on a subscription), and everything else is a deterministic script. There
is no API key, no network call, and `next build` never runs a model.

## Data

| File | What | Who writes it |
|------|------|---------------|
| `content/glossary.json` | `scope` (posts under watch), `terms` → `forms` + `senses` → zh/en `gloss`, and `ignored` forms with a reason | The agent proposes (`proposed: true`); the author approves by removing the flag, or rejects by moving the forms to `ignored` |
| `content/glossary-index.json` | post → paragraph hash → `{ form: senseId \| null }` | Derived; only through `glossary:apply` |

- **Senses, not words.** A form maps to a term; a term has one or more senses.
  Each occurrence points at a sense (`io/input-output` vs `io/google`), or at
  `null` when the string is not that term there (a link title, a pun).
- **Rejections are data.** Without `ignored`, every scan would re-propose the
  same common words.

## Scripts

```bash
pnpm glossary:pending [--post <slug>.<lang>] [--limit N]   # JSON of what needs judging
pnpm glossary:apply <results.json>                          # validate + merge; writes nothing on any error
pnpm glossary:check                                         # nothing pending, nothing proposed
```

A paragraph is **pending** when its hash is new (`scan`: find new terms and
resolve known forms), or when a known form matches in it that its record does
not resolve (`resolve`). The second case is what makes a term added today
backfill every older post without re-reading them.

Matching is plain substring search, longest form first, no overlaps, case
sensitive; Latin-edged forms must sit on word boundaries ("Web" never matches
in "WebAssembly"). CJK needs no word segmentation.

`apply` refuses: a form not in its paragraph, a sense that is not a sense of
that form's term, a matching form left unresolved, a form that is in
`ignored`, a gloss missing a language, a duplicate sense id, and a paragraph
that changed since `pending` ran.

## The agent loop

Ask the agent to "run the glossary loop in docs/glossary.md" (after writing a
post, or when `glossary:check` fails):

1. Run `pnpm -s glossary:pending --limit 30`.
2. Judge each item and write a results file **outside the repo**:

   ```jsonc
   {
     "terms": [            // new terms, or new forms / senses on an existing id
       { "id": "monad", "forms": ["Monad", "单子"],
         "senses": [{ "id": "monad", "gloss": { "zh": "…", "en": "…" } }] }
     ],
     "ignore": [{ "form": "Web", "reason": "the blog's own subject" }],
     "paragraphs": [       // one entry per pending item
       { "post": "halting-problem.zh", "hash": "…", "occurrences": { "图灵机": "turing-machine" } }
     ]
   }
   ```

   A paragraph with nothing to resolve still gets `"occurrences": {}`. It is
   fine to apply `terms` first and resolve paragraphs in a second pass, since
   new terms create new matches.
3. Run `pnpm -s glossary:apply <file>`, fix whatever it names, and repeat until
   nothing is pending.
4. List the proposed terms (id, forms, zh gloss) for the author to review.

### Judging

Readers program a little or work next to engineers, but are not specialists
in every post's topic. Propose a term when a reader could stall on it *and* a
one-line gloss unblocks them: jargon (call-by-need, 停机问题), acronyms (TC39),
named concepts (Monad, PWA), people or products whose role the post assumes
(SPJ, Weex). Skip everyday words, anything the post defines on the spot, and
anything in `ignored`.

Before adding a term, read the `glossary` list in the pending output. Another
spelling of an existing term becomes a new form on it (H5 → `html5`). A new
meaning of an existing form becomes a new sense with its own id
(`<term>/<qualifier>`).

Forms are exact strings as they appear in posts, in both languages, including
common variants (`PWA`, `PWAs`, `Progressive Web App`). Prefer unambiguous
forms (`惰性求值`, not `惰性`).

Glosses are one or two sentences in zh and in en: what it is and why it
matters here. Leave out filler like "X is a term that…".

### Author commands

- "approve X": remove `proposed` from term X and its senses.
- "reject X": remove term X, add its forms to `ignored` with the author's
  reason, then run the loop to resolve leftovers.
- "add <post> to the glossary": append `<slug>.<lang>` to `scope`, then run the
  loop.
