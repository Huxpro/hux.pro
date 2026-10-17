import { createRoot } from "react-dom/client";
import { Wardrobe } from "./Wardrobe";
import { LANG } from "../common/words";
import "../common/styles.css";

document.documentElement.lang = LANG;
createRoot(document.getElementById("root")!).render(<Wardrobe />);
