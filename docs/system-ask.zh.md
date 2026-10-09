---
origin: "AI-translated from the original"
---

# Ask

向命令面板提一个问题，而不是做一次搜索：一个会读这个站点、并附上出处链接来回答的 agent。模型在服务器上；它的工具在页面里运行，面对的是浏览器只取一次的全站索引。没有配置 key 时，由一个写好剧本的替身（stand-in）跑同样的循环。命令面板那一侧见 [system-command.md](./system-command.md)。

## 做好了是什么样

- **一段对话，放在哪里都是它。** 在桌面上，它可以是命令面板居中的卡片、页面旁边的侧边面板、Dock 的顶部面板，或者 Dock 里的一颗胶囊（pill）；在它们之间移动，别的什么都不会动。在手机上，它就是一个底部抽屉。
- **页面始终看得见。** 在一个用来阅读的页面上唤出它（K 键、Ask 按钮），它会在侧边打开；从 1280px 起，页面会给它让出位置，而不是被它盖住。
- **它会展示过程。** 一个完成的回答会保留它的步骤（搜了什么、读了什么），折叠在 "Looked through the site" 下面；找到的东西以卡片呈现；链接会落到确切的标题、条目或 commit 上。
- **它总会回答。** 一直搜个不停的模型会被叫停并要求作答；只做了推理没有输出的模型，会被再问一次。
- **只在被要求时才动手。** 要改一个设置，得到的是一张可以点的卡片，或者一次已经完成并标明完成的修改；问一个关于设置的问题，永远不会变成一次修改。

![1280px 桌面上的 Ask，在它的四个位置：首页上方的居中卡片、一篇文章旁的侧边面板（文章的正文栏已左移让出位置）、同一篇文章上方 Dock 的顶部面板，以及屏幕顶部的胶囊。](/img/docs/system-ask/places.png)

同一段替身对话出现在桌面的四个位置上（无头浏览器，1280×860）：首页上方的居中位置（左上）、一篇文章旁的侧边面板（右上；正文栏已经往左挪了一步，`data-ask-docked`）、Dock 的顶部面板（左下），以及它收起后的胶囊，显示着回答的开头几个字（右下）。移动它的只有位置菜单（⋯）和收起箭头。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-ask/phone-answer.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的 Ask：一个全高的底部抽屉，标题栏里是历史、新对话和关闭；下面是问题、展开后显示搜索及找到的五段文字的步骤，接着是一排演讲卡片，最底部是输入框。" />
  <img src="/img/docs/system-ask/command-offer.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="侧边面板回答 'Can I change the theme?'：一张标题为 'Appearance: Follow the Sun' 的命令卡片，带有 Light、Dark、Follow the System 和 Follow the Sun 四个按钮，以及替身说明尚未应用任何改动的一句话。" />
</div>

左：手机（iPhone 15 Pro，无头浏览器），抽屉与屏幕同高，没有位置按钮，也没有最小化；步骤是展开的（一次 `search_site`，五段文字），后面跟着回答 `present` 出来的卡片。右：关于设置的问题得到的是一个提议，而不是一次修改：主题的卡片，带着它的四个目标值，当前那个写在标题里。

## 原理

![agent 循环：浏览器里的 chat.ts 把对话 POST 给 app/api/chat；路由清理输入、选定模型（网关、某个直连的 provider，或替身）、判断这一轮是否必须马上作答，然后流式返回一步；工具调用回到页面，页面拿 public/ask/index.json 执行它们并重新提交，直到模型作答。](/img/docs/system-ask/agent-loop.svg)

这个循环的长度就是一个问题。页面发出对话；路由流式返回一步；如果这一步以工具调用结束，`chat.ts` 就在页面里逐个执行，再把对话送回去进行下一步。模型写出回答时，循环结束。

- **路由很薄。** 它保管 key，并锁定模型拿到的一切：系统提示词、工具定义、模型列表、输出上限（`maxOutputTokens` 4000）。一个请求携带的是对话（最近 24 条消息，每个问题 4000 字符）、一个列表内的模型和思考强度、这个浏览器里可用的命令 id，以及一个可选的 `finalize` 标志。它从不读取索引。
- **工具在页面里运行。** 它们在 `tools.ts` 里声明，不带 `execute`，所以一次调用会回到浏览器，由 `chat.ts` 拿已加载的索引执行（或者返回一个命令提议），然后重新提交（AI SDK 的 `onToolCall` + `sendAutomaticallyWhen`）。
- **它总会回答。** 一轮里调用工具满 6 次后，路由会以 `toolChoice: "none"` 运行下一步，并附上一条"用已有的东西作答"的指令（`TOOL_BUDGET`、`ASK_ANSWER_NOW`）；页面在 10 次时停止重新提交（`MAX_TOOL_CALLS`）。如果某一步既没有文字也没有工具调用（模型只做了推理），会带着 `finalize: true` 再送回去一次，效果相同。之所以这样，是因为 Qwen 3.5 Flash 曾经一直搜索、始终不回答。
- **会话是模块状态**（`lib/chat.ts`），所以任何 surface（命令面板、一个面板、一个页面）显示的都是同一段对话；做一个新的 surface，就是把 `AskMessages`、`AskComposer` 和 `AskHistory` 摆在一起。
- **重的部分晚加载。** AI Elements、streamdown 和 AI SDK 的客户端在 Ask 第一次打开时才加载（`components/entry.tsx`、`askLazy`）；外壳（卡片、面板、抽屉）立刻带着骨架屏出现，对话随后淡入覆盖上去。
- **没有 key 时，用替身。** 路由里的 `standIn()` 会走一轮真实的循环：先让页面按原样用问题去 `search_site`，再把找到的前三篇文档 `present` 成卡片，最后附上链接作答。"open …" 和 "play …" 这类问题会用第一个结果调用 `open_page` / `play`；命令类问题得到写好剧本的 `command_*` 或 `list_commands` 调用（`lib/stand-in-command.ts`）。它证明的是接线和界面，不是回答的质量；配置了模型时永远不会用到它。

## 从搜索到提问

⌘K 里的每一次查询也都可以拿来提问。只要输入框里有文字，结果里就有 **Ask 行**：

| 查询 | Ask 在哪里 | ↵ 的作用 |
|---|---|---|
| 读起来像个问题（`intent.ts`：以 `?` 结尾、开头是疑问词、≥ 5 个词、≥ 10 个汉字、以中文疑问语气结尾） | 第一行，已选中 | 提问 |
| 其他任何内容 | 最后一行 | 打开最匹配的结果；↓ 或 **Tab** 可以到达 Ask |

在搜索模式下，**Tab** 从任何地方都能进入 Ask，有查询内容时就直接把输入的内容问出去。它的 `Ask AI` `tab` 提示在输入时始终停在输入框的末端（`md` 以下是 `AI` `tab`），位于麦克风之后：语音是填写输入框的另一种方式，而 Ask 是输入框的去处。只有触屏的设备两个键盘提示都不显示。语音会完整保留说出来的问题（`systems/command/voice.tsx` 里的 `toFieldText`）：命令仍然会被精简成查询（"open the writing" → "writing"），问题则不会。

Ask 是命令面板的第四种模式，与搜索、斜杠和 load-bundle 并列（命令 provider 里的 `isAskMode`）。在桌面上，它在同一张卡片里替换掉结果列表；在手机上，提问会收起命令面板，打开 Ask 自己的底部抽屉。Escape（或返回按钮）回到搜索，对话保留；✎ 按钮开始一段新对话。回答里指向本站某个页面的链接会导航过去，命令面板随之离开，就像执行了一条命令。

使用 Gateway 语音模型时，Ask 的输入框在录音或转写期间会折叠成一行。原来放文本框的地方显示当前的动作，麦克风按钮仍然可用。轻点一下再按 Stop，转写结果会留在编辑器里。在输入框内按住再松开，转写一完成就发送；滑到外面则取消。浏览器自带的识别器保留原来"点一下开始听"的流程。

## Ask 在哪里

桌面上：一段对话，三个位置，外加一颗胶囊。手机上：一个底部抽屉。它在哪里由命令 provider 的 `askPlacement` 决定；对话属于会话，所以移动 Ask 不会动到别的东西。

| 位置 | 是什么 | 来自 |
|---|---|---|
| **center** | ⌘K 卡片变成一个聊天窗口：与搜索卡片同宽（700px）、同位置，稍高一些；它的侧栏按钮会在对话旁打开历史，并把卡片加宽到 960px，成为一个聊天应用。它是一个窗口：可以拖到任何地方。在手机上，是一个与屏幕同高、属于它自己的底部抽屉 | 命令面板的 Ask 模式（`chat.tsx`）；手机上是 `SurfaceSheet` 里的 `panel.tsx` |
| **side** | 停靠在末端边缘的 440px 面板；旁边的页面保持可用，从 1280px 起页面会让出位置（`data-ask-docked`，首页除外） | `panel.tsx`，`SurfacePanel` |
| **top** | Dock 的面板，从顶部垂下来 | `activity.tsx`，`LiveActivity` |
| **pill** | 最小化：Dock 里的一颗胶囊，先显示 agent 正在做什么，再显示回答的开头几个字，工作时带着站点的光晕 | 同一个 activity，收起状态 |

下面是桌面的预设；其中每一条都是一个设置（见后文）。

- **放在哪个位置。** 从命令面板提问（Ask 行、Tab、`/` `K`）会把卡片变形为居中的聊天窗口，除非 Ask 已经在侧边或顶部打开，那就由它接下这个问题。K 键和 Ask 按钮在阅读页面（/writing、/works、/prompt、/about、/docs；`onReadingPage`、`isReadingPage`）上，当 440px 面板和正文栏确实放得下时（1280px 及以上，`ASK_SIDE_MIN_WIDTH`），会把它打开在页面旁边，让页面保持可见；在其他地方则打开在居中位置。带着已经打开的居中聊天窗口进入一个阅读页面，它会移到侧边。一次拖动或位置菜单里的选择，是对当前页面情境的手动覆盖：关掉再打开 Ask 仍然沿用它，而导航会清除它，交给新页面重新决定。为命令面板让位（parking）明确是临时的，永远不会变成偏好。如果启用的是独立的位置按钮而不是菜单，它们还会为同类页面的下一次唤出记住一个默认位置（`hux_ask_placement`）。
- **回去的路。** 只有当入口是搜索时（Ask 行、Tab、`/` `K`），离开居中位置才会回到搜索：有一个返回按钮，Escape 回到输入框。如果是直接到达的（K 键、Ask 按钮、从别的位置移过来），它背后没有搜索：没有返回按钮，Escape 直接关闭它（命令 provider 里的 `askEntry`）。
- **移动。** 标题栏里保留最小化和一个位置菜单（⋯）；三个常驻的位置按钮是关闭的。整条标题栏都是拖动把手。用鼠标时立刻就能拖；用触摸时，按住 360ms 才进入拖动（`LONG_PRESS_MS`）。居中位置是一个自由窗口，侧边面板和 Dock 面板也会跟着指针走。末端边缘的一条窄带接纳侧边位置，顶部的一条窄带接纳 Dock；一旦进入，更宽的离开带会让目标保持稳定，所以斜着拖也不会在几个位置之间闪烁。当指针悬在另一个位置上时，会画出它将落下的位置（`AskDragOverlay`）。位置菜单是键盘和辅助技术到达同样三条命令的途径；当侧边位置无法与页面共存时，Side 是禁用的。如果侧边位置暂时放不下，Ask 会退回居中（或者在命令面板占着居中位置时退成胶囊），但保留它的自动或手动来源，空间回来后再回到侧边。每一个实际生效的位置都会记录它来自自动逻辑、用户、为命令面板让位、空间不足，还是导航（`systems/command/ask-state.ts` 里的 `askProvenance`）。
- **两者同时出现。** 当 Ask 是居中聊天窗口，或者（在桌面上）在 Dock 里时，按 ⌘K，或在输入框外按 `/`，会把它停到一边（两栏都放得下时停在侧边，较窄的桌面上变成 Dock 胶囊，手机上停在顶部），然后打开命令面板。侧边面板和卡片共享屏幕：卡片在剩下的空间里居中，点在面板上的点击仍归面板。停在一边的聊天不会抢键盘。关掉命令面板会把 Ask 恢复到这次临时移动之前的位置；导航则会把停靠的位置确定下来，而不是把它瞬移到新页面上方。已经在侧边的 Ask 留在原处。输入框里的 `/` 就是一个字符。
- **胶囊。** 最小化（或者顶部位置的收起箭头，或者它在顶部时发生了路由切换）会留下胶囊；点它会打开顶部位置。在回答还没写完时关闭 Ask，也会留下胶囊。✕ 才是彻底关闭。
- **链接。** 在居中位置，点链接会导航，Ask 变成侧边面板，这样就能一边看页面一边看对话；在手机上，命令面板离开。在侧边时，链接在面板下方导航，面板保持不动；在顶部时，链接导航后收起成胶囊。
- **手机。** 一个底部抽屉，仅此而已。Ask 体量大、会停留一阵，这正是抽屉的职责；Dock 的 Live Activity 是给顺手经过的小东西用的。所以手机的预设没有位置按钮、没有最小化、也没有胶囊：抽屉的标题栏是历史、✎ 和 ✕，向下滑关闭，Ask 按钮会把同一段对话带回来。从搜索提问会收起命令面板并打开抽屉。在抽屉里点开一个链接会关闭它，让页面露出来。它的输入框怎样遇上键盘，见 [keyboard-input.md](./keyboard-input.md)。
- **入口。** Ask 按钮是每个页面上搜索栏旁的一颗小球（`fab.tsx`、`AskBall`），Ask 打开时它会亮起：首页上在提示框右边，桌面角落里在 ⌘K 按钮左边，手机上在它上方。它不在搜索栏的布局流里，所以搜索栏的排版和变形和它单独存在时完全一样，而它自己没有动画：一次导航的 View Transition 会把它作为共享元素直接滑到新位置（`ask-ball`，和 λhux 的移动方式一样）；在搜索栏自身安顿下来的每一帧里，它都照着搜索栏实际画出的样子站在旁边（在 framer 的 postRender 中读取，以及在每次写入搜索栏样式时、绘制之前读取）。离开首页时，两者都会为侧边面板让开。

### 设置，以及每个平台一套预设

上面的每一个选择都是 `lib/config.ts` 里的一个设置，在做出选择的地方读取（provider 的 `openAsk` / `minimizeAsk`、标题栏的控件、拖动把手、activity 的胶囊、语音光晕）。一切在每个平台上都可配置；桌面和手机的区别只在预设。devtool 的 **Ask** 部分会展示这些预设，并可以为任一平台修改任何设置（`hux_ask_config`，按平台保存，只保存与预设不同的部分），同时还能看到访客的模型、思考强度及其默认值。

| 设置 | 决定什么 | 桌面 | 手机 |
|---|---|---|---|
| `fromSearch` | 从搜索提问时 Ask 在哪里打开 | center | center（抽屉） |
| `fromCall` | 不在阅读页面时，K 键 / Ask 按钮在哪里打开它：`last`（位置按钮上一次放它的地方），或某一个位置 | center | center |
| `onReadingPage` | `side`：在 /writing、/works、/prompt、/about、/docs 上，唤出时在侧边打开（从命令面板提问仍会把卡片变形）；`same`：和其他地方一样 | side | same |
| `placeButtons` | center / side / top 作为标题栏里独立的按钮。关闭时：在 `drag` 开启的地方保留一个可用键盘操作的位置菜单，而拖动和当下的情境负责移动 Ask | off | off |
| `drag` | 整条标题栏可在位置之间拖动，鼠标立刻生效，触摸需长按；位置菜单也由它决定是否显示 | on | off |
| `minimize` | `dock`：最小化成 Dock 里的胶囊；`off`：没有最小化按钮，Dock 的收起即关闭 | dock | off |
| `backgroundPill` | Ask 关闭后仍在写的回答显示为胶囊 | on | off |
| `glowDelay` | 输入框开始聆听后，语音光晕出现前等待的毫秒数 | 0 | 0 |
| `keyboardDelay` | 麦克风刚刚让键盘收起时，额外等待的毫秒数 | 0 | 320 |

平台由 surfaces 的 `sm` 区分：640px 以下是手机。侧边能否放下是另一个空间上的判断：从 1280px 开始，那时页面已经预留了面板的宽度。

## 是聊天，不是一个框

- **快捷键。** 在任何文本框之外按 K 都能打开 Ask（在正在阅读的页面旁边，其他地方则在居中位置），再按一次关闭。斜杠列表里的 `/` `K`，以及搜索里的 Tab 或 Ask 行，会把卡片变形为聊天窗口。⌘K，或在输入框外按 `/`，会把居中的聊天窗口（或者在桌面上的 Dock）停到一边，在它前面打开命令面板。
- **历史。** 每段对话从第一个问题起就会保存（`lib/history.ts`）：最新的 30 段，只存在这个浏览器里，读取的结果截到 600 字符。侧栏（窄屏上是时钟图标）列出它们；选中一段即让它成为当前对话。✎ 开始一段新的。
- **新文章，新对话。** 在同一篇文章上，对话会继续，文章里的某一段仍然属于那篇文章。另一篇文章就是新的上下文（`lib/chat-continuity.ts`），这就是该开新对话的信号：关闭 Ask（在手机上，点开其中的链接时就会关闭），再在下一篇文章上打开它，会开始一段新对话；在那里就某一段落提问也一样。同一篇文章的另一种语言版本算作它自己的页面，因为它承载的是另一份文字。之前的对话留在历史里。从历史里选中一段，它会挂在当前打开的文章上，直到文章再次切换。
- **并行。** 切到另一段对话，并不会中断正在回答的那段：它在后台继续，工具调用照常，结束时自行保存；在那之前，它在历史中的那一行会一直转圈。这次访问中打开过的每一段对话都保持活跃，所以回到一段正在运行的对话，看到的就是它还在运行（`lib/chat.ts` 里的 `live`）。
- **模型和思考强度，按对话区分。** 每段对话都有自己的模型和 Quick / Balanced / Deep（AI SDK 通用的 `reasoning`，对应 low / medium / high；默认 low），随对话一起保存在历史里：回到某段对话，选择器也会恢复成它的设置；修改它们，改的就是这段对话。新对话从上次选择的设置开始（`lib/prefs.ts`，`hux_ask_model` / `hux_ask_effort`）。路由只接受列表里的模型和这三个强度。
- **消息操作。** 对问题：Copy，以及 Edit（改了再问一次：AI SDK 的 `sendMessage` 带上被替换消息的 id，会丢掉它之后的一切）。对回答：Copy（它的 Markdown），最后一条上有 Regenerate，更早的回答上有 Rewind to here（要按两次：第一次会问 "Drop what follows?"）。回答正在写的时候，Edit 和回退会等待；回退之后的对话按它现在的样子保存。问题的操作就在气泡旁边，按需出现：鼠标悬停时，触屏上点一下或长按时（点别处则收起）。Escape 会取消编辑而不离开 Ask（命令面板和面板会跳过已经被处理过的 Escape）。
- **语音。** 麦克风放在发送按钮旁边，位于末端，和 Claude、ChatGPT 的做法一样；选择器在前面。在触屏上，它会让输入框失焦，所以聆听时键盘会滑下去。按下立即响应：输入框让位给录音行，光晕扫入（`glowDelay`，0），在声音驱动它之前一直呼吸。只有在键盘正在收起时它才会等待（`keyboardDelay`）：键盘滑动和光晕的头几帧叠在一起，会在手机上掉帧。这两个等待同样适用于命令面板的输入框（`systems/command/voice.tsx`）。
- **发出去的问题不会回来。** 发送会中止麦克风（它的最后一句可能在 ↵ 之后才确定），手机键盘对已发送文字的延迟提交（拼音、联想词）会被丢弃，所以输入框永远不会被重新填上。
- **出错时说清楚哪里错了。** 路由会把 provider 的错误信息原样传过来（`describe`），显示在 "Something went wrong." 下面。

## Agent

- **它以 Hux 的身份说话。** 第一人称，让访客觉得是在和他本人交谈：讲逻辑（先给结论，再讲背后的模型），有观点（选边站，承认自己的偏见），有趣（自嘲、抖个包袱，"lol" 最多一次）。这个人设来自他自己的文字：About 和 /prompt、他用每种语言亲自写的文章（大部分英文文章是从中文机器翻译的，所以不是他的措辞），以及他在 X 上的帖子，其中几条被原封不动地放进了提示词（`ASK_VOICE`）。关于他的事实来自站点，从不编造；观点可以超出站点内容，但要以观点的身份说出来。一旦有人问起或者依赖它，它就说明自己是 AI；不以他的名义做任何承诺；不谈雇主的内部事务，也不涉及私人。这一切都在 `prompts.ts` 里。
- **先给地图，再读正文。** 系统提示词（`lib/ask-prompt.ts`，`askSystemPrompt`）带着一张站点地图（每一篇文章、信条、时期、项目和编程语言的标题、链接和文档 id：几千个 token，每个服务器实例构建一次，每次请求逐字节相同，因此 provider 的提示词缓存可以命中）。条目背后的正文由模型通过 `search_site` / `read` 获取。把整个站点放进每次请求会有几十万个 token；地图加上几次读取只是其中的一小部分。
- **找到的东西，以卡片呈现。** 一场演讲不只是一个标题：在回答下方，它链接到的文档（以及它读过的）会以卡片的形式回来（`components/cards.tsx`），而 `present` 工具（1 到 6 个 id）让模型在东西本身就是答案时（"which talks…"、"where can I watch…"）把卡片放到回答里合适的位置。作品的卡片就是它在 /works 上的 commit（`lib/log-client`）：联系表上显示的封面、场合和年份，以及每种附件一个按钮（观看、幻灯片、照片、链接），像 /works 一样通过 systems/attachments 打开。文章的卡片带着它的第一张图（索引里的 `cover`）；信条的卡片带着它的那句话。卡片是一个指向确切位置的链接。一样东西只有一张卡片：一篇文档的不同语言版本会合并成读者所用语言的那一份（`lib/doc-href.ts`）。从居中位置打开一场演讲，会先把 Ask 移到侧边（命令面板位于舞台之上），而且舞台会先于面板接收 Escape。
- **它知道你在读什么。** 问题会带上读者当前打开的内容（`lib/page-context.ts`）：在文章上，是文章及视野中的那一节（阅读线以上的最后一个标题）；在 /prompt 上，是展开的条目；在 /works 上，是展开的 commit 或地址指向的那个；在 PL 图表上，是展开的那门语言。它以标签的形式显示在输入框上方，点 × 可以把它排除（仅对该页面）；在已发送的问题上则是一个指回原处的链接。它作为用户消息里的 `data-context` 部分发送，附上索引里那一节的文字（截到 4000 字符）；路由会检查并限制它（4500），在问题之前以 `<context>` 块交给模型（`ASK_CONTEXT`），指令里说明"这个"指的就是它。对同一处的第二个问题不会再发送一次。从命令面板转过来的问题同样带上页面的上下文。在有内容可问的页面上，空对话会先给出关于它的问题（"Sum this up in three lines"）。编辑问题会保留它的上下文。
- **Ask about this。** 在页面上选中的文字（在页面内容里，而不是在输入框或 Ask 本身里）下方会出现一个 "Ask about this" 按钮（`components/selection.tsx`，在根布局里作为 `AskSelection` 挂载一次）：这些文字连同它们所在的页面和章节，会附在下一个问题上（`lib/pending-context.ts`），Ask 在它应该出现的地方打开。从页面拖到输入框上的任何东西，都是要问的对象，而不会变成输入框里的文字（`lib/pointed.ts`）：指向站内某样东西的链接（/works 上的 commit hash、/prompt 上条目的 id——它现在拖动时就是它的链接、一篇文章、一张卡片）会带上那样东西及其正文；一张图片会带上它所属的 commit 或文章；普通文字就是一段引文。每一项在发送前都显示为一个标签，× 可以去掉；来自当前打开页面的引文会代替页面本身的标签。模型同样以 `<context>` 块读取它们（`kind` 为 quote 和 item）。
- **它可以在站点上动手。** 有两个工具会这么做，和其他工具一样在页面里运行，通过一个组件注册的"手"（`lib/actions.ts`、`components/actions-host.ts`，来自始终挂载的 AskSide）：`open_page` 把读者带到一个页面或页面上的某处（`lib/follow-href.ts`，和每个链接的落点方式一样：/prompt 条目会展开），带引文时，等链接自身的落点完成后滚动到那段文字并高亮它（`lib/highlight-quote.ts`，CSS Custom Highlight API）；`play` 通过 systems/attachments 打开一场演讲的录像、幻灯片、照片或链接。对话保持可见：从居中位置，Ask 会移到侧边；在手机上，抽屉会落下，让页面露出来。只在读者要求时，而且只针对屏幕上的那段对话：在后台回答的对话会被拒绝，所以它永远不会把读者拽来拽去。
- **不绑定厂商。** 全程使用 AI SDK。模型 id 采用 Vercel AI Gateway 的格式（`provider/model`）；换模型就是改 `models.ts`。

### 上下文控制

输入框可以恢复被排除的页面、钉住当前正在阅读的章节，还可以用 **+** 添加其他已索引的来源。最多发送三个可见来源（`lib/context-policy.ts` 里的 `MAX_CONTEXTS`，与路由共享）；自动加入的页面会把位置让给显式附加的内容。超出的附加会被拒绝并给出提示，而不是挤掉已有的来源。待发送的来源和被排除的页面属于各自的对话，在 Ask 于不同 surface 之间移动时都会保留。推荐问题和来自命令面板的问题使用同一份草稿；即使更早的消息已经超出服务器的历史窗口，每个问题也会带上它当前的来源。

引文标签显示开头和结尾的几个词（`quoteLabel`）；它的提示框和发送出去的上下文保留整段文字。在触屏上，选区操作按钮放在与系统菜单相反的半屏，并限制在 visual viewport 之内（`lib/selection-layout.ts`）。系统原生的文字拖动会保留原始来源；标题链接、prompt id 和 commit hash 会说明自己可以拖动。不支持的拖放会给出反馈，**+** 则为拖动提供了键盘 / 触摸的替代方式。

### 动作的生命周期

导航和播放要求最新的问题里有一个明确的中文或英文动作请求（`lib/action-policy.ts` 里的 `requestedAction`）；被引用的命令和否定的请求不算数。已关闭、最小化和在后台的对话不能发起动作。一个待执行的引文高亮会重新核对发起它的对话和目标位置，等待目标内容就绪，并在读者自己开始滚动时取消。它在高亮放好之后才报告成功，而不是在某个延迟回调之前。能高亮整句时就高亮整句，否则退回到一段较短的开头。在手机上，卡片里的媒体和 agent 发起的播放都会先收起 Ask，再打开附件的 surface。

### 用哪些模型

`systems/ask/lib/models.ts` 就是全部的列表：选择器显示它，路由不接受其他任何模型（未知的 id 会退回第一个，也就是默认模型）。挑选标准是能在网关的**免费额度**上运行、而且便宜：每一项在网关的目录里都是 `availableToFreeTier`，支持工具、会推理、能读两种语言，并且服务时不拿提示词做训练。选择器显示每家厂商的标志（`components/model-icon.tsx`，来自 Lobe Icons），按 id 里的 provider 对应。

| 模型 | $ / M tokens（输入 / 输出） | |
|---|---|---|
| Qwen 3.5 Flash（`alibaba/qwen3.5-flash`） | 0.10 / 0.40 | 默认；搜索很积极，靠工具预算让它作答 |
| Gemini 2.5 Flash（`google/gemini-2.5-flash`） | 0.30 / 2.50 | 搜得少一些；回答得好 |

不管用哪个，一个问题的花费都远低于一美分（输入约 10k token，输出约 600）。Claude、GPT 和 Gemini 3 不在免费额度内；它们需要购买网关额度，到那时再加入列表。免费的 `$0` 模型没有收录：那些免费模型在服务时不承诺不拿访客的问题做训练。无论如何，都要在网关的控制台里给项目设一个预算。试过又撤掉的：Kimi K2 Thinking（通过网关连不上）、Qwen 3.8 Flash 和 DeepSeek V4.1 Flash（`-fast`）（不在免费额度内）。

### 由哪个 provider 运行

第一个匹配的生效（路由里的 `resolveModel`）：

| 环境里设置了 | 运行的是 |
|---|---|
| Vercel 部署（`VERCEL=1`）、`AI_GATEWAY_API_KEY`，或拉取下来的 `VERCEL_OIDC_TOKEN` | 列表里的任意模型，经由网关。部署环境不需要 key：网关 provider 每次请求都用项目的 OIDC token 认证。key 是给在别处运行用的（本地、CI、这个仓库的云端会话）。 |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | 直接调用该 provider 的模型，适用于带 `direct` id 的条目 |
| 都没有 | **替身**（见 [How it works](#how-it-works)）：不需要 key 就能跑通整个循环（路由 → 工具调用 → 浏览器搜索 → 重新提交 → 卡片 → 回答），用于开发和预览。 |

## 索引

`pnpm ask:index` 把站点读进 `public/ask/index.json`（生成文件，不提交；`predev` 和 `build` 会运行它）。`lib/ask-corpus.ts` 负责读取内容；`systems/ask/lib/corpus.ts` 定义它的形状。

| 文档类型 | 来源 | href |
|---|---|---|
| `post` | `content/blog/*.mdx`，每种语言一篇文档，按标题切分 | `/writing/<slug>/<lang>`，某一段则是 `#<heading id>` |
| `conviction`、`influence` | `content/prompts.json` | `/prompt#<anchor>` |
| `era` | `content/log.json` | `/works` |
| `work` | `content/log.json` | `/works#<commit hash>` |
| `language` | `content/languages.json` | `/writing/pl-chart/<lang>#<id>` |

每个分块最多 1200 字符。目前大约 230 篇文档、770 个分块：约 580 KB，gzip 后约 230 KB（其中很多是中文，压缩率较低）。一个带正文的文件：浏览器在第一次有东西要问时（打开 Ask，或者在命令面板的输入框里输入两个字符）才去取它，从不随页面一起加载，到达后建立 BM25 索引（`lib/search.ts`，MiniSearch，分词用 `lib/tokenize.ts`，构建时和浏览器里切法相同）。`read` 最多返回 12,000 字符。拆分这个文件（一个不带正文的索引，加上每篇文档一个文件供 `read` 使用）在首次请求上省了约 50 KB，代价是每次读取多一次往返，所以在站点超出这个规模之前，它就是一个文件。

同一个索引也给命令面板提供了**全文搜索**：正文匹配查询而标题不匹配的文章仍然会显示，排在标题匹配的结果之后（`systems/command/results.tsx` 里的 `usePaletteFilter`）。

### 落到实处的链接

Ask 给出的每个链接都去往确切的位置：一段文字的链接是它所在文章里它所属的那个标题（最近的 h1 到 h3，页面和索引都从 `lib/heading-id.ts` 得到它的 id）；一场演讲或一个项目的链接是它在 /works 上 commit 的永久链接；一条信条的链接是它在 /prompt 上的条目。系统提示词里的地图带着同样的永久链接，并告诉模型保留 `#` 部分。

页面在到达时以及每次 `hashchange` 时都会定位过去（`lib/use-hash-landing.ts`）：commit 那一行、文章标题和 PL 图表的那一行会被滚动到并刷上底色；/prompt 的条目还会展开，如果过滤条件把它藏起来了，就解除过滤。指向当前已打开页面的链接不算路由切换，所以 Ask 用 `lib/follow-href.ts` 来跟随链接，它自己写入 hash 并触发 `hashchange`：在 /works 侧边的一个来源会跳到它那一行。

## 命令工具

`systems/command/catalog.ts` 为每条命令提供一段面向模型的描述、双语标题和有限的目标值。`CommandAction.id` 是一个目录 id，所以添加一条没有描述的命令会在类型检查时失败。Ask 为每条命令生成一个 `command_<id>` 工具（`lib/command-tools.ts`）；它们的实现留在 `useCommandActions`（`systems/command/actions.tsx`）里，与命令面板共用。一共有 19 条命令（包括只在搜索里出现的 Sky Window）、五个内容 / 导航工具（`search_site`、`read`、`present`、`open_page`、`play`）以及 `list_commands`：总共 25 个声明。语音只在支持识别的地方可用；Install 只在安装之前可用。客户端在每次请求时发送这些可用的 id；路由拿目录过滤它们并使用 `activeTools`，同时保留全部定义以便解读历史。

每条命令都有一个必填的 `policy.execution`：`on-request` 或 `user-gesture`，对 `location=gps` 和 `music=play` 还有更严格的目标级覆盖（`gestureValues`）。schema 和描述都由这个策略生成。`execution=offer` 是默认值。只有读者明确要求动手时，模型才使用 `execution=apply`。`executeAskCommand`（`lib/execute-command.ts`）在调用浏览器宿主之前，会检查可用性、允许的目标值、策略，以及这段对话是否是当前的、可见的。模型负责理解意图；运行时掌管执行的边界。缺少目标值时永远不会触发循环切换 / 开关切换。

| 策略 | 动作 |
| --- | --- |
| 自动读取 / 展示 | `search_site`、`read`、`present`、`list_commands` |
| 明确要求时 | 主题、语言、玻璃、色调、壁纸样式 / 选择器、近似 IP 定位、暂停音乐、导航、About、Ask、安装指南、Sky Window 说明；现有的 `open_page` 和 `play` 打开页面 / 附件 |
| 用户点击 | 语音麦克风、精确 GPS、开始播放背景音乐、开关开发者面板；传感器授权和实际安装仍留在它们现有的界面里 |

通过检查的提议会变成一张紧凑的卡片（`components/command-card.tsx`）；`language=zh` 或 `theme=dark` 这样确切的目标值是一个按钮，未指定目标值时则给出可选项。同一套 setter 实现同时服务于直接执行和点击，并与命令面板共用。壁纸的目标值使用现有的图片 / 随机 / 循环选择器或真实的天气样式，而不是一份编造的天气预报。Sky Window 会选择天空背景并打开它的说明；打开这份说明不会请求运动 / 定位权限。安装命令打开的是一份指南；它不会安装应用。失败的动作会返回错误，永远不会被报告为已完成。成功的直接执行返回 `executed`，渲染成已完成的卡片，并随对话保存。

`list_commands({ ids: [...] })` 永远只展示模型选出的命令，按它选定的顺序（`commandsToPresent`）。问"能做什么"的问题会得到 1–2 个相关的例子，不改任何设置；完整的菜单需要明确要求。具体的请求使用一到两次 `command_*` 调用。在后台或不可见的对话可以提供控件，但不能应用。宿主会重新检查可用性 / 目标值，把需要手势的动作保持在卡片点击的那个任务里，并在导航或打开新 surface 时把 Ask 移开。应用天气样式时 Ask 留在原处。

成功的点击会用 `executed` 更新已有的工具输出（`lib/command-state.ts` 里的 `recordCommandExecution`），保存到历史里，而不会发起新的模型请求。位置变化和重新加载都会保留完成状态；下一个问题会告诉模型实际执行了什么。一个发现菜单（discovery menu）可以反复使用。不需要 key 的替身用写好剧本的请求和两个固定的发现示例（主题和 Sky Window）走一遍这些路径。

### 工具数量基准测试

`pnpm ask:benchmark` 是离线的：它在 34 个双语用例上，把 12 个和 18 个工具的实验性词法候选列表与全部 25 个进行比较。它衡量的是 schema 字节数，以及预期的工具是否在筛选中保留下来，**而不是模型的准确率**。筛选器从来看不到预期答案。六个非命令工具全部保留。当前的离线运行结果：12 个工具时保留 31/34 个用例，18 个时 33/34，25 个时 34/34；间接的"手机 / 太阳 / 月亮"请求在两个候选列表里都丢了 Sky Window，较小的列表还丢了一个中文的主题请求，以及一个双重修改请求里的其中一条命令。完整的 schema 约 14.6 KB。因此在拿到实测数据之前，生产环境保留所有可用的命令；实验性的裁剪只限于基准测试。

实测运行（`--run`，见下文）使用生产环境的系统提示词、完全相同的工具 schema、低推理强度，以及配置好的 Gemini / Qwen 模型。它不执行任何工具。它记录第一次调用的正确性（工具名、每一个明确的目标值、在目录策略下实际得到的 apply / offer 结果，以及多余的调用），包括两个同时要求的修改、把能力类建议限制在 1–2 个动作，以及只在明确要求完整列表时才允许列出全部。边界用例包括深色模式的预览、一个"怎么做"的问题，以及开始播放音乐。它还记录会展示多少个动作、provider 错误、延迟和输入 / 输出 token 用量，并在重复运行中轮换变体的顺序。JSON 报告写到被忽略的 `shots/` 下；`--output=path` 可以改变目的地。它不衡量浏览器里的执行，也不衡量最终回答的质量。在没有凭据的 checkout 里拿不到实测的准确率数据。

Google 的 [function-calling guidance](https://ai.google.dev/gemini-api/docs/function-calling#best-practices) 建议活跃的工具集在 10–20 个之间。这是一个有用的实验范围，而不是针对本站 Gemini 2.5 Flash 或 Qwen 3.5 Flash 实测得出的分界线。只有在反复的实测证明有收益、而且不会丢掉间接请求、双语设置或能力发现之后，才启用裁剪。

## 约束

下面每一条被打破，都会有看得见的问题。

| 约束 | 原因 | 打破之后 |
|---|---|---|
| 工具在 `tools.ts` 中声明，不带 `execute`，在 `chat.ts` 的 `onToolCall` 里运行 | 索引在浏览器里；路由从不读取它 | 带 `execute` 的工具会在服务器上运行，而服务器没有索引；页面永远看不到这次调用 |
| 页面的上限始终高于路由的预算（`chat.ts` 里 `MAX_TOOL_CALLS` 为 10，路由里 `TOOL_BUDGET` 为 6） | 路由负责强制作答的那一步；页面的上限只是兜底 | 上限等于或低于预算，会在强制作答之前就停掉循环：满屏的步骤，没有回答 |
| 模型读到的每一个字都在 `prompts.ts` 里 | 语气、指令和工具描述集中在一处 | 散落在组件里的措辞会偏离人设，也会偏离基准测试里的 schema |
| 系统提示词保持逐字节相同（`askSystemPrompt`，只构建一次）；每次请求不同的内容作为 `data-context` 部分传递 | provider 的提示词缓存能装下这张几千 token 的地图 | 在系统提示词里放日期或当前页面，每一步都要为整张地图付费 |
| 模型只在 `models.ts` 里，每个都在网关的免费额度内；第一个是默认 | 路由只接受这些（`askModelOf`），而部署环境没有额度 | 写在别处的 id 会被悄悄替换成默认模型；付费模型在部署环境里会失败 |
| 副作用（`open_page`、`play`、命令的 `apply`）只在当前可见的对话中、有明确请求时才执行（`requestedAction`、`executeAskCommand`） | 模型选择意图；运行时掌管边界 | 后台的对话，或者只是提到某个页面的问题，会把读者带走或改掉设置 |
| 一条命令就是一个目录条目加上它在 `useCommandActions` 里的实现，绝不是只给 Ask 用的 setter | 在命令面板里点和在 Ask 里点，必须做完全相同的事 | 两条互相矛盾的代码路径；缺少描述会让 `tsc` 失败 |
| 行为上的选择是 `config.ts` 里的一个设置（两套预设、`valid()` 里的一个分支），用 `useAskConfig` / `askConfigNow` 读取 | devtool 会按平台展示并覆盖它 | 组件里多出一个 devtool 看不到也改不了的分支 |
| 标题 id 来自 `lib/heading-id.ts`，页面和索引都是 | 同一个函数生成锚点和链接 | 链接落在文章顶部，而不是那一段 |
| AI Elements、streamdown 和 AI SDK 客户端只从懒加载的模块中导入（`entry.tsx`、`askLazy`、面板） | 在 Ask 打开之前，这些都与页面无关 | 每个页面首次加载都要为聊天买单 |
| 手机抽屉保持 `height={detentHeight(1)}` 和 `restoreFocus={false}` | 输入框的键盘处理依赖这两者（[keyboard-input.md](./keyboard-input.md)） | 输入框藏在键盘后面，或者下一次触摸时键盘弹出来 |
| 对 `components/ai-elements/` 的改动只限于 Base UI 和本仓库所需（见下文） | 它们要一个一个地接手；在那之前跟随 registry | registry 的更新无法通过 diff 合进来 |

## 可以自由选择的

- **用哪些免费额度内的模型，以及顺序。** 第一个是默认。
- **每个设置的预设**，按平台，在 `ASK_PRESETS` 里。
- **人设和指令**，在 `prompts.ts` 里，遵守上面的约束（事实来自站点、说明自己是 AI、不做承诺）。
- **各项数值**：`TOOL_BUDGET`（只要低于 `MAX_TOOL_CALLS`）、`MAX_MESSAGES` 24、历史保留的 30 段对话、`MAX_CHUNK` 1200、`MAX_READ` 12,000、输出上限。
- **卡片和步骤的样子**，以及推荐问题（`ASK_SUGGESTIONS`、`ASK_CONTEXT_SUGGESTIONS`）。
- **工具筛选**：生产环境关闭；要试就在基准测试里试。

## 做法

**添加一条命令。** 在 `systems/command/catalog.ts` 里加一个条目（双语标题、给模型的描述、有限目标值的 `options`、一个 `policy.execution`），在 `useCommandActions` 里写它的实现，在 `scripts/ask-tools-benchmark.mjs` 里加一个用例。然后运行 `pnpm ask:test`、`pnpm command:test` 和 `pnpm ask:benchmark`。

**添加一个模型。** 查网关的目录（`availableToFreeTier`、工具、推理、不拿提示词训练），把它加进 `ASK_MODELS`，如果是新厂商，就在 `components/model-icon.tsx` 里给它一个标志。

**添加一个内容工具。** 在 `tools.ts` 里声明（`jsonSchema`，不带 `execute`），在 `prompts.ts` 的 `ASK_TOOLS` 里写它的描述，在 `chat.ts` 的 `onToolCall` 里运行它，在 `components/messages.tsx` 里显示它的步骤。

**添加一个设置。** 在 `AskConfig` 里加一个字段并写上文档注释，在两套预设里各给一个值，在 `valid()` 里加一个分支，在 devtool 的 Ask 部分（`systems/devtool/panel.tsx`）加一行，并在上面的设置表里加一行。

**做一个新的 surface。** 用 `lib/use-ask.ts` 里的 hooks（`useAskSession`、`useAskHistory`、`useAskPrefs`、`useAskRunning`、`useAskRequest`、`useAskContinuity`）把 `AskMessages`、`AskComposer` 和 `AskHistory` 摆在一起，放在一个懒加载的模块里。

**不用 key 试一试。** `pnpm dev`，随便问点什么：替身会搜索、显示卡片并列出链接。"open …" / "play …" 会触发动作；"Can I change the theme?" 会得到一张提议卡片，"Switch to dark mode" 会直接应用，"What can you do?" 会显示包含两条命令的发现菜单。

**检查它。** `pnpm ask:test`（点击的边界以及持久化的工具结果）、`pnpm command:test`、离线的 `pnpm ask:benchmark`。环境里有 `AI_GATEWAY_API_KEY` 或 `VERCEL_OIDC_TOKEN` 时，可以跑实测基准：

```sh
pnpm ask:benchmark --run --models=all --repeats=3
# A smaller smoke run:
pnpm ask:benchmark --run --cases=dark-en,language-zh,sky-indirect,discover-zh,hello
```

## 参考

### 文件

```
systems/ask/
├── index.ts           # AskChat (lazy), and which pieces to import for a surface of its own
├── lib/
│   ├── corpus.ts      # the index's shape: docs (a post in one language, a conviction, a commit…) cut into chunks
│   ├── tokenize.ts    # words in both languages (Intl.Segmenter), the same at build time and in the browser
│   ├── search.ts      # the index in the browser: fetched once, BM25 (MiniSearch), search + read
│   ├── doc-href.ts    # the doc a link points at, in the reader's language
│   ├── tools.ts       # the agent's content tools (search_site, read, present, open_page, play): declared once, run in the page
│   ├── chat.ts        # the session: current conversation, the agent loop (AI SDK Chat)
│   ├── chat-continuity.ts # another post is a new chat
│   ├── prefs.ts       # the last model and thinking level picked, what a new conversation starts on (no AI SDK, so the devtool can read it)
│   ├── storage.ts     # JSON in localStorage, where storage allows
│   ├── config.ts      # how Ask behaves: every setting, a preset per platform (desk / phone)
│   ├── history.ts     # past conversations, in localStorage
│   ├── page-context.ts # what the reader has open: the post and section, the entry, the commit
│   ├── pending-context.ts # what they pointed at for the next question (a selection, a drop), per conversation
│   ├── context-policy.ts # MAX_CONTEXTS (3), shared with the route
│   ├── pointed.ts     # a selection or a drop, as a context
│   ├── selection-layout.ts # where "Ask about this" stands; a quote tag's label
│   ├── use-ask.ts     # the hooks surfaces are built from: useAskSession / useAskHistory / useAskPrefs / useAskRunning / useAskRequest / useAskContinuity
│   ├── actions.ts     # the browser host for navigation, media and command clicks
│   ├── action-policy.ts # requestedAction: was open / play explicitly asked for; siteActionHref
│   ├── command-tools.ts # offer-only tools generated from systems/command/catalog.ts, and list_commands
│   ├── execute-command.ts # executeAskCommand: availability, targets, policy, foreground
│   ├── command-state.ts # successful taps recorded in tool outputs and history
│   ├── stand-in-command.ts # the keyless stand-in's scripted command calls
│   ├── models.ts      # the models the picker offers and the route accepts; the thinking levels
│   └── intent.ts      # is this a question or a search?
├── components/
│   ├── entry.tsx      # AskChat / AskPanel, lazily loaded over a skeleton
│   ├── lazy-view.tsx  # askLazy, FadeSlot: load a piece, fade it in over the skeleton
│   ├── skeleton.tsx   # what a surface shows while the conversation loads
│   ├── messages.tsx   # AskMessages: the conversation, steps, copy / regenerate
│   ├── command-card.tsx # compact command actions and the expandable discovery menu
│   ├── cards.tsx      # AskCards: what the agent presented (a strip) and what an answer used (rows)
│   ├── context-tag.tsx # what a question is about, as a tag
│   ├── selection.tsx  # "Ask about this" over words selected on the page
│   ├── actions-host.ts # the agent's hands: open a page at a spot, play a talk, run a command
│   ├── composer.tsx   # AskComposer: field, model, thinking level, voice, send / stop
│   ├── model-icon.tsx # each model maker's mark, for the picker
│   ├── history.tsx    # AskHistory: past conversations
│   ├── chat.tsx       # the center place: the palette, widened into two panes (lazy-loaded)
│   ├── panel.tsx      # the side place, and the phone's drawer
│   ├── activity.tsx   # the top place and the pill: a Live Activity in the Dock
│   ├── activity-body.tsx # the Dock panel's conversation, and the session bridge for the pill
│   └── placement.tsx  # the placement menu / buttons, minimize, the drag handle, the drag's overlay
├── prompts.ts           # every word the model reads (system prompt, voice, answer-now, context, tool descriptions) and the suggested questions
├── surfaces.tsx         # AskSide, AskDock, AskDragging, AskSelection: mounted once in the root layout
└── strings.ts           # en / zh

lib/ask-corpus.ts      # reads the site into the index (Node, build time)
lib/ask-prompt.ts      # fills in the system prompt: the About and a map of the site
lib/follow-href.ts     # follow a link on this site, firing hashchange for the page already open
lib/highlight-quote.ts # open_page's highlight (CSS Custom Highlight API)
lib/use-hash-landing.ts # pages land on #anchors: scroll, wash, open
scripts/ask-index.ts   # writes public/ask/index.json (`pnpm ask:index`; predev and build run it)
scripts/ask-tools-benchmark.mjs # `pnpm ask:benchmark`
scripts/tests/ask-commands.test.mjs # `pnpm ask:test`
app/api/chat/route.ts  # the one server route: key, prompt, tools, stream, the stand-in
components/ai-elements/  # AI Elements, as the registry ships them (see below)
```

### AI Elements，基于 Base UI

聊天界面由 [AI Elements](https://elements.ai-sdk.dev)（shadcn registry，复制到 `components/ai-elements/`）搭建，底层是 shadcn 的 **Base UI** 原语（`components.json` 的 style 为 `base-maia`；原语落在 `components/ui/`）。它们直接使用站点的 token（`--muted`、`--accent`、`--popover`……），所以本来就穿着站点的配色。计划是一个一个地接手它们；在那之前，对它们的改动只限于 Base UI 和本仓库所需的：

- `asChild` → Base UI 的 `render`（大多数由 CLI 转换；tooltip 的触发器是手动修的：否则会出现嵌套的按钮）。
- `@radix-ui/react-use-controllable-state` → `lib/use-controllable-state.ts`。站点自己不依赖 Radix；cmdk 仍然会带进来 `@radix-ui/react-dialog`。
- 菜单项在 `onClick` 时选中（Radix 里是 `onSelect`）；preview-card 的延迟设在触发器上。
- 弹出层的定位器在 `z-[10060]`，高于命令面板（`z-[10050]`）。
- Streamdown 的插件在消息里精简为 `cjk` + `code`（推理里只有 `cjk`；没有 mermaid，没有 TeX），它的 `@source` 行写在 `globals.css` 里，好让 Tailwind 生成它的 class。
- 代码块读取的是 shiki 1（站点用的那个），并把异步结果保存在 state 里，而不是在渲染时读取 ref。

### 待定

- 按某个维度过滤 /works 或 /prompt，在 /works 上就地展开一行。
- 路由除了输入上限之外的限流，以及花费上限。
- 一套评测集，用来选择默认模型和地图的详细程度。
