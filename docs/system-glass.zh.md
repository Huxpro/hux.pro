---
origin: "AI-translated from the original"
---

# 玻璃

每一个浮在页面上的 System UI surface 都由这种材质做成，而一个设置就能同时改变它们全部。这一页还讲了阅读页面背后的壁纸是怎样退后的。

## 做好了是什么样

iOS 26 恰好提供两种 Liquid Glass 材质，本站也一样，两种语言里的名字都与之相同（用的是 Apple 自己的叫法，见 设置 → 显示与亮度 → Liquid Glass）：

| | 英文 | 中文 | 填充 |
|---|---------|------|------|
| 默认 | **Tinted** | **色调** | 卡片颜色足够多，本身就读作一个面 |
| | **Clear** | **透明** | 一层鲜亮的薄色：背后是什么，透出来的就是什么颜色 |

Tinted 是一个有自己颜色的面；Clear 借用的是壁纸的颜色，所以它并不是更透明一些的 Tinted。在图片壁纸上，两者看起来差别很大；在纯色背景上，两者很接近，这本来就应该如此。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-glass/palette-tinted.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="桌面上的命令面板，壁纸是 Sonoma，材质为 Tinted：一张浅色、近乎白色的卡片；壁纸在列表背后只剩一层淡淡的颜色。" />
  <img src="/img/docs/system-glass/palette-clear.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个命令面板，材质为 Clear：卡片带上了壁纸的红色和绿色，背后的小组件透过模糊显露出来。" />
</div>

桌面上的 ⌘K 命令面板（`bg-glass-popover`），壁纸是 Sonoma，先 Tinted 后 Clear。同一个 surface，同样的模糊，同样的文字：变的只有填充，背后的小组件也随之透了出来。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-glass/sheet-tinted.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上作为底部 sheet 的命令面板，材质为 Tinted：壁纸上一张近乎不透明的白色 sheet。" />
  <img src="/img/docs/system-glass/sheet-clear.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个 sheet，材质为 Clear：壁纸的粉色和绿色透过整个 sheet，靠近底部还能隐约看到背后小组件的文字。" />
</div>

同一个命令面板在手机上，它在那里是一个 sheet（`bg-glass-sheet`）。sheet 是最实的一级，Tinted 下 85%，到了 Clear 依然降到 46%。

两种材质下的模糊都只是普通的 `backdrop-blur`：没有高光，没有透镜畸变，不假装自己是一块实体玻璃。

## 原理

`<html>` 上的一个 class，换掉几个数字。一种材质由七个数字组成，各个角色只推导一次：

![上方两块材质：Tinted 用的 :root 和 Clear 用的 html.glass-clear，输入到 app/globals.css 里的阶梯；Tint: Wallpaper 和 legibility 系统的 --wp-glass-add 从右侧输入。下方是每个 bg-glass token，用一对条形表示它在 Tinted 和 Clear 下的填充，以及它绘制的是哪一类 surface。](/img/docs/system-glass/tokens.svg)

材质决定填充；阶梯把每个填充变成一种颜色；表格说明哪个 token 用在哪一类 surface 上。条形表示的是加上 `--glass-add` 之前的填充，`--glass-add` 只会让它们变大。

```css
:root {
  --glass-fill: 50%;  --glass-fill-raised: 60%;  --glass-fill-panel: 70%;
  --glass-fill-popover: 75%;  --glass-fill-sheet: 85%;
  --glass-hover-step: 20%;  --glass-dark-add: 0%;
}
html.glass-clear      { --glass-fill: 20%; /* … Clear's numbers */ }
html.dark.glass-clear { --glass-dark-add: 6%; }

/* The ladder: declared once, on every element that can change an input. */
--glass: color-mix(in oklab, var(--glass-base) calc(var(--glass-fill) + var(--glass-add)), transparent);
/* …one line per role */
```

另外还有两样东西输入到 `--glass-add` 和 `--glass-base`，都来自 legibility 系统（[docs/system-legibility.md](./system-legibility.md)）：杂乱或色调不对的壁纸会增加填充（`--wp-glass-add`，也就是 Liquid Glass Clear 要求垫在文字下面的那层压暗；Clear 全部接受，Tinted 接受一半，由 `--glass-add-k` 决定）；**Tint: Wallpaper** 设置（`<html>` 上的 `data-tint="wallpaper"`）则以 `--tint-glass: 14%` 把图片的颜色混入 base。Clear 下的深色模式会多加 6 个百分点，读起来和浅色模式透明度相同。

切换材质不需要任何重新渲染。`services/glass.tsx` 切换那个 class；`@theme` 块把每个 `--glass*` 变量映射为 `--color-glass*`，于是 Tailwind 有了 `bg-glass…`，任何用它们绘制的 surface 都会自动跟着变：

| Token | Surface |
|-------|----------|
| `bg-glass` / `bg-glass-hover` | 小组件卡片、FAB、Live Activity 面板、PiP 栏、404 链接、App 文件夹的悬停态 |
| `bg-glass-strong` / `bg-glass-strong-hover` | 编辑中的 App 文件夹、Done 和 Edit widgets 胶囊按钮、theater 的光球、按压时的底色（FAB、living surface 的悬停态） |
| `bg-glass-overlay` | 抬起的预览面板（`GLASS_PANEL`）、播放控件里被选中的胶囊（`GLASS_PILL_FLAT`，`systems/theater/lib/chrome.ts`） |
| `bg-glass-popover` | 桌面上的命令面板、Ask 的选区胶囊和位置菜单 |
| `bg-glass-sheet` | 每一个 sheet 和窗口（`systems/surface/sheet.tsx` 里的 `SHELL`：手机上的命令面板、Ask、devtool、壁纸选择器、播放列表）、小组件选择菜单、抬起的播放胶囊（`GLASS_PILL`） |
| `GLASS_PANEL`（`lib/glass.ts`） | 抬起的预览面板：`media-peek.tsx` 和 `magnetic-preview.tsx` |
| `GLASS_CAPSULE`（`lib/glass.ts`） | `bg-glass` 上的一行 chrome：Live Activity 胶囊、Dock 的通知和计数球、最小化的窗口、/works 和 /prompt 上固定的栏 |

**玻璃上的文字**什么都不用做：ink token 都是 alpha 值，会与填充合成。在图片壁纸上，浮雕式的 text-shadow 落到玻璃上时，强度随材质而定：`bg-glass` 和 `bg-glass-strong`（以及它们的悬停态）取 `--glass-relief-k`（Tinted 0.3，Clear 1）；实的几级，即 overlay、sheet 和 popover，取 `--glass-relief-solid-k`（Tinted 0，Clear 0.5）。

## 规则

| 规则 | 原因 | 打破之后 |
|---|---|---|
| 浮层 surface 用玻璃 token 绘制，绝不用 `bg-card/NN` 或 `bg-popover/NN` | 只有 token 会跟着设置变化 | 有人选了 Clear，这个 surface 仍是一块不透明的板子，旁边的邻居却都变淡了。`eslint.config.mjs` 里的 `no-restricted-syntax` 让它在 `lib/glass.ts` 以外的任何地方都是 lint 错误 |
| 只有多于一个 surface 用到的配方才放进 `lib/glass.ts` | 一次性的直接内联 `bg-glass…`；共用的不能各自漂移 | 两个深浅差一档的胶囊叠在一起浮着，看起来像次品 |
| 原则上不给 token 加透明度修饰符 | 填充是 token 的事；`/NN` 会把它再乘一遍，还掩盖了角色 | 一个不属于任何一级的 surface。整页的遮罩是例外：`THEATER_BACKDROP`（`bg-glass/80`）和 About 的遮罩（`bg-glass/70`） |
| 不透明的 `bg-card` / `bg-popover`（不带 `/NN`）用于不是浮层玻璃的东西 | `components/ui` 里的菜单、按下的胶囊的实色状态 | 不会出问题；lint 允许 |

## 可以自由选择的

- **哪一级**，取决于 surface 是什么：卡片或胶囊用 `bg-glass`，叠在它上面的用 `-strong` 或 `-overlay`，用来阅读的 surface 用 `-sheet` 或 `-popover`。
- **模糊半径。** 首页卡片用 `backdrop-blur-sm`，大多数 chrome 用 `-xl`。在 20% 的填充下，surface 背后能看清的东西，在 Clear 下透过它也能看清，所以文字叠在文字上的 surface 需要模糊。
- **边框和阴影。** `border-border/50` 加上 `shadow-raised` / `shadow-overlay` 是常用的组合；`GLASS_PANEL` 故意把阴影留给调用方。

## 设置

| 在哪里 | 怎么做 |
|-------|-----|
| 命令面板 | `Glass: Tinted` 这一行（点击切换；标签显示当前材质），或者先按 `/` 再按 `G`。`Tint: Neutral` 是先按 `/` 再按 `T` |
| Devtool | Glass 模块：分段控件 Tinted / Clear，以及 Tint: Neutral / Wallpaper |
| 代码里 | `useGlass()`（`services/glass.tsx`）→ `{ material, setMaterial, toggle, tint, setTint }` |

材质保存在 `localStorage` 的 `hux_glass` 下，默认为 Tinted；tint 保存在 `hux_glass_tint` 下，默认为 Neutral。

## 添加一个 surface

1. 用表格里的一个玻璃 token 绘制它，通常再配一个 `backdrop-blur-*`。
2. 如果已有别的 surface 用着同样的配方，就从 `lib/glass.ts` 导入；如果你的是第二个，就把它挪到那里。
3. 在图片壁纸上切到 Clear 看一看（devtool 的 Glass 模块），深浅两种主题都要看。
4. `pnpm lint`。

## 阅读页面

这和材质无关：680px 宽的正文栏背后放一张照片，就是一张与正文争夺注意力的图。

| 路由 | 处理方式 |
|-------|-----------|
| `/`（以及 `/lab/legibility`，它在样张里模拟阅读页面） | **全强度、清晰、不加色调。** 它*就是*内容：小组件是浮在桌面上的一个 springboard。 |
| 其他所有页面 | **退后：** 壁纸上盖一层页面颜色的遮罩，如果是图片，下面再加一层虚化。全出血；没有卡片，没有圆角，不把文章装进盒子。 |

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-glass/home-desktop.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="手机上的首页，壁纸是 Sonoma：壁纸清晰、全强度地铺在 App 图标和玻璃小组件背后。" />
  <img src="/img/docs/system-glass/writing-reading.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一张壁纸上的 writing 页面：图片被虚化成柔和的色块并被遮淡，文章列表直接放在上面，没有卡片。" />
</div>

同一张壁纸在 `/` 和 `/writing` 上。首页展示图片；阅读页面把它遮淡、虚化，正文直接放在上面。

图片壁纸以 opacity 1 绘制，因为一张由人亲自挑选的照片，以一半强度显示，就只是一张褪了色的图。变化的是画在它**上面**的东西。遮罩多少、虚化多少，是 legibility 策略针对每张壁纸算出的结果（每个主题一个 `veilBase`，再随杂乱程度和色调冲突增加；见 [docs/system-legibility.md](./system-legibility.md)），在 `/lab/legibility` 的阅读样张上调校。

`systems/ambient/lib/reading-surface.ts` 负责判断（`isReadingSurface`）。`wallpaper-background.tsx` 绘制遮罩，也就是按策略给出的 alpha 铺一层 `bg-background`，对所有类型的壁纸都生效（Sky 和 Gradient 也会退后）。模糊只用于图片，这是唯一一种有细节可虚化的类型：它画在每一层的内部元素上（`gradient-stack.tsx`，半径 `--wp-blur`），这样层上的软边遮罩保持清晰、不被缩放。这两部分都是 devtool 开关（`Reading dim`、`Reading blur`），因为这是品味问题，而解决品味问题的唯一办法就是亲眼去看。

bezel 和软边都不属于这套处理。两者属于页面的边缘，而不是图片（见 [Placement](./system-ambient.md#placement)）。

## 历史

这个 token 约定过去只是一句话："每一个浮层 surface 都用玻璃绘制"。后来它对其中十一个已经不成立了（theater 的控件、最小化的窗口、App 文件夹、commit 嵌入、404 卡片等等），切到 Clear 时它们都还是不透明的。文字描述发现不了第十二个，于是用 lint 规则取代了它。
