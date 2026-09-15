import type { ReactNode } from "react";

/** A long page to scroll, with a readout of where the scroll happens. */
export function Page({ children }: { children?: ReactNode }) {
  return (
    <div style={{ padding: "48px 20px", fontFamily: "system-ui, sans-serif" }}>
      {children}
      {Array.from({ length: 40 }, (_, i) => (
        <p key={i} style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
          Row {i + 1}. Scroll the page: in container scroll the document stays
          still and this list moves inside the bezel.
        </p>
      ))}
    </div>
  );
}

/** A full-bleed backdrop inside the bezel, so the corners have something to round. */
export function Backdrop({ layerProps, style }: { layerProps: Record<string, string>; style: object }) {
  return (
    <div
      aria-hidden="true"
      {...layerProps}
      style={{
        position: "fixed",
        zIndex: -1,
        background: "linear-gradient(160deg, #6ea8ff, #b58cff 55%, #ffb38a)",
        ...style,
      }}
    />
  );
}
