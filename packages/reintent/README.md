# reintent (vendored)

The intent model from airtalk's reintent lab
([Huxpro/airtalk#818](https://github.com/Huxpro/airtalk/pull/818), commit
`8309f7f`, `prototypes/reintent-lab/reintent/`), copied unchanged:

| File | What it is |
| --- | --- |
| `src/reintent.js` | closed intent types, cells, precedence (a person's decision > their preference > a model sure enough > code), crossover along an index, `narrow`, `alternatives`, effects cached `under` an assignment |
| `src/signal.js` | signal / computed / effect / batch, with an equality cutoff |
| `src/reactive.js` | reintent on signals: an intent is a computed |

Its design and evidence are in airtalk's `docs/intent-stage.md`. Here it is
the intent tier over stage scenes: `/lab/intent` (app/lab/intent) declares a
dream's intents and compiles each screen's assignment into the scene's
props. Do not edit these files here; change them upstream and copy again.

```bash
node --test scripts/tests/reintent-signal.test.mjs
```
