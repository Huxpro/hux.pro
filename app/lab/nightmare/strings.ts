import type { LabTable } from "@/systems/lab";

const en = {
  // Navigation & Header
  title: "Nightmare Lab",
  tagline: "The Tall Man by the Bedside",
  modeExperience: "Experience",
  modeWorkbench: "Workbench",
  restart: "Relive",
  soundOn: "Sound On",
  soundOff: "Muted",

  // Act 1: The Wardrobe
  act1Title: "I. The Slit in the Dark",
  act1Description: "A dark bedroom. Across from the bed, the wardrobe door stands ajar in deep shadows...",
  act1Prompt: "Slide or tap to open the wardrobe door",

  // Act 2: The Tall Man
  act2Title: "II. Looming Over the Bed",
  act2Description: "He steps out. Impossibly tall and slender, draped in black, crowned by an immense flat circular brim, staring right down at you.",
  act2Prompt: "Hold to shut your eyes & break the paralysis",
  act2Progress: "Waking up...",

  // Act 3: The Awakening
  act3Title: "III. Waking Dread",
  act3DreamNote: "You snap awake in a cold sweat. It was just a nightmare...",
  act3Realization: "...but in the stillness of your bedroom, the wardrobe door is actually opening.",
  act3Memory: "“When I was a child, he came to watch me every few nights. I was terrified of him.”",
  act3Action: "Relive the Nightmare",

  // Panel & Knobs
  sceneKnobs: "Nightmare Dynamics",
  act: "Current Act",
  acts: {
    act1: "1 · Wardrobe",
    act2: "2 · The Gaze",
    act3: "3 · Reality",
  },
  hatSize: "Hat Brim Width",
  slenderness: "Figure Height & Slenderness",
  ambientLight: "Ambient Darkness",
  heartbeatBpm: "Heartbeat Rate (BPM)",
  doorAngle: "Wardrobe Opening Angle",
  cameraPerspective: "Bedside Camera Tilt",
  soundToggle: "Synthesizer Audio",
  narrativeNotes: "Dream Memory",
  narrativeMemoryText:
    "An interactive capture of a recurring childhood sleep-terror. A towering black-clad figure emerges from the wardrobe, watching silently over the bed. The terror reaches its peak when waking up reveals the bedroom door is indeed opening.",
};

const zh: typeof en = {
  // Navigation & Header
  title: "噩梦实验室",
  tagline: "床头的黑衣男人",
  modeExperience: "沉浸体验",
  modeWorkbench: "参数调试",
  restart: "重新入梦",
  soundOn: "声音开启",
  soundOff: "静音",

  // Act 1: The Wardrobe
  act1Title: "一 · 门缝里的阴影",
  act1Description: "深夜的卧室。正对着床铺的衣柜，门虚掩着，隐匿在一片漆黑里……",
  act1Prompt: "滑动或点击拉开柜门",

  // Act 2: The Tall Man
  act2Title: "二 · 床头的凝视",
  act2Description: "他从衣柜里走了出来。身着黑衣，极瘦极高，头顶戴着大得惊人的圆平礼帽，居高临下直勾勾看着床头的你。",
  act2Prompt: "长按闭上眼睛，挣扎醒来",
  act2Progress: "正在惊醒……",

  // Act 3: The Awakening
  act3Title: "三 · 惊醒与现实",
  act3DreamNote: "你猛地从梦魇中挣脱出来。长舒一口气，以为只是个梦……",
  act3Realization: "……然而黑暗中，你卧室里的衣柜门，正悄无声息地真正敞开。",
  act3Memory: "“小时候他隔三差五就过来看我，我很害怕他。”",
  act3Action: "重新入梦",

  // Panel & Knobs
  sceneKnobs: "噩梦参数调控",
  act: "当前阶段",
  acts: {
    act1: "1 · 衣柜门缝",
    act2: "2 · 黑衣凝视",
    act3: "3 · 现实惊悚",
  },
  hatSize: "黑色礼帽宽度",
  slenderness: "黑衣人身高与瘦削度",
  ambientLight: "暗室光照级别",
  heartbeatBpm: "心跳速率 (BPM)",
  doorAngle: "衣柜开门角度",
  cameraPerspective: "床头视线倾角",
  soundToggle: "过程合成音效",
  narrativeNotes: "梦境记忆",
  narrativeMemoryText:
    "基于童年反复出现的真实噩梦重塑：一个极高极瘦、戴着巨型圆平礼帽的黑衣男人从衣柜走出伫立床头。最强烈的恐惧在于：醒来之后，发现卧室的柜门确实正在打开。",
};

export const NIGHTMARE_STRINGS: LabTable<typeof en> = { en, zh };
