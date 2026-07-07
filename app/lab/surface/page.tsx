import { SurfaceLabView } from "./view";

export const metadata = {
  title: "Surface Physics | Hux.Pro",
  description:
    "An interactive model of the site's floating-surface design language — every glass, popover, and scrim plotted on two axes: elevation (Z) and presence (A).",
};

export default function SurfaceLabPage() {
  return <SurfaceLabView />;
}
