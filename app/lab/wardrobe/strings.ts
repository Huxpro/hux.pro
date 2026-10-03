import type { LabTable } from "@/systems/lab";

// The dream, as I remember it. The experience beside it says the same
// thing without words; this is the version with them.
const en = {
  title: "The Wardrobe",
  story: [
    "I dreamt of a man in black, very tall and very thin, standing at the head of my bed, looking at me. On his head was one of those round hats, like the ones Orthodox Jewish men wear, only much, much bigger.",
    "At first he was standing inside my wardrobe. Then he opened its door, stepped out, and stood at my bed, looking at me.",
    "Then I woke up. The door of the wardrobe in my bedroom really was opening.",
    "It was a nightmare I knew. When I was little I saw this man in black all the time; every few nights he came to look at me. I was so afraid of him.",
  ],
  how: "Hold to close your eyes · three times · sound on",
};

const zh: typeof en = {
  title: "衣柜",
  story: [
    "我梦到一个穿着黑色衣服、很瘦很高的男人，站在我的床头看着我。他头上戴着那种像犹太人一样圆圆的大帽子，但比犹太人的帽子大很多。",
    "他一开始站在我的衣柜里面。后来他把衣柜门打开，走出来，站在我的床头看着我。",
    "后来我醒了。醒了之后发现，我卧室的柜门确实正在打开。",
    "这是一个噩梦。小时候我经常看到这个黑衣男人，他老是隔三差五就过来看我。我很害怕他。",
  ],
  how: "按住，闭上眼睛 · 三次 · 打开声音",
};

export const WARDROBE_STRINGS: LabTable<typeof en> = { en, zh };
