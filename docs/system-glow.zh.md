---
origin: "AI-translated from the original"
---

# 光晕与语音

整个站点只有一道光，以及它能回应的声音。每一处光晕都是同一个 WebGL
shader，画在一个圆角盒子的边缘上（`systems/glow`），由同一个渲染器绘制，
同一时间只用一套调色板。语音系统（`systems/voice`）用两种方式听麦克风：
Gateway 录音，或浏览器自带的识别器；两者都向光晕输送同一个音量表。

## 看起来是什么样

![桌面上的 About：屏幕边缘亮起蓝、紫、粉、琥珀和青色，在四角最深，在碰到文字之前就淡去。](/img/docs/system-glow/about-ring.png)

About（`/` 然后 `O`），无头浏览器，1280×860。一个覆盖整个屏幕的 `ring`
（`<EdgeGlow>`）：光沿着边缘走，在碰到文字之前淡出；它的深度是留白的一个比例，
而不是固定的像素数。

![Glow Lab 的 "In production" 一行：左边是一块被光环绕的 16:10 屏幕，右边是一个搜索框，光从它的底边升起。](/img/docs/system-glow/lab-ring-line.png)

`/lab/glow`：同一道光，在屏幕大小的盒子上是 `ring`，在输入框上是 `line`。
line 就是聚焦到一条边上的 ring：光从这条边升起成一个穹顶，而不是铺满四边。

目前接入的地方：

| 位置 | 形状 | 它在说什么 |
|---|---|---|
| About（`systems/about`） | ring，`<EdgeGlow>`，固定覆盖整个屏幕 | *你好*：系统在介绍自己 |
| 首次访问时 About 的 "Reveal" | ring，`motion="pulse"`，`inside={false}`，`bleed={14}` | *按我* |
| 命令面板和 Ask 的输入框，正在聆听 | line，底边，由声音驱动 | *我在听* |
| 同上，正在整理文字或转写 | line，`processing` | *正在处理* |
| 应用内浏览器，加载中（`systems/windows/components/web-frame.tsx`） | line，顶边，`processing` | *正在处理*（取代了转圈） |
| 正在写回复时 Dock 上的 Ask 胶囊（桌面） | ring，`processing`（一颗彗星），`bleed={8}` | *在运行* |

## 只有一道光

About 用 Siri 的光晕环绕屏幕。有了它之后，站内每一个想表达*这里有东西活着*的
地方（一个正在聆听的输入框、一个正在加载的窗口），要么复用它，要么另造一道几乎
一样的光。两道几乎一样的光，看上去就是个错误。所以只有一道：

- **同一时间一套调色板**：Siri 的（`lib/palette.ts`：蓝 · 紫 · 粉 · 琥珀 ·
  青，首尾相接成环），或者与壁纸和谐的三个色相（`lib/harmony.ts`，见下文）。
  页面上所有光晕都用同一套。shader 的 `ring()` 从 `uPal` 读取它；CSS 回退方案
  把 Siri 的颜色保存为 `--glow-stops`（`GLOW_CSS_STOPS`），语音波形读取
  `GLOW_STOPS`。在其他任何地方写光晕颜色都是 bug。
- **一个 shader**（`lib/shader.ts`）：圆角盒子边缘上的一片光场。每一处光晕都是
  这个 shader 画在某个盒子上。
- **一个渲染器**（`lib/renderer.ts`）：整个页面只有一个 WebGL context。

光晕表达的是*这里有东西活着*：在听、在处理、在运行、就是现在。它从来不是装饰。

## `<Glow>`

```tsx
<div className="relative rounded-2xl">          {/* the host: its radius is read */}
  …
  <Glow active={on} />                           {/* ring */}
  <Glow active={on} shape="line" level={voice.level} bands={voice.bands} />
  <Glow active={loading} shape="line" edge="top" processing />
</div>
<Glow active={open} fixed radius={screenRadius} />  {/* over the viewport */}
```

| prop | |
|---|---|
| `active` | 开：扫入并停留；关：扫出，之后没有任何开销 |
| `shape` | `ring`（整圈边缘，默认）或 `line`（一条边） |
| `edge` | line 所在的边：`bottom`（输入框，默认）或 `top`（加载条） |
| `level` | 0–1，一个数字（在 0.25 s 内缓动过去）或每帧读取的 getter。静止值是 0.45 |
| `bands` | 低 / 中 / 高三个频段的 getter，各 0–1 |
| `processing` | 聚成一道移动的光束：line 上沿边缘来回，ring 上是绕圈的彗星 |
| `motion` | 开着时光怎样活动：`flow`（默认）、`rotate`、`pulse`（见下文） |
| `period` | 每转一圈（rotate，2）或每次呼吸（pulse，2.3）的秒数 |
| `inside` | `false` 只画边缘以外的光晕；配合 `bleed`，就是从宿主背后透出来的光 |
| `baseline` | *高级*：没有波、弧或瓣的地方保留的深度，是峰值深度的 0–1（波谷对波峰）。每种 motion 有自己的值（`GLOW_BASELINE`：flow 0.176，rotate 0.12，pulse 0.3）；只在需要覆盖时才传 |
| `reach` | 光向内延伸的像素数；可见的尾巴在约 4.45 个 reach 处结束（`GLOW_EXTENT_PER_REACH`）。省略时按宿主尺寸决定：line 是高度的 0.22 倍，5–14 px；ring 是短边的 0.038 倍，3–38 px（`fixed` 时 18–38） |
| `extent` | `{ x, y }`，光在离左右边和上下边多少像素处结束；也就是换了一种单位的 `reach`（见下文）。会覆盖 `reach`，在四角平滑过渡 |
| `bleed` | 每一侧溢出到外面的光晕像素数（默认 0：只画在内部） |
| `radius` | px；从宿主的 `border-top-left-radius` 读取（`fixed` 时为 0）。它被画进光里而不是用遮罩裁出来，四角的过渡也跟着它，所以一改就立刻重画（停住的帧也会）。传入和盒子自身圆角同一个来源的值：在整页上就是 `useWallpaper().screenRadius`，也就是 `<Vitre>` 画 bezel 用的那个数。 |
| `strength` | 0–1；devtool 的全站强度会与它相乘 |
| `fixed` / `layer` | 覆盖视口；vitre 的 bezel 图层 |
| `inDuration` / `outDuration` | 进场 / 离场的秒数：0.6 / 0.35，`fixed` 时 1.1 / 0.52 |
| `onDone` | 光完全离开后调用一次 |
| `className` / `style` / `ref` | 光晕自己的盒子，也就是边缘被点亮的那个圆角矩形 |

光晕是一个以 block 显示的 `<span>`，所以它既能放在一个词里（段落中的徽章），也能
放在卡片上。它 `absolute` 覆盖在宿主上，每一侧超出 `bleed` 像素，不接收指针事件。

### Reach 与 extent

光晕的深度有两种单位。`reach` 是光束的尺度：满高的光束厚 1.7 个 reach，光按
`exp(-(d/thick)^1.45)` 衰减。`extent` 是光在视觉上结束的位置。两者是同一个数，
通过 `GLOW_EXTENT_PER_REACH`（lib/shader.ts）换算，也就是静止时最亮的波峰衰减到
2% 不透明度时的深度：

```
1 − exp(−1.15 · g) = 0.02   →  g = 0.01757
exp(−(d / 1.7)^1.45) = g    →  d = 1.7 · 4.041^(1/1.45) = 4.45 reaches
```

所以一个被要求在 152px 处结束的光晕，reach 是 34px，看起来和直接给它 34px reach
的完全一样；让终点精确的那个窗口（extent 的最后五分之一，那里的光已经不到 6%）
只修剪尾巴。改了光束的厚度或衰减，这个常数也必须跟着改。

## `<EdgeGlow>`

```tsx
<EdgeGlow
  active={open}
  content={[wordsRef, footRef]}   // what the light frames
  depth={1.3}                     // where it ends, as a share of the gutter
/>
```

屏幕大小的光环没有天然的深度：固定像素在桌面上是一条细线，在手机上是一大片；
按屏幕比例又不管光环框住的是什么。edge glow 的深度是**留白**的一个比例，也就是它的
边缘与内容之间的空间：

| | |
|---|---|
| `content` | 一个 ref，或多个（取并集）。每一个都按静止时的布局计算（所有滚动祖先都在顶部），并被这些祖先裁剪：长文章只计入它起始的那一屏，滚动它也不会改变留白（如果在显示时测量，向上滚动后文章会碰到屏幕顶端，光就缩成了零）。 |
| 留白 `x` / `y` | 左右留白中较窄的那个 / 上下留白中较窄的那个，从光晕自己的盒子算起（视口，或 `style` 把它内缩到的范围，比如 bezel 的屏幕）。开着时测量，任何尺寸变化时重新测量，离场时沿用。 |
| `depth` | 光在哪里结束：`0.5` 是到内容的一半，`1` 正好碰到内容，`1.5` 是尾巴越过内容半个留白。**一个数字**是较窄留白的比例，光离每条边都一样高：ring 通常的样子，内容离哪边最近就先碰到哪边。**`{ x, y }`** 各轴用各自的留白，光跟着内容的形状走（x 离左右，y 离上下）。 |

其余都和 `<Glow>` 一样（`active`、`motion`、`baseline`、`strength`、`radius`、
`layer`、`style`、`className`、各个时长）。它永远是 `fixed`，永远是 ring。用
`{ x, y }` 时，extent 在每个角上从一个轴的值缓动到另一个轴的值。

## 规则

下面每一条被打破，都会有看得见的问题。

| 规则 | 原因 | 打破之后 |
|---|---|---|
| 颜色只写在 `lib/palette.ts` / `lib/harmony.ts` | 只有一道光；devtool 的规则和壁纸会同时缓动每一处光晕 | 一道几乎一样的光，而且无视壁纸的和谐色 |
| 不要为了一道光自建 WebGL context、canvas 或 CSS 渐变：用 `<Glow>` | 浏览器只保留少数几个 WebGL context，会丢掉最旧的 | context 丢失后光晕（或壁纸）变成空白 |
| 宿主是 `relative`，圆角是它自己的（或传 `radius`） | 光晕 `absolute` 覆盖在父元素上，读取的是父元素的圆角 | 光落在错误的盒子上，或者圆形宿主外面亮着方角。Dock 胶囊的包裹层没有圆角，所以它传 `radius={CAPSULE / 2}` |
| `bleed` 需要空间：光晕不能在一个紧贴宿主的 `overflow: hidden` 祖先里 | 光晕画在宿主边缘之外 | 光晕被平平地切掉。Dock 胶囊的光晕因此是玻璃的兄弟元素 |
| 宿主因为滚动以外的任何原因被隐藏时，`active={false}` | 只有滚出屏幕会被检测到（IntersectionObserver，128px margin） | 帧花在没人看得见的光晕上（Dock 胶囊藏在它的面板后面时会关掉） |
| 声音的 `level` / `bands` 以 getter 传入，绝不在 render 里调用 | 渲染器每帧都会读取它们 | 每帧一次重新渲染，或者光晕冻结在一个值上 |
| `useVoiceInput().start()` 由一次按下触发 | 麦克风只在手势中授权，Safari 也只在手势中启动音频（`primeAudio`） | 权限弹窗始终不来；音量表挂在一个挂起的 `AudioContext` 上，读数为 0 |
| 改了光束的厚度或衰减 → 更新 `GLOW_EXTENT_PER_REACH` | extent 和 reach 是同一个数的两种单位 | About 的光在一条硬线处结束，或者没到指定位置就结束了 |
| 改了 `lib/tuning.ts` 的默认值 → 升级它的 key（`hux_glow_v2`） | 否则已保存的设置会保留旧的默认值 | 老浏览器永远看不到新样子 |

可以自由选择的：`reach`、`bleed`、`strength`、`motion` 和 `period`，line 用哪条边，
`inDuration` / `outDuration`，以及输入框显示光晕还是波形（访客在 DevTool 里的选择；
默认是 Glow）。

## 添加光晕

1. 说出它在表达什么（*在听*、*在处理*、*在运行*、*就是现在*）。如果什么都不表达，
   它就是装饰：停下。
2. 选形状：东西用 `ring`，输入框或进度条用 `line`。选 motion：默认 `flow`，运行中
   用 `rotate`，现在 / 等待用 `pulse`，处理中用 `processing`。小元素（胶囊、按钮）
   需要 `bleed` 和较小的 `reach`（3–4 px）。
3. 把 `<Glow>` 放进一个 `relative` 宿主，它应该跟随这个宿主自己的圆角，并留出光晕的
   空间（见规则）。
4. 先在 `/lab/glow` 里画出来，和它的邻居放在一起，在两种主题下、在壁纸上配合
   devtool 的 Glow · Colours 判断效果。
5. 把它加进上面"看起来是什么样"的表格（如果它原本在候选里，就从候选中移除）。

## 原理

### Shader

对每个像素，shader 知道它离盒子的圆角边缘有多远，以及它在边缘一圈中的位置；
一切都由这两个数构建。

| 部分 | 是什么 |
|---|---|
| 光束 | 绕环的四道行波，两道朝一个方向、两道朝另一个方向，谐波为 2 · 3 · 5 · 7，所以它们的波峰永远不会以同样的方式对齐两次。波决定光向内延伸多远；波峰看上去就是光束。 |
| 颜色 | 调色板沿环铺开，每道光束各自漂移，让颜色彼此滑过；平均之后再从亮度上推开（浅色主题推得更远）。 |
| 核心线 | 边缘上一条细而亮的线，在深色主题下更白。 |
| 光晕 | 盒子外面（`bleed`），一片更柔和的溢出光：小元素需要的那种泛光。 |
| 衰减 | `exp(-(d/thick)^1.45)`，`thick` = reach × 1.7 × 波高（以 baseline 为下限）× 频段的驱动：比指数更陡，因为普通 `exp` 的长尾在一个小元素上累加起来，会在它表面铺一层冲淡的颜色。 |
| 四角 | 光束的深度是四条边距离的**平滑**最小值（log-sum-exp），再和真实的圆角轮廓混合一次。边距离的硬最小值会让光沿对角线折起来：一旦光比角的半径伸得更深，每个角都会出现一道折痕（38px 的光环下 10px 的屏幕圆角）。平滑最小值让等高线在任何深度都保持圆润，让两条边的光在角上叠加，同时仍然贴合圆形宿主的曲线（头像，手机 44px 的圆角）。柔和度跟随 reach；核心线保持在真实轮廓上，清晰锐利。没有 `bleed` 时，圆角轮廓以外什么都不画（按 canvas 的分辨率抗锯齿）：圆角宿主不会在它的曲线外面亮起来。 |
| 聚焦 | 把环收窄成一段弧（`uFocus`、`uFocusAt`）。**line** 就是聚焦到一条边上的环；**processing** 就是那段弧收得很小并且移动。 |
| 能量 | `uLevel`（静止 0.45）拉长每一个 reach（× `0.6 + 0.9 · level`，静止时 1.0）并提亮；`uBands`（低 / 中 / 高）各自驱动自己的光束（第一道、中间两道、第四道），所以说话是涟漪，而不是整体一胀一缩。 |
| 显现 | 光从聚焦中心出现，向两边展开，前沿闪亮，落定时 reach 涌起一下（600 ms；`fixed` 时 900 ms）。 |

**line** 沿着它的边铺开，而不是绕着中心：在宽盒子的中部，角度变化很快，会把光束
展开成放射线，所以 line 的光束和聚焦沿边运行（`sx`，从角到角是环的四分之一），
距离只从这条边量起，reach 朝聚焦中心鼓起，让光升起成一个穹顶（voice-glow 的
*bend*）。弧的半宽是 `0.085 + 0.07 · level`，所以声音既把它抬高也把它拉宽；
`processing` 把它收窄到 0.045，让中心在边上 0.25 ± 0.085 的范围里来回扫动，每次
折返都有缓动，一趟 1.1 s，level 保持在 0.55 或以上。`edge="top"` 是把盒子镜像过来。

### Motion

开着时光怎样活动。`flow` 是这个 shader 最初构建的光场；`rotate` 和 `pulse` 是
Libraries.dev border-beam 的两个家族，它们改为**分层构建**（`lib/shader.ts` 里的
`layered`），和 border-beam 的构建方式一样。border-beam 的 CSS 就放在 `/lab/glow`
里我们的实现旁边（`border-beam` 包，仅 lab 使用的 dev dependency，MIT），每一对都
在同一个宿主上、同一个主题里。

| motion | 光 | 表达 |
|---|---|---|
| `flow` | 光场：四道光束在走，两道朝一个方向、两道朝另一个方向 | *你好*、*我在听* |
| `rotate` | 一段亮弧（约环的 40%）以匀速扫过固定的颜色场（`period`，每圈 2 s；border-beam 的是 1.96），颜色轻轻摇摆；弧的前端有火花 | *在运行* |
| `pulse` | 整个环分成三个柔和的瓣，每个四分之一各按自己的余弦时钟呼吸（1 · 1.23 · 0.89 · 1.37 × `period`，2.3 s），颜色 14 s 转一圈 | *就是现在*、*在等你* |
| `pulse` + `inside={false}` + `bleed` | 只有边缘外的泛光。不需要不透明的子元素；shader 在内部什么都不画 | *按我*：首次访问时 About 的 Reveal |

各层：一条清晰的 **1px 描边**（轮廓：小元素靠它被认出来），一层柔和的**内部**光
（主体），一层越过边缘的**泛光**（氛围），旋转时还有前端附近一道窄窄的**火花**
（深色背景上是白色，浅色背景上是墨色），带一个热点泛光。颜色场固定在盒子上：旋转是
一道光扫过它，所以颜色随着光的移动而变化。所有这些都压得很低，并且按主题区分：是边上
的一道光，而不是一个边框。第一版从 flow 派生出这两种 motion（在移动的光束上开一扇
窗；把光束冻住让它呼吸），看起来比 border-beam 差，而且原因是调参解决不了的：像一盏
灯在滑动而不是光扫过边沿，没有头部，一种衰减在卡片的 3–4 px 上显得浑浊，一团团色块
在胀缩。

在光必须结束的地方（一个 `extent`，比如 About 的深度），各层和 flow 一样遵守它：
内部光被限制，让它自己的尾巴在窗口开始处已经淡到 2%（深度 ≤ 0.232 × extent，呼吸
在这个范围内缩放），窗口只负责让终点精确。不加限制时，窗口到达的地方 pulse 还有
十分之一的强度，光在那里以一条横线结束，而不是淡出。

在屏幕上，各层的主体随盒子变大（内部光最多 × 2.4）：border-beam 没有屏幕尺寸可以
参考，而卡片上的强度放到整个屏幕上就看不出来了。聚成 processing 彗星的光，以及
line，永远是 flow。在减弱动态效果下，旋转停住不动，pulse 保持在中等的呼吸，只画
一次。

#### Baseline

光在没有任何东西运动的地方保留的深度，**以运动达到峰值处深度的比例表示**：flow 的
波谷对波峰，旋转的弧或 pulse 的瓣对边沿。0 表示只有运动所在之处有光；1 表示边沿和
峰值一样深，运动不再可见。波谷是变薄，而不是变暗，和 flow 一样：四道光束加起来，
在边缘处无论下限多薄都保持明亮。低于 flow 自己的波谷（`GLOW_FLOW_TROUGH`，
0.3 / 1.7 = 0.176）时，边沿也会变暗，和 flow 的核心线一样，在 0 时消失。

| motion | baseline | 含义 |
|---|---|---|
| flow | 0.176 | 波谷是波峰 1.7 个 reach 中的 0.3，核心线骑在上面：波浪下面那圈实心的边沿 |
| rotate | 0.12 | 一圈细细的边沿，亮弧扫过时把它加深（0 就是 border-beam 的旋转：弧以外什么都没有） |
| pulse | 0.3 | 一圈边沿，三个瓣呼吸着把它加深 |

在 shader 里：flow 的光束下限是 `uBaseline` × 1.7 个 reach；rotate 和 pulse 的
内部光是 `mix(uBaseline, 1, raw)` × 峰值深度，其中 `raw` 是那里弧或瓣的高度；
越过边缘（pulse 画在外面时），泛光保持同样比例的光。`baseline` 故意设为高级选项：
默认值只是一个靠眼睛判断的起点，这个旋钮就是为此而设（devtool 的 About · baseline，
lab 里的 baseline 覆盖）。

### 颜色

在壁纸上，光可以从图片里取色（`lib/harmony.ts`）。图片的主色决定一个基础色相：
ambient profile 的 `tint`，照片测量一次得到的颜色，天空则从实时场景里读取，由
`components/palette-bridge.tsx` 发布。一条色轮规则从它选出三个色相，让光属于这张
图片，而不是浮在它上面。

| 规则 | 色相（OKLCH，相对基础色相） | 看起来 |
|---|---|---|
| analogous | −32°，0°，+32° | 图片自己的颜色被点亮（最平静） |
| complementary | 0°，+24°，+180° | 图片的颜色和它的对立色（对比最强） |
| split | 0°，+150°，+210° | 对立色的两个邻居（有对比而不冲突） |
| triadic | 0°，+120°，+240° | 均匀分布在色轮上（最活泼） |
| **auto** | 色彩丰富的图片（chroma ≥ 0.08）→ analogous；柔和的 → split；灰的（chroma < 0.03，或者纯色页面）→ siri | |
| **siri**（默认） | Siri 的五个色标，无论壁纸是什么 | |

每个色相都用同一个 OKLCH 亮度和彩度绘制（深色主题 0.74 / 0.16，浅色主题 0.68），
彩度降到能放进 sRGB 为止，这样三者看起来地位相等，也不会有哪个被截断。它们作为一个
环变成 shader 的五个色标（a b c b′ a′，返回的两个稍亮和稍暗一点），放在
`uniform vec3 uPal[5]` 里，由 `ring()` 插值。渲染器每帧读取调色板；换了壁纸或规则
之后，用 1.5 s 缓动过去，停住的帧也会重画。不触发任何重新渲染。色轮用 OKLCH，是为了
让"相差 32°"在眼睛看来就是 32°。

规则是全站的，所以只有一道光。它在 devtool 的 Glow 模块里（`Colours`，附带壁纸的
色相和五个色标的色块）；`/lab/glow` 针对分布在色轮各处的壁纸逐一展示每条规则。CSS
回退方案（没有 WebGL）和语音波形保留 Siri 的色标。

### 渲染器

浏览器只保留少数几个 WebGL context，超出就丢掉最旧的，而一个页面可能有很多光晕
（徽章）。所以只有一个 context，在一个从不放进文档的 canvas 上；每个 `<Glow>` 是一个
*实例*（页面里的一个 2D canvas），渲染器把 shader 画进共享的 canvas，再复制过去
（`drawImage`，在同一个任务里，在 WebGL 缓冲区呈现之前）。共享 canvas 只会变大，
每个实例画在它的左下角。context 丢失后在下一帧重建。

一个 `requestAnimationFrame` 循环服务所有实例，只在有实例处于活动状态（进场、开着或
离场）且标签页可见时运行：

- **屏幕外**：滚走的实例会被跳过（IntersectionObserver，128px margin；`fixed`
  的光晕不适用）。
- **稳定**：在减弱动态效果下且没有任何东西在动（没有 getter 形式的 `level`，没有
  `bands`，不在 processing），只画一帧然后停住（`hold`）。
- **节奏**：当帧间隔超过 22 ms 持续半秒，循环降到隔帧绘制，每 4 s 试探一次全速。
  光晕的动态远慢于 30 Hz，稳定的半速比参差的全速看起来更好。
- **分辨率**：超过 160,000 CSS px² 的光晕用设备像素比的一半（柔和，开销大），较小的
  用完整像素比（它的核心线需要每一个像素）；像素比上限为 2。
- **回退**：没有 WebGL 时，用 Siri 色标画一个静止、模糊的锥形渐变（`app/globals.css`
  里的 `.glow-fallback`；line 被遮罩到只剩底边）。

## 语音

`useVoiceInput({ lang, onInterim, onFinal })` 选择一条识别路径，并把同一个麦克风
音量表输送给光晕。

![语音流水线分三栏。识别：一次按下调用 start()；gateway 路径用 MediaRecorder 录音，把片段 POST 到 /api/voice；浏览器路径用 SpeechRecognition，并为音量表另开一路音频流。音量表：AnalyserNode 输出 RMS 乘以增益 5，经过 0.02 的门限、软拐点和 120/550 ms 的包络得到 level；三个频段各自经过增益、门限、软拐点和包络得到 bands。光晕：状态机 idle、listening、processing；level() 和 bands() 以空闲呼吸 0.17 + 0.06 sin(2.4t) 为下限；line 形状的 Glow；以及它们设置的 uniform。](/img/docs/system-glow/voice-pipeline.svg)

两条路径最后都落到同样的两个 getter 和同一个 `<Glow>`；不同的只是文字从哪里来。
呼吸下限让光晕在按下的那一刻、麦克风还没打开时就开始动。

- **AI Gateway**：当服务端有 Gateway 凭据（`VERCEL`、`AI_GATEWAY_API_KEY` 或
  `VERCEL_OIDC_TOKEN`），浏览器支持 `MediaRecorder`（webm/opus、mp4 或
  ogg/opus），并且 DevTool 选的模型不是 Browser 时使用。点一下开始、点停止结束，或者
  按住录音、在输入框内松开结束。松开之前滑出输入框会取消这次按住的录音。完整的片段
  经过 `/api/voice`。DevTool 的 Voice 模块可以选 `openai/whisper-1`（默认，
  `$0.36/hour`，`systems/voice/models.ts` 里的 `DEFAULT_VOICE_MODEL`）或
  `spacexai/grok-stt`（`$0.10/hour`）。在 Grok 经过真实的中英文口述测试之前，
  Whisper 一直是默认。在 Ask 里，按住后松开会把完整的转写直接作为消息发送，而点一下再
  停止则把文字填进输入框供编辑；命令面板总是填入。API key 留在服务端。录音 60 秒后
  自动停止，片段限制在 5 MiB 以内，短于 300 ms 的片段会被丢弃。设置
  `VOICE_TRANSCRIPTION_MODEL=off` 可以关闭 Gateway 转写。某个模型录音或转写失败后，
  在页面剩下的生命周期里回退到浏览器识别（选择另一个模型则使用那个模型）。
- **浏览器回退**：Web Speech API（`SpeechRecognition`、
  `webkitSpeechRecognition`）提供中间结果，并在说话人停顿时给出最终短语。识别由浏览器
  完成；不经过本站。两条路径都不可用时，麦克风会被隐藏。DevTool 可以明确选择 Browser，
  用来和 Gateway 模型对比；这时使用浏览器路径原来的点按聆听交互。
- **声音本身**：一路麦克风流经过 `lib/meter.ts`，供光晕使用。如果第二路采集被拒绝，
  level 就从识别器自己的 sound / speech / result 事件合成出来，光晕仍然有回应。
- **空闲**：从按下开始，level 和每个频段都不会低于一个缓慢的呼吸（`use-voice-input.ts`
  里的 `IDLE`：0.17 ± 0.06，2.4 rad/s），所以光晕和波形立刻就动，在麦克风打开之前、
  在词与词之间也在动，而不是等到第一个音节才醒来（音量表的门限会把静音读成 0）。

状态：`idle → listening → processing`（浏览器整理文字，或 Gateway 转写片段）
`→ idle`，或者 `denied` / `error`，每个都会弹出一行提示（`voice-input-error`）。
hook 的 `listening` 在 `listening` 和 `processing` 两种状态下都为 true，光晕的
`active` 接的就是它。

音量表按 voice-glow 的方式塑造原始信号：增益（× 5；笔记本麦克风读数在 0.03–0.2 RMS），
噪声门限（0.02），软拐点让喊叫被圆滑地压住，以及包络，快上（120 ms）慢下（550 ms），
所以光晕随一个音节跃起，在词与词之间回落。三个频段（80–300 Hz、300–2000、
2000–6000）各有自己的包络，驱动各自的光束。整个页面只有一个 `AudioContext`，不连接
到扬声器，分析只在 getter 被读取时运行。

![三个搜索框，从上到下：沿底边一道又低又细的光；一道更高更宽、横跨大半个输入框升起的光；一道聚在中心偏左的短光束。](/img/docs/system-glow/line-states.png)

`/lab/glow` 里输入框的 `line`：在呼吸的下限（level 0.17）、在很大的声音下（0.95），
以及 `processing`：声音把光抬高并拉宽它的弧；processing 把它聚成一道沿边移动的光束。

### 在命令面板里

一个麦克风，放在输入框末端的按钮组里，两种外壳都有（桌面上的 popover、手机上的
sheet），Ask 输入框的工具栏里也有（`systems/command/voice.tsx`：`VoiceButton`、
`VoiceVisual`、`VoiceStatus`）。聆听时，输入框底边戴上 `line` 光晕
（`strength={0.95}`），随着声音升起和起伏。它在按下时就出现（`glowDelay` 0，
`systems/ask/lib/config.ts`）：它自己的显现，一次从中心向外的扫动，就是它的到来。
在手机上，如果这次按下在最近 800 ms 内让键盘收了起来，它会再等 `keyboardDelay`
（320 ms；桌面上为 0），因为键盘的滑动和光晕的头几帧叠在一起会掉帧。

![Gateway 录音时、然后转写时的命令面板输入框："Recording…" 带红色停止按钮和录音圆点，光沿着底边；然后 "Transcribing…" 带一个转圈，光聚成一道光束。](/img/docs/system-glow/palette-gateway.png)

桌面上的命令面板，`GET /api/voice` 被打桩为开启，使用模拟麦克风：录音中（输入框隐藏，
原地显示内联状态，停止按钮带圆点，line 光晕）和转写中（一个转圈，光束在移动）。

Gateway 录音时，按钮变成带录音圆点的停止图标，转写时变成转圈；输入框内联显示录音、
松开和取消的文案。在 Ask 里，输入框把 textarea 和模型控件折叠成单独一行录音条
（300 ms，ease-out），转写完成后再展开。在 Gateway 模式下，支持的浏览器会在开始、停止
和取消时给出短促的振动反馈。

DevTool 的 Voice 模块可以把视觉样式切换为**波形**（`systems/voice/waveform.tsx`）：
64 根 Siri 色标的竖条填满状态旁边的输入框一行，随着同一个音量表的 level 和 bands
变高；一个移动的鼓包表示正在转写。两种样式互斥；保存的默认值是 Glow。录音结束或浏览器
语音识别停顿时，光晕聚成移动的光束，直到短语落定。

说出来的话被当作查询，而不是句子来读："go to the writing"、"open works"、
"show me the wallpaper"、"打开写作" 到达时分别是 `writing`、`works`、`wallpaper`、
`写作`（`toQuery`）。说出来的问题整句送进去，交给 Ask（`toFieldText`）。

语音是一个**动作**，不是一个地方，也不是一项设置：它在命令面板的 `actions` 区（现在就
做一件事），和 Ask、Music、Add to Home Screen 并列。它是 `slashOnly`：在斜杠列表里
是 `V`，永远不会作为搜索结果出现，因为它的控件已经在输入框里了。只有浏览器有识别器时
（`isVoiceSupported()`）它才会列出，即使 Gateway 本来能用。

### 手势

**用 Gateway 模型时点一下或按住录音；浏览器模式保留原来的手势。** 口述工具都同时响应
点按和按住：Wispr Flow 按住 Fn（按住说话），macOS 按两下地球键，Windows 的 Win+H，
Superwhisper 的 ⌥Space。这些键里最好的那些要么被系统全局占用，要么页面根本看不到
（浏览器收不到 Fn / 地球键；Win+H 属于操作系统；⌥Space 属于这类工具，在 Mac 上还会
打出一个不换行空格）。所以命令面板一个都不占用，而是在自己的空间里提供同样的两种手势
（`HOLD_MS`，300 ms，算作按住）：

| 入口 | Gateway 模型 | 浏览器识别 |
|---|---|---|
| 麦克风 | 点一下开始，点停止转写；或者按住、说话，在输入框内松开转写（在 Ask 里是发送），在外面松开取消 | 点一下切换，或者按住 ≥ 300 ms 后松开停止 |
| `/` `V` | 点一下开始，用停止按钮结束；或者按住 V、说话，松开转写 | 点一下开始，或者按住 ≥ 300 ms 后松开停止 |
| 空输入框里的空格（仅命令面板） | 按住 ≥ 300 ms，说话，松开转写 | 按住 ≥ 300 ms，说话，松开停止 |

浏览器的点按会话在说话人停顿时结束；按住的会话在松开按键或指针时结束。`/` `V` 知道
自己是由按键触发的，因为命令的 `run` 会收到触发它的那个字母；点击它的斜杠列表行则不带
字母，所以之后打出的 "v" 永远不会结束一次会话。按住的键产生的重复会被吞掉，所以按住
永远不会往输入框里打字。

## 调校

devtool 的 **Glow** 模块调高或调低这道光，保存在 localStorage 里（`hux_glow_v2`，
`lib/tuning.ts`；key 的版本随默认值一起变，所以保存过旧默认值的浏览器会从新的开始）：

| 旋钮 | 范围 | 作用 |
|---|---|---|
| Colours | Siri / Auto / Analog / Compl / Split / Triad，单独占一行 | 所有光晕的颜色从哪里来：默认 Siri |
| Strength · all | 0–150% | 全站每一处光晕。渲染器每帧读取它，所以拖动会同时改变所有亮着的光晕 |
| About · motion | Flow / Rotate / Pulse | About 光环的 `motion`，在最要紧的那个光环上逐一判断：默认 Flow。它排在 About 各旋钮的第一个，因为其他旋钮都要对照它来看 |
| About · strength | 0–150% | About 的光环，叠加在上一项之上 |
| About · desk depth | 较窄留白的 5–250% | 桌面上（`sm` 及以上）About 的 `<EdgeGlow depth>`：默认 140% |
| About · phone depth | 较窄留白的 5–250% | 手机上的同一项：默认 140% |
| About · baseline | 0–100% | 高级：无论哪种 motion，About 光环在没有波、弧或瓣的地方保留的光：默认 5% |

两种布局的深度默认都是 140%：光的尾巴结束在较窄留白再往外 40% 的地方，越过文字的边缘，
但避开了大部分文字。

About 显示时这个模块会展开（它的 `relevant`），面板滚动到它那里，在那里判断光的效果。
蓝色的 `*` 标记偏离默认值的旋钮；点它会把那个旋钮重置。模块自己标题旁的 `*` 会全部
重置（一个传了 `onReset` 的 `DebugSection`）。`Show About` 把光环调出来供肉眼判断。
About 显示时，devtool 浮在它上面（`DEVTOOL_OVER_ABOUT_Z`，10030：它的胶囊、窗口和
sheet；`SurfaceWindow` / `SurfaceSheet` 上的 `zIndex`），但仍在命令面板之下。

**Voice** 模块选择转写模型（Browser / Whisper / Grok，保存为 `hux_voice_model`）
和音频视觉样式（Glow / Waveform，`hux_voice_visual`）。

## 候选

画在 `/lab/glow` 的 "Could be" 一行里，每一个都可以用眼睛判断；目前都还没接入（规则见
[添加光晕](#添加光晕)）。

| 位置 | 形状 | 将会表达 |
|---|---|---|
| ⌘K 聆听时首页的命令栏 | line | 从页面上看到的声音 |
| 窗口已打开的应用图标 | ring，rotate | 在运行 |
| /works 上的 HEAD commit | ring，pulse | 就是现在 |
| 播放演讲时身份卡片上的照片 | ring | 正在说话 |

## 来自 Libraries.dev

[border-beam](https://github.com/Jakubantalik/libraries.dev/tree/main/packages/border-beam)
和 [voice-glow](https://github.com/Jakubantalik/libraries.dev/tree/main/packages/voice-glow)
是带共享 rAF 驱动的 CSS 渐变组件；这个系统是 shader，但结构取自它们：

| 来源 | 取用了什么 |
|---|---|
| border-beam 的 `line` 类型 | 光晕可以只在一条边上，这正是输入框需要的形状 |
| border-beam / voice-glow 的驱动 | 一个共享循环，屏幕外暂停，自适应半速 |
| border-beam 的 `strength`、`active` + 淡入淡出 | `strength`，带动画显现和离场的 `active` |
| border-beam 的 `pulse-outside` | 光晕（`bleed`）：小元素的光溢出到外面；配合 `motion="pulse"` 和 `inside={false}`，就是全部 |
| border-beam 的 rotate 家族 | `motion="rotate"`：它的分层（描边、内部、泛光、火花）和固定的颜色场，在 shader 里实现 |
| border-beam 的 pulse 家族 + 它共享的振荡器驱动 | `motion="pulse"`：一个个颜色瓣，四个四分之一按错开的余弦时钟呼吸，由唯一的渲染器循环驱动 |
| voice-glow 的分析 | 门限 → 软拐点 → attack/release 包络；三个人声频段各有自己的包络 |
| voice-glow 的频段 → 瓣 | 频段驱动各自的光束，所以声音是涟漪 |
| voice-glow 的 `bend` | line 的 reach 在中心鼓成一个穹顶 |
| voice-glow 的 `processing` | 光聚成一道移动的光束，每次折返都有缓动 |
| voice-glow 的 `idle` | 静止 level（0.45），所以开着时从不死气沉沉 |

没有取用的：每个实例生成的样式表（改用一个 shader），按尺寸调好的多套调色板（同一时间
一套调色板，来自壁纸或 Siri），以及 voice-glow 的 SVG 位移扭曲（在 WebKit 上开销大，
而且 shader 的光束本来就在动）。

## 文件

```
systems/glow/
├── index.ts
├── lib/
│   ├── palette.ts      # Siri's five stops, and the shader's ring() over uPal
│   ├── harmony.ts      # the light's colours from the wallpaper, by a colour-wheel rule
│   ├── shader.ts       # the field of light on the edge of a rounded box
│   ├── renderer.ts     # one WebGL context, one rAF loop, every instance
│   └── tuning.ts       # the devtool's knobs: strength, colours, the About's motion, depth, baseline
└── components/
    ├── glow.tsx        # <Glow>: shape, level, processing, reveal; GLOW_BASELINE
    ├── edge-glow.tsx   # <EdgeGlow>: a screen's ring, ending where its content begins
    └── palette-bridge.tsx  # publishes the wallpaper's dominant colour to harmony.ts

systems/voice/
├── index.ts            # VOICE_LANG, exports
├── lib/meter.ts        # microphone → level + three bands (gain, gate, knee, envelope)
├── use-voice-input.ts  # Gateway recording or Web Speech API + the meter + IDLE
├── waveform.tsx        # the alternative visual: 64 bars beside the status
├── models.ts           # allowed transcription models and the default
└── prefs.ts            # saved DevTool choices: model, visual

systems/command/voice.tsx   # the microphone, the visual, the status copy, gestures, toQuery
app/api/voice/route.ts      # Gateway availability (GET) and transcription (POST)
app/lab/glow/               # the lab: every scale, one set of controls, a real microphone
```
