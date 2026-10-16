// =============================================================================
// Things a model added to a scene after an event (a lamp, a cat): drawn from
// the intent tree. Each is a semantic thing (named, measured, inspectable)
// whose drawing is a lazy effect: a placeholder (code's, instant) until a
// model has drawn it, then the drawing, kept with what it was written under.
// =============================================================================

import { useMemo } from "react";
import { Atmosphere, Part, semantic, type SemanticComponent } from "scene";
import { realized, sanitizeSvg, type Tree, type Value } from "intents";

const made = new Map<string, SemanticComponent<Record<never, never>>>();

/** A semantic component for a thing only the tree knows about, declared once per id. */
function thing(id: string, aka: readonly string[]) {
  let C = made.get(id);
  if (!C) {
    C = semantic({ id, kind: "learned", aka, parts: ["body"] }, ({ children }) => <>{children}</>);
    made.set(id, C);
  }
  return C;
}

function Drawing({ svg }: { svg: string }) {
  const clean = useMemo(() => sanitizeSvg(svg), [svg]);
  return <g dangerouslySetInnerHTML={{ __html: clean }} />;
}

export function Learned({ tree, values, drawingLabel }: { tree: Tree; values: Record<string, Value>; drawingLabel: string }) {
  return (
    <>
      {tree.nodes
        .filter((n) => n.learned && !n.draws)
        .map((n) => {
          const place = realized(tree, values, n.id, "place");
          const light = realized(tree, values, n.id, "light");
          const at = (place.at as [number, number] | undefined) ?? [195, 760];
          const scale = (place.scale as number | undefined) ?? 1;
          const Thing = thing(n.id, n.aka);
          const svg = n.drawings?.[0]?.svg;
          return (
            <Thing key={n.id} transform={`translate(${at[0]} ${at[1]}) scale(${scale})`}>
              {light.on === true && (
                <Atmosphere name="light">
                  <ellipse cx="0" cy="-70" rx="110" ry="92" fill="#ffd9a0" opacity="0.16" />
                  <ellipse cx="0" cy="-70" rx="46" ry="38" fill="#ffd9a0" opacity="0.18" />
                </Atmosphere>
              )}
              <Part name="body">
                {svg ? (
                  <g style={light.on === true ? { filter: "brightness(2.6) sepia(0.7) saturate(1.6)" } : undefined}>
                    <Drawing svg={svg} />
                  </g>
                ) : (
                  <>
                    <rect x="-26" y="-90" width="52" height="90" fill="#0b1020" fillOpacity="0.5" stroke="#9aa6c8" strokeDasharray="4 3" />
                    <text x="0" y="-40" textAnchor="middle" fontSize="10" fill="#9aa6c8" fontFamily="monospace">
                      {drawingLabel}
                    </text>
                  </>
                )}
              </Part>
            </Thing>
          );
        })}
    </>
  );
}
