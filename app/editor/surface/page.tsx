import { SurfaceEditor } from "./view";

export const metadata = {
  title: "surface.ts | Editor",
  description:
    "The glass design language as an interactive model — every floating surface plotted on two axes: elevation (Z) and presence (A).",
};

export default function SurfaceEditorPage() {
  return <SurfaceEditor />;
}
