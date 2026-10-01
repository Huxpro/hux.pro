import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isDemoPage, isFramed } from "./config";
import { Demo } from "./demo/Demo";
import { LangProvider } from "./i18n";
import "./styles.css";

// This site is the demo: a small mobile page inside <Vitre>, the way a host
// uses it. A phone gets it full screen, with Safari's real chrome; the
// simulated phone in the documentation gets it in a frame (`?frame`).
//
// The documentation lives on hux.pro, as a lab (/lab/vitre): the article, the
// simulated phone that runs this page, and the site's own frame around both.
// Its content is still the package's — src/docs here, where api.ts fails the
// type check for an undocumented export. hux.pro's server sends anything but a
// phone there from /vitre; this sends a wide screen that reached the page
// anyway (an iPad, or /vitre/index.html). `vite dev` has no hux.pro to send it
// to, so it gets the demo.
const DOCS = "/lab/vitre";

if (!isDemoPage() && import.meta.env.PROD) {
  location.replace(DOCS + location.hash);
} else {
  document.documentElement.dataset.page = "demo";
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <LangProvider persist={!isFramed()}>
        <Demo />
      </LangProvider>
    </StrictMode>
  );
}
