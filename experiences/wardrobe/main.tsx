import { createRoot } from "react-dom/client";
import { Wardrobe } from "./Wardrobe";
import { LANG } from "./words";
import "./styles.css";

document.documentElement.lang = LANG;
createRoot(document.getElementById("root")!).render(<Wardrobe />);
