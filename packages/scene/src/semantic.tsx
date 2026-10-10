"use client";

// =============================================================================
// semantic(): the one boundary.
//
// Anything a person could name is a semantic component. Its declaration (id,
// words, parts, params) sits next to it; what it draws inside is free: any SVG,
// any filter, any canvas code. The boundary only:
//
//   1. registers the instance (its path, its live props) with the stage;
//   2. lays outside overrides over the props the code passed, so an edit made
//      in the inspector or by a sentence survives the component being rewritten;
//   3. wraps what it draws in a <g data-sem>, which is how it is measured;
//   4. tells <Part>s inside whose they are.
// =============================================================================

import { createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type SVGProps } from "react";
import { instancePath } from "./path";
import { useRegistry } from "./stage";
import { declare, defaults, type Declaration, type ParamValues, type Params } from "./spec";

interface Owner {
  path: string;
  entity: string;
}

export const OwnerContext = createContext<Owner | null>(null);

/** The path of the semantic thing being drawn here (for a <Draw> or a hook). */
export function useOwner(): Owner | null {
  return useContext(OwnerContext);
}

type Placement = Pick<SVGProps<SVGGElement>, "transform" | "clipPath" | "opacity" | "mask">;

export type SemanticProps<P extends Params> = Partial<ParamValues<P>> &
  Placement & {
    /** Which one, when the thing appears more than once: "wardrobe", "bedside". */
    instance?: string;
    children?: ReactNode;
  };

export type SemanticComponent<P extends Params> = ((props: SemanticProps<P>) => ReactNode) & {
  declaration: Declaration<P>;
};

export function semantic<P extends Params = Params>(
  decl: Declaration<P>,
  Render: (props: ParamValues<P> & { children?: ReactNode }) => ReactNode,
): SemanticComponent<P> {
  declare(decl as Declaration);
  const base = defaults(decl.params);
  const keys = new Set(Object.keys(decl.params ?? {}));

  function Semantic({ instance, transform, clipPath, opacity, mask, children, ...rest }: SemanticProps<P>) {
    const registry = useRegistry();
    useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);
    const path = instancePath(decl.id, instance);
    const passed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (keys.has(k) && v !== undefined) passed[k] = v;
    const props = { ...base, ...passed, ...registry.overridesFor(decl.id, path) } as ParamValues<P>;
    const ref = useRef<SVGGElement>(null);

    useLayoutEffect(
      () => registry.mount({ path, entity: decl.id, instance: instance ?? null, props: {}, host: "svg", node: () => ref.current }),
      [registry, path, instance],
    );
    useLayoutEffect(() => registry.update(path, props));

    return (
      <OwnerContext.Provider value={{ path, entity: decl.id }}>
        <g ref={ref} data-sem={path} transform={transform} clipPath={clipPath} opacity={opacity} mask={mask}>
          <Render {...props}>{children}</Render>
        </g>
      </OwnerContext.Provider>
    );
  }
  Semantic.displayName = `semantic(${decl.id})`;
  return Object.assign(Semantic, { declaration: decl });
}

/** A named part of the semantic thing it is drawn inside: <Part name="hat">. */
export function Part({ name, children, ...g }: { name: string; children?: ReactNode } & SVGProps<SVGGElement>) {
  const owner = useContext(OwnerContext);
  if (!owner) throw new Error(`scene: <Part name="${name}"> must be drawn inside a semantic component.`);
  const path = `${owner.path}.${name}`;
  return (
    <OwnerContext.Provider value={{ ...owner, path }}>
      <g data-sem={path} {...g}>
        {children}
      </g>
    </OwnerContext.Provider>
  );
}

/**
 * Atmosphere: what is drawn but is not a thing (a glow, a second image in a
 * dream, grain). It is left out of measurement and coverage, by name.
 */
export function Atmosphere({ name, children, ...g }: { name: string; children?: ReactNode } & SVGProps<SVGGElement>) {
  return (
    <g data-sem-post={name} {...g}>
      {children}
    </g>
  );
}
