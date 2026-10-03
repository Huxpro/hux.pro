import type { LabTable } from "@/systems/lab";

// The Wardrobe tells the dream in order. This one keeps the feeling it left
// in the years around it: being looked at, and never catching him at it.
const en = {
  title: "Torch",
  story: [
    "A man in black, very tall and very thin, with a round hat far bigger than any hat should be. He stood in my wardrobe; he opened its door and came out and stood at my bed, looking at me. When I woke, the wardrobe door really was opening.",
    "When I was little I saw him all the time; every few nights he came to look at me. You cannot catch someone like that with a torch. Wherever the light goes, he has just gone, and the door you are not looking at is the one that opens.",
    "I was so afraid of him.",
  ],
  how: "Drag to shine · find him · sound on",
};

const zh: typeof en = {
  title: "手电",
  story: [
    "一个穿黑色衣服、很瘦很高的男人，戴着一顶大得不像话的圆帽子。他站在我的衣柜里；他把衣柜门打开，走出来，站在我的床头看着我。醒了之后，衣柜门确实正在打开。",
    "小时候我经常看到他，他隔三差五就来看我。这样的人，是拿手电照不到的。光照到哪里，他刚好就不在那里；而你没在看的那扇门，正是会打开的那扇。",
    "我很害怕他。",
  ],
  how: "拖动照亮 · 找到他 · 打开声音",
};

export const TORCH_STRINGS: LabTable<typeof en> = { en, zh };
