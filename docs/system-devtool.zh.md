---
origin: "AI-translated from the original"
---

# Devtool 系统

调试面板：十三个模块，用来一边拨动站点的各种旋钮（壁纸、玻璃、天空、阅读、Ask、语音、光晕……），一边看页面如何反应。它在所有环境下默认关闭，开发环境也不例外；通过 `D`、⌘K 里的 Debug Panel 一行，或长按搜索按钮唤出。在手机上，它要么是停靠在底边的 sheet，要么是自由浮动的胶囊；在桌面上，它永远是浮动的胶囊 ⇄ 窗口这一对。每一行只要偏离了默认值，就会带一颗星：琥珀色表示只在本次会话内有效的覆盖，蓝色表示已保存的设置。

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-devtool/phone-sheet.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上停靠的 devtool：首页上方一个停在 0.7 detent 的底部 sheet，依次是标题栏、模块图标组成的导轨、带一行状态的折叠模块、展开的 Wallpaper 模块，以及固定在底部的 footer。" />
  <img src="/img/docs/system-devtool/phone-pill.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一部手机，sheet 被拉离底边之后：右上角只剩一个带 D 键提示的黑色 Debug 胶囊。" />
</div>

手机上的停靠与浮动（无头浏览器，393pt 宽）。sheet 和其他 surface 一样，用的是站点的 detent，上方的页面保持可用。标题下方的导轨里，与当前页面相关的模块下面有一个点，Sky 图标上有一颗星（蓝色：已保存的设置，这里是 Follow the Sun 被关掉了）。拉离底边之后，剩下的只有胶囊。

![桌面右上角浮动的 devtool 窗口，下面是 20:30 强制下雨的首页；Sky 模块展开，标题、Time of day 和 Condition 上有琥珀色星，Follow the Sun 上有蓝色星。](/img/docs/system-devtool/desk-window.png)

在桌面上，devtool 是右上角一个 420px 的窗口，好让它所针对的页面留在视野里。这里 Sky 模块强制了下雨，时钟被拖到 20:30：模块标题、Time of day 和 Condition 上是琥珀色星（刷新即消失），Follow the Sun 上是蓝色星（已保存），模块的星也重复出现在它的导轨图标上。播放头停在日间条带里；因为时钟说是夜晚，各个天气状况的选项都换上了夜间的样子；实时状况（Clear）保留着它的绿点。

- 底下的页面保持可用：可以滚动、可以点击，每拨一下旋钮都会重绘。
- 折叠的模块从不是盲的：它的标题栏带着一行状态和它的星。
- 展开哪些模块跟随页面（相关性），而不是跟随上一次点了什么。
- 每个控件都是站点自己的（`Switch`、`Segmented`、`Slider`），用系统色调，所以面板读起来就是站点的一部分。

## 原理

```
systems/devtool/
├── provider.tsx    # DevtoolProvider: enabled, open, docked; saved devtool
│                   #   settings (hux_devtool); DRAGGABLE_DEFAULTS / _INSTANCES
├── dock.tsx        # DevtoolFAB: where the devtool is, and the gestures that move it
├── panel.tsx       # The modules, rail and footer: content, unaware of its container
├── page-meta.tsx   # DevtoolPageMeta: a post publishes its frontmatter to the panel
└── index.ts        # Barrel exports
```

`DevtoolProvider` 挂在 `shared/providers.tsx` 里（它会被告知命令面板是否打开，以及怎样关掉它）；`<DevtoolFAB />` 在 `app/layout.tsx` 里挂一次。`isEnabled` 之前，`DevtoolFAB` 什么都不渲染。

### 一个对象，两种停靠

devtool 是**一个对象**，而不是"一个按钮打开一个面板"。它要么停靠在底边，要么自由浮动；要么展示着模块，要么收起。provider 持有两个布尔值 `isOpen` 和 `isDetached`，由视口把它们变成一个外壳：

|          | 停靠（有一条边可贴） | 浮动 |
|----------|-------------------------|----------|
| **打开** | `SurfaceSheet`，底边，`SHEET_DETENTS` | `SurfaceWindow`，右上角，420px |
| **关闭** | 什么都没有；用 `D` 或 ⌘K 唤出 | 胶囊 |

所以胶囊是一种**状态**，而不是用来打开 devtool 的东西：它就是收起的 devtool，只有在 devtool 浮动时才存在。桌面没有值得停靠的底边（一个贴着边、撑满全高的 devtool 会挡住它所针对的页面），所以从 Tailwind 的 `sm` 起，无论设置怎么说，它都按浮动来处理（`canDock` 为 false）。这就是它一直以来的胶囊 ⇄ 窗口这一对；多出第二种停靠的是手机。

### 手势

两个，彼此互为镜像：

| | 手势 | 效果 |
|---|---|---|
| **离开底边** | 把 sheet 往上拉过它的顶边，松手 | 落成胶囊 |
| **回到底边** | 把胶囊拖到底边上，**按住**，松手 | 一块停靠垫升起来迎接它；松手后 sheet 回来 |

![胶囊被拖到手机底边上：下面立着一块浅浅的停靠垫，边框是实线，拖动条已经填满整个宽度。](/img/docs/system-devtool/phone-dock-pad.png)

胶囊在垫子上按住超过了 `DWELL_MS`：垫子的边框变成实线，拖动条已经填满，此时松手就会停靠（`data-dock-pad="armed"`）。

两者基于同一个想法：*它该在哪里，就把它挪到哪里*。所以哪一个都不需要单独去学，被拖动的胶囊下面出现的停靠垫，本身就在教这一对手势。

脱离底边时，如果命令面板开着，也会一并关掉。通常正是命令面板唤出了 devtool，而要一个胶囊，就是要把页面要回来。

窗口的标题栏也保留了一个停靠按钮（`PanelBottom`，在关闭按钮旁边，只在 `canDock` 时出现），因为在触屏上，把窗口拖到边上的途中免不了要挡住屏幕。

**离开底边。** 拉到顶部*停住*，会像平常一样吸附到最高的 detent；*继续往上拉*才会脱离。触发阈值是手指越过顶部后的 `PULL_PAST_TOP_TRAVEL`（14px），而拖动条上方大约只剩二十像素；一旦松手就会触发，外壳会稍稍让一下（`data-pull-armed`），让手势在发生之前就看得见，也还来得及退回去。

这个阈值之所以小，是因为它是量出来的，不是选出来的。一次上拉的大部分行程都花在改变 sheet 的高度上（在 iPhone 13 上从 0.7 detent 算起是 187px），剩下的才是拖动条到玻璃顶边的距离。见 `systems/surface/sheet.tsx` 里 `PULL_PAST_TOP_TRAVEL` 旁边的注释，那里也解释了这个手势为什么读指针，而不读 Base UI 公布的 overshoot。

**回到底边。** 停靠垫只在手里真的拿着一个胶囊时才升起，也只在有边可停靠的地方出现，因为它唯一的任务就是充当放置目标。它站在 sheet 将要站的位置，按 surface 系统的边缘间距内缩，顶部是 sheet 自己的拖动条，等在那里。

**停靠要按住。** 胶囊的存在是为了让一个浮动的东西能放到任何地方，所以从垫子上经过（或者直接穿过它松手）只会把胶囊留在那里。只有胶囊在垫子上被*按住*满 `DWELL_MS`（550ms）之后松手，才会停靠。垫子做得浅也是同样的原因（`PAD_HEIGHT`，84px，约为手机屏幕的十分之一）：一个吞掉底部四分之一的目标，就把底部四分之一从胶囊那里拿走了。

等待是画出来的，不是藏起来的：拖动条在恰好一个停留时长内填满整个宽度，用的就是真正在跑的那个计时器；如果胶囊提前离开，它会退回去。`data-dock-pad` 承载三种状态（`idle`、`over`、`armed`）；没有 CSS 读它，它是留给测试和眼睛的把手。

停靠会让胶囊*忘记*它被拖到过哪里（`forgetPosition`，`systems/draggable`）：它松手时所在的位置是一个目标，不是一个座位，所以下次 devtool 离开底边时，它会回到自己的角落，而不是停靠口那里。

### 非模态，可叠放

面板从不把页面拿走，因为 devtool 存在的意义就是在拨动壁纸、玻璃和天空时看着页面反应。底下的页面保持可滚动、可点击，在页面上的按压归页面所有；关闭按钮、`D`、Escape 和向下拖动可以让它退下。

因为它是一个 surface，从它打开的选择器（Wallpaper 模块里当前图片那一行会打开壁纸选择器）会**叠放**在它上面，从命令面板算起三层：命令面板 → devtool → 选择器，每升起一层，下面那层就退后一步。在桌面上，窗口直接共存，选择器在最上面。About 打开时，devtool 浮在它之上（`DEVTOOL_OVER_ABOUT_Z`），这样就能在光环显示着的时候拨动 Glow 模块的旋钮。

### 可组合

devtool 在生命周期里会被三种不同的外壳承载，所以关于"它在哪里"的任何东西都不住在模块里。`panel.tsx` 导出 `DevtoolModules`、`DevtoolTitle`、`DevtoolRail`、`DevtoolSections` 和 `DevtoolFooter`（不知道自己容器的内容），`dock.tsx` 把它们放进当前的外壳，外面包上共享的 `<SurfaceBody>`（标题，`toolbar` = 导轨，`footer` = `Press D to toggle` · `Disable Devtool`），所以三种外壳看起来都和站点上其他所有 surface 一样。

这就是 surface 系统在 `<AdaptiveSurface>` 之下有一层**原语层**的原因（见 [Surface System](./system-surface.md)）。`<AdaptiveSurface>` 只编码一条规则：*由视口选择形状*。这条规则不适用于 devtool，它的形状由开发者用手势来选。所以 devtool 直接组合 `<SurfaceSheet>` 和 `<SurfaceWindow>`，就像命令面板为了它的搜索框标题栏已经在做的那样。

切换外壳会重新挂载模块，因为不同外壳 portal 到不同的地方。必须在切换中存活的东西属于 provider 或 `localStorage`，折叠状态和所有已保存的设置本来就在那里。模块自己的局部状态（滚动位置、Sky 模块的 Tune 和 Motion 折叠、正在进行的 Play）不会保留。

### 拖动

只有一个可拖动实例 `devtool`，因为胶囊和窗口是同一个对象的两种尺寸。它们共享右上角这个锚点，所以窗口在胶囊所在的位置打开，胶囊落在窗口被留下的位置。这个实例会持久化（`hux_drag_devtool`），两者挂载时各自读回对方的位置。（在 Draggable 模块里关掉 `persist`，这种交接就会停止；在下次刷新之前，两者各自保留自己的偏移。）

两者都直接使用 `useDraggable`，而不是 `withDraggable` 这个 HOC：胶囊需要自己的拖动处理函数来知道它何时在垫子上方，而这恰恰是那个 HOC 存在的目的所要隐藏的。

胶囊本身就是把手；窗口靠标题栏拖动。模块主体从不是把手，所以滑块、文本框和滚动都能正常工作。在手机上，sheet 的拖动条完全取代了拖动。

### 进与出

| 入口 | 效果 |
|--------|--------------|
| `D` | devtool 开启后，切换面板。停靠时：sheet ⇄ 无。浮动时：窗口 ⇄ 胶囊。 |
| ⌘K："Debug Panel: On / Off" 一行（slash 模式下是 `d`） | 开关（见下文）。 |
| 长按搜索按钮 | 唤出它。没有写进文档。 |
| 胶囊 | 只在浮动时存在。 |

焦点在输入框、textarea 或任何 contenteditable 元素里时，命令面板打开时，以及按住 ⌘、Ctrl 或 Alt 时，`D` 都会被忽略（`DevtoolProvider` 的 keydown 监听）。

**开和关说的是屏幕上有什么**，这和 `isEnabled` 不是一回事，两种停靠的答案也不同：

| | "开"的含义 | "关"做什么 |
|---|---|---|
| 浮动 | `isEnabled`：胶囊候着，所以它在屏幕上 | 禁用；胶囊和窗口都消失 |
| 停靠 | `isOpen`：没有胶囊，所以抽屉必须真的升起来 | 关上抽屉 |

这就是 provider 上的 `isShowing` / `toggleShowing`，命令面板的那一行（`systems/command/actions.tsx` 里的 `debug-panel`）只是报告它。如果那里读的是 `isEnabled`，那么把抽屉划走之后，这一行会显示 `On`，屏幕上却什么都没有，要重新打开得按两次。**把抽屉往下划就是关**，按一次就回来。

停靠时的"关"只关闭、不禁用，这是有意的：`isEnabled` 同时也是让会话覆盖保持生效的东西（`systems/ambient/provider.tsx`、`components/ui/hero-exit.ts`），把面板收起来不等于把它的状态扔掉。要在手机上真正禁用，用 footer 里的 "Disable Devtool"。

`isFloating` 和 `canDock` 放在 provider 上而不是 `dock.tsx` 里，因为这个开关需要和形状一样的答案，两个地方各自判断，就是两个会慢慢走岔的地方。

这一行的 `kind` 跟着按下之后会发生什么走。"开"会打开一个 surface，所以命令面板作为一层叠放留在它后面；"关"什么都不打开，所以它像其他设置一样直接离开。

**隐藏的入口。** 长按搜索按钮（两种形状都行：首页的搜索栏或圆形 FAB）满 `DEVTOOL_HOLD_MS`（1.2 秒）会唤出 devtool。承载这次长按的按压不会同时打开命令面板；滑动超过 `HOLD_SLOP_PX`（10px）算作拖动或滚动，会取消长按。

长按可以短，因为进度是看得见的。前 `DEVTOOL_HOLD_REVEAL_MS`（700ms）什么都不显示，这已经超过任何一次轻点，所以普通按压永远看不到它，入口保持隐藏。之后一个圆环（`HoldRing`）从 1.3 倍收拢到按钮自己的边缘，恰好在长按完成时到达。正是这个反馈让更短的长按变得安全：一次意外的长按会及时现身，让你来得及松手。

圆环画在按钮**外面**，位于一个测量出来的 `fixed` 矩形上，而不是画在按钮里面：手指正按在按钮上，画在那里的任何东西（换掉的图标、填充）都在指尖下面，看不见。按钮的两种形状共用 24px 的圆角（`FAB_RADIUS`），所以一个圆环两者都合适。见 `systems/command/fab.tsx`。

### 会话覆盖与已保存的设置

每一行写入的值属于两种之一，它的星（`PanelStar`，带 `source`）说明是哪一种。颜色的全部意义就在这个区别上：琥珀色的星是一次随标签页结束的实验，蓝色的星是这个浏览器会记住的选择。

![会话覆盖（琥珀色）存在 provider 的 useState 里，刷新即消失，只在 isEnabled 时被读取；已保存的设置（蓝色）存在 localStorage 里，刷新后仍在，devtool 关闭时也生效。行的星汇总成模块的星（最强者胜出）和它的导轨图标；会话星会把模块拉开，已保存的星不会。devtool 自身的状态（启用、停靠、折叠、拖动位置）不带星。](/img/docs/system-devtool/overrides-vs-settings.svg)

- **会话覆盖**（琥珀色）是某个 provider 里的 React state：`useWallpaper` 上的 `devtoolOverrides`（Full、Widget、Soft edge、Bezel、Scroll、No WebGL2），`useWeather` 上的 `debugOverride` 和 `sceneOverrides`（强制的天气状况和 Tune），`useAmbientTime` 上的 `timeScrubMinutes` / `dayOffset`（时间旅行），以及 `useDevtool` 上的 `heroExitOverride`。它们刷新即消失，而且除非 `isEnabled`，读取它们的地方都会忽略它们，所以禁用 devtool 会立刻把真实的站点还回来。壁纸家族变化时，bezel 和 soft-edge 覆盖也会被丢弃（它们带有 `edgeFamily` 标记）。
- **已保存的设置**（蓝色）写入的是站点其余部分读取的同一个存储，所以 devtool 关闭时它们也生效，选择器或 ⌘K 显示的也是同一个值。大多数存在各自系统的键里（`hux_ambient_settings`、`hux_theme`、`hux_glass_tint`、`hux_reading_*`、`hux_ask_config`、`hux_voice_model`、`hux_glow_v2`、`hux_music_mock`……）；只有 devtool 会设置的那些存在 `hux_devtool` 里（Phone palette、Home weather、Works 的几行、可拖动配置）。
- 行的星是一个按钮：按下它会把这一行恢复原样。模块标题的星汇总它的各行（`strongest`：只要有一颗会话星，它就是琥珀色）；如果模块传了 `onReset`（Ask、Voice、Glow），标题的星会重置整个模块。

### 折叠与导轨

面板里的模块多到一屏放不下，所以展开哪些是算出来的，而不是写死的。每个模块给它的 `<DebugSection>` 传两样只有它自己知道的东西：

- **`relevant`**：它此时此地重要吗？相关的模块默认展开，其余默认折叠。顺序从不改变，所以不会有东西在你手底下挪动；不重要的只是折叠着等着。

  | 模块 | 何时相关 |
  |---|---|
  | Frontmatter、Reading | 页面是一篇文章（设置了 `pageMeta`） |
  | Works | 在 `/works` 上 |
  | Wallpaper、Sky | 在首页（壁纸就是页面），或者有东西被会话覆盖了 |
  | Glass | 在首页 |
  | Music | 有曲目在播放或暂停，或者开着 mock |
  | Command | 在手机上（`canDock`），因为它唯一的设置是手机上的命令面板 |
  | Ask | 这个页面上调用过 Ask（`askStarted`） |
  | Voice | 总是 |
  | Glow | About 打开时（面板会滚动到它） |
  | Draggable | 从不；它是工具，不是任何页面的主题 |
  | Windows | 有窗口打开着 |

  *会话*覆盖会把模块拉开（你正做到一半）；偏离默认值的*已保存*设置不会（它是偏好，会让模块在任何地方永远展开）。

- **`star`**：里面有东西偏离默认值吗？见上文。它在标题旁边，所以折叠着的模块也能说"看看这里"。

每个折叠的标题栏还在它的 `action` 槽里带一行状态（`sans · M/M`、`weather · gl`、`sheet`、`5/7`、窗口数……），所以折叠不等于盲。

**手动折叠按相关性分别记住。** 点击标题栏会把折叠状态存在 `id:relevant` 或 `id:idle` 下（`sectionFoldKey`），所以"在文章里展开 Frontmatter"和"在别处把 Frontmatter 收起来"是两个答案，而不是一个由最后访问的页面说了算的答案。只用裸 id 存下的折叠（引入相关性之前的）在加载时直接丢弃，而不是猜着归入某个情境。

**导轨**是索引：`MODULE_ORDER` 里每个模块一个图标，相关的模块下面有一个点，带着模块的星，展开时是实心的小块。

- **点按**：展开那个模块，折叠其他所有模块，滚动到它。再点一次，把折叠交还给相关性和你自己的选择。
- **Shift 点按**（或 ⌘ / Ctrl / Alt）：展开它，不折叠其他任何模块。

导轨的折叠是用来导航的，不是用来保存的：它们存在期间优先于已保存的折叠，从不写入存储，换一个路由就没有了。点击某个模块的标题栏，会收回导轨对它的折叠，并保存你的选择。

模块通过 `<DevtoolSections>` 向导轨报告自己，它在 `dock.tsx` 里包住外壳的整个主体（导轨和模块）；模块仍然是唯一知道自身状态的地方。

## 模块

按 `MODULE_ORDER` 排列，这既是导轨的顺序，也是列表的顺序。(S) 标记会话覆盖，其余凡是会写入的都是已保存的设置。

1. **Frontmatter**：当前文章由 `<DevtoolPageMeta>`（`app/writing/[slug]/[lang]/page.tsx`）发布的 frontmatter：slug、渲染的语言、文章的语言范围，然后按书写顺序列出每个字段，附一个 Copy JSON 按钮。只读。
2. **Reading**：文章的阅读界面：Typeface（Sans / Serif）、Size 和 Measure（S / M / L）、Media bleed、Focus mode、Ruler dock（Left / Right）。与文章自己的 "Aa" sheet 写入的是同一组设置（`components/post/reading-settings.ts`、`ruler-settings.ts`）。
3. **Works**：`/works` 怎样画一个章节的引用（`worksRef`：Auto、Stub、Ring、Row、Under、Hash；Auto 在桌面上是 Hash，在手机上是 Under），以及两个试验中的布局，Projects 书架和 Feed 视图，默认都关闭。
4. **Wallpaper**：整个背景系统。它以一行 `Now:` 开头，说明正在绘制什么（`Weather · Sky · light · full @1.00`，或者图片的 `Sonoma · dark · desktop @0.62`，最后一个字段说的是桌面还是阅读界面；适用时后面再跟上 veil 和 `blur`）。然后是 Weather / Image 开关；Weather 下面是 **Style**（Sky / Gradient / Classic，与选择器显示的三个色块相同）和 **No WebGL2**（S：假装 WebGL2 不存在，好看到 Sky 的降级方案；除此之外样式和引擎一一对应，所以没有引擎选择器）。有一行显示当前图片（及其分辨率），点开会在面板上方打开选择器：在目录里挑选是选择器的工作。然后是 Full、Widget 和 Soft edge（S），Bezel 开关（S），以及开启时它的 Tint（Black / Dark / Theme / Custom，带一个取色器）、Band 和 Radius；Scroll（S：Window / Container）和 Hero exit（S：Scroll / Fade；平台默认值是 `defaultHeroExit`）；然后是阅读处理，Reading blur（仅图片）和 Reading dim。最后一行是图片解析后的资源路径，或者天气的实时引擎：`GL · 1266×791 · 0.88× · 6.4ms`（内部分辨率、自适应缩放、帧时间），或者 Sky 不得不降级时的 `CSS · Gradient` 加一条说明。
   Full 和 Widget 是*相互独立*的开关，不是同一个控件的两半：持久化的设置只能是其中之一，但面板存在的意义就是看到设置表达不了的组合。
5. **Glass**：Material（Tinted (色调) / Clear (透明)）和 Tint（Neutral / Wallpaper），然后一行读数，说明可读性策略为正在绘制的壁纸算出了什么（`ink` / `flip` / `flip·mid`、`busy`、`relief`、`+ink%`、`glass +%`，以及实验室的数值生效时的 `lab`），它链接到 Legibility Lab（`/lab/legibility`），那里每一个数值都是一个滑块。见 `docs/system-legibility.md`。
6. **Sky**：天气和时间作为一件事，因为壁纸是两者的函数。从上到下：一行状态（状况 · 时段 · 时钟、太阳高度、月亮照亮比例）；**Home weather**（Widget / Line：网格卡片，或问候语上方的一行）；一条日间时间轴（S），用当前状况下天空的颜色绘制，标出日出和日落，带可拖动的播放头和 ▶ 播放，下面的时段名称可以让时钟跳过去；**Follow the Sun**（就是 Appearance 本身；关掉就是 Follow the System）；六种天气状况（S），按生效的钟点预览，再点一次回到实时；日期滑块（S），用来移动月亮；**Gyro**；**Window**（天空之窗，带 Heading 和 Pitch 滑块（S），在没有传感器的地方用来瞄准它），以及一个折叠的 **Motion** 读数，显示传感器自己的数值；**Located by**（地点 · 提供方 · 时长，IP 的时区偏移与设备时钟不一致时显示 `tz≠`）；**Refetch**（Location / Weather；Weather 会把两者都重新获取）；以及一个折叠的 **Tune**（S）。**Now** 重置时钟、日期、天气状况和 Tune；已保存的行保留它们的蓝色星。

   Play 是两个按钮，▶ **Day**（一分钟走完一天）和 ▶ **2×**（半分钟）。两者都从播放头当前位置开始走，穿过午夜再绕一圈；按亮着的那个会暂停，按另一个会改变速度而不重新开始。实时状况的选项带一个绿点，时钟上太阳落下时，每个选项都显示它的夜间样子。Tune 的滑块是云量、降水、风速、风向和 veil，下面是原始预报（WMO 代码、云量、mm/h、风、太阳的高度 · 方位角，以及 API 自己给的白天 / 夜晚）。

   Gyro 一行是让 Sky 的雨雪沿真实重力方向落下的倾斜（`docs/ambient-sky.md` → Gyroscope tilt），读数是实时角度。在 iOS 上，它也是除壁纸选择器外第二个可以授予运动权限的地方，因为请求权限需要一次点击。

   **流星出现的窗口在它依赖的两条轴上都有标记**，因为规则有两半，而这里各有一个界面单独回答其中一半：

   - **何时**：日间时间轴底部的一条横条，两端带刻度，墨色与它两侧的日出日落标记相同；时间读数和它们并排写在下面。窗口会跨越午夜，所以它以两段横条出现，分别贴着条带的两端，读作一个范围（`19:40 → 05:21`），由 `meteorWindowSpan()` 在拆分它们的代码旁边重新拼起来。它是通过向 `meteorPossible()` 询问真实场景得出的，而不是去解太阳高度，所以标记不会和真正触发流星的那次点击走岔。天空被遮蔽时，它也只花一个场景而不是三百个，因为 `clarity` 在一天之内不会变。
   - **透过什么**：每个透过它能看到流星的天气状况选项上，都有一个角标。它回答的是*如果我现在选这一个，能看到流星吗？*，所以它是**通过 `toSceneWeather`** 来求值的。那是唯一知道"强制一种状况"意味着什么的函数：真实测量值会被拿掉，因为 10% 的实测云量是关于今天晴朗天空的事实，而不是关于正在预览的阴天。用任何别的方式预测，都会让标记承诺一件点击兑现不了的事。覆盖也算在内：强制 **Cloudy**，标记就熄灭（这个 profile 的云量是 0.7）；把 **Tune → Cloud** 拉到 20%，它又回来了。只要那个覆盖还在，Clear 也会跟着变，因为在 70% 强制云量下的晴空里确实没有流星。不过只管规则的天气这一半：一个在正午也跟着变暗的选项，会把时间轴的问题答得很糟，所以它不这么做。

   两个条件以及为什么是十二度，见 `docs/ambient-easter-eggs.md` → The shooting star。
7. **Music**：播放器的状态、曲目和在播放列表中的位置，以及 **Mock player** 开关（`hux_music_mock`）：一个离线的 fixture 驱动整个音乐系统，不需要 YouTube，原地替换，无需刷新。
8. **Command**：**Phone palette** 开关，Sheet（命令面板在手机上所在的底部 sheet）/ Popover（手机宽度下的桌面卡片，也就是命令面板原来的样子）。可以在同一台设备上比较两者；popover 的代码路径为此完整保留。
9. **Ask**：Ask 的行为方式（`systems/ask/lib/config.ts`）。一行 **Preset** 选择显示的平台，Desk 或 Phone，初始是当前视口所属的那个（在标题栏里注明）；下面是那个平台的所有设置：Ask 从搜索和从一次调用打开时出现在哪里、在阅读页面上、位置按钮、拖动、最小化（收进 Dock，或者关闭）、回复生成期间的胶囊，以及语音光晕的两段等待。然后是访客的模型和思考等级。每一行的蓝色 `*` 把它重置为预设值（或默认值）；标题的星重置全部。见 `docs/system-ask.md` → Settings, and a preset per platform。
10. **Voice**：转写模型（Browser，或一个 Gateway 模型及其价格）和录音视觉效果（Glow / Waveform），由命令面板和 Ask 共用。它会检查 `/api/voice`，并在 Gateway 不可用、改用浏览器自带识别时说明。
11. **Glow**：光的音量（`systems/glow`）：Colours（Siri，或按色轮规则取壁纸的主色）及实时调色板的色块、全站的 Strength，以及 About 光环的运动、强度、桌面和手机上的深度和基线。一个 Show / Hide About 按钮把光环调出来供评判。
12. **Draggable**：`DRAGGABLE_INSTANCES` 里每个条目一行，各带一个 persist 开关（大脑）和一个拖动开关；任一项偏离它在 `DRAGGABLE_DEFAULTS` 中的条目时，带一个蓝色 `*`。实例有：`devtool`（拖动、持久化）、`command-fab`（不拖动，预先开启持久化）、`command-palette`（拖动，每次打开回到中央）、`surface-wallpaper`、`surface-playlist`、`surface-theater-playlist` 的窗口（拖动，回到中央），以及 `surface-attachments`（列出了，但没有 defaults 条目，所以是关闭的）。
13. **Windows**：打开的应用窗口，最前面的排在最先，显示是否聚焦 / 最小化、runtime 和 flavor、来源（web / built-in / online）、尺寸预设、重新加载次数、矩形，以及 bundle 或页面 URL。只做检查：应用从 ⌘K 启动，bundle 也从 ⌘K 按 URL 加载。标题栏显示打开的数量。

## 约束

- **会话覆盖通过 `isEnabled` 读取。** 每个读取覆盖的地方都会检查它（`systems/ambient/provider.tsx`、`useHeroExit`）。一个跳过这项检查的新覆盖，会在 "Disable Devtool" 之后继续改变站点，而访客看不出原因。
- **星的 `source` 必须与值所在的位置一致。** 琥珀色承诺刷新即消失，蓝色承诺会保留。一个被标成琥珀色的已保存值，就是一个悄悄比实验活得更久的设置。
- **`MODULE_ORDER` 与 `DevtoolModules` 保持同步。** 导轨从前者读取顺序，而且只列出它认识的 id；渲染了却不在其中的模块永远到不了导轨上。
- **模块对自己的外壳一无所知。** 有三种外壳承载它们，切换会重新挂载；必须保留的状态放进 provider 或存储。
- **模块主体从不是拖动把手**，否则窗口里的滑块和滚动会失灵。
- **可拖动的东西需要两个条目。** `DRAGGABLE_INSTANCES` 让它出现在 Draggable 模块里；`DRAGGABLE_DEFAULTS` 给它姿态。没有 defaults 条目，它会退回到不可拖动、不持久化。
- **停靠时的"关"只关闭，从不禁用**，否则覆盖会随着一次划动消失。

## 可以自由选择的

- 某个旋钮放在哪个模块里、它的行顺序和标签。
- 每个模块折叠时的状态行。
- 什么让一个模块 `relevant`，只要已保存的设置本身永远不会让它变得相关。
- 模块标题的星是否重置整个模块（`onReset`）。

## 做法

**添加一个模块。** 在 `panel.tsx` 里写一个 `function XModule()`，外面包一个 `<DebugSection id title icon relevant star action>`；把它加进 `DevtoolModules`，并在同一位置把它的 id 加进 `MODULE_ORDER`；用 `PanelRow` + `PanelToggle` / `PanelSegmented` / `PanelSlider` 搭建各行，值偏离默认时加一个 `PanelStar`；把各行的星汇总成该区块的 `star`（`strongest`）。

**添加一个只有 devtool 会设置的已保存设置。** 在 `DevtoolSettings` 上加一个字段，默认值写在 `SETTINGS_DEFAULTS` 里，在 `getDevtoolSettings` 里校验，在加载 effect 里设置，再加一个调用 `setDevtoolSettings` 的 setter；把它暴露在 context 上。在别处通过 `useOptionalDevtool()` 读取，并以默认值作为兜底，这样 provider 之外的页面也能渲染。

**添加一个会话覆盖。** 在拥有这个值的 provider 里加一个 `useState`，读作 `isEnabled ? override : undefined`，加一个清除它的琥珀色 `PanelStar`，以及一个包含"有东西被覆盖了"的 `relevant`。

**让一个 surface 的窗口可拖动。** 给它一个 `id`，然后在 `systems/devtool/provider.tsx` 里把这个 id 同时加进 `DRAGGABLE_DEFAULTS`（通常是 `{ draggable: true, persist: false }`）和 `DRAGGABLE_INSTANCES`（带一个英文和一个中文标签）。

## 参考

### useDevtool

```typescript
const {
  isEnabled,        // Whether devtool is enabled at all (persisted)
  isOpen,           // Whether the modules are showing
  canDock,          // Does this viewport have an edge worth docking to?
  isFloating,       // detached || !canDock: the shape-deciding one
  isShowing,        // Is any of it on screen? (see "Getting in and out")
  toggleShowing,    // The palette's On / Off switch
  toggle,           // Toggle the panel (D)
  open,
  summon,           // Enable if needed, then open (palette and hold)
  close,
  detach,           // Lift off the edge; collapses to the pill
  dock,             // Back onto the edge; reopens as the sheet
  toggleEnabled,    // The footer's Disable Devtool
  setEnabled,
  getDraggableConfig, setDraggableConfig,   // per-instance drag / persist
  pageMeta, setPageMeta,                    // the Frontmatter module's source
  phonePalette, homeWeather, worksRef, worksShelf, worksFeed,  // + setters
  heroExitOverride, setHeroExitOverride,    // a session override
} = useDevtool();

// Outside the provider (page content), never throws:
const devtool = useOptionalDevtool();
```

存储的 `isDetached` 不在 context 上；请读 `isFloating`。

### 控件

行是 `PanelRow`（标签在左，控件在右，或用 `stacked` 放在下面），值不在默认时加一个 `PanelStar`；开关是 `PanelToggle`；选择是 `PanelSegmented`；数值用 `components/ui/slider.tsx` 里共享的 `Slider`（通过 `PanelRange` / `PanelSlider`），和各个实验室用的是同一个：墨色轨道，触屏上用平台原生的滑块。只有 Sky 时间轴的播放头是它自己的 range input。Draggable 模块的各行早于这些控件，自己画开关。

### 用代码驱动覆盖

强制一种天气状况。白天/夜晚从来不属于它，由时钟决定，所以强制的状况不可能把月亮放进白天的天空：

```typescript
const { setDebugOverride, setSceneOverrides } = useWeather();

setDebugOverride({ condition: "rain" }); // null → back to the real weather
setSceneOverrides({ precipitationIntensity: 1 }); // heavy
```

没有时段覆盖；只有一个时钟，移动它，太阳、月亮、天空、时段、问候语和日出日落通知会一起移动：

```typescript
const { setTimeScrubMinutes, setDayOffset, resetTimeTravel } = useAmbientTime();

setTimeScrubMinutes(22 * 60); // 22:00 today
setDayOffset(11);             // eleven days on, a different moon
resetTimeTravel();            // back to now
```

壁纸的种类和样式是真实的（已保存的）设置，所以面板和选择器永远不会不一致：

```typescript
const { setKind, selectWallpaper, selectWeather } = useWallpaper();

setKind("image");            // Swap the background kind, crossfaded
selectWallpaper("monterey"); // Hot-swap the pair, no reload
selectWeather("classic");    // Back to weather, the original palettes
```

### 持久化

- **`hux_devtool`**：`fabEnabled`（在所有环境下默认关闭，开发环境也不例外）、`detached`、`collapsed`（手动设置的折叠）、`draggable`，以及只有 devtool 使用的设置（`phonePalette`、`homeWeather`、`worksRef`、`worksShelf`、`worksFeed`）。
- **`hux_drag_<id>`**：可拖动实例在持久化期间的位置。
- **其他每一个已保存的行**：各自系统的键（见上文）。
- **会话覆盖和导轨的折叠**：只在内存里，刷新即重置。

### 与 Ambient 的集成

devtool **依赖** ambient 系统：Wallpaper、Glass 和 Sky 模块读取天气、位置、时间和壁纸状态，并写入上面说的会话覆盖和设置。这种依赖也反向存在：`AmbientProvider` 读取 `useDevtool().isEnabled` 来决定这些覆盖算不算数。
