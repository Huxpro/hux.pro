/* eslint-disable @typescript-eslint/no-explicit-any -- ported as written (Huxpro/airtalk#845) */
/**
 * Elements: what JSX builds. The core reads only its own element types (intent components,
 * Fragment, a context's Provider) and passes every other node through untouched: a host node
 * (`host(kind, props)`) means nothing to the core and everything to the host that reads it.
 */

export const Fragment = Symbol.for('reintent.fragment');

export type Child = Element | HostNode | string | number | boolean | null | undefined | Child[];

/** A component: a function of its props. `scope` marks one whose key names what is inside it. */
export type Component<P = any> = ((props: P) => Child) & { scope?: boolean; displayName?: string };

export type Element = {
  readonly $$element: true;
  readonly type: Component | typeof Fragment;
  readonly props: Record<string, any>;
  readonly key: string | undefined;
};

/** A node only the host understands: a kind and its props, children already expanded. */
export type HostNode = {
  readonly $$host: true;
  readonly kind: string;
  readonly props: Record<string, any>;
  readonly children: Rendered[];
};
export type Rendered = HostNode | string | number;

export function h(type: Element['type'], props: Record<string, any> | null, ...children: Child[]): Element {
  const { key, ...rest } = props ?? {};
  if (children.length) rest.children = children.length === 1 ? children[0] : children;
  return { $$element: true, type, props: rest, key: key == null ? undefined : String(key) };
}

/** A host node. Its `children` (elements or nodes) are expanded by the core before the host sees them. */
export function host(kind: string, props: Record<string, any> = {}): Element {
  const { children, ...rest } = props;
  return h(hostType(kind), rest, ...(children === undefined ? [] : [children]));
}

const hostTypes = new Map<string, Component>();
function hostType(kind: string): Component {
  if (!hostTypes.has(kind)) {
    const t: Component = () => null;
    Object.defineProperty(t, '$$hostKind', { value: kind });
    hostTypes.set(kind, t);
  }
  return hostTypes.get(kind)!;
}
export const hostKindOf = (t: unknown): string | undefined => (t as any)?.$$hostKind;

export const isElement = (x: unknown): x is Element => !!x && typeof x === 'object' && '$$element' in x;
export const isHostNode = (x: unknown): x is HostNode => !!x && typeof x === 'object' && '$$host' in x;

/** Mark a component as a scope: keys inside it are unique within it, so a part keeps its intents when moved. */
export function scope<P>(c: Component<P>): Component<P> {
  c.scope = true;
  return c;
}

/** Children as a flat list (the way components usually want them). */
export function childrenOf(children: Child): Child[] {
  const out: Child[] = [];
  const walk = (c: Child) => (Array.isArray(c) ? c.forEach(walk) : c != null && c !== false && out.push(c));
  walk(children);
  return out;
}
