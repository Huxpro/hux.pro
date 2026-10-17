# reintent-core

Intents as a reactive, typed program. A closed set of kinds per intent,
written in TSX. Each value is decided by one rule: a person, then a rule,
then the author, then a relation, then a viewer, then a sure model, then
code (or a question). When a model rewrites the program, values are
reconciled by path.

- `reintent-core`: the core. No dependencies.
- `reintent-core/jsx-runtime`: the program's JSX runtime (`/** @jsxImportSource reintent-core */`).
- `reintent-core/words`, `/observe`, `/devtools`: libraries on the core.
- `reintent-core/react`: the React binding.

See docs/system-reintent-core.md, and `/lab/reintent` for The Wardrobe running on it.
`pnpm reintent:test` and `pnpm reintent:typecheck` check it.
