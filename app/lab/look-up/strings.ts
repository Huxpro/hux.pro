import type { LabTable } from "@/systems/lab";

// The Wardrobe tells the dream in order. This one keeps a single moment of
// it, the one a child has from the pillow: how tall he was.
const en = {
  title: "Look Up",
  story: [
    "He stood at the head of my bed, looking at me: a man in black, very tall and very thin, with a round hat on his head, like the ones Orthodox Jewish men wear, only much, much bigger.",
    "From a pillow, a man that tall does not end. You see his shoes, then his coat, and his coat, and his coat, and you have to make yourself keep looking.",
    "When I was little he came every few nights. I was so afraid of him.",
  ],
  how: "Drag up · keep going · sound on",
};

const zh: typeof en = {
  title: "抬头",
  story: [
    "他站在我的床头看着我：一个穿黑色衣服、很瘦很高的男人，头上戴着那种像犹太人一样圆圆的大帽子，但比犹太人的帽子大很多。",
    "躺在枕头上看，这么高的人是没有尽头的。先是他的鞋，然后是大衣、大衣、大衣，你得逼着自己继续往上看。",
    "小时候，他老是隔三差五就过来看我。我很害怕他。",
  ],
  how: "向上拖动 · 别停 · 打开声音",
};

export const LOOK_UP_STRINGS: LabTable<typeof en> = { en, zh };
