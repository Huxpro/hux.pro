/** @jsxImportSource reintent-core */
// The tree as the model rewrote it again: whether he is still there is a choice of the tree
// itself (<Choose>), not of a value. Gone, he is not drawn, and nothing about him is read. The
// wardrobe is keyed in both, so its path, and what was decided about it, holds in either.
import { Choose } from "reintent-core/lib/choose";
import { Dream, Man, Wardrobe } from "../intents/v2";

export default (
  <Dream key="wardrobe">
    <Choose
      key="ending"
      name="ending"
      default="waits"
      ask
      label="他还在吗 · is he still there"
      words={{ waits: ["还在", "等着", "waits"], gone: ["不在", "走了", "进去了", "gone"] }}
      alternatives={{
        waits: [<Man key="man" />, <Wardrobe key="wardrobe" />],
        gone: <Wardrobe key="wardrobe" />,
      }}
    />
  </Dream>
);
