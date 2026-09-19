import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isDemoPage, isFramed } from "./config";
import { Demo } from "./demo/Demo";
import { Docs } from "./docs/Docs";
import { LangProvider } from "./i18n";
import "./styles.css";

// A phone, or the phone frame inside the docs, gets the demo itself. Anything
// wider gets the documentation page with the demo in a simulated phone.
const demo = isDemoPage();
document.documentElement.dataset.page = demo ? "demo" : "docs";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider persist={!isFramed()}>{demo ? <Demo /> : <Docs />}</LangProvider>
  </StrictMode>
);
