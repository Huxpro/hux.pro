---
origin: "AI-translated from the original"
---

# 带着工程思维去 Vibe

一场讲 vibe coding 和工程的分享的工作笔记。不是这个代码库的文档。

Hi，我是 Xuan。
今天这些都不讲。

## 主题

- 给 vibe coder 的实用工程基本功
- 哪些地方还需要工程（哪些不需要了）
- “AI 没有取代高级工程师，而是邀请每个人都成为高级工程师。”

## 核心要点

- 学高阶的工程能力

### 大纲

- 工程？
	- AI 淘汰了“一部分”
	- 另外那“一部分”是什么？
		- 如果“写代码”就是全部，那 Manager / 高阶 IC 早就不需要了。
			- 他们一直都在 vibe coding。
- 第一章：像“Manager”一样管理 AI
  - 搞定 Context：
    - 定方向 & 框定问题
  		- 从 Spec 开始
  			- 你知道自己要什么
  		- 迭代式 / 协作式调研
  			- Plan mode 能给你点东西，但是……
					- 可能太重
    			- 你不知道自己要什么
	- 搞定随机性 / 性格
  	- 用好你的团队（每个成员各有长短）
  	- 并行探索
- 第二章：像“架构师”（或 Principal Eng）一样思考系统
  - 拉高标准；带它
		- 套用传统的工程原则
  		- DRY
		- 迭代地找出你系统里的模式 / 规则
			- 过早优化
			- 关注点分离 -> 模块化
	- 理解结果 & 权衡取舍 & 设好约束 / 护栏
		- 性能
		- 正确性
			- 类型、测试、协议
		- 好调试
  		- DevTool
		- Docs / Spec 现在就是代码
- 结束语

## 开场：工程？

首先，我们说的“工程”到底是什么？
- 在座有多少人真的在做工程岗？举个手

过去十年，我们一直是这么看待做软件这件事的：

```md
Product -> Design --> Engineering 
                     (== Coding?)
```

AC 提出“Vibe Coding”这个词才过去 10 个月，现在 90% 的代码已经是 AI 写的了。

如果 AI 会写代码，我们还需要工程师吗？
- 如果你是非工程背景的 vibe coder，你还需要学“工程”吗？

这个问题我想了一阵子了，不只是因为我担心自己的饭碗，而是真的，
作为一个做开发者 infra 的人，我的工作就是造人能用得顺手的 infra。
可突然之间 AI 成了最好的用户，我也得重新想想 dev infra 该是什么样。

```md
我造 infra 给 human 用
    ↓
Human 需要 build fluency 才能用好
    ↓
AI 天生就有这个 fluency
    ↓
所以 "fluency" 不再是 engineering 的核心价值
    ↓
那什么才是？
    ↓
Managing AI = Managing Team 的 insight
    ↓
Protips
```

**当 infra 的熟练度不要钱了，工程的重心就变成了别的东西。**


> "Engineer" 这个词来自拉丁语 ingenium（聪明才智）和 ingeniare（设计、发明）
最早的 engineers 是设计攻城器械和桥梁的人——重点是 problem solving + design，不是操作工具

工程上的资深程度（很大一部分）是由用工具有多熟练来定义的（语言、React 这样的库、Web/Lynx 这样的平台……）

AI 替代了“写代码”的需求，但还剩下一些东西。

在组织里：
- Manager / 高阶 IC 一直都在 vibe coding
	- 他们不产出代码。

所以也许：AI 时代需要的工程，就是那些通常由高级工程师承担的职责（而且不只是写代码）

> 管理 AI 在结构上等同于管理一个工程团队。

### Protip 0：把管理 AI 当成带一个工程团队


## 设定 Context / 入职

- 规则
- 文档 / 搜索
- 用 Skills/MCPs 沉淀组织知识库

## 设定角色

- git 

## 定义问题：迭代 vs. 从 Spec 开始

```md
The site currently uses a single OG image for all URLs.

Build a system that generates OG images so that each blog post and each API will have its own OG images.
```

### Spec / Plan Mode

- Prompt：“给我写个 X”
	- ??
- Spec：“我来帮你把 X 拆开”
	- 我给你写好了 design doc
- Plan Mode：“你自己把 X 拆开（给我写个 design doc/PRD/RFC），我来 review”
	- 要求高级工程师“先想清楚再写” (think step-by-step)
	- 我不喜欢它的地方是“它完成得太快了”
		- 你要是不 review，那就没区别。

> SSD, Plan Mode

UI 任务
- 让它画图（就算给了 figma/截图）
- 检查它的理解

逻辑任务
- 对，现在模型会思考了（CoT）
- 但让它打印出来方便你检查，还是有用

>** 不，你还是得自己想**

### ProTip 1. 先问。

> 现实里，往往是先开个会交换想法。
> 高级工程师会带着初级工程师弄清楚到底该想些什么

代码质量上：一份清楚的 spec 能出好得多的代码 > 迭代

拿不准的话：没有 spec，就在写代码之前跟 agent（其实任何 AI 都行）聊天，“迭代你的想法”：最好在 IDE 里聊，这样 context 就白送在那儿了。


## 管理人手：原型 / 实验（应对随机性）（Feature Branching）

假设你在带一个工程团队，要在很紧的时间线里解决一个问题，而且你还有空闲人手（2 个组员）。你会怎么做？嗯，你可以让不同的组员用不同的方法做同一件事。

### Protip 2. Worktree

开多个 worktree——Trae 是订阅制的：那就多试试

- 多个模型
- 多轮
	- 就算是同一个模型，写出来的代码也可能天差地别
		- 第一轮就不同，每条消息都不同（会偏向之前的 context）

并行 agentic coding，

同时开多个 worktree 来做实验。

power user 功能——现在普及了

https://stackoverflow.com/questions/31935776/what-would-i-use-git-worktree-for
https://www.reddit.com/r/ProgrammerTIL/comments/mtjg0c/git_til_about_git_worktrees/

VSCode 刚加上一等的 worktree 支持：https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees#_working-with-git-worktrees
- https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees#_working-with-git-worktrees
- https://code.visualstudio.com/updates/v1_103#_git-worktree-support

Cursor 会为并行的 agent 自动创建和管理 git worktree。每个 agent 跑在自己的 worktree 里，文件和改动相互隔离，所以 agent 们可以各自编辑、构建、测试代码，互不干扰。要让 agent 在 worktree 里跑，在 agent 下拉菜单里选 worktree 选项。[](https://cursor.com/blog/agent-best-practices)

## 自己定工程标准和架构决策

### 做 bar raiser

> 或者说：懂工程的话，会更好！

**工程决策做得差（context 管得差）：LLM 退化得非常快 **

### Protip 3：你需要 bar raiser（为整个团队）

> 做架构决策，本质上就是为未来的 LLM 做 context 管理

LLM 往往会：
- 把所有东西都写在一起（一个文件里）
	- 巨大的 UI 文件
	- 巨大的数据模型
	- 巨大的 `providers.tsx` 和巨大的 state
	- 跟“模块化 / 可组合”冲突
	- 让它抽到 lib / 组件里
	- 架构决策自己来做
- 什么都自己写（重复造轮子）
	- 是：现在你可以定制了
		- 好例子：shadcn/ui、tailwind
	- 不是：你还是需要好的地基
		- 数据请求库
			- SWR / 缓存持久化
		- 路由 / 导航
		- UI 基础组件

> 不，你最好还是自己 review 代码，确保它遵循了工程实践。
> 它做出让你意外的决定时——问它为什么——你可能会发现一些你不知道的东西

> 让 AI 帮你重构。
> 问好的架构问题

### Protip 4：架构是个迭代的过程。

架构往往随着功能增加而演化——新的逻辑冒出来，对更好架构 / 抽象的需求冒出来 -> 这时候就该重构了
- 就算是传统的人类工程，有非常资深的架构师——架构也不是能一次完全预见的东西（当然有帮助）。
- 所以组织才需要“架构师”这个角色，时刻盯着重新架构的需求。
- 架构不是一次性的活儿。它是个角色，在 agentic coding 时代我们依然需要这样的角色

> 软件工程原则依然有用。
> 我们这些“传统程序员”是从手写代码里成长起来、获得这些洞见的，而 vibe coder 要走到那一步，目前还有一道坎……（这也是初级开发者难找工作的原因之一）
> 
> 但我相信下一代程序员也能从 agentic 编程里学到这些

举个例子：知道什么时候拆模块、什么时候把东西合并到一个模块里……

1. 不同的 React `Context` 最好跟它们各自功能的 UI 放在一起
	1. 所以不是一层横向的抽象
2. 不同的 `Context` 都去注册键盘绑定——很难看出有没有冲突，也很难定义它们之间的优先级
	1. 我们需要一个“全局键盘注册表”

所以说到底是代码层之上的逻辑抽象——每个高级工程师都得靠时间和实践慢慢培养出这种直觉。

- 管理依赖
- 设好约束


--- 
你还是得自己定义逻辑：
- 类型：互斥的 union
- 组合：子集
- 继承：父 -> 子


模型：
- GPT：重工程
	- 容易过度工程（搞得太复杂）
- Claude：结果导向（RL、照字面、像人）
	- 容易过度简化
		- 就像一个员工跟你说“走这条路更快 / 更短，相信我”
- Gemini 3 Pro：
	- 视觉上真的很强

### ProTip 5：Spec 现在是源头（唯一真相）

以前它是源头吗？不，以前是测试。

让 LLM 解释它的架构 --> 回到“spec”

Spec 现在就是“代码”，“代码”现在是产物

源代码体积现在就是“代码体积”（产物体积）：会有死代码，正常


### Protip 6：专职角色：Subagents？

省 context，专门打造——把它们当成“其他角色 / 队友”
- Code reviewer（语言 / React 律师）
- 文档员

## 理解结果 & 权衡取舍

### Protip 7：性能

Vibe Coder 面临的挑战

这里有很多细节：
- 看似一样的结果，可以用不同的算法算出来（时间 / 空间复杂度）
- 同一个算法，可以在不同的地方跑（结果也就不同）
	- 客户端 vs. 服务端
	- 主线程 vs 后台

## 正确性：可验证依然是最大的瓶颈

LLM 能 ReAct 之后，只要你能告诉 AI 哪里坏了，它们就能一直干下去，永远不停（“无尽的心智”）

> “自动驾驶的基础设施”


移动端开发——没有视觉。

### L1：人工 Q&A——回归


### L2：TDD——传统错误（静态错误、运行时异常）


### L3：视觉


### L4：??


infra 现在是 AI 的瓶颈，我个人觉得它是眼下限制你“AI 工程团队”天花板的最大瓶颈。

我们 ByteDance 正在大力转向 AI-first 的工程文化，这也是
为什么我们在投入 Trae 和 Lynx。

## 结束语：目标定高。保持乐观；拥抱 AI。

1. 作为人：meme：台阶


- AI 会带你到那儿
- 我们作为工具开发者（Trae、Lynx）也会帮你到那儿。




### 局部性

### 一致性

### 可验证
