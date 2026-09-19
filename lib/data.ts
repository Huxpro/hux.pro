import { type BlogPost, type LocalizedContent } from "./content";

// Re-export types
export type { BlogPost };

// Blog post metadata for command palette search (extends LocalizedContent with date/tags)
export interface BlogPostMeta extends LocalizedContent {
  date: string;
  tags?: string[];
}

export interface TalkData {
  id: string;
  title: string;
  titleZh?: string;
  event: string;
  date: string;
  location: string;
  video?: string;
  slides?: string;
  description?: string;
  descriptionZh?: string;
}

// Static data for client-side search in command palette
// This mirrors the MDX frontmatter for quick access without fs
export const blogPosts: BlogPostMeta[] = [
  {
    slug: "js-20yrs-preface",
    language: "zh",
    title: "《JavaScript 二十年》推荐语",
    date: "2021-04-10",
    description: "",
    tags: ["Web", "JavaScript"],
  },
  {
    slug: "reflection-2020",
    language: "zh",
    title: "作为一个前端，看不懂@黄玄 的几乎每一个回答，只有我自己吗？",
    description: "Taking this chance to reflect on myself",
    date: "2020-07-05",
    tags: ["知乎", "Meta"],
  },
  {
    slug: "react-hooks-vue-composition",
    language: "zh",
    title: "React Hooks 是否可以改为用类似 Vue 3 Composition API 的方式实现？",
    description: "Thinking in React vs. Thinking in Vue",
    date: "2020-04-03",
    tags: ["知乎", "Web", "React"],
  },
  {
    slug: "is-pwa-dead-in-2019",
    language: "zh",
    title: "2019 年 PWA(Progressive Web App) 凉了吗？",
    description: "Is PWA effectively dead in 2019?",
    date: "2019-11-19",
    tags: ["知乎", "Web", "PWA"],
  },
  {
    slug: "vim-from-finder",
    language: "zh",
    title: "把「终端下的 Vim」作为 macOS Finder 的打开方式",
    description: "Open file with terminal Vim from the macOS Finder",
    date: "2019-09-03",
    tags: ["Vim"],
  },
  {
    slug: "vim-cn-im",
    language: "zh",
    title: "Vim 与中文输入法",
    description: "Using Vim with non-english input method",
    date: "2018-10-06",
    tags: ["Vim"],
  },
  {
    slug: "avoiding-success-at-all-cost",
    language: "en",
    title: "Avoiding success at all cost",
    description:
      'Watching "Escape from the Ivory Tower: The Haskell Journey"',
    date: "2018-09-27",
    tags: ["Haskell", "笔记", "En"],
  },
  {
    slug: "dreamer",
    language: "zh",
    title: "程序员中的梦想家",
    description: "Dreamers among programmers",
    date: "2018-06-30",
    tags: ["Facebook", "Meta"],
  },
  {
    slug: "pwa-zh-preface",
    language: "zh",
    title: "《PWA 实战》推荐序",
    date: "2018-05-11",
    description: "",
    tags: ["Web", "PWA"],
  },
  {
    slug: "halting-problem",
    language: "zh",
    title: "如何通俗地解释停机问题？",
    description: "How to explain the Halting Problem?",
    date: "2017-12-12",
    tags: ["知乎", "计算理论"],
  },
  {
    slug: "uncomputable-funcs",
    language: "zh",
    title: "如何证明不可计算的函数比可计算的函数多？",
    description: "Why is there more uncomputable functions?",
    date: "2017-12-12",
    tags: ["知乎", "计算理论"],
  },
  {
    slug: "css-complaints",
    language: "zh",
    title: "为什么 CSS 这么难学？",
    description: "Why I dislike CSS as a programming language",
    date: "2017-10-06",
    tags: ["Web", "CSS", "知乎"],
  },
  {
    slug: "farewell-flash",
    language: "zh",
    title: "Farewell, Flash. 感谢你，但这一次是真正的永别。",
    description: "So long, and thanks for all the Flash",
    date: "2017-07-26",
    tags: ["Web", "Flash"],
  },
  {
    slug: "upgrading-eleme-to-pwa",
    language: "both",
    title: "Upgrading Ele.me to Progressive Web App",
    titleZh: "饿了么的 PWA 升级实践",
    description: "饿了么的 PWA 升级实践",
    descriptionZh: "Upgrading Ele.me to Progressive Web App",
    date: "2017-07-12",
    tags: ["Web", "PWA"],
  },
  {
    slug: "sw-precache",
    language: "en",
    title: "How does SW-Precache works?",
    date: "2017-05-28",
    description: "",
    tags: ["Web", "PWA", "En"],
  },
  {
    slug: "html-document",
    language: "zh",
    title: "如何理解 document 对象是 HTMLDocument 的实例？",
    description: "Why is document an instance of HTMLDocument?",
    date: "2017-04-06",
    tags: ["Web", "知乎"],
  },
  {
    slug: "nextgen-web-pwa",
    language: "zh",
    title: "下一代 Web 应用模型 —— Progressive Web App",
    description:
      "The Next Generation Application Model For The Web - Progressive Web App",
    date: "2017-02-09",
    tags: ["Web", "PWA"],
  },
  {
    slug: "wechat-miniapp-ux",
    language: "zh",
    title: "如何客观地评价「小程序」的体验?",
    description: "Wechat Mini-Program vs. the Web, a UX comparison",
    date: "2017-01-09",
    tags: ["Web", "微信", "UX/UI"],
  },
  {
    slug: "the-open-web",
    language: "zh",
    title: "Web 在继续离我们远去",
    description: "After the release of Wechat Mini-Program",
    date: "2016-09-22",
    tags: ["Web", "微信"],
  },
  {
    slug: "React-vs-Angular2",
    language: "zh",
    title: "React vs Angular 2：冰与火之歌",
    description: "React versus Angular 2: There Will Be Blood",
    date: "2016-02-01",
    tags: ["Web", "JavaScript", "译"],
  },
  {
    slug: "ios9-safari-web",
    language: "zh",
    title: "iOS 9，为前端世界都带来了些什么？",
    description:
      "iOS 9, Safari and the Web: 3D Touch, new Responsive Web Design, Native integration and HTML5 APIs",
    date: "2015-12-15",
    tags: ["Web", "译"],
  },
  {
    slug: "how-designer-learn-fe",
    language: "zh",
    title: "设计师如何学习前端？",
    description: "How designers learn front-end development?",
    date: "2015-10-28",
    tags: ["知乎", "Web", "UX/UI"],
  },
  {
    slug: "js-version",
    language: "zh",
    title: "ES5, ES6, ES2016, ES.Next: JavaScript 的版本是怎么回事？",
    description:
      "ES5, ES6, ES2016, ES.Next: What's going on with JavaScript versioning?",
    date: "2015-09-22",
    tags: ["Web", "JavaScript", "译"],
  },
  {
    slug: "alitrip-strategy",
    language: "zh",
    title: "聊聊「阿里旅行 · 去啊」",
    description: "聊聊在线旅行行业与老东家的产品思路",
    date: "2015-06-15",
    tags: ["产品", "阿里"],
  },
  {
    slug: "see-u-ali",
    language: "zh",
    title: "See you, Alibaba ",
    description: "再见，阿里。",
    date: "2015-05-11",
    tags: ["Meta", "阿里"],
  },
  {
    slug: "os-metro",
    language: "zh",
    title: "hUX 随想录（二）：操作系统的浪漫主义 —— Metro 篇",
    description: "信息、载体、抽象、UI 设计乱谈",
    date: "2015-04-15",
    tags: ["hUX 随想录", "UX/UI"],
  },
  {
    slug: "unix-linux-note",
    language: "zh",
    title: "Unix/Linux 扫盲笔记",
    description: "不适合人类阅读，非常水的自我笔记",
    date: "2015-04-14",
    tags: ["笔记"],
  },
  {
    slug: "digital-native",
    language: "zh",
    title: "hUX 随想录（一）：Digital native 数字原住民",
    description: " 两岁的侄女天天叫着手机手机 ",
    date: "2015-03-25",
    tags: ["hUX 随想录", "UX/UI"],
  },
  {
    slug: "hello-2015",
    language: "zh",
    title: "Hello 2015",
    description: '"Hello World, Hello Blog"',
    date: "2015-01-29",
    tags: ["Meta"],
  },
  {
    slug: "wechat-block-kuaidi",
    language: "zh",
    title: "如何看待微信屏蔽快的打车事件？",
    description: "恰有小感。",
    date: "2014-12-13",
    tags: ["知乎", "产品"],
  },
  {
    slug: "responsive-web-design",
    language: "zh",
    title: "你们觉得响应式好呢，还是手机和PC端分开来写？",
    date: "2014-11-20",
    description: "",
    tags: ["知乎", "Web"],
  },
  {
    slug: "why-alibaba-ux-sucks",
    language: "zh",
    title: "为什么阿里系软件体验都不好？",
    description: "或许这就是所谓的企业 DNA ",
    date: "2014-10-01",
    tags: ["知乎", "产品", "阿里"],
  },
  {
    slug: "is-pure-android-better",
    language: "zh",
    title: "对中国用户而言，Pure Android 是否比 MIUI 或 Flyme 体验更好？",
    date: "2014-09-04",
    description: "",
    tags: ["知乎", "产品", "UX/UI"],
  },
  {
    slug: "miui6",
    language: "zh",
    title: "如何评价 MIUI 6？",
    date: "2014-08-16",
    description: "",
    tags: ["知乎", "产品", "UX/UI"],
  },
];

export const talks: TalkData[] = [
  {
    id: "gosim-2026-vibe-native",
    title: "Why AI Agents Deserve a Better App Framework",
    titleZh: "为什么 AI Agent 配得上更好的应用框架",
    event: "GOSIM Paris 2026",
    date: "2026-05-05",
    location: "Paris, France",
    slides:
      "https://paris2026.gosim.org/schedule/vibe-native-for-more-why-ai-agents-deserve-a-better-app-framework/",
    description:
      "Why AI agents deserve a better app framework — Lynx, and three principles for AI-native infra.",
    descriptionZh:
      "为什么 AI Agent 配得上更好的应用框架——Lynx，以及 AI 原生基建的三条原则。",
  },
  {
    id: "react-summit-2025-unlock-native",
    title: "Lynx: Unlock Native for More",
    titleZh: "Lynx: Unlock Native for More",
    event: "React Summit",
    date: "2025-06",
    location: "Amsterdam, Netherlands",
    video: "https://youtu.be/l2dByiwiQcM",
    description:
      "What makes Lynx familiar and what sets it apart: dual-threaded design, instant launch, silky interaction.",
    descriptionZh:
      "Lynx 为何既熟悉又与众不同：双线程架构、瞬时启动、丝滑交互。",
  },
  {
    id: "reactconf-2021-memo",
    title: "React without a Memo",
    titleZh: "React without a Memo",
    event: "React Conf 2021",
    date: "2021-09",
    location: "Online",
    video: "https://youtu.be/lGEMwh32soc",
    description:
      "Introducing React Forget — write React without useMemo and useCallback.",
    descriptionZh: "介绍 React Forget——不用手写 useMemo / useCallback 的 React。",
  },
];
