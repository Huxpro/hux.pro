---
origin: "AI-translated from the original"
---

# 可读性

在任意壁纸、任一种玻璃材质下，文字怎样保持可读；以及把其中每一个数字都变成滑块的实验室。

## 做好了是什么样

每一种文字颜色都是墨色（ink）加一个 alpha，所以它会和背后的东西合成：白色、玻璃填充、一张照片。在平静的图片上，各级（rung）落在原来那些灰色的位置；在繁杂的图片上，它们会往上爬、加上阴影，裸露区域还会翻转成另一种墨色。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-legibility/ladder-tahoe.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="实验室的裸样本，Tahoe 壁纸，浅色主题：深色墨色，四级均匀递减；另外注入了一行旧的固定灰色，它和 secondary 那一级挨得很近。" />
  <img src="/img/docs/system-legibility/ladder-zebra.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同一个样本，Zebra 壁纸，浅色主题：该区域已翻转为浅色墨色，带深色投影，各级依然递减、依然可读；那行固定灰色则消失在条纹里。" />
</div>

`/lab/legibility` 的裸样本，分别在 Tahoe（平静，`edges` 0.018）和 Zebra（最繁杂的图片，0.124）上，都是浅色主题。最后一行 `oklch(0.556)` 是旧的 secondary 灰色，专为这张截图注入。在 Tahoe 上它紧挨着 `muted-foreground`，这正是要点：在页面原本就正确的地方，这套阶梯看起来和以前一样。在 Zebra 上，阶梯翻转为浅色墨色，secondary 一级从 54 % 爬到 88 %（ink boost +14，bare boost +20），浮雕（relief）是深色投影；而那个固定灰色两种墨色都不属于，于是沉了下去。

原来的调色板是灰阶：白底黑字、`#1a1a1a` 底白字，中间夹着几种固定灰色：`oklch(0.556)` 用于次要文字，`oklch(0.97)` 用于悬停底色，`oklch(0.922)` 用于边框。每一种灰其实都是*预先算好的 alpha*：黑色 53% 叠在白色上恰好就是这个颜色。只要页面永远是白色或近黑色，这就成立。壁纸和透明玻璃打破了它：固定灰色不管背后是什么，所以在中间调的天空上会消失，在深色海面上又会刺眼。

## 原理

三层，从静态到运行时：

```
scripts/wallpaper-profile.ts       measure every wallpaper once  →  wallpaper-profiles.json
systems/ambient/lib/legibility.ts  policy: profile → CSS variables on <html>   (pure, cheap)
app/globals.css                    the ladder: variables → every token         (no JS)
```

### 1. 墨色加 alpha（`globals.css`）

每一个文字和底色 token 都是 `--ink` 乘一个百分比：

| Token | 含义 | 浅色 | 深色 |
|---|---|---|---|
| `--foreground` | 墨色本身 | `oklch(0.145)` | `oklch(0.93)` |
| `--reading-foreground` | 墨色乘 `--ink-alpha-reading`，用于连续阅读的正文而非标签 | 85 % | 85 % |
| `--muted-foreground` | 墨色乘 `--ink-alpha-secondary`（+ boost） | 54 % | 60 % |
| `--tertiary-foreground` | 墨色乘 `--ink-alpha-tertiary`（+ boost） | 32 % | 36 % |
| `--quaternary-foreground` | 墨色乘 `--ink-alpha-quaternary`（+ boost） | 20 % | 22 % |
| `--muted`、`--secondary` | 墨色乘 `--wash-alpha-muted` | 4 % | 6 % |
| `--accent` | 墨色乘 `--wash-alpha-accent`（+ tint） | 7 % | 10 % |
| `--border`、`--input` | 墨色乘 `--wash-alpha-border` | 9 % | 10 % |
| `--ring` | 墨色乘 `--ink-alpha-ring`（+ tint） | 45 % | 45 % |
| `--ink-line` | 文字下方的线（链接的下划线）；是一个直接写出的输入值（见下文） | 40 % | 40 % |

“+ boost” 指 `--wp-ink-boost`，在裸露区域再加 `--wp-zone-boost`，在阅读路由上再加 `--wp-lift-*`（quaternary 一级不加 lift）。

`text-muted-foreground`、`bg-muted/50`、`border-border/50` 和 `hover:bg-accent/25` 都能用，Tailwind 的 `/NN` 修饰符是把 alpha 相乘，而不是把一种灰调淡。用在底色上没问题。用在*文字*上，修饰符等于自造了一级，并且会把壁纸 boost 一起按比例缩小；所以文字应该选一级：`text-tertiary-foreground`（说明文字、时间戳）和 `text-quaternary-foreground`（分隔符）补全了 Apple 的阶梯。这些 alpha 是挑过的，在纯色页面上与旧灰色只差一两个通道值，所以原本正确的地方看起来不变，原本错误的地方则跟着背景走。`bg-ink/5` 是在任何东西上都适用的底色。

**文字下方的线是唯一不做混合的一级。** 其余每个 token 都是墨色的 `color-mix()`。Safari 在 `color`、填充和边框里会绘制这种颜色，但在 `text-decoration-color` 里不会，混合出的颜色在那里根本不画：写成 `decoration-<token>/NN` 的下划线在 iPhone 上是看不见的。所以 `--ink-line` 是一个输入值：按主题直接写出墨色的 40 %（`--ink-line-theme` / `--ink-line-inverse`），在翻转区域里像 `--ink` 一样被替换。下划线就写成 `decoration-ink-line`：文章里的链接、magic link（`.prose-link`）、问候语、prompt 页面、语言图表都是这样。因为是直接写出的，它不吃壁纸 boost：文字下方的线是文字所在那一级上的装饰。

![:root 和 .dark 上的输入值，以及 html 上的壁纸输入值，流入 THE LADDER 代码块，由它用 --ink 混合出每个文字和底色 token；工具类读取这些派生 token；--ink-line 绕过阶梯。翻转的 .ink-bare 区域重新声明 --ink、--ink-line 和浮雕基础变量，并因为它在阶梯的选择器列表里而重新派生。](/img/docs/system-legibility/ladder.svg)

这些 token 在一个代码块里派生（`globals.css` 中的 “THE LADDER”），声明在 `:root`、`.ink-scope`（实验室的一个格子）、`.ink-flip`、`.ink-bare` 和 `.ink-bare-mid` 上。自定义属性在声明处计算，并以值的形式继承，所以一个改变 `--ink` 的区域也必须在这个选择器列表里，否则它的 `--muted-foreground` 传下来时已经是用根节点的墨色混好的了。替换本身要同时重新声明三样东西：`--ink`、`--ink-line`，以及浮雕基础变量（`--relief-rgb`、`-a1`、`-a2`、`-y`、`-b1`、`-b2`）。

### 2. Profile（`scripts/wallpaper-profile.ts`）

```bash
pnpm wallpapers:profile          # measure, write systems/ambient/lib/wallpaper-profiles.json
pnpm wallpapers:profile:check    # exit 1 if the table is stale (not in CI; run it by hand)
```

每一张提交进仓库的图片都在 OKLab 中按 96×60 的网格采样；**Classic** 天气调色板（六种天气的白天和夜晚，加上日出和日落）由各自的三种颜色合成到同样的网格上，所以渐变的 profile 可以和照片的直接比较。每个素材：

| 字段 | 含义 |
|---|---|
| `lum` | 平均亮度，0..1 |
| `zones.top/mid/bottom` | 每个三分之一区域的平均亮度；标识和问候语位于上三分之一 |
| `mean` | 平均颜色，sRGB，供实验室估算对比度以及阅读 lift 使用 |
| `contrast` | 亮度的标准差 |
| `edges` | 亮度的平均局部梯度：**有多繁杂**。一个 Classic 渐变约为 0.001；Zebra 是 0.124 |
| `chroma` | 平均 OKLab 色度 |
| `tint` | 主导彩色（按色度加权的色相直方图，峰值 ± 1 个桶），灰色时为 null |

Profile 是关于一个文件的事实。添加壁纸就是运行脚本、提交这张表；其他任何东西都不需要知道这张图片的存在。

**Sky** 和 **Gradient** 不是文件。它们的场景每分钟根据太阳、月亮和天气派生一次（`systems/ambient/lib/scene.ts`），再由 shader 绘制。构建时没有东西可测，运行时也没有东西要采样：场景本身已经描述了画面。`profileFromScene`（在 `legibility.ts` 中）直接从场景读出同样形状的 profile：把加了 veil 的天顶、中段和地平线按图层不透明度合成，作为三个区段；对 Sky，把云量 × 密度、降水、雾、星星和闪电作为 `edges`（Gradient 是平滑的，所以为零）；中段的 OKLab 色度和色相作为 tint。几十次乘法而已；暴风雨中的 Sky 能达到 Zebra 繁杂度的一半左右，并相应地得到浮雕和玻璃填充。Classic 继续使用测量出的表。

### 3. 策略（`legibility.ts`）

`resolveLegibility({ profile, theme, reading, veiled, policy })` 返回下面这些数字（`policy` 默认为 `DEFAULT_LEGIBILITY_POLICY`）。运行时计算的就只有这些，并按可能变化的输入做了记忆化：

| 输出 | 来源 | 落在哪里 |
|---|---|---|
| `inkBoost` | `max(busy, 0.7·conflict) × 14` 个 alpha 点 | `--wp-ink-boost`，加到 secondary、tertiary 和 quaternary 的 alpha 上 |
| `bareBoost` | 再加 `busy × 20` 个 alpha 点，仅限裸露区域；阅读路由上为 0 | `--wp-bare-boost`，`.ink-bare` / `.ink-bare-mid` 把它当作自己的 `--wp-zone-boost`。那些文字除了图片什么依靠都没有，所以在繁杂的图片上它们的各级会向不透明攀升，就像 iOS 绘制主屏幕标签那样 |
| `relief` | `max(need, busy × 0.85)`，其中 `need` 随墨色与顶部区段的差距缩小到 0.55 以下而增大；阅读路由上 × 0；小于 0.1 → 0 | `--wp-relief`，缩放文字阴影 |
| `flip`、`flipMid` | 按区段判断（顶部区段对应页头，中段对应 app 文件夹）：反向墨色与该区段的差距比主题墨色多出 0.15 以上时翻转；评分时浅色墨色有 `0.25 × √busy` 的先手优势，因为它的投影是更强的浮雕，而光晕只在纹理上失效。在最大繁杂度下，浅色主题低于约 0.59 就翻转，深色主题高于约 0.74 就翻回来；而一张平静的中间调图片（露珠）保持主题墨色 | `data-wallpaper-flip`、`data-wallpaper-flip-mid` |
| `glassAdd` | `busy × 14 + conflict × 22` 个填充点 | `--wp-glass-add`，加到每一种玻璃填充上（Clear 全取，Tinted 取一半） |
| `veil` | `veilBase[theme] + busy × 0.15 + conflict × 0.15`，上限 0.7（基值浅色 0.32 / 深色 0.40） | `--wp-veil`；开启 Reading dim 时阅读 veil 的 alpha，任何类型都适用（包括 Sky） |
| `blur` | `28px + busy × 16px` | `--wp-blur`；开启 Reading blur 时的阅读失焦半径（仅限图片） |
| `tint` | profile 的 tint，钳制到 L 0.50–0.66（浅色）/ 0.60–0.76（深色），C 0.05–0.16；色度低于 0.03 时为灰色 | `--wp-tint-l/c/h` |
| `lift` | 仅限阅读路由：secondary 和 tertiary 在 `inkBoost` 之上还需要多少 alpha 点，才能在加了 veil 的图片上（取其均值和最差区段）达到 4.5:1 和 3:1，上限 80 % / 60 %，让各级仍然是不同的级 | `--wp-lift-secondary`、`--wp-lift-tertiary` |

`busy` 是 `edges / 0.06`，经过钳制。`conflict` 衡量图片落在卡片颜色错误一侧的程度（一张深色照片在浅色主题的白色卡片下会变成中灰，深色墨色在那里没有立足之地）：浅色主题中亮度 0.62 时为 0，0.22 时为 1；深色主题中 0.45 时为 0，0.85 时为 1。

Provider 在一个 effect（`applyLegibility`）里把这些输出写到 `<html>` 上，外加 `data-wallpaper-kind`（`image` / `weather` / `none`）、`data-wallpaper-surface`（`desktop` / `reading`）和 `data-wallpaper-relief`（仅在大于零时存在）。与现有值相同的写入会被跳过。不会触发重新渲染；剩下的交给样式表。在纯色页面、天气渐变、平静的图片以及每个阅读页面上，这些输出都是零，文字阴影为 `none`（而不是透明阴影），所以主路径不会比以前多付出任何代价。

### 4. 浮雕与翻转

浮雕是两种形状的 `text-shadow`，形状是墨色的一个属性：

```css
/* light ink */  0 1px 3px rgb(0 0 0 / .6·r), 0 0 2px rgb(0 0 0 / .45·r)
/* dark ink  */  0 0 4px rgb(255 255 255 / .55·r), 0 0 3px rgb(255 255 255 / .3·r)
```

每个主题都为自己的墨色声明一组参数（`--relief-theme-*`：颜色、两个 alpha、偏移、模糊半径），也为反向墨色声明一组（`--relief-inverse-*`）；阶梯根据元素携带的是哪一组来构建 `--text-relief`，所以那条翻转区域 `--ink` 的规则会同时切换阴影形状，没有任何选择器需要把“哪个主题、有没有翻转”问上两遍。

`text-shadow` 以计算值的形式继承，所以它在每种底面上只声明一次：`body`（壁纸）以及改变输入值的区域（`.ink-bare`、`.ink-bare-mid`、`.ink-scope`）；`bg-glass` / `bg-glass-strong` 类及其悬停态（× `--glass-relief-k`：Tinted 为 0.3，Clear 为 1）；以及 `bg-glass-overlay` / `-sheet` / `-popover`（× `--glass-relief-solid-k`：Tinted 为 0，Clear 为 0.5）。`.ink-flat` 让一个元素退出。

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-legibility/relief-on.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="Zebra 条纹上的浅色墨色 secondary、tertiary 和 quaternary，带深色投影：白色条纹上的字保持着深色边缘。" />
  <img src="/img/docs/system-legibility/relief-flat.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="同样几行加上 .ink-flat：在白色条纹上，tertiary 和 quaternary 的字母融进了条纹里。" />
</div>

Zebra 上翻转后的阶梯，浮雕为 0.85（左），以及同一区域加上 `.ink-flat`（右），已放大。看 “tertiary” 和 “quaternary” 穿过白色条纹的地方：有投影时字母保有边缘；没有投影时它们融进了斑马的皮毛。`.ink-flat` 用于自带底面的文字（反色小标签、代码），绝不用于图片上的文字。

只有裸露区域会翻转：`.ink-bare`，依据图片的顶部区段判断（主屏幕的页头，加上 Sky 的提示、下拉提示和归位 spinner）；以及 `.ink-bare-mid`，静止状态下的 app 文件夹（图标下方的标签），依据中段判断。两者背后除了图片什么都没有。在 `data-wallpaper-flip` / `data-wallpaper-flip-mid` 下，区域把 `--ink` 换成 `--ink-inverse`，重新派生自己的阶梯，并选用另一种浮雕形状。这个比较并不对称：浅色文字带深色投影，深色文字带白色光晕，而投影能在多得多的底面上读得清（Aqua 和锁屏在照片上都选择了白字加阴影），所以 `dropBias` 给浅色墨色一个随繁杂度增长的先手优势（光晕只在纹理上失效）。因此，繁杂的中间调图片（石头、枯山水）在浅色主题下会变成浅色字，而不是深色字加光晕；而一张平静的图片（露珠）保持主题墨色。玻璃表面从不翻转：它们带着卡片颜色，所以它们的墨色本来就是对的。它们改为通过 `glassAdd` 来*适应*，这正是 Liquid Glass 对小元素和大元素的区分。一个按需长出玻璃的区域，也就随之不再是裸露的：文件夹在编辑时去掉 `.ink-bare-mid`，而在可悬停的指针设备上，`.ink-bare-rest` 会在悬停玻璃下取消翻转。

### 5. 排版角色（`lib/typography.ts`）

角色是 `lib/typography.ts` 中反复出现的配方：每个 `TYPE.*` 都是一串 class（字号、字体、字距），钉在阶梯的某一级上，生产组件和实验室的样本都导入它们。完整的角色 → 级映射在 [design-system.md → Roles](./design-system.md#roles)；决定一个角色落在哪一级的规则见下文。

共享的字符串是实验室赖以成立的对齐保证：样本里的日期和写作小组件里的日期都是 `TYPE.rowMeta`，同一串字符串，所以无论两边怎样组件化，都不会走样。实验室刻意不挂载任何生产组件；再渲染一遍站点，就多了一样需要保持同步的东西。角色没有覆盖到的，就在调用处内联写出，等它反复出现时再提升到 `lib/typography.ts`。

#### 各级的规则

- **Reading**（`reading-foreground`，`TYPE.reading`）：连续阅读的正文，比如文章正文、/prompt 条目的推理、一条陈述下的各方声音。阅读内容有自己的层级：挂在正文旁边的东西（/prompt 条目的实例、一条影响的单行背景、引用的出处）留在低一级，即 secondary。一行接一行读下去的文字不是标签，Apple 用的是 label 颜色，而不是 secondary。各标签级是为界面框架（chrome）调校的：一段 secondary 的正文在白底上是 4.3:1，在加了 veil 的壁纸上约 3.5:1，而同一段落在这一级上约为 7。
- **Secondary**（`muted-foreground`）：在它所在之处本身就是信息的文字：分区标签、文章的标题行、描述。
- **Tertiary**（`tertiary-foreground`）：为相邻内容作注的文字：标题旁的日期、标题下的副标题、说明文字、时间线里的人生事件、未激活的筛选项、静止状态的图标链接。
- **Quaternary**（`quaternary-foreground`）：只用于本身不携带信息的东西：分隔符（`·`、`@`）、哈希列（`TYPE.hash`）、占位字形、正文行号、悬停才出现的箭头。它在图片上几乎看不见，这对装饰是对的，对文字是错的：语言徽标、作品的元信息行、事件行、标签行、统计数字之类都放在 tertiary。它吃满壁纸 boost。

因此，等宽元信息按同一条规则（而不是两条）落在两级上：在它作注的标题旁边（`rowMeta`，tertiary）；单独出现时它就是信息本身（`meta`，secondary）。

#### 决定

已定：调色板的分组标题使用 `TYPE.label`（等宽，与其他所有分区标签一致）；标签按原样书写，不用大写，因为小写等宽本身已经是机器层的声音（`jul 2020`、`retry`、`cd ~`），大写是叠在上面的第二种、更响的声音（devtool 保留自己的读数腔调）。`/writing` 把来源（译 / 知乎）作为 `rowMeta` 文字印出，不给 `featured` 加徽标。

仍未决定，并在实验室中原样复现：

1. **三种标签字号。** 小组件标签是 `text-xs`；壁纸 sheet 的分区标签是 `text-[11px]`；说明条和 sheet 的胶囊是 `text-[10px]`。角色只保留两种（`label`、`labelSm`）；11px 的 sheet 标签尚未迁移，两种方向都有可能。

### 6. 阅读处理

一张照片衬在 680px 的正文栏后面，是一个与之竞争的图形，所以除主屏幕外的每个路由都让它退后：在图片上盖一层页面颜色的 veil，下面再加一层失焦（`docs/system-glass.md`，*Reading surfaces*）。两者都是按壁纸计算的策略输出：Zen Garden 耙过的沙子比 Tahoe 的渐变得到更多 veil 和更多模糊，浅色主题下的 Earth 还要再加上色调冲突那一份。两个 devtool 开关（`Reading blur`、`Reading dim`；设置项 `wallpaperReadingBlur` / `wallpaperReadingDim`）决定*要不要*；策略决定*多少*。

**Lift。** Apple 的阶梯是为不透明底面调校的：在白底上 secondary 一级是 4.3:1，tertiary 是 2.2:1。阅读栏的底面是透过 veil 的图片，要差上几个点。所以在阅读路由上，每个标签级都会被提升到在它实际所处底面上的目标对比度（`legibility.ts` 中的 `readingLift`）：profile 里有图片的平均颜色和各区段亮度，veil 是我们自己加的，而失焦让平均值变得可信：在 28px 及以上，一行文字落在的是一片区域的平均色，而不是它的细节。这是纯算术，不采样任何东西。Lift 在每一级有上限（80 % / 60 %）：被提升到墨色本身的 secondary 就不再是一级了；目标需要超过上限时，错的是底面，该改的是 veil。纯色页面也会做 lift：白底上的 tertiary 需要大约 12 个点才能达到 3:1。

实验室的**阅读样本**是一个独立的表面：它按策略的数值把背后的壁纸失焦并加 veil，并采用策略的阅读解析结果（不翻转，浮雕 × `reliefReading`），所以 dim、blur 和各级都在它们将要所处的壁纸上被评判，并且和桌面样本在同一页面上。真实路由要打开它来检查。

### 7. Tint

中性基线天然是灰色的：`--tint` 是 profile 的颜色，`--tint-glass` / `--tint-accent` 是用量，两者都为 0。**Tint: Wallpaper** 设置（Glass 模块，`useGlass().setTint`，存储在 `hux_glass_tint` 下）会在 `<html>` 上设置 `data-tint="wallpaper"`，把它们提高到玻璃底色的 14 % 和强调底色的 28 %，ring 也包括在内。墨色保持中性：“apply color to the background rather than to symbols or text”。灰色壁纸得到灰色 tint，所以在没有颜色可借的地方，这个设置什么也不改变。

## 规则

约束，以及没有它们会坏掉什么：

| 规则 | 原因 / 会坏掉什么 |
|---|---|
| 文字选一级；绝不用 `text-<token>/NN` | 修饰符会把这一级连同壁纸 boost 一起相乘，于是文字恰恰在最需要 boost 的地方沉下去。 |
| 下划线用 `decoration-ink-line`；绝不用 `decoration-<token>/NN` | Safari 不会在 `text-decoration-color` 里绘制 `color-mix()`：这条线在 iPhone 上看不见。 |
| 文字和底色不用固定灰色（`oklch(0.556)`、`text-neutral-500`） | 固定灰色是针对某一种背景的 alpha；放在图片上它就什么 alpha 都不是了（第一张图）。 |
| 改变 `--ink` 的区域要在 THE LADDER 的选择器列表里，并同时重新声明 `--ink-line` 和 `--relief-*` 基础变量 | 派生 token 以算好的颜色继承；不重新派生，这个区域就会保留根节点的灰色、一条深色下划线和错误的阴影形状。 |
| 背后只有图片的文字放在 `.ink-bare`（页面顶部）或 `.ink-bare-mid`（页面中部）里 | 只有这些区域会得到 bare boost 和翻转。在它们之外，深色照片上的浅色主题文字仍然是深色。 |
| 长出玻璃的裸露区域就不再是裸露的（去掉这个 class，或对悬停玻璃用 `.ink-bare-rest`） | 玻璃带着卡片颜色；在它上面用翻转后的墨色就是用错了墨色。 |
| 让 `legibility.ts` 中的 `INK_LIGHTNESS`、`INK_ALPHA` 和 `INK_RGB` 与 `globals.css` 中的 `--ink` 和 `--ink-alpha-*` 保持同步；让 `--ink-line-*` 的亮度与 `--ink` 保持同步 | 翻转和阅读 lift 依据 TS 副本计算；样式表依据 CSS 绘制。只改一边，策略推理的就是一套不在屏幕上的阶梯。 |
| 添加或重新编码壁纸后，运行 `pnpm wallpapers:profile` 并提交 JSON | 没有 profile 的图片得不到 boost、浮雕、翻转或 tint。CI 里没有任何东西能发现过期的表。 |
| 浮雕规则以 `data-wallpaper-relief` 为键，而不是以强度为零为条件 | 为零时阴影必须是 `none`，而不是透明阴影，否则在纯色页面上每个文本节点都要栅格化一个阴影。 |

自由选择：`DEFAULT_LEGIBILITY_POLICY` 中的每个数字，以及每个 `--ink-alpha-*`、`--wash-alpha-*`、浮雕和玻璃填充的输入值，都是品味问题，在实验室里调校。角色的字号和上面那个未决的标签字号问题也是品味问题。

## 实验室

**`/lab/legibility`** 设为 `noindex`，入口有 `/lab` 索引、主屏幕的 Lab 小组件，以及 devtool 的 Glass 模块（打印当前 `busy · relief · +boost · glass` 的那一行）。它和站点其他部分一样是双语的；它的字符串放在旁边的 `app/lab/legibility/i18n.ts` 里，而不在访客词典里。在那里选择一个场景，会通过选择器和 devtool 用的同一套 setter 真正选中它，滑块写入的也是 provider 和样式表本来就读取的那些变量。它设置的场景（壁纸、主题、材质、tint）就是真实的设置，和在选择器里设置完全一样。

| 面板 | 调节什么 |
|---|---|
| Scene | 主题、材质、tint、天气样式（Sky / Gradient / Classic）以及每一张壁纸：六种天气的白天和夜晚加日出和日落，每一个都是按访客坐标在那个时刻的真实场景，通过 Sky 模块自己的天气和时钟覆盖强制设定；**Live** 回到真实的天空 |
| Profile | 正在绘制的画面的测量数值，只读 |
| Contrast | 主要墨色和次要墨色相对于每种表面下合成后的平均颜色的 WCAG 对比度：裸露的顶部区段、玻璃、sheet、阅读 veil |
| Policy | `LegibilityPolicy` 的每个旋钮，阅读相关的单独成节；星号标记与线上值不同的数值，点击可重置 |
| Resolved | 两种翻转和各项输出（ink boost、bare boost、relief、glass add、veil、blur、tint L/C/H），可以针对当前场景直接固定 |
| Sheet | 样式表自己的输入值：alpha 阶梯、底色、浮雕形状、当前材质的玻璃填充、tint 用量；默认值从计算样式读取，所以实验室不保存第二份副本 |
| Export | 所有改动的 JSON，以及 sheet 覆盖值的 CSS，用来粘贴进 `DEFAULT_LEGIBILITY_POLICY` 或 `:root` |

样本（`specimens.tsx`）由排版角色和玻璃 token 组成，从不使用生产组件（原因见*排版角色*）：一块裸文字、一个小组件、Live Activity、调色板、一个 sheet，以及阅读表面。

样本下方的**画廊**一次展示某个类别的所有壁纸（天气 14、Apple 17、Nature 19），每个格子都是一个带有自己解析变量的 `.ink-scope`。一个策略滑块会同时移动所有格子，读起来不好的壁纸会和读起来没问题的排在同一行里显现出来。天气格子按格子的时刻派生场景，并绘制该样式的 CSS 渐变；在 Sky 下就是它回退到的 Gradient，同样的调色板，只是没有 shader 的纹理。

在实验室里做的调校**在会话内保留**：策略交给 provider（`labPolicy`），由它用这套策略解析每一个路由，而 sheet 覆盖值以内联方式留在 `<html>` 上，所以在样本上调好的 veil 可以先在真实的 `/writing` 上检查，再复制进代码。只要其中任何一项生效，devtool 的 Glass 行就会显示 `· lab`；实验室里的 **Reset all** 会清除它们，重新加载页面也会。随页面离开而失效的，是实验室通过 devtool 强制设置的一切（天气、时钟、`full` 位置覆盖、devtool 的开启状态）以及固定值（它们天然只针对某个场景）。

实验室、图标工作室和 devtool 里的每一个滑块都是同一个组件 `components/ui/slider.tsx`：一条细轨道，用几个百分点的墨色，已走过的部分用墨色，滑块用平台自己的。iOS Safari 扁平的白色胶囊保持原生，由 `accent-color` 染成白色；只有可悬停的指针设备才会得到一个带样式的 16px 白色圆盘，因为原生的桌面滑块在某些引擎上又小又灰。

## 添加东西

- **一张壁纸：** 按 `.claude/skills/wallpapers` 操作，然后运行 `pnpm wallpapers:profile` 并提交 `wallpaper-profiles.json`。
- **一个表面：** 用玻璃 token 和墨色 token 绘制。它会跟随材质、tint、boost 和浮雕，而不需要知道它们的存在。
- **直接位于壁纸上的文字**（背后什么都没有）：包在 `.ink-bare`（靠近页面顶部）或 `.ink-bare-mid`（页面中部）里。
- **绝不能带阴影的文字**（反色小标签、代码）：`.ink-flat`。
- **一个替换墨色的新区域：** 把它的选择器加到 THE LADDER 和翻转墨色的规则里（或者复用 `.ink-flip`）；见示意图。
- **一个想试试的数字：** 打开实验室，拖动滑块，看，复制。
- **不通过选择器查看某张壁纸：** ⌘K → Wallpaper，或者把 `localStorage.hux_ambient_settings` 设为 `{"wallpaperKind":"image","wallpaperId":"zebra"}` 后重新加载（主题：`hux_theme`，材质：`hux_glass`）。

## 背景：Apple 是怎么做的

两个相隔三十年的想法，撑起了整个系统。

**标签颜色是墨色加 alpha。** iOS 的 `label` / `secondaryLabel` / `tertiaryLabel` / `quaternaryLabel` 是近黑或近白，alpha 分别为 100 / 60 / 30 / 18 %；macOS 的阶梯是 85 / 50 / 25 / 10 %（深色模式的 secondary 提高到 55 %，因为白色加 alpha 读起来更弱）。它们之所以是 alpha，*是为了让同一个语义颜色能合成在白色、分组灰色、模糊材质之上*。Vibrancy 是同一原则在混合模式上的体现：“regardless of the material you choose, use vibrant colors on top of it.”

**图片上的文字要么加浮雕，要么翻转。** Aqua 用白字加深色投影标注桌面图标。iOS 主屏幕在明亮壁纸上给标签加阴影，在浅色壁纸上把它们翻转成黑色；锁屏会提取壁纸的主导色给时钟用。Liquid Glass 把它定为规则：小元素随下方内容在浅色和深色之间*翻转*；较大的表面会*适应*但不翻转；Clear 变体 “does not have adaptive behaviors … it needs a dimming layer to darken the underlying content”。

ryOS 重现了 Aqua，它是这些数字的参照：它的 Aqua Glass 菜单栏采样壁纸顶部 15 %（阈值为亮度 0.62），在浅色文字下用深色投影（`0 1px 3px .6, 0 0 2px .45`），在深色文字下换成白色光晕（`0 0 4px .22, 0 0 3px .12`）。我们的光晕更强（`.55` / `.3`）。

## 非目标

不做运行时采样，不用 canvas，不用 `getImageData`。ryOS 实时采样壁纸并缓存；我们手里有文件，所以在构建时测量，把答案提交进仓库。一个 profile 是十三个数字；策略是十几次乘法；其余都是 CSS。
