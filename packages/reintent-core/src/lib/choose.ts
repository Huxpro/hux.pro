/**
 * `<Choose>`: a structural choice. Its kinds are subtrees, not values: which one the program is.
 *
 *   <Choose key="form" name="form" default="story" alternatives={{
 *     story: <Storytelling key="story" />,
 *     demo:  <ProductDemo key="demo" />,
 *     game:  <InteractiveGame key="game" />,
 *   }} />
 *
 * It is one intent (`…/Choose:form#form`) over the alternatives' names, settled like any other
 * (a person, a sure model, code's default), and it renders the chosen subtree only. What is read
 * under it is read after it, so a model's beliefs there can be given it (`Given`), and `worlds`
 * branches on it before what it holds. The others are not rendered, but each is one `whatIf`
 * away. A keyed component keeps its path in whichever alternative holds it (Choose is not a
 * scope), so what was decided about it holds across them.
 *
 * Renders a host node `choice` { name, path, chosen, of } with the chosen subtree as its children.
 */
import { host, useIntent, usePath, type Child } from '../core/index';
import { shown, type About } from './vocab';

export type ChooseProps = {
  name: string;
  /** Code's pick: what renders until someone sure has chosen. */
  default: string;
  alternatives: Record<string, Child>;
  ask?: boolean;
  label?: string;
  /** Words for each alternative, for a sentence to name it. */
  words?: Record<string, readonly string[]>;
};

export function Choose(p: ChooseProps) {
  const of = Object.keys(p.alternatives);
  const about: About = {
    label: p.label,
    aka: [],
    kinds: Object.fromEntries(of.map((k) => [k, { label: k, words: p.words?.[k] ?? [k], data: {} }])),
    ordered: false,
    more: [],
    less: [],
  };
  const v = useIntent<string>(p.name, { default: p.default, ask: p.ask, kinds: of, about });
  const chosen = shown(v, p.default);
  return host('choice', { name: p.name, path: usePath(p.name), chosen, of, children: p.alternatives[chosen] });
}
Choose.displayName = 'Choose';
