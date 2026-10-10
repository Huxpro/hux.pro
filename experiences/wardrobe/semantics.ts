import type { LanguageLayer } from "scene";

// The dream as it was told, and what each part of it was taken to mean. The
// refs are the paths the things are declared under (entities.tsx).
export const LANGUAGE: LanguageLayer = {
  prompt: [
    "我梦到一个", ["穿着黑色衣服，很瘦很高的男人", "man"], "站在我的", ["床头", "man[bedside]"], ["看着我", "man.eyes"],
    "。然后", ["他", "man"], "的头上戴着那种像犹太人一样", ["圆圆的大的帽子", "man.hat"], "，但是", ["比犹太人的帽子大很多", "man.hat"],
    "。然后", ["他", "man"], "一开始站在我的", ["衣柜里面", "man[wardrobe]"], "，然后", ["他", "man"], "后来把",
    ["衣柜门打开", "wardrobe.door"], "，走出来站在我的", ["床头", "man[bedside]"], ["看着我", "man.eyes"], "。然后后来",
    ["我醒了", "viewer"], "，醒了之后发现我", ["卧室", "room"], "的", ["柜门确实正在打开", "wardrobe.door.right"], "。",
  ],
  concepts: [
    { words: { zh: "黑衣男人", en: "the man in black" }, kind: { zh: "实体 · 黑衣、很瘦、很高 · “他” ×3", en: "entity · black, thin, tall · “he” ×3" }, ref: "man" },
    { words: { zh: "帽子", en: "the hat" }, kind: { zh: "部位（属于男人）· 圆", en: "part (of the man) · round" }, ref: "man.hat" },
    { words: { zh: "大很多", en: "much bigger" }, kind: { zh: "参数 · 相对常人的比例", en: "param · a ratio to the usual" }, ref: "man.hat", lands: "man.hatScale > 1" },
    { words: { zh: "看着我", en: "looking at me" }, kind: { zh: "关系 · 男人 → 我", en: "relation · the man → me" }, ref: "man.eyes" },
    { words: { zh: "衣柜里面 / 床头", en: "in the wardrobe / at the bed" }, kind: { zh: "位置 → 同一个人的两个实例", en: "places → two instances of one man" }, ref: "man", lands: "man[wardrobe] · man[bedside]" },
    { words: { zh: "衣柜", en: "the wardrobe" }, kind: { zh: "实体", en: "entity" }, ref: "wardrobe" },
    { words: { zh: "衣柜门打开", en: "the door opens" }, kind: { zh: "部位 + 状态变化 · open 0 → 1", en: "part + change of state · open 0 → 1" }, ref: "wardrobe.door", lands: "wardrobe.openLeft · openRight" },
    { words: { zh: "我 / 醒了", en: "I / woke" }, kind: { zh: "视角 + 事件 · 不在画面里", en: "point of view + event · not in the picture" }, ref: "viewer" },
  ],
};
