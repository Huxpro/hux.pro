# Works 关联探索：项目、演讲与它们之间的横轴

对 [PR #249](https://github.com/Huxpro/hux.pro/pull/249)（squash + project context）的分析，
以及 `/works` 上 commit 之间关联关系的五个方向和三个可交互原型。
原型页面：[index.html](./index.html)（用 `content/log.json` 的真数据渲染，封面是各 talk 的真实缩略图；
发布版在 https://claude.ai/artifact/XMg1oSSrrK8mxhssyhXWjm）。

## 关系拆分

| 关系 | 例子 | PR 249 | git 里的对应物 |
|---|---|---|---|
| edition-of | Two Threads EN / 中文；Lynx 首发 D2 / React Summit / WAD | squash | `[PATCH v2]`、cherry-pick |
| about / evidence-of | React without memo → React Compiler | `projects[]` | branch 上的 commit、merge |
| part-of | lynx-ui、ReactLynx ⊂ Lynx | 没有 | branch off a branch |
| milestone | 2022 年三个中国的认可 | squash `china-react` | annotated tag |

## 五个方向

- **A. Squash + Context**（PR 249 现状）：两个机制；成本花在 edition-of 上，part-of 没碰；两个 squash 其实是 milestone；squash 行没有 hash。
- **B. Threads**：一个指针 `editionOf`，thread 位置由最新 edition 决定，其它 edition 折成一行。
- **C. Branches**：`about[]` 作 parent 指针，project 是 lane，行停在 tip，默认 `--first-parent` 折叠；子项目是 sub-lane，双 parent 是 merge，release 是 `tag:`。
- **D. Releases**：milestone 作为 commit，talk 作为它的证据折进 strip。
- **E. Trailers**：只标注不改版式，压缩交给 `?about=` 过滤。

## 倾向

C 作机制，B 补 edition，D 作内容层面的决定：两个指针字段（`about[]`、`editionOf`），零个新集合。
待定：项目行停在 tip 还是起点；thread header 用原版还是当前 locale 的版本；默认折叠到哪一层；PR 249 中哪些部分沿用。
