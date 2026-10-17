# reintent-core

Intents as a reactive, typed program. A part takes intents in (`useIntent`,
a closed set of kinds each) and gives the world out. Each value is decided by
one rule: a person, then a rule, then the author, then a relation, then a
viewer, then a sure model, then code (or a question). When a part is
rewritten, values are reconciled by path.

- `reintent-core`: the core. No dependencies; its hooks need a frame, not React.
- `reintent-core/words`, `/observe`, `/devtools`: libraries on the core.
- `reintent-core/react`: the React binding (`reactPart`, `useCell`).

See docs/system-reintent-core.md, and `/lab/reintent` for The Wardrobe running on it.
`pnpm reintent:test` and `pnpm reintent:typecheck` check it.
