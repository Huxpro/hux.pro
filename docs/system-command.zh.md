---
origin: "AI-translated from the original"
---

# 命令系统

⌘K：站内的命令面板，灵感来自 Spotlight、Raycast 和 VS Code。一份命令列表，
有四个入口（搜索结果行、斜杠列表、单个字母、Ask 的工具），外加一个应用启动器、
一个语音输入框，以及打开它的浮动按钮。代码在 `systems/command/`。

## 做好了是什么样

桌面上是 popover：一张玻璃卡片，位于屏幕上三分之一处。最前面是应用条，然后是
Navigation、Actions 和 Settings，最后是 Writing。每一行有斜杠字母的都会显示出来；
底栏教你按键。

![桌面上的 popover：搜索框带着麦克风和 Ask AI tab 提示，应用条以一个虚线的 Load 图块结尾，Navigation 各行带着字母 H U X P O，底栏是按键提示。](/img/docs/system-command/palette-desk.png)

1280×860，在首页按 ⌘K 打开面板。字母在每一行的末端；输入框的末端是麦克风和
`Ask AI tab`；首页的搜索栏和 Ask 小球露在卡片下方。

手机上是 sheet。内容一样，变的只是外框。子模式是叠在面板上的第二个 sheet，
而不是原地换掉内容。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-command/palette-phone.png" style={{ width: "calc(33.3% - 0.67rem)", margin: 0 }} alt="手机 sheet 形态的面板，停在较低的 detent：输入框带着麦克风和斜杠按钮，应用条露出五个图块和第六个的一角，Navigation 各行没有字母。" />
  <img src="/img/docs/system-command/slash-phone.png" style={{ width: "calc(33.3% - 0.67rem)", margin: 0 }} alt="叠在面板上的斜杠 sheet：面板的顶边从上方露出来；Navigation 和 Actions 各行，没有字母。" />
  <img src="/img/docs/system-command/bundle-phone.png" style={{ width: "calc(33.3% - 0.67rem)", margin: 0 }} alt="叠在面板上的 Load bundle sheet：高度只够放一行提示、一个 URL 输入框和一个 Open 按钮；面板在它后面变暗、退后。" />
</div>

iPhone 15 Pro 视口，无头浏览器（没有键盘，安全区 inset 为零）。左：面板停在
十分之七高度；没有字母，因为没有键盘，输入框里显示的是斜杠按钮。中：斜杠 sheet，
与面板的 detent 齐平，面板的顶边从上方露出。右：bundle sheet，高度刚好装下它的表单。

输入时每个分组都原地过滤；没有剩余结果的分组会隐藏。

![输入了 "wall" 的 popover：应用条消失了，Settings 显示 Wallpaper 和 Tint，Writing 显示按正文匹配到的文章。](/img/docs/system-command/search-query.png)

`wall`：没有应用匹配，所以应用条消失了；Wallpaper 按名字匹配，Tint 按它的关键词
`wallpaper colour` 匹配；下面的文章是按描述或正文匹配到的，不是按标题。Ask 行
（`Ask AI: wall`）在列表末尾，这里看不到；如果输入读起来像个问题，它会排到最前面。

## 原理

```
systems/command/
├── provider.tsx        # CommandProvider / useCommand: open, modes, Ask placement, global keys
├── ask-state.ts        # The pure state machine behind the palette and Ask sharing a room
├── palette.tsx         # CommandPalette: picks the shell (sheet or popover)
├── sheet.tsx           # The phone shell: SurfaceSheet with detents, sub-modes as nested sheets
├── popover.tsx         # The desk shell: a draggable Spotlight card that morphs between modes
├── catalog.ts          # COMMAND_CATALOG: titles, model-facing descriptions, targets, policy
├── actions.tsx         # useCommandActions (the one implementation list), CommandKind, shell context
├── results.tsx         # Search results, the Ask row, the slash list; shared by both shells
├── search-filter.ts    # The palette's one scoring policy (tested by pnpm command:test)
├── apps-launcher.tsx   # CommandAppsStrip: the horizontal apps strip and its Load tile
├── load-bundle-panel.tsx  # LoadBundlePanel: the OTA Lynx bundle URL form
├── voice.tsx           # Voice in the field: the microphone, Space-to-talk, / V
├── fab.tsx             # FloatingActionButton: the search bar / round button and the Ask ball
├── use-compact-viewport.ts  # Below Tailwind md (767px): the strip's pitch, the FAB's layout
└── index.ts            # Barrel exports
```

### 一个命令，四个入口

一个命令是 `catalog.ts` 里的一个条目（它是什么，写给人看，也写给模型看），加上
`useCommandActions()` 里的一个条目（它做什么）。搜索结果行、斜杠列表、斜杠字母和
Ask 的 `command_<id>` 工具，最后都走到同一个 `run`。

![catalog 生成 Ask 的命令工具，经由 executeAskCommand 和 Ask host 走到 CommandAction.run；以 catalog 为类型约束的 useCommandActions 提供搜索结果行和斜杠列表，经由 useRunCommand 走到同一个 run，然后按命令的 kind 决定面板如何退场。](/img/docs/system-command/pipeline.svg)

左边这条路从不让模型决定策略：`executeAskCommand` 会把以下情况都变成一张确认卡片：
没有被明确要求的、不在可见对话里的、受 `user-gesture` 策略约束的，或者缺少目标的。
右边这条路只决定面板之后做什么，依据是命令的 `kind`。

`CommandAction.id` 的类型是 `CommandId`，所以一个没有 catalog 条目（因而没有描述）
的命令过不了类型检查。catalog 里的标题是 Ask 卡片上显示的；一行的 `label` 是面板
自己的，通常带着当前值（`Appearance: Follow the Sun`）。

### 命令，以及面板之后做什么

`useCommandActions()` 返回 19 个命令（Voice 只在支持语音识别时出现，Install 只在
网站尚未安装时出现）。每个命令带一个 `kind`：

| Kind | 作用 | 从搜索触发之后 | 从斜杠列表触发之后 |
|------|------|--------------------|----------------------------|
| `navigate` | 跳转到别处 | 关闭 | 关闭 |
| `surface` | 打开一个二级 surface | popover 关闭；sheet 留在它后面 | 同左 |
| `toggle` | 切换一个设置 | 保持打开，让新值显示出来 | 关闭 |
| `stay` | 改变面板正在做的事（Voice、Ask） | 保持打开 | 保持打开 |

这张表在 `useRunCommand()(action, origin)` 里，`origin` 为 `"search"` 或
`"slash"`；外壳通过 `useCommandShell()` 提供 `leave(kind)`，列表自己从不调用
`close`。有两个 kind 是仔细选过的：About 是 `navigate` 而不是 `surface`，因为留在
后面的 sheet 会透过 About 的遮罩显出来；Devtool 在关闭时是 `surface`（打开它会弹出
一个抽屉），打开后是 `toggle`。

三个标记决定一个命令出现在哪里：

- `section`：`navigation`、`actions`（一件马上做的事：Voice、Ask、Music、
  Install、Sky Window）或 `settings`（一个会保留的值）。面板的分组按这个顺序排列。
- `slashOnly`：只在斜杠列表里，从不作为搜索结果行，因为它的控件已经在屏幕上了
  （Voice：输入框的麦克风；Ask：Ask 行和 Tab 提示）。
- `searchOnly`：能搜到，但不主动展示。不在面板打开时的列表里，也不在斜杠列表里；
  匹配它的查询（`lab`、`实验`）会把它带出来，它的字母也照样能运行它。Labs 和
  Sky Window 属于这一类。只能用键盘的命令（Docs）更低调一步：没有 `label`，所以
  哪里都没有它的行，只有 `/` `I`。

### 两种外壳

`palette.tsx` 按断点声明外壳，用的是 surface 系统的断点（`useBreakpointValue`、
`SURFACE_BREAKPOINTS`），所以面板和所有二级 surface 在同样的宽度变形，而不必假装
自己是一个 `AdaptiveSurface`：

| 视口 | Devtool 的 **Phone palette** | 外壳 | 位置 |
|----------|---------------------------|-------|-------|
| `sm`（640px）以下 | Sheet（默认） | **Sheet**：`SurfaceSheet`，`SHEET_DETENTS`（`[0.7, 1]`） | `sheet.tsx` |
| `sm` 以下 | Popover | **Popover** | `popover.tsx` |
| `sm` 及以上 | 任意 | **Popover**：居中的 Spotlight 卡片，可拖动 | `popover.tsx` |

devtool 里这一项是一个保存下来的设置（`phonePalette`），它把
`COMMAND_PRESENTATION`（`{ base: "sheet", sm: "popover" }`）换成
`POPOVER_PRESENTATION`（`{ base: "popover" }`）：只有一张 presentation 映射，
没有第二条代码路径。两种外壳用同一份命令列表渲染同样的内容（`results.tsx`）；
外壳只决定外框，以及面板如何退场。

#### Sheet

和壁纸选择器、播放列表是同一种 sheet，只是标题栏的位置放的是搜索框。它打开时占
屏幕的十分之七；拖动或点一下输入框会把它带到顶部（`onFieldTap`），就像 Maps 的
sheet 在点搜索框时会长高一样，好让键盘下方留出最大的空间。把它拖回顶部以下会让
输入框失焦，免得较低的 detent 一半藏在键盘后面。

启动器不是二级 surface，所以这个 sheet 是 `modal`：它在的时候页面不响应操作，
点一下页面就会关掉它，就像点页面会关掉 popover 一样。

**叠放。** 在手机上，`surface` 命令（壁纸选择器）不会关闭面板。面板留着并退后一层，
选择器从它上面升起（这是 surface 栈做的；如果是从子模式 sheet 里打开，面板退后两层），
关掉选择器后面板又回到前面。只有键盘会收起。在桌面上 popover 会关闭。

**子模式是嵌套的 sheet。** 面板有两个子模式，互斥（`provider.tsx` 里的
`isSlashCommandsMode` / `isLoadBundleMode`）。每个都是做完就回到面板的任务，所以在
手机上每个都是叠在面板上的第二个 sheet，就像 iOS 从一个 sheet 上再弹出一个 sheet。

| 子模式 | Sheet | 高度 | 进入方式 | 离开方式 |
|----------|-------|--------|------------|-----------|
| 斜杠命令 | `command-slash` | 与面板的 detent 齐平 | `/` 按钮、空输入框里的 `/`、任何输入框之外的 `/` | 关闭、向下拖、点面板、执行一个命令、Backspace |
| Load bundle | `command-bundle` | 内容高度（`fitContent`） | 应用条的 Load 图块（`openLoadBundle()`） | 关闭、向下拖、点面板、Open |

两个 header（`SubModeHeader`）形状一样：一个图标、标题，以及一个退回上一层的出口；
面板自己的关闭按钮留在面板上。两者都是面板 sheet 的 React 子元素
（`nestedIn="command"`），所以 Base UI 把它们当作嵌套的 sheet，在其中一个打开时禁用
父级的滑动，Escape 一次只弹出一层。斜杠 sheet 与面板齐平（`detentHeight(detent)` +
`level={detent}`，在进入时读一次），这样它的列表正好接着面板的列表往下。bundle sheet
的高度只够放一行提示、一个输入框和一个按钮，并停在为它的输入框弹出的键盘上
（`--drawer-keyboard-inset`，在 `SurfaceSheet` 里统一处理）；
`LoadBundlePanel chrome="sheet"` 去掉了面板自己的返回箭头和标题，因为 sheet 的
header 已经有了。

**输入框的末端。** 两种外壳都一样：先是麦克风，然后是 `Ask AI tab`（有键盘时）或者
斜杠按钮（没有键盘时，并且只在输入框为空时出现，而这恰好就是输入 `/` 能起作用的
时候）。这个按钮就是可以按的提示：同样的 kbd 样式，加上边框和适合手指的点击区域。

**键盘提示**（行字母、底栏、`esc`、Tab 提示）跟随输入设备，而不是外壳：
`useShowKeyboardHints()` 读取 `services/input-capability` 里的
`hasFineHoverPointer`。桌面会显示；接上触控板的 iPad 也会立刻显示；手机和不带
外设的 iPad 不显示，无论哪种外壳。

sheet 怎样遇上软键盘（16px 输入框、inset、不自动聚焦）见
[在手机上打字](./keyboard-input.md)。

#### Popover

一张居中的卡片，位置比 Spotlight 略低（`--command-palette-offset`：
`min(22vh, 13.5rem)`），可通过 `useDraggable("command-palette")` 拖动，点页面就
关闭。它在一张卡片里在四种模式之间变形，通过动画改变宽度、header 和底栏，而不是
直接替换：

| 模式 | 卡片宽度 | 内容 |
|------|-----------|------|
| 搜索 | 700px | `CommandResults`，列表上限为 `min(40rem, 43dvh, …)` |
| 斜杠 | 400px | `CommandSlashList`，没有 `43dvh` 上限，卡片会长高以放下整个列表 |
| Load bundle | 440px | `LoadBundlePanel`，带着它自己的返回箭头和标题 |
| Ask | 700px，带历史侧栏时 960px | `AskChat`（[Ask](./system-ask.md)） |

在 16 英寸笔记本上，搜索列表的上限让 Geolocation 成为最后一个完整显示的行。
Ask 停靠在侧边时，卡片在剩下的空间里居中，点击外部关闭的范围止于侧边面板。

popover 保留了针对 iOS Safari 的适配，以手机（`/iPhone|iPod/`）而不是 iOS 为条件，
用于 devtool 把它放到手机上的情况：页面固定在当前滚动位置（`absolute`、
`top: scrollY`、body overflow hidden），打开时不聚焦输入框，背景在 pointer-down 时
就关闭。iPad 上的 Safari 按桌面处理。

### 搜索

列表由 cmdk 负责；`usePaletteFilter` 负责打分。

- **打分策略**是 `search-filter.ts` 里的 `scorePaletteItem`。一行的身份（它的 value
  去掉内部的 `app-` / `blog-` 前缀，加上它的主要关键词）做模糊匹配。用
  `detailKeywords` 包起来的辅助文本（命令关键词、文章描述和标签）在单个拉丁字母的
  查询下会被忽略，这样 `p` 不会把描述里恰好有个 `p` 的东西都翻出来。用
  `exactKeywords` 包起来的类别词（`app`、`apps`、`post`、`lynx`、`文章`…）只在
  整个查询正好是它时才匹配，所以 `app` 会列出所有应用，而 `p` 不会仅仅因为应用的
  value 是 `app-…` 就匹配到应用。
- **按正文找文章。** 查询满两个字符后，Ask 的搜索索引（`systems/ask/lib/search`）
  会加载；正文匹配而标题不匹配的文章也会显示，分数为 `0.05`。
- **Ask 行**只要输入框里有文字就在。读起来像问题的查询（`isQuestionLike`，
  `systems/ask/lib/intent`）会把它排到最前，并在下一帧选中它（`usePaletteSelection`），
  于是按 ↵ 就是提问；否则它排在最后，用 ↓ 或 Tab 可以到达。在输入框里按 Tab 总是
  带着已输入的内容进入 Ask。

### 应用条和 Load bundle

当 Window 系统挂载时，第一个分组是一条没有标题、可横向滚动的应用条，列出
`content/apps.json` 里的每个应用（完整目录，包括首页文件夹略去的 `featured: false`
应用，比如 BusyWeek 和 Cat Wand），用共享的 `AppTile` 以 `md`（48px）尺寸绘制。
浏览和搜索时它看起来一样：它用同一个打分器过滤自己的图块，没有匹配时隐藏。在
Tailwind `md` 以下，列间距大约是 5.3 个图块宽，所以 iPhone 上显示五个和第六个的一角。

最后一个图块 **Load…** 打开 bundle 表单（`openLoadBundle()`）：一个 URL 输入框
（`http(s)://` 或站内路径），一个 Open 按钮。Open 调用
`windows.openBundleUrl(url)`，整个面板随之退场。

### 语音

输入框末端那组按钮里的麦克风会把语音输入到输入框里（`useCommandVoice`，基于
`systems/voice`）。三个入口都在面板内部，所以不会和系统的听写按键冲突：

| 方式 | 手势 |
|-----|---------|
| 麦克风 | 浏览器识别：点一下开始听，直到停顿；Gateway 模型：点一下开始录音，再点停止，或者按住再松开 |
| `/` `V` | 点一下开始；按住 `HOLD_MS`（300ms）或更久，松开即停止 |
| 空输入框里的空格 | 按住说话，松开停止；单击不起作用 |

听到的内容会变成一个查询（`toFieldText`："go to the writing" → `writing`），除非它
读起来像个问题，那样就整句放进去交给 Ask。监听时，输入框边缘显示站内的光晕
（`Glow`，`shape="line"`）或者一条波形，取决于语音视觉效果的偏好设置。

### 浮动按钮

`FloatingActionButton` 是始终在屏幕上的入口，旁边是 Ask 小球。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-command/fab-phone-home.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的首页：底部居中是一条宽的 Search 栏，右边是圆形的 Ask 小球。" />
  <img src="/img/docs/system-command/fab-phone-page.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的 Writing 页面：右下角是一个圆形的命令按钮，Ask 小球叠在它上方。" />
</div>

在首页它是一条搜索栏（`Search`；从 `md` 起是 `Search or / for commands` 加一个
`⌘K` 标签），小球在它右边。在其他页面它变形为末端的一个 48px 圆形按钮（从 `md`
起是一个写着 ⌘ K 的胶囊），小球在它左边，在 `md` 以下则在它上方。桌面上的形态就在
第一张截图里卡片的下方。

- 按一下切换面板。小球打开或关闭 Ask（`K` 也一样），Ask 打开时小球亮起。
- 按住按钮 1.2 秒会唤出 devtool；0.7 秒后出现一个圆环。
- 离开首页后，在它的拖动设置打开时可以拖动（`useDraggable("command-fab")`）。
- 在手机上，编辑首页网格时它会淡出，把屏幕底部让给编辑控件。
- Ask 停靠在侧边时，它向左移动面板的宽度。

## 约束

| 约束 | 原因 | 打破之后 |
|------|-----|-------------|
| 每个命令都有一个 `COMMAND_CATALOG` 条目，带描述和 `policy.execution` | Ask 的工具、卡片和 benchmark 都由它生成；`CommandAction.id` 的类型以它为准 | 类型检查失败；或者出现一个 Ask 无法描述的命令 |
| 命令的行为只存在于 `useCommandActions` 里它的 `run` 中 | 面板和 Ask 必须做完全相同的事 | Ask 和点击的结果不一致 |
| `run(ctx)` 对每个 catalog 选项都遵从 `ctx.value`，只在没有值时才循环切换 | Ask 通过 `run({ value })` 应用确切的目标 | "设为深色"却切到了浅色 |
| 任何需要用户激活的操作（麦克风、GPS 权限提示、开始播放音频、打开 devtool）都是 `user-gesture`，或列在 `gestureValues` 里 | 模型的工具调用没有用户激活；点卡片的那一下才有 | 浏览器拒绝，或者权限提示在没人要求时弹出来 |
| `kind` 描述的是这次按下对屏幕做了什么 | `useRunCommand` 据此决定面板如何退场 | sheet 留在遮罩后面，或者面板在它刚打开的选择器底下被关掉 |
| 列表通过 `useCommandShell().leave(kind)` 退场，从不调用 `close()` | 由外壳决定：popover 关闭，sheet 可能留着 | sheet 的栈被打乱 |
| 斜杠字母不能重复 | `SlashShortcuts` 运行带这个键的第一个命令 | 第二个命令的字母默默失效 |
| 键盘提示来自 `useShowKeyboardHints()` | 提示关乎输入设备，而不是宽度 | 手机上出现字母，接了键盘的 iPad 上反而没有 |
| 子模式 sheet 保持 `restoreFocus={false}`，并且不设 detents | 在 iOS 上把焦点还给输入框，会在下一次触摸时弹出键盘；带 detents 的 sheet 汇报的是在 detent 之间的滑动，而面板需要单纯的比例才能跟着手指回到前面 | 键盘莫名其妙弹出来；面板不跟随拖动 |
| 手机上输入框是 16px（`text-[16px] sm:text-sm`） | iOS Safari 在小于 16px 时会放大页面 | 聚焦时页面被放大 |

## 可以自由选择的

- 命令的字母（任何未被占用的；已占用：A C D E G H I K L M O P T U V W X）。
- 它的 `section`、图标、label 的措辞和关键词（两种语言）。
- 它是否 `searchOnly`、`slashOnly`，或者只能用键盘（没有 label）。
- popover 的几何参数（`popover.tsx` 里的 `PALETTE_GEOMETRY`）和 sheet 选用的
  detent，在 surface 系统的 detents 范围内。
- 打分常量（`FULL_TEXT_SCORE`，哪些词是 exact 或 detail），只要
  `pnpm command:test` 仍然通过。

## 添加一个命令

1. `catalog.ts`：一个条目，包含 `title { en, zh }`、一段写给模型看的 `description`
   （它做什么、每个目标是什么意思、没有目标时该怎么做）、需要目标时的 `options`，
   以及 `policy.execution`（比其他目标更严格的目标放进 `gestureValues`）。
2. `actions.tsx`，在 `useCommandActions()` 里：`id`、有字母时的 `key`、`kind`、
   `section`、`label`（有当前值的话带上）、`icon`、中英文 `keywords`，以及在给出
   `ctx.value` 时应用它的 `run(ctx)`。要按条件提供，就把它排除在数组之外
   （Voice 和 Install 就是这样）。
3. 运行 `pnpm command:test`、`pnpm ask:test` 和 `npx tsc --noEmit -p .`；如果工具
   选择可能变化，再跑 `pnpm ask:benchmark`。
4. 更新 [system-ask.md](./system-ask.md#command-tools) 里的数量和策略表，以及下面的
   斜杠字母。

## 参考

### 按键

| 按键 | 位置 | 动作 |
|-----|-------|--------|
| `⌘K` / `Ctrl+K` | 任何地方 | 切换面板。如果 Ask 是居中的对话（或桌面上的 Dock 面板），它会先停靠：放得下就停在侧边，较窄的桌面上变成胶囊，手机上回到 Dock。关闭面板时它回到原处 |
| `/` | 输入框之外 | 以斜杠模式打开，同样会让 Ask 先停靠。在输入框里它就是一个字符，唯一的例外是面板的空输入框，在那里它进入斜杠模式 |
| `K` | 输入框之外，面板关闭或处于 Ask 时 | 打开 Ask，已打开则关闭 |
| `Tab` | 面板的输入框 | 进入 Ask，带着已输入的内容 |
| 空格（按住） | 面板的空输入框 | 说话；松开停止 |
| `↑` `↓` `↵` | 搜索 | cmdk 的选择 |
| `Backspace` | 斜杠模式 | 回到搜索 |
| `Esc` | 面板 | Load bundle → 搜索；Ask → 如果是从搜索进来的就回到搜索，否则关闭；其他情况关闭（并恢复停靠的 Ask）。在手机上先弹出子模式 sheet |

### 斜杠字母

在斜杠列表里，按分区排列。列表打开时所有字母都有效，包括没有列出的那些。

| 按键 | 命令 | Kind | 分区 |
|-----|---------|------|---------|
| `H` | Home | navigate | navigation |
| `U` | Writing | navigate | navigation |
| `X` | Works | navigate | navigation |
| `P` | Prompts | navigate | navigation |
| `O` | About（它唯一的快捷键；[system-about.md](./system-about.md)） | navigate | navigation |
| `I` | Docs（只能用键盘，不列出） | navigate | navigation |
| `E` | Labs，`/lab`（只能搜到，不列出；`L` 是 Language） | navigate | navigation |
| `V` | Voice（在支持的环境下；只在斜杠列表） | stay | actions |
| `K` | Ask（只在斜杠列表） | stay | actions |
| `M` | Music：播放 / 暂停 | toggle | actions |
| `A` | Appearance：Follow the Sun → 太阳没在显示的那个主题 → 太阳正在显示的那个 → Follow the System | toggle | settings |
| `L` | Language | toggle | settings |
| `C` | Geolocation，IP ↔ 精确（`c` 代表 coordinates） | toggle | settings |
| `W` | 壁纸选择器 | surface | settings |
| `G` | Glass：tinted ↔ clear | toggle | settings |
| `T` | Tint：wallpaper ↔ neutral | toggle | settings |
| `D` | Devtool | surface / toggle | settings |

Install（actions，直到安装为止）和 Sky Window（actions，只能搜到）没有字母。

### `useCommand()`

来自 `provider.tsx`。面板：`isOpen`、`isSlashCommandsMode`、
`isLoadBundleMode`、`isAskMode`、`open(slash?)`、`close`、`toggle`、
`setSlashCommandsMode`、`openLoadBundle`、`setLoadBundleMode`、
`setAskMode`。语音：`voiceRequest`、`voiceHoldKey`、`requestVoice(key?)`。
Ask 的停靠位置（`askPlacement`、`askPill`、`askStarted`、`askEntry`、
`askRequest`、`openAsk`、`moveAsk`、`closeAsk`、`minimizeAsk`）在
[Ask](./system-ask.md) 里说明；它的状态转换是 `ask-state.ts` 里的纯 reducer。

### 测试

- `pnpm command:test`：打分策略（`scripts/tests/command-filter.test.mjs`）。
- `pnpm ask:test`：Ask 的命令工具、策略、执行和确认卡片
  （`scripts/tests/ask-commands.test.mjs`）。
