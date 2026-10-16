# reintent (vendored)

`src/reintent.js` is copied unchanged from Huxpro/airtalk#818
(`prototypes/reintent-lab/reintent/reintent.js`, commit `8309f7f`): intents as a
closed, probabilistic decision table indexed by context. A person's decision > their
preference > a confident model > code; an indexed type crosses over along one
dimension of the context, and a person's switch moves the crossover; alternatives are
one-flip worlds, the rest frozen.

Here it has two hosts: the Lab's camera (`app/lab/screens/`: how a scene composed for a
phone is framed on any screen) and the intent loop (`app/lab/intents/`: drags, resizes and
sentences as events on an intent tree, resolved to presets or handed to a model). See
docs/lab-reintent.md. Do not edit the vendored file; update it from airtalk. `reintent.d.ts`
types it as this site uses it.
