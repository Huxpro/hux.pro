/**
 * Follow a link to this site from code (Ask's answers and sources, its
 * tools): a route change through the router, or, for a link into the page
 * already open, a travel to the part it names.
 *
 * The router does not travel for a link that changes only the hash, and
 * `pushState` fires no `hashchange`, so the pages listening for one
 * (lib/use-hash-landing.ts, /prompt) would never hear of it. This writes the
 * hash and fires the event itself, so `/works#3fa9c1e` from a conversation
 * at the side of /works goes to the row, the same as from anywhere else.
 */
export function followHref(href: string, push: (href: string) => void) {
  const to = new URL(href, window.location.href);
  const here = window.location;
  if (to.origin !== here.origin || to.pathname !== here.pathname || to.search !== here.search) {
    push(href);
    return;
  }
  if (!to.hash) return;
  const oldURL = here.href;
  if (to.hash !== here.hash) history.pushState(null, "", to.hash);
  // Fired even when the hash is the one already there: following the same
  // link twice travels twice.
  window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: here.href }));
}
