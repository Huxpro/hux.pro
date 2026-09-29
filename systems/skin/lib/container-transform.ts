// =============================================================================
// Container transform — a widget opening into its page, as Android opens a
// card into a screen.
//
// Material's container transform keeps the thing you touched on screen: the
// card's container grows into the destination's, its corners opening from
// the widget radius to square, while the card's content fades out and the
// page's fades in through it (fade through). Here it rides the navigation's
// own view transition (next-view-transitions): the card is named
// `md-container` for the old snapshot, the destination page's surface
// (`[data-page-surface]`, the PageLayout <main>) takes the name for the new
// one while `html[data-md-transform]` is set, and the stylesheet animates the
// pair ("View Transition API Styles", globals.css).
//
// Material skin only, and only where the browser has view transitions;
// anywhere else the page simply crossfades in, as it always has.
// =============================================================================

const NAME = "md-container";
/** Past the transition's end (500ms), so the new snapshot is taken first. */
const CLEAR_AFTER_MS = 900;

export function armContainerTransform(card: Element | null) {
  if (!(card instanceof HTMLElement)) return;
  const root = document.documentElement;
  if (root.dataset.skin !== "material") return;
  if (typeof document.startViewTransition !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  card.style.viewTransitionName = NAME;
  root.dataset.mdTransform = "";
  window.setTimeout(() => {
    delete root.dataset.mdTransform;
    if (card.isConnected) card.style.viewTransitionName = "";
  }, CLEAR_AFTER_MS);
}
