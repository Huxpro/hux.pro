import type { LabTable } from "@/systems/lab";

// What this is, in the words beside it. The dream it opens with is the
// model's first tree; Inspect is where another is told.
const en = {
  title: "A Dream, Told",
  story: [
    "I dreamt of him again. At first the wardrobe door was open a crack, and he was inside, looking at me. Then he was standing by the window, his back to me. Then he was at the head of my bed, bending over me, his hat so big it hid half the room.",
    "This one is not drawn by hand. The model read the words and wrote them as a tree: three beats, and in each, where he is, how far the door is open, whether he looks at me, how long it lasts. Where it could not tell (the window, or the foot of the bed?) it said so. The player only plays trees.",
    "Open Inspect and tell it another dream. It becomes another tree, and the same player plays it.",
  ],
  how: "Tap for the next beat · Inspect to tell another",
};

const zh: typeof en = {
  title: "讲一个梦",
  story: [
    "我又梦到他了。一开始，衣柜门开着一条缝，他在里面看着我。然后他站到了窗边，背对着我。最后他站在我床头，弯下腰，帽子大得遮住了半个房间。",
    "这一个不是手画的。模型读了这段话，把它写成一棵树：三幕，每一幕里他在哪、柜门开多大、看不看我、持续多久。它拿不准的地方（窗边，还是床尾？）它会说出来。播放器只负责演树。",
    "打开「检查」，讲另一个梦。它会变成另一棵树，还是这个播放器来演。",
  ],
  how: "轻触，下一幕 · 打开检查，讲另一个梦",
};

export const DREAM_STRINGS: LabTable<typeof en> = { en, zh };
