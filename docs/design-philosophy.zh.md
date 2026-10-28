---
origin: "AI-translated from the original"
---

# 设计理念

hux.pro 为什么看起来、用起来都像一个个人操作系统：几条原则，供一次改动遇到规则没有覆盖的选择时权衡。规则本身（两种声音 Prose 和 System；字体、颜色、玻璃、触摸）见 [Design System](./design-system.md)。这些是判断，不是一次改动能通过或不通过的检查。

首页应当像一个认得你的操作系统，而不是一个推销某个人的页面。站点借鉴了 Apple 的系统（springboard、Spotlight、Live Activities、Liquid Glass、Siri 的光效）、命令启动器，散文部分借鉴安静的个人网站；从营销网站那里，什么都不借。

## 原则

### 1. 先有人，再有结构

来到这个站点应当像见到一个人，而不是翻一份目录：它先说谁在这里，再列出有什么；能知道的事情，不用问它就知道。

- 问候语跟着天色走，而不只是跟着时钟：日出和日落各有一句（`getAmbientGreetingKeyFromPhase`，`systems/ambient/lib/greeting.ts`），壁纸就是本地的天气（`systems/ambient`）。
- 回访的访客会在问候语下方得到一句招呼："Last Read *title*."，或 "Welcome Back"，超过七天则是 "It's Been A While"（`systems/ambient/components/greeting.tsx`）。简短、温和，从不要求回应。
- 新访客由 About 迎接，它是唯一一个不请自来的界面，而且只来一次（`systems/about/provider.tsx`）。

### 2. 对话即导航

命令面板就是四处走动的方式，它既能搜索，也能提问。

- ⌘K 搜索一切；一个问题会变成 Ask，它的工具读取站点内容，并给出命令面板自己的命令（`systems/ask/lib/command-tools.ts`，由 `systems/command/catalog.ts` 生成）。见 [Ask](./system-ask.md)。
- 一个新功能首先是一条命令。页面上的控件是通往它的捷径，而不是唯一入口。

### 3. 键盘优先，拇指同等

在桌面上，站点像 Raycast 或 Spotlight 那样操作；在手机上，像 iOS。哪一边都不是另一边的降级版。

- ⌘K 打开命令面板，`/` 在任何地方打开它的斜杠列表（`systems/command/provider.tsx`）；接着按一个斜杠字母就执行动作（`/` `O` 打开 About，`/` `E` 打开 labs；`systems/command/actions.tsx`）。
- 没有键盘的地方，同一个 `/` 是输入框里的一个 chip（`SlashEntry`，`systems/command/results.tsx`），首页网格的编辑控件移到屏幕底部，也就是拇指所在的地方。

### 4. 流动的边界

文章、演讲、项目和音乐是同一个人的不同侧面，而不是互不相通的房间。

- 首页网格把它们混在一起，每样一个 widget，顺序由访客决定（`app/home-view.tsx`）。
- 一个问题就能覆盖所有这些：Ask 的索引把文章、作品、时期和 prompt 并排收在一起（`AskDocKind`，`systems/ask/lib/corpus.ts`）。

### 5. 生来双语

英文和中文地位相同，不是原文与译文的关系。

- 第一次访问时采用浏览器的语言；之后保留访客的选择（`services/locale.tsx`）。
- 一篇文章可以是英文、中文或两者都有（`content/blog/<slug>.<en|zh>.mdx`），`/writing` 先显示访客所用语言的文章，"All" 只隔一个 chip（`LanguageFilter`，`components/post/post-list.tsx`）。
- 每一个可见的字符串都有两种语言（`lib/i18n.ts`）；只以一种语言发布的 widget、lab 或命令，就是没有完成。

### 6. 渐进展开

先展示一样东西是什么；有人留意时，再展示更多。

- `/writing` 的一行只是标题和日期；指针指向它时，会预览文章的描述、摘录和封面（`components/post/post-peek.tsx`）。
- 设置放在它起作用的地方，而不是放在一个设置页里：全站的设置（主题、玻璃、色调）是命令面板里的命令，一篇文章的字体、字号和栏宽是它的 `Aa`（`components/post/reading-sheet.tsx`）。

### 7. 少，但更好

设计是它如何运作，所以衡量一个标记的标准是它*做了*什么，而不是它看起来怎样。在加一个标签、徽章、箭头或图标之前，先问界面是不是已经说过了。如果说过了，这个标记就是把同一件事再说一遍，那它就该去掉，或者等到有人留意时再出现。

- **每一层只有一种声音。** 机器层是小写等宽字体（`jul 2020`、`retry`、`cd ~`）。大写和字距会在它之上再叠一种机器声音（[Design System](./design-system.md)）。
- **示意等到有人留意时再出现。** widget 本身就是点击目标，露出一角的封面已经说明这一条可以滚动。标题栏的箭头和分页圆点只在指针或焦点落在卡片上时出现，手指按下时从不出现（`WIDGET_REVEAL`，`components/ui/widget.tsx`）。
- **预览只做预览。** 首页卡片完整地说明一样东西是什么，它的行打开完整的条目。外链和附件放在卡片通往的页面上，而不是挤占标题的位置放在卡片上。
- **精选只起作用，不做标注。** `featured` 决定首页卡片展示什么。归档本来就是完整的、按日期排序的，所以不显示徽章（`components/post/post-list.tsx`）。

这里没有去掉任何体验：壁纸、乱码动画（scramble）、预览、theater、音乐、apps 和命令面板都还在。去掉的是把它们重复说一遍的 chrome。

## 避免什么

- 营销的陈设：首屏横幅、社会认同、用户评价、订阅弹窗和 cookie 弹窗。
- 品牌色或强调色。颜色由内容带来（一张壁纸、一个封面）；UI 是灰阶的（[Design System](./design-system.md)）。
- 横贯顶部的导航栏。导航是一次按键，或者悬浮的命令栏。
- 任何不请自来的东西，About 除外，而且只有一次。
- 不解释任何东西的动效（[Motion](./motion.md)）。
