/** @jsxImportSource reintent-core */
// The Wardrobe's intent tree, as the model first wrote it: an instance file,
// elements and literal props only (test/structure.test.ts holds it to that).
import { Dream, Man, Wardrobe } from "../intents/v1";

export default (
  <Dream key="wardrobe">
    <Man key="man" />
    <Wardrobe key="wardrobe" />
  </Dream>
);
