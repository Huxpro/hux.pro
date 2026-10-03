import type { Locale } from "@/lib/i18n";

// Ask's words, in both languages. Kept with the system, as the labs keep
// theirs, rather than in the site-wide table.

const en = {
  ask: "Ask",
  askRow: "Ask AI",
  askHint: "Ask a question about the site",
  placeholder: "Ask about Hux, his writing, his work…",
  newChat: "New chat",
  model: "Model",
  thinking: "Thinking…",
  steps: "Looked through the site",
  searched: (q: string) => `Searched “${q}”`,
  read: (title: string) => `Read ${title}`,
  results: (n: number) => (n === 1 ? "1 passage" : `${n} passages`),
  noResults: "Nothing matched",
  sources: (n: number) => (n === 1 ? "Used 1 page" : `Used ${n} pages`),
  emptyTitle: "Ask anything about this site",
  welcome: "what would you like to know?",
  emptyHint: "Answers come from the posts, the prompt and the works, with links to where they say it.",
  error: "Something went wrong.",
  retry: "Try again",
  history: "History",
  close: "Close",
  noHistory: "Past conversations show up here. They stay in this browser.",
  deleteChat: "Delete conversation",
  copy: "Copy",
  copied: "Copied",
  regenerate: "Regenerate",
  effort: "Thinking",
  efforts: { low: "Quick", medium: "Balanced", high: "Deep" },
  suggestions: [
    "What is Lynx, and why did Hux build it?",
    "How does Hux think about PWAs?",
    "Which programming languages does Hux find most interesting?",
    "What does Hux believe about open source?",
  ],
};

type AskStrings = typeof en;

const zh: AskStrings = {
  ask: "问答",
  askRow: "问 AI",
  askHint: "就这个网站提一个问题",
  placeholder: "问问黄玄、他的文章、他的作品…",
  newChat: "新对话",
  model: "模型",
  thinking: "思考中…",
  steps: "翻阅了网站",
  searched: (q) => `搜索「${q}」`,
  read: (title) => `阅读《${title}》`,
  results: (n) => `${n} 段`,
  noResults: "没有匹配",
  sources: (n) => `引用了 ${n} 个页面`,
  emptyTitle: "关于这个网站，问什么都行",
  welcome: "想知道些什么？",
  emptyHint: "回答来自文章、Prompt 与作品，并附上出处链接。",
  error: "出了点问题。",
  retry: "重试",
  history: "历史",
  close: "关闭",
  noHistory: "过往的对话会出现在这里，只保存在这个浏览器中。",
  deleteChat: "删除对话",
  copy: "复制",
  copied: "已复制",
  regenerate: "重新生成",
  effort: "思考",
  efforts: { low: "快速", medium: "均衡", high: "深入" },
  suggestions: [
    "Lynx 是什么？黄玄为什么要做它？",
    "黄玄怎么看 PWA？",
    "黄玄觉得哪些编程语言最有意思？",
    "黄玄对开源有什么信念？",
  ],
};

export function askStrings(locale: Locale): AskStrings {
  return locale === "zh" ? zh : en;
}
