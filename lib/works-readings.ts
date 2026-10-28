// =============================================================================
// Works readings: the narrowings of /works that are worth a card of their own.
//
// `/works?type=talk` is a reading of /works, not a page (the query string is
// the view state; lib/log-view.ts). But it is a link people send (the About,
// the home widgets), and a crawler that unfurls it reads one page's Open
// Graph. A static page has one, so each reading here also has a page of its
// own, `/works/<type>`, which renders nothing and only says what it is: its
// title, its words, its baked card (app/works/[type]). /works itself lives
// in the section's layout, so it stays mounted across them.
//
// next.config.ts rewrites `/works?type=<type>` to that page (before the
// filesystem, so the plain /works does not win) and redirects the bare
// `/works/<type>` back to the query: the query is still the address.
//
// Dependency-free on purpose: next.config.ts imports it.
// =============================================================================

/** The readings with a card, by the type they filter to. */
export const WORKS_READINGS = ["talk", "project"] as const;

export type WorksReading = (typeof WORKS_READINGS)[number];

export function isWorksReading(value: string): value is WorksReading {
  return (WORKS_READINGS as readonly string[]).includes(value);
}
