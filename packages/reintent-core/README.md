# reintent-core

Reintent in `.tsx`, after [Huxpro/airtalk#845](https://github.com/Huxpro/airtalk/pull/845):
intents as values, not signals. A model writes an intent tree (elements and
literal props) on intent components that read their intents as values and
return host nodes saying what was decided. A view in any host draws them.

- `reintent-core`: the core. Elements and the render with its trace, `whatIf`,
  `watch`, contexts with axes, one intent's value from its writers (a person >
  a sure model > code), stamped results, a pluggable source.
- `reintent-core/jsx-runtime`: `/** @jsxImportSource reintent-core */`.
- `reintent-core/lib/*`: libraries on the core's public entry. From airtalk:
  `axis`, `alternatives`, `questions`, `orphans`. From this repository: `vocab`,
  `words`, `changes`, `observe`, `session`.

See docs/system-reintent-core.md, and `/lab/reintent` for The Wardrobe on it.
`pnpm reintent:test` and `pnpm reintent:typecheck` check it.
