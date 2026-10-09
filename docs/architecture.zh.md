---
origin: "AI-translated from the original"
---

# 架构

这是仓库的地图：每个顶层文件夹放什么，一个 system 长成什么形状，谁可以 import 谁，状态放在哪里，以及每个 system 由哪篇文档负责。读它是为了知道一处改动该放在哪里；动某个 system 之前，先读它自己的文档。

## 做好了是什么样

- 一个有自己的 UI、状态和逻辑的功能是一个文件夹 `systems/<name>/`，带一个 `index.ts`，在[那张表](#各个-system-及其文档)里有一行，并有一篇文档。
- 新文件放进本页为它这一类指定的文件夹。顶层不会冒出新东西。
- 在生产环境运行的服务端代码仍然只有两个路由：`app/api/chat` 和 `app/api/voice`。每个页面都是预渲染的。
- `pnpm ask:index` 仍然能跑：脚本能触及的每个模块在纯 Node 下都仍然能加载。

## 地图

![仓库地图：app/ 的路由挂载 shared/providers.tsx，它组合 services/ 和各个 system 的 provider；每个 system 方框标出它的文档；systems、components/ 和 lib/ 互相 import；content/ 由 scripts/ 读取并写出提交进仓库的快照，构建时也由 lib/ 读取。](/img/docs/architecture/map.svg)

上面一行：在浏览器里运行的东西，以及两个生产环境路由。`app/layout.tsx` 挂载 `Providers` 和所有应用级的 surface（Dock、命令面板、sheet、窗口）；`api/chat` 和 `api/voice` 调用 `systems/ask` 和 `systems/voice`。下面一行：构建之前发生的事。箭头从 import 方（或读取方）指向它所用的东西。

| 文件夹 | 放什么 |
|--------|-------|
| `app/` | Next.js 16 App Router 的路由。`page.tsx` 在服务端通过 `lib/` 读取内容，再交给同一文件夹里的客户端视图（`app/page.tsx` → `home-view.tsx`，`app/writing/page.tsx` → `blog-list.tsx`，`app/works/layout.tsx` → `view.tsx`）。路由：`/`、`/writing`、`/works`、`/prompt`、`/about`、`/docs`、`/lab/<id>`。 |
| `systems/<name>/` | 带 UI、状态和逻辑的功能。见[一个 system 的形状](#一个-system-的形状)。 |
| `services/` | 没有 UI 的全局状态，每个一个 provider：`theme.tsx`、`locale.tsx`、`visitor.tsx`、`glass.tsx`、`input-capability.tsx`，从 `services/index.ts`（`@/services`）导出。 |
| `shared/providers.tsx` | provider 树，仅此而已。它的顺序及其原因：[React Conventions](./react-engineering.md)。 |
| `components/` | 不归任何单个 system 所有的共享 UI：`ui/`（基于 Base UI 的 shadcn 基础组件，`components.json` 的 style 是 `base-maia`）、`home/`（小组件；清单在 `widgets.ts`）、`post/`（阅读页）、`log/`（works 时间线的卡片和媒体）、`ai-elements/`（Ask 的聊天部件）、`apps/`、`languages/`、`magic-link/`、`motion-primitives/`、`prompt/`，以及 MDX 渲染器（`mdx-components.tsx`、`mdx-renderer.tsx`）。 |
| `lib/` | 本身没有 UI 的模块：工具函数（`utils.ts` 的 `cn`、`typography.ts` 的 `TYPE`、带翻译的 `i18n.ts`）、几个 hook（`use-controllable-state.ts`、`use-hash-landing.ts`）、query client（`query.ts`），以及把 `content/` 变成数据、会 import `fs` 的服务端读取器：`mdx.ts`、`log-server.ts`、`prompts.ts`、`og-snapshot.ts`、`ask-corpus.ts`、`ask-prompt.ts`、`image-meta.ts`、`icon/generate.ts`。 |
| `content/` | 站点的文字和数据：`blog/*.{en,zh}.mdx`、`about/{en,zh}.mdx`、`log.json`（works）、`prompts.json`、`apps.json`、`icon.json`、`badges.json`、`languages.json`；以及脚本写出的快照。 |
| `docs/` | 这些页面。这里的每个 `.md` / `.mdx` 都发布在 `/docs/<slug>/<lang>`（`lib/mdx.ts` 里的 `getDocSlugs`）。 |
| `packages/vitre` | 页面在 iOS Safari 上的边缘，一个独立的包，演示站点在 `packages/vitre/site`。站点以 `vitre` 的名字 import 它（`tsconfig.json` 里指向 `src/index.ts` 的一条 path）。见 skill `vitre`。 |
| `scripts/` | `package.json` 里各个 `pnpm` 脚本背后的 Node CLI：快照（`og:*`、`badges:*`、`apps:*`、`icon:*`）、`wallpapers:*`、`ask:index`、vitre 演示站的构建，以及 `scripts/tests/` 里的测试。 |
| `tests/` | 针对 Ask 状态机和策略的 `node:test` 文件（`ask-*.test.ts`）。没有 `pnpm` 脚本运行它们；见[命令](#命令)。 |
| `public/` | 静态文件。文档图片在 `public/img/docs/<slug>/`。生成且被忽略的：`public/ask/index.json`、`public/vitre/`。 |
| `middleware.ts` | 根据 `locale` cookie（默认 `en`），给不带语言的 `/writing/*` 或 `/docs/*` 地址补上语言。 |

## 一个 system 的形状

```
systems/<name>/
├── index.ts         # what other folders import: @/systems/<name>
├── provider.tsx     # its context, when it has app-wide state
├── components/      # its UI
└── lib/             # its logic, data and pure state
```

每个 system 都有 `index.ts`。其中十一个有 `provider.tsx`。另外六个（`ask`、`draggable`、`glow`、`lab`、`surface`、`voice`）没有；它们保存的状态放在模块级 store（`systems/surface/stack.ts`、`systems/ask/lib/use-ask.ts`）或 `makeStore` 偏好设置（`systems/voice/prefs.ts`）里。有些保持扁平，一个关注点一个文件，没有 `components/` 或 `lib/`：`command`、`devtool`、`surface`、`draggable`。

整个应用都要读的 system provider 挂载在 `shared/providers.tsx`，放在它所读取的 provider 里面。它的 surface（sheet、窗口、Dock 活动）在 `app/layout.tsx` 里挂载一次。只有某个子树需要的 provider 就挂在那个子树里（`DockProvider` 在 `<Dock>` 里）。

## 状态放在哪里

| 类型 | 放在哪里 | 例子 |
|------|-------|---------|
| 应用级、被很多地方读取 | `shared/providers.tsx` 里的一个 provider | `useTheme()`、`useWeather()`、`useMusic()` |
| 某个功能自己的、可从任何地方读取 | 基于 `useSyncExternalStore` 的模块级 store，没有 provider | `systems/dock/notice.ts`（`showNotice`）、`systems/surface/stack.ts` |
| 访客的字符串偏好 | `components/post/persisted-setting.ts` 里的 `makeStore` | 阅读设置、Ask 的模型 |
| 有结构的设置 | localStorage 里的一个 JSON 对象，由它的 provider 读取 | `hux_ambient_settings` |
| 服务端数据 | TanStack Query，持久化为 `hux_query_cache` | ambient system 的位置和天气 |
| 语言 | localStorage 和 `locale` cookie，后者由 `middleware.ts` 读取 | `services/locale.tsx` |
| 内容 | `content/`，构建时读取 | 文章、works、prompts |

该选哪一种，以及怎样读取只在浏览器里才有的值而不引起 hydration 不一致：[React Conventions](./react-engineering.md)。

## 规则

**生产环境的服务端代码是 `app/api/chat` 和 `app/api/voice`。** chat 为 Ask 持有模型密钥；voice 通过 AI Gateway 转写语音（它的 `GET` 会告诉你是否可用）。其余一切都是预渲染的：没有 server action，动态路由会列出它们的参数（`generateStaticParams`）。`/writing/<slug>/<lang>` 和 `/works/<type>` 拒绝其他参数（`dynamicParams = false`）；`/docs` 允许，这样新文档在 `next dev` 里就能显示。`app/api/log`、`app/api/icon` 和 `app/api/og` 是给 `next dev` 用的工具，在生产环境返回 403（`og`：404，除非 `NEXT_PUBLIC_OG_RUNTIME=1`）。`/lab/icon` 和 `/lab/works` 是 `force-dynamic`：它们每次请求都读取各自的文件，好让开发路由能保存它。`middleware.ts` 也会运行，但只用来重定向。新的端点要么用同样的方式加以限制，要么在这里写明。

**脚本或测试能触及的每个模块都在纯 Node 下运行。** `pnpm` 脚本用 `--experimental-strip-types` 和 `scripts/register-ts.mjs`（它负责解析 `@/` 和不带扩展名的路径）运行 `scripts/*.ts`，而它们会 import 站点代码：`lib/` 以及 `systems/ask`、`systems/ambient` 和 `systems/command` 的一部分。Node 只会剥掉类型，所以在这些模块里：

- 不能有 JSX，也不能 import `.tsx`（`ERR_UNKNOWN_FILE_EXTENSION`）；
- 不能有 `enum`、`namespace` 或构造函数参数属性（`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`）；
- 类型要用 `import type` 或内联的 `type` 导入。普通的 `import { SomeType }` 在剥离后依然保留，加载时失败："does not provide an export named"。

`tsc` 一个都抓不到。`pnpm ask:index` 在每次 `pnpm dev` 和 `pnpm build` 时都会运行，所以这里一出错，两者都会停下。

**客户端模块只以类型的方式 import 服务端读取器。** `lib/` 里的读取器会 import `fs`。需要它们数据结构的 `"use client"` 文件用 `import type`（`app/prompt/view.tsx` 从 `lib/prompts.ts` 导入）；数据由页面以 props 传进来。

**`services/` 不从 `systems/`、`components/`、`shared/` 或 `app/` import 任何东西。** 它的 provider 位于每个 system 的 provider 之外，而所有地方都 import 它们。

**在一个 system 内部，import 用相对路径。** 没有 system 会 import 自己的 `@/systems/<name>` barrel（目前也没有一个这么做）：`index.ts` 会重新导出整个 system，从内部 import 它就会经过 barrel，招来循环依赖。

**`packages/vitre` 不从站点 import 任何东西。** 它是一个包；站点以 `vitre` 的名字 import 它。唯一反方向的引用是 lab，它读取演示站点的文档模块（`app/lab/vitre` 从 `@/packages/vitre/site/src/…` 读取，`systems/lab/catalog.ts` 读取 `package.json`）。

## 可以自由选择的

- **从 system 外部 import 时，走 barrel 还是深层 import。** 大多数 import 走 `@/systems/<name>`；深入 system 的 `lib/` 或 `components/` 的 import 也很常见（深入 `ambient`、`ask` 和 `command` 的最多），没有规则禁止。
- **`components/` 和 `systems/` 互相 import。** 首页小组件、log 卡片和阅读页会用到各个 system；system 会用到 `components/ui`、`log` 和 `ai-elements`。两者之间没有分层。
- `systems/index.ts` 重新导出了六个 system，但没有任何地方 import 它。新 system 不需要加到那里。

## 做法

**添加一个 system。** 先写 `systems/<name>/index.ts`；随着它长大再加 `provider.tsx`、`components/`、`lib/`。把 provider 挂载在 `shared/providers.tsx` 里它所读取的东西里面，把它的 surface 挂载在 `app/layout.tsx`。写 `docs/system-<name>.md`，在下面的表格和 `AGENT.md` 的 Documentation Map 里各加一行。

**添加一个 service。** `services/<name>.tsx`，带一个 provider 和一个 hook，从 `services/index.ts` 导出，挂载在 `shared/providers.tsx`。

**添加一个页面。** 在 `app/` 下建一个文件夹；`page.tsx` 通过 `lib/` 读取，客户端视图放在旁边。动态段要列出它的参数。让它能从 ⌘K 到达：在 `systems/command/catalog.ts` 加一个目录项，在 `actions.tsx` 里写它的 `run`（skill `ask-commands`）。

**添加一个脚本。** `scripts/<name>.ts`，在 `package.json` 里加一项，形式和其他的一样（`node --experimental-strip-types --import ./scripts/register-ts.mjs scripts/<name>.ts`）。如果它写出的文件要提交进仓库，把它加到 skill `content-snapshots` 里。

## 命令

```bash
pnpm dev                 # predev: lynx CSS module, vitre demo (when stale), ask:index
pnpm build               # prebuild: lynx CSS module; then vitre demo, ask:index, next build
pnpm lint
npx tsc --noEmit -p .
pnpm ask:test && pnpm command:test
node --experimental-strip-types --import ./scripts/register-ts.mjs --test tests/*.test.ts
```

各个快照命令以及它们各自提交什么：skill `content-snapshots`。

## 各个 system 及其文档

| System | 是什么 | 文档 |
|--------|-----------|-----|
| `about` | 新访客遇到的那个 surface；`<Badge>` | [About & Badges](./system-about.md) |
| `ambient` | 天气、太阳、壁纸、bezel 的设置 | [Ambient](./system-ambient.md)（位置、天气、时段、缓存）；动态天空在 [The Sky](./ambient-sky.md)，它的彩蛋在 [Ambient easter eggs](./ambient-easter-eggs.md)；样式、图片和 bezel 在 [Wallpapers](./wallpapers.md) |
| `ask` | 把 ⌘K 变成一场对话；`app/api/chat` | [Ask](./system-ask.md) |
| `attachments` | 一个 commit 的媒体在哪里打开 | [Attachments](./system-attachments.md) |
| `command` | ⌘K 命令面板和浮动按钮 | [Command](./system-command.md)；页面间的跳转：[Navigation](./navigation.md) |
| `devtool` | 调试面板和 FAB | [Devtool](./system-devtool.md) |
| `dock` | 顶部的 Live Activity 和一行通知 | [Dock](./system-dock.md) |
| `draggable` | 给 FAB 和窗口用的 `withDraggable` / `useDraggable` | 无；devtool 的 FAB 见 [Devtool](./system-devtool.md) |
| `glow` | Siri 的光环，站内唯一的光 | [Glow & Voice](./system-glow.md) |
| `identity` | handle 背后的个人资料卡 | [Identity](./system-identity.md) |
| `install` | 添加到主屏幕的说明 | 无 |
| `lab` | `/lab`：各项研究和 vitre 库的页面 | [Lab](./system-lab.md) |
| `music` | Now Playing，YouTube 播放器（离线时用 `hux_music_mock`） | 它的 Live Activity 见 [Dock](./system-dock.md)；离线测试见 `AGENT.md` |
| `surface` | 按视口区分的 sheet / panel / window | [Surface](./system-surface.md)、[Typing on a phone](./keyboard-input.md) |
| `theater` | 视频和幻灯片播放器，剧场模式和画中画 | 它的轨道见 [Attachments](./system-attachments.md)，它的活动见 [Dock](./system-dock.md) |
| `voice` | 语音输入；`app/api/voice` | [Glow & Voice](./system-glow.md) |
| `windows` | 给应用用的 Chrome 窗口 | [Windows](./system-windows.md) |

横跨多个 system 的：[Design System](./design-system.md)、[Legibility](./system-legibility.md)、[Glass](./system-glass.md)、[Motion](./motion.md)、[React Conventions](./react-engineering.md)、[Content](./content-system.md)、[OG Images](./og-images.md)、[Link Previews](./og-previews.md)、[App Icon](./app-icon.md)、[App Folder](./app-shelf.md)、[Widget Scroll](./system-widget-scroll.md)。
