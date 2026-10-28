---
origin: "AI-translated from the original"
---

# Dock 系统

Dock 是屏幕顶部 **Live Activity** 的归宿：收起时是一颗颗胶囊，展开后变形为面板（借用 iOS 灵动岛 / 通知中心的隐喻）。它是"Global Player"界面的共同基础：音乐播放器和环境相位通知都是 Dock activity，所以长相和行为完全一致。

站内一行字的 **notice** 也出现在这里："Dark Mode · Following the Sun"、"Reading in Chinese · Preference unchanged"、"Sky window · swipe up to come back"。见 [通知](#通知notice)。

## 做好了是什么样

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-dock/desk-pill.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="收起状态的音乐 Live Activity：顶部正中的一颗玻璃胶囊，里面是专辑封面、绿色的 EQ 条和一个向下的箭头。" />
  <img src="/img/docs/system-dock/desk-panel.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个 activity 展开后：一块 360px 宽的圆角玻璃面板从顶部垂下，标题栏写着 'playing'，带一个收起箭头，下面是 NowPlaying 卡片，底部是拖动条。" />
</div>

音乐（先设 `localStorage.hux_music_mock = "1"`，再从首页小组件播放），桌面上的收起与展开。面板占据胶囊在顶部正中的位置，面板在时胶囊消失；面板的内容就是首页小组件里那个 `<NowPlaying />`，底部的拖动条是鼠标拖动的起点。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-dock/phone-pill.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的首页，音乐胶囊位于顶部正中、状态栏下方。" />
  <img src="/img/docs/system-dock/phone-notice.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上一篇刚切换到中文的文章：顶部的玻璃胶囊写着 'Reading in Chinese · Preference unchanged'；命令栏的按钮仍在右下角，没被碰到。" />
</div>

手机上的一颗胶囊和一条 notice（无头浏览器，393pt 宽，没有安全区 inset）。这条 notice 由文章的语言切换触发，形状和锚点都与胶囊相同：顶部一行字，底部命令栏所在的地方什么都没有。

- 顶部正中同一时间只归一样东西：胶囊、一个打开的面板，或一条 notice。
- 胶囊是一眼看完的东西（胶囊形）；面板是要读或要操作的东西（圆角矩形）。见 [形状](#形状)。
- 面板双向跟手：从胶囊往下拉出来，往上甩过顶边收回去。
- 玻璃从进场到退场始终是玻璃：任何承载模糊的盒子都不做淡入淡出。

## 原理

```
systems/dock/
├── provider.tsx                  # DockProvider + useDock (coordination only)
├── notice.ts                     # showNotice / dismissNotice: the notice store
├── band.ts                       # the top band: the Dock and a pinned bar sharing the strip
├── components/
│   ├── dock.tsx                  # <Dock>: pill row layout, publishes --dock-clear
│   ├── live-activity.tsx         # <LiveActivity>: the pill ⇄ panel drawer
│   ├── dock-notice.tsx           # <DockNotice>: the notice, at the pills' anchor
│   ├── use-band-occupant.ts      # an occupant's shape and width in the band
│   ├── sample-activities.tsx     # stand-in activities for /lab/band only
│   └── index.ts
└── index.ts
```

分成三个角色，activity 只需要提供内容：

- **`LiveActivity`** 负责*外观*：收起时的胶囊外壳、展开后的面板（标题栏、内容、拖动条），以及构成面板的 drawer。
- **`DockProvider` / `useDock`** 负责*协调*：唯一的 `openId`（同一时间只开一个面板）、切换路由时收起、打开着的 activity 卸载时收起（`registerActivity`），以及 `noticeUp`，即此刻锚点是否被一条 notice 占着。
- **`Dock`** 负责*布局*：一行水平居中、可滚动的胶囊，在 `app/layout.tsx` 中挂载一次，所有 activity 都是它的子元素。

![上半部分：三种状态共享顶部正中。胶囊（openId 为 null）在点击或下拉时变为面板，在 Escape、外部点击、箭头、上滑或路由切换时变回；胶囊在 showNotice 时变为 notice，在计时结束、点击或上滑时变回；面板打开时触发的 notice 会等面板关闭。下半部分：带 data-dock-pill 的 Drawer.SwipeArea 包住 Dock 行里的 Drawer.Trigger 玻璃；Drawer.Portal 把 Drawer.Popup data-dock-panel 放进一个非 modal 的 SurfaceViewport；popup 承担 transform、不绘制任何东西，它里面的 data-surface-shell 承担玻璃和淡入淡出，Drawer.Content 装着标题栏和内容，拖动条在它外面。](/img/docs/system-dock/anchor.svg)

上半部分是锚点的状态机：谁占着顶部正中，以及什么会把它交出去。下半部分是 `live-activity.tsx` 搭出来的一个 activity：transform 在 popup 上（红色），玻璃和它的淡入淡出在下一层的 shell 上（绿色）。

### 面板是一个向上走的 Base UI Drawer

展开的面板是一个 `swipeDirection="up"` 的 `Drawer.Root`，是 `systems/surface` 里手机 sheet 的镜像。灵动岛的隐喻锚定在顶部，收起时*向上*走；sheet 做的是同一件事，只是从底边出发。它们用同一个库、同样的 data 属性、同一个共享栈，所以站内只有一套浮层语汇，而不是两套。动效写在 CSS 里，位于 `app/globals.css` 的 "Dock panel motion" 一节。

它带来的：

| | |
|---|---|
| **下拉展开** | `Drawer.SwipeArea` 包住胶囊，所以从胶囊*往下*拖就会打开面板，面板全程跟手。松手时不到面板高度的一半（Base UI 的 `DEFAULT_SWIPE_OPEN_RATIO`）就弹回去。这是 iOS 通知中心的手势。 |
| **叠放** | 面板以 `dock-activity` 的身份注册进共享的 surface 栈（`systems/surface/stack.ts`）。在它上面打开命令面板（从键盘打开；点 FAB 算外部点击，会把面板关掉）会让它后退一层并变为 inert。只是共享屏幕的 surface 则不会：面板会报告自己占的区域，止于它底边的 sheet 与它并排铺开，而不是盖在它上面（见 [system-surface.md](./system-surface.md) 的 "Covering, not merely later"）。 |
| **自由布局** | 面板被 portal 进共享的 `SurfaceViewport`，所以胶囊行可以带 transform，而面板不会以它为锚点。 |
| **非 modal** | root 和 viewport 上都是 `modal={false}`：没有焦点陷阱、没有滚动锁定、没有遮罩。在两者之外点击会关掉面板（Base UI 的外部点击），同时点击会落到本来瞄准的地方，站内其他所有 surface 都是这样。 |

### 面板怎么出现：弹出，而不是滑入

drawer 通常从它锚定的那条边滑进来。这个不是，因为它来自的胶囊只比面板自己的顶边高出几个像素，没有可以滑行的距离：

| | |
|---|---|
| popup | 在 `data-starting-style` / `data-ending-style` 上用 `transform: scale(0.94)`，`transform-origin: top center`，时长 `--dock-pop-duration: 300ms`。 |
| shell | `dock-pop-in` / `dock-pop-out` 关键帧淡入淡出，在下一层的玻璃上。 |
| 拉开时 | `[data-swiping][data-starting-style]` 把 popup 钉在 `--drawer-swipe-movement-y` 上：手指底下，手指说了算。 |
| 被甩走的面板 | `data-swipe-dismiss` 把缩放换成位移，`translateY(calc(-100% - var(--surface-exit)))`（向上越过顶边、再越过 inset，所以是真的离开，而不是被状态栏截住），并关掉淡出，因为被手指甩出去的面板应该离开屏幕，而不是溶解。甩得越用力（`--drawer-swipe-strength`），退场越短。 |
| 减弱动态效果 | popup 和胶囊都没有 transition，shell 没有动画。 |

## 规则

下面每一条被打破，都会有看得见的问题。前五条就是 `systems/dock/components/live-activity.tsx` 顶部 "BEFORE CHANGING THIS FILE" 块里的五条说明，是向上走的 drawer 特有的；`systems/surface/sheet.tsx` 里的那份清单在这里同样适用。修改这个文件或 "Dock panel motion" 一节之前，两份都要读。最后两条写在 "Dock panel motion" 一节里，以及 `live-activity.tsx` 中 viewport 旁边。

| 规则 | 原因 | 打破之后 |
|---|---|---|
| swiping 规则限定在 `[data-starting-style]` 上（说明 1） | 关闭方向的拖动会写一个内联 `transform`；`SwipeArea` 的拖动只写 `--drawer-swipe-movement-y`，所以得由 CSS 来移动它。关闭方向松手时，popup 同时是 `data-swiping` 和 `data-ending-style` | 松手时被钉在手指上，面板卡在屏幕上下不去 |
| 不用 snap points（说明 2） | `--drawer-snap-point-offset` 对 `up` 做了符号修正，但实时拖动的算法是为 `down` 写的 | 见 [试过但没有采用](#试过但没有采用) |
| `SwipeArea` 上加 `aria-hidden={false}`（说明 3） | 它渲染出来是 `role="presentation" aria-hidden` | 胶囊按钮从无障碍树里消失 |
| 透明度加在玻璃上，绝不加在包含玻璃的盒子上（说明 4） | `opacity < 1` 的元素会成为自己的 backdrop root，于是里面的 `backdrop-filter` 采样到的是一个空组 | 在淡入淡出期间面板是透明的，后面页面的文字清清楚楚 |
| 关闭状态的 transform 只缩放，绝不位移（说明 5） | `SwipeArea` 拖动开始时，Base UI 在把 popup 标记为 swiping 之前读取它的 transform（`resolveClosedOffset`，`min(height, abs(translateY))`） | 下拉只跟十个像素而不是面板的高度，然后冲过头 |
| 淡入淡出是 shell 上的关键帧动画，不是 transition | shell 的 `transition` 简写属于 surface 的后退效果，而 `data-starting-style` 只存在一帧：对 transition 来说太短，但足够启动一个动画 | 第二条 `transition` 规则会把后退效果整个替换掉 |
| 没有遮罩；viewport 不接收指针 | 旧 Dock 的 `fixed inset-0` 遮罩吞掉了所有点击 | 面板打开时，命令面板的 FAB 点不到（实测） |

**关于说明 4 和 5。** 在 popup 上做淡入曾经试过也上线过，结果面板在进场时是透明的，后面页面的文字直接透过来，没有模糊。在同一帧、同样的透明度下做 A/B 对比：放在 shell 上，后面的文字是模糊的；放在 popup 上，是清晰的。所以 popup 承担 transform，淡入淡出放在下一层，放在 shell 和胶囊上，它们本身就是玻璃。sheet 遵守同一条规则，notice 也是。仓库里没有测试覆盖这一点；手动检查的办法是在进场过程中逐帧采样，确认 shell 和 `<body>` *之间*没有任何东西在淡入淡出或加滤镜。Base UI 判断退场是否结束时读的是 *popup* 的动画，不是子树的，所以 shell 的淡出不会拖住卸载。

最顺手的弹出写法是 `translateY(-10px) scale(0.94)`，而其中的 `translateY` 悄无声息地弄坏了下拉：十个像素的偏移告诉 Base UI 面板离打开只差十个像素，测出来的 `--drawer-swipe-movement-y` 是 +12px，本该是 −170。纯 `scale()` 让 transform 的 Y 保持为零，测量就会退回到面板的高度。这十个像素在视觉上没有损失：把 170px 高的面板从 `top center` 缩放到 0.94，底边本来就会抬起差不多这么多。

### 布局与共存

- **收起：** 胶囊在一行里并排居中。行太挤时可以水平滚动（`.no-scrollbar`），所以 N 颗胶囊也能从容应对。
- **展开：** 打开的 activity 的面板占据顶部正中的锚点，**所有胶囊都隐身并不再接收指针**（`[data-dock-pill]` 上的 `data-hidden`）；收起后恢复。它们保持挂载，所以面板在时这一行的布局和滚动位置都不变。（activity 不能单独关掉，所以不会有胶囊被困在面板后面。）
- **一次一个：** 打开一个 activity 会收起其他已打开的。
- **关闭：** 外部点击、Escape、上滑、收起箭头，或路由切换。前几种都是 drawer 自己的；最后一种是 `DockProvider` 的。
- **notice 也占锚点：** notice 在时胶囊会让开，和让给面板时一模一样；面板打开时触发的 notice 会等面板关闭。停靠的窗口（`MinimizedWindows`）也同样让开。

## 添加一个 Live Activity

在 `app/layout.tsx` 中 `<Dock>` 的某个子组件里渲染 `<LiveActivity>`。没东西可显示时返回 `null`；如果打开着的那个被卸载，provider 会收起 Dock。

```tsx
<LiveActivity
  id="music"
  openLabel="Open music controls"
  collapseLabel="Collapse"
  pill={<>{/* leading pill content: art, EQ, icon… */}</>}
  title={<>{/* panel header left side */}</>}
>
  {/* panel body: bring your own padding */}
</LiveActivity>
```

对于不只是一张卡片的 activity，可以自由选择的：

| prop | |
|---|---|
| `actions` | 自己的标题栏按钮，位于标题和收起箭头之间（Ask 的历史记录和新对话） |
| `panelWidth` | 面板的 CSS 宽度，设在 popup 上（默认 `min(92vw, 360px)`；Ask 用的是 `min(92vw, 440px)`） |
| `working` | activity 正在处理被要求做的事：站内的光晕作为 `processing` 光束沿胶囊边缘流动，胶囊隐藏时关闭。它是玻璃的兄弟元素，带 8px 的光晕，这一行的阴影余量和间距为它留了空间。 |
| `moveFocus` | 设为 `false` 时打开不移动焦点（Base UI 的 `initialFocus`），适用于自己会聚焦输入框的内容；否则 drawer 的焦点会覆盖它 |
| `headerHandle` | 让标题栏成为功能自己的拖动把手（`onPointerDown`、`className`），与 drawer 的触摸滑动相互独立。Ask 用它让指针把面板拖到不同位置。 |
| `pillClassName` / `panelClassName` | 加在胶囊玻璃和面板 shell 上的额外 class |

检查清单：

- 复用同一功能在别处显示的内容（`NowPlaying`、`WeatherNow`），这样面板和小组件永远不会走样。
- 内容自带内边距（通常是 `px-5 pb-4`）。
- 内容里没有任何东西对承载玻璃的盒子做淡入淡出或滤镜（规则 4）。
- 在手机上检查点击、从胶囊下拉、向上甩；在桌面上检查点击和 Escape。

## 通知（notice）

```ts
import { showNotice, dismissNotice } from "@/systems/dock";

showNotice({
  id: "solar-theme",          // the same id again updates it in place
  icon: Sunset,
  title: "Dark Mode",         // the fact
  note: "Following the Sun",  // behind it: what did not change, or how to undo
  duration: 5_000,            // default NOTICE_DURATION_MS, 3.2s
});
```

notice 是系统用一行字告诉你某件事发生了，只说一次：太阳切换了主题、页面现在是另一种语言、天空窗口打开了、一个链接去了新标签页。它可以从任何地方调用（provider、effect、时钟），因为它是一个模块级 store（`notice.ts`）而不是 context。大多数调用方在树里与 Dock 并列，而不在它下面。`dismissNotice(id)` 只有在该 id 正在显示时才会把它撤下。

| 边 | 方向 | 那里有什么 |
|---|---|---|
| **顶部** | 系统 → 你 | Live Activity、notice |
| **底部** | 你 → 系统 | 命令栏，以及从它升起的 sheet |

它遵守的规则：

- **一次一条。** 新 notice 替换正在显示的那条，两者原地交叉淡化。不会堆叠。
- **只在屏幕上时计时。** 在打开的面板后面时它会等待，之后获得完整的时长。被按住时（手指按在上面，或指针停在上面）计时暂停，松开后获得剩下的时间。
- **点击或上滑可以提前撤下。** 上滑时它跟手，并顺着那个方向离开；拉得不够会弹回。它不是按钮（读屏软件通过 `role="status"` 区域听到它），所以对其他所有人来说，让它消失的是时间。
- **它不发布到 `--dock-clear`。** /works 和 /prompt 的工具栏靠这个变量吸顶在胶囊下方；为了一条三秒的消息把它们往下推，会让它们跳两次。如果放着不管，吸顶栏比 notice 宽，会从它两端露出来，所以这两个工具栏会像胶囊一样淡出、上移让开，notice 离开后再回来（`components/ui/use-notice-yield.ts`）。只在确实位于 notice 下方时才这样：吸顶在 Live Activity 胶囊下方时工具栏本来就避开了它，停在标题下方时则离得很远。lab 自己的工具栏（`LabBar`）目前还不会让开：在桌面上，Band Lab 的 "Fire a notice" 会落在它上面。
- **透明度加在玻璃上。** notice 的淡入淡出在胶囊上，胶囊承载模糊（规则 4）。
- **里面不放选择。** 任何需要询问的东西，比如用读者之外的另一种语言分享的链接，都是一个 surface。`components/post/language-sheet.tsx` 是一个在任何宽度下都从底部升起的表单 sheet，在桌面上最宽 400px（`sheetMaxWidth`），而且不是 modal：没有遮罩，后面的页面保持可用。

**为什么在顶部，而不是底部的 toast。** 站点过去用 Sonner 在底部正中显示这些消息。在 390px 宽的手机上实测，toast 那一行离底部 16px、高 46px，盖在 24–72px 处的命令栏上：它出现的那三秒里，点 ⌘K 会点到 toast 上。那张带两个按钮的语言卡片更糟：高 136px，在得到回答之前一直盖着 ⌘K，而且以 `z-index: 999999999` 画在所有 sheet 和 About 遮幕之上。顶部的 notice 不可能撞上命令栏，而 Dock 本来就知道怎么共享它的锚点（胶囊 ⇄ 面板）。

### 形状

形状说明的是这个东西是什么，而不是它从哪条边来：

- **胶囊**（`GLASS_CAPSULE`，`lib/glass.ts`）用于一眼看完的一行：Live Activity 胶囊、notice、/works 和 /prompt 的吸顶栏、命令栏。
- **圆角矩形** 用于要读或要操作的东西：Live Activity 面板（16px）、sheet（24px）、窗口。

要避免的是：塞了两个按钮的胶囊，或者假装成 toast 的卡片。

## 参考

### 使用方

| Activity | 源码 | 胶囊 | 面板内容 |
|----------|--------|------|------------|
| 音乐 | `systems/music/components/music-activity.tsx` | 专辑封面 + EQ | `<NowPlaying />` |
| 环境相位 | `systems/ambient/components/phase-activity.tsx` | 太阳图标 + 时间 | `<WeatherNow />` |
| Theater 音频 | `systems/theater/components/theater-activity.tsx` | 缩略图 + EQ | 播放控制 + `<SurfaceSwitch />` |
| Ask | `systems/ask/components/activity.tsx` | 闪光图标 + agent 正在做的事，工作时发光 | 对话、历史记录、输入框（见 [system-ask.md](./system-ask.md#where-ask-sits)） |
| 最小化的窗口 | `systems/windows/components/minimized-dock.tsx` | 应用图标 + 标题（自己的胶囊，不是 `LiveActivity`） | 无（恢复窗口） |
| 示例 | `systems/dock/components/sample-activities.tsx` | 替身，只在 `/lab/band` 需要时出现 | 一行示例文字 |

音乐只在本次会话播放过东西之后才出现；环境相位只在日出日落前后出现；theater 只在视频处于 Audio 视图时出现。在无头浏览器里，音乐是最方便的：在应用脚本运行之前设 `localStorage.hux_music_mock = "1"`，然后在首页小组件上按 Play。

Notice 的来源：太阳切换主题（`systems/ambient/components/solar-theme.tsx`）、天空窗口的打开和关闭（`wallpaper-background.tsx`）、拒绝被嵌入框架的链接（`systems/attachments/provider.tsx`）、双语文章的语言切换（`components/post/use-post-language.tsx`）、语音输入出错（`systems/command/voice.tsx`）、Ask 的来源已满（`systems/ask/components/selection.tsx`）、Works 和 Icon 两个 lab 的保存与重置（`app/lab/works`、`app/lab/icon`），以及 Band Lab 的 "Fire a notice"。

### 顶部条带，以及它的 lab

上面这些东西都在争屏幕顶部的同一条带：Live Activity、停靠的窗口、notice、打开的面板，以及页面的吸顶栏（/works 和 /prompt 的工具栏、lab 自己的工具栏）。它们怎么共享，仍在用真实组件做决定。这是若干独立选择的组合，即 `systems/dock/band.ts` 中的 `BandConfig`，由 Dock、每个 `LiveActivity`、停靠的窗口和页面的 `PinnedSlot` 读取：

| 旋钮 | 它选择什么 |
|---|---|
| `share` | 吸顶栏是否参与共享条带；关掉就是老办法（胶囊居中，工具栏吸顶在它们下方） |
| `group` | 占位者怎样站在工具栏旁边：`all` 在它后面排成一行，`tray` 放在一个固定大小的窗口里，`count` 折叠成一个显示数量的球；点它，工具栏会折成一个球，占位者展开 |
| `form` / `openForm` | 它们在工具栏旁的形状，以及数量球被打开时的形状：`pill` 或 `ball`（球就是 36px 宽的胶囊，内容被裁掉） |
| `trayCap` | tray 在手机上完整显示几个（更宽的屏幕多两个） |
| `peek` | 一个装得比显示得多的窗口，末尾露出下一个的一半 |
| `barScrolls` | （`all`）工具栏放在滚动条带里、排在第一个，占位者进来时它滑走 |

`PRESETS` 给其中四组命了名：`stack`、`tray`、`scroll`（条带滚动）、`swap`（二选一）。上线的是 `DEFAULT_CONFIG`，即二选一：放得下时并排，差一点放不下时变成球，完全放不下时变成数量。其他配置都是会话级覆盖（sessionStorage），在 **`/lab/band`** 里设置。一套配置只在工具栏*遇上*条带之后才生效；在那之前，以及在所有没有吸顶栏的页面上，Dock 一如既往。每个吸顶栏都参与：/works 和 /prompt 的工具栏，以及每个 lab 自己的工具栏（`LabBar`），后者放在条带高度的 `PinnedSlot` 里，除非 lab 把它放到一边（`pin="static"`）。

一切东西站在哪里由一个函数决定，`bandGeometry(band)`，Dock 和 slot 都读它，所以它们在任何一个像素上都不会有分歧。它返回两样东西。占位者的 **window** 正是它们可以被看见的范围，也是 Dock 那一行裁切的地方，所以没有东西会滑到工具栏、边距或球的下面。工具栏的 **reserve** 是它在末端让出的宽度。它遵守的一些规则：

- 每个旋钮都是一种**溢出**策略。只要工具栏保持自身宽度、每个占位者都是胶囊时能在条带里并排放下，它们就并排站着，不管配置是什么：在工具栏后面左对齐，与它的玻璃隔一个间距，需要的话一直延伸到栏旁的边距里。宽屏绝不会为了照顾手机而折叠。超出之后，依次是：占位者变成球（如果 `form` 这么写），然后由 group 接手。数量球从不只数一个占位者：一个占位者本来就和数它的那个球一样小。打开的数量球如果又放得下了，就会关上。
- 会换行的工具栏（lab 的）按一行时的宽度测量，所以它也能放得下。
- window 从工具栏的*玻璃*之后一个 `GAP`（8px）开始，而不是从它的文字之后。
- 在手机上（边距不超过 32px），window 一直延伸到屏幕边缘：下一个占位者被手机的边缘截断，正是这个截断表明它可以滚动。更宽时，它止于内容栏。
- 只要还放得下一个占位者，工具栏就不会小于它的最小宽度。但也绝不会为了保住工具栏而把占位者推到够不着的地方：window 至少容纳一个完整的占位者。
- 打开的数量球从边缘滚到边缘，不管有多少个。
- window 在半空中结束的地方（贴着工具栏、折叠的球、内容栏），末端是胶囊形的：滑出去的占位者钻到一条与它自身半径相同的弧线下面，而不是一条直线。在屏幕边缘则保持直角。这是一个 `clip-path`，能保住胶囊的模糊（mask 就不行）。圆形末端留下的占位者部分会随着变窄而淡出（不到 6px 时消失，球的三分之二起完全显示）。淡出是玻璃本身上的 `filter: opacity()`（加在任何包含玻璃的东西上的 opacity 都会把模糊一起带走）。

占位者以同样的方式参与：`useBandOccupant()` 给它形状（胶囊或球）、它是否被数量球隐藏，以及它作为胶囊时的自身宽度（由内容和玻璃的内边距测得），它把这个宽度作为 `data-natural` 发布在自己那一行的子元素上；它给自己的玻璃标上 `data-band-glass`，Dock 会在那里淡化被截剩的一条。只需要条带上某一个事实的读取方会选取它（`useBandSelect`），所以窗口尺寸变化不会让每个 Live Activity 都重新渲染。

工具栏通过声明参与。它的 slot（`PinnedSlot`）测量它并报告它的盒子。工具栏标出让步的部分：在自身内部滚动的 chip 组上标 `data-bar-give`（最小宽度：固定部分加一个完整的 chip），或者在会换行的工具栏中必须保持完整的部分上标 `data-bar-keep`（lab 工具栏的名字；它的工具在下面换行）。它按 `--band-reserve` 收窄自己，这个变量由 slot 设置。打开数量球时，slot 还会把工具栏折成一个球。`LabShell` 用 `pin="band"`（默认值）把它的工具栏放进条带。

**Band Lab** 就是站点本身：旋钮设置覆盖配置，占位者是 Dock 自己的（最多六个由真实 `LiveActivity` 画出来的示例 activity、模拟的音乐播放器、一个停靠的窗口、一条 notice），遇上它们的工具栏在页面上选择：lab 自己的两行工具栏，或者带示例分面的真实 /prompt 或 /works 工具栏。它们在页面真实的滚动上相遇。有四条规则是从页面的实际状态中测量出来的（`app/lab/band/model.ts`）：只有一条条带，工具栏仍然能完成它的工作，没有重叠且间距保持，每个占位者都够得着。

测试装置的每个部分各有其位，顶部属于被测对象：lab 自己的工具栏，它的第二行选择哪个工具栏来遇上条带。底部 FAB 旁边是遥控器：四条规则显示为四个点（点开查看它们测到了什么，在一个非 modal 的 sheet 里，所以条带在它下面保持可用）、占位者数量、预设。细调旋钮是一个面板：手机上在页面里，宽屏上在页面旁边并固定住。

会动的东西都有动画，而不是直接替换：胶囊变成球靠的是它的真实宽度变化（`width` 在 `[data-dock-pill] > *` 的 transition 里，优先级高于 trigger 自己的工具类）；Dock 那一行的 window 靠 `left`、`width` 和内边距的过渡移动；工具栏靠 `max-width` 收窄。

### `--dock-clear`

Dock 把它的胶囊向下延伸到多远，以 `--dock-clear` 发布在 `<html>` 上（没有胶囊时为 0），用布局盒子而不是 rect 来测量，因为胶囊进场时是缩放过的。任何吸顶在页面顶部的东西（/works 工具栏、lab 工具栏的 `--lab-bar-top`）都按它避开 Dock，而不是去猜有没有 Live Activity。notice 不发布到这个变量（见 [通知](#通知notice)）。

## 历史

### 为什么有它

以前，胶囊 / 面板 / 拖动 / Esc / 路由收起这一整套机制都在 `MusicDock` 里。加第二种通知（环境相位变化）就意味着把它们全部复制粘贴一遍。Dock 把这套机制抽出来，只写一次。

把面板换成 drawer 删掉了手写的 `drag="y"` + `dragConstraints` + `onDragEnd` 40px 阈值、两个 `AnimatePresence` 块、`Dock` 里的透明遮罩，以及 `DockProvider` 里的 Escape 监听。它还删掉了"胶囊行不能带 transform"这条规则（否则行里的 `fixed` 面板会以这一行为锚点）：现在面板是 portal 出去的。它唯一没有复刻的，是遮罩吞掉所有点击这件事（[规则](#规则) 的最后一条）。

### 试过但没有采用

这次本想评估的 Drawer 能力（#175）中，有两项在顶部锚定的面板上站不住脚。两项都做出来了，在 iPhone 13 上走查实测，然后撤回。

**`snapPoints`：不用。** Base UI 对 `up` 修正了 `--drawer-snap-point-offset` 的符号（`DrawerPopup.js`），但几何上仍然是把底部 sheet 镜像过来：偏移裁掉的是 popup 的*顶部*。用 `snapPoints={[0.18, 1]}` 实测，紧凑的 detent 把面板放在 `translateY(-50.5px)`，包围盒在 `top: -42`：标题栏、收起箭头和顶部的圆角都出了屏幕，留下来的是播放控制。顶部面板的内容从顶边向下排列，所以该被裁掉的是底部。

实时拖动更糟：`DrawerPopup.js` 里的阻尼移动分支和 `DrawerViewport.js` 里的进度计算都写的是 `swipeDirection === 'down'`，所以在向上的 drawer 上，完全打开的那一端没有限位。一次拖动中测到的 transform：`-50 → -26 → +5.5 → +37.5 → +69.5`，直接越过停靠位置，没有上限。松手后的归位是对的；之前的一切都不对。

两个 detent 还意味着每一个上显示*不同的内容*（一行的 NowPlaying 和完整的卡片），这是渲染上的决定，不是拖动的几何。detent 只裁切，不替换。

**`Drawer.Indent` / `Drawer.IndentBackground`：不用。** 两个原因，其中一个致命。只要最近的 `Drawer.Provider` 里*任何*一个 drawer 打开，`data-active` 就会被设上，所以它分不清 Dock 面板和命令面板：实测两者的缩进效果完全相同，而命令面板缩进正是我们为 sheet 否决掉的做法（bezel 已经给页面加了框）。

致命的那个：`Drawer.Indent` 的做法是给应用主界面外面的盒子加 transform，而在 `vitre` 之下，这个站点的页面*本身*就是一叠 fixed 图层：壁纸、窗口层、处于 container scroll 中的 body 本身。祖先上的 transform 会让它成为这些图层的包含块，再加上缩进的 `overflow: hidden`，这个盒子没有任何文档流内容可以撑起高度。实测：页面整个渲染成黑色，只剩 Dock 面板和 FAB（两者都在缩进之外）还看得见。要让这个页面缩进，就得重构它的图层模型。
