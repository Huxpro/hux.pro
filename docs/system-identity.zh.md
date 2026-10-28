---
origin: "AI-translated from the original"
---

# Identity 系统

提交这一条时，我是谁。

`/works` 上的每一条提交都由一个身份签名（`<jsx@fb.com>`、
`<@bytedance>`、`<rit.edu>`），每个身份下有一个或多个角色：Meta 的两个暑期实习和全职的那几年，是同一个 handle 下的三个角色。handle、`Role:` 字段或角色行，都代表这个身份的卡片：一张缩成卡片大小的 GitHub 个人主页，内容包括打开它时所在的角色、同一 handle 下的其他角色，以及用它签过的东西。

```
systems/identity/
├── index.ts               # the public exports
├── provider.tsx           # IdentityCardProvider, useIdentityCard, useIdentityProfile
├── lib/profile.ts         # buildIdentityProfile(log, identityId, roleId, locale)
└── components/
    ├── identity-profile.tsx  # IdentityProfileView: the card's contents
    ├── identity-hover.tsx    # IdentityHover / IdentityPeek: the hover peek
    └── identity-card.tsx     # IdentityCard: the surface a finger opens
```

`IdentityCardProvider` 挂载在 `shared/providers.tsx` 里，`<IdentityCard />` 在 `app/layout.tsx` 里挂载一次。

## 长什么样

![桌面上的一行 /works：指针停在这一行哈希下方的 handle jsx@fb.com 上，一张卡片跟着它浮出来：一张照片，旁边是 "Software Engineer, 2020 – 2022"，然后是这个角色的介绍、列出两段实习的 "Also at Meta"，以及一排数字：5 commits、4 projects、1 talk。](/img/docs/system-identity/desk-peek.png)

有指针时，卡片是一个 peek。把指针停在 `<handle>` 上，个人资料随之出现，也随之离开。没有可以按的东西，那些数字只是读数。

<img src="/img/docs/system-identity/phone-sheet.png" style={{ width: "min(100%, 320px)" }} alt="同一个身份在手机上，是一个标题为 <jsx@fb.com> 的 sheet：同样的头部、介绍和其他角色，接着数字变成一个分段控件（5 commits、4 projects、1 talk），下面是签过的五条提交，最后是一个 Visit 按钮。" />

用手指时，同一张卡片是一个 sheet，以 handle 为标题。其中的数字是标签页，各自对应它所计数的那些提交，每条提交都是一行、可以打开；Visit 跳到这个角色在 `/works` 上的那一行。截图为无头浏览器，393pt 宽，通过点击 Meta 的角色行打开。

## 卡片

- **角色**：打开卡片时所在的那个角色，排成个人主页头部的样子：一张那个时期的照片，裁成圆形，旁边是职位，以及一行等宽字体的任职时间（`2020 – 2022`、`2023 – Present`）、团队和地点；角色介绍在两者下方，占满卡片宽度。照片是 `content/log.json` 里的 `identities.<id>.avatar`（站内路径或 URL）。目前还没有哪个身份设置了照片，所以每张卡片显示的都是 GitHub 头像，即 `lib/profile.ts` 里的 `DEFAULT_AVATAR`。公司和 handle 不再重复：打开卡片的那个标记已经印出了它们，sheet 的标题也就是 handle。
- **其他角色**：同一身份下的其他角色，最新的在前，以安静的行排列，任职时间靠右，放在 `Also at <company>` 下面。
- **贡献**以数字呈现：先是用这个 handle 签过多少条提交，然后是各个类型，数量多的在前（`5 commits · 4 projects ·
  1 talk`）。如果只有一种类型，总数只会重复它，所以只列这一种类型。在 peek 里，这些数字是一排小方块。在 sheet 里，它们是一个一行高的分段控件（共用的 `Segmented`，reader 色调），即签过的那些提交的标签页，提交以 inset group 列在下方，所以计数正好是它所计的那份列表的标题。列表的容器（`EasedHeight`）在切换标签页改变行数时会缓动到新的高度，而按内容定高（`fitContent`）的 sheet 会跟着它变化。卡片打开时停在 All。
- **仅在 sheet 里**：当附件抽屉是附件的归宿时（`attachments.homeOf(set, 0) === "surface"`），点一行提交会在附件抽屉里打开它的附件，叠在这个 sheet 之上；否则跳到这条提交在 `/works` 上的那一行。**Visit** 跳到这个角色的那一行。

### 数据从哪里来

全部由 `buildIdentityProfile` 从提交进仓库的 log 推导出来，通过 `LOG`（`lib/log-client.ts`）读取：

- 身份是 `content/log.json` 里的 `identities.<id>`：`handle`、`company`、`avatar`、`accentColor`。
- 它的角色是这个身份的 `ranges[]`。`normalizeLogData`（`lib/log.ts`）把每个 range 转成一条设置了 `identityId` 的 `role` 提交，时间线也正是把它渲染成角色行的。
- 什么东西以谁的身份签名，由 `resolveIdentity`（`lib/log.ts`）决定，和署名用的是同一个函数：提交上显式的 `identityId`；没有的话，用它 `attachedTo` 的那个角色；再没有的话，用任职时间覆盖其日期的那个角色。`attachedTo: null` 且没有 `identityId` 的提交不属于任何人。角色和事件不计入，当前语言没有列出的提交也不计入。

卡片说不出任何时间线上没有的东西。

## 两种进入方式，由输入方式决定

`/works` 只有一套悬停系统：跟着光标从折叠的行里浮出的磁性 peek（`components/motion-primitives/magnetic-preview.tsx`）。一个名字代表的比它印出来的多，和一行内容装的比它显示的多，是同一类东西，所以有指针时，卡片**就是一个 peek**。`IdentityHover` 把标记包进一个 `MagneticPreview`；`IdentityPeek` 只在悬停期间推导个人资料（`useIdentityProfile`），所以没人在看的那些行什么都不用算。

没有指针的地方，同一个标记是一个按钮，点一下会调用 provider 上的 `open({ identityId, roleId, anchor })`。`IdentityCard` 是一个使用 `ANCHORED_PRESENTATION` 的 `AdaptiveSurface`：640px 以下是 sheet，640px 起（触屏平板）是挂在被点击标记上的 popover。这种呈现方式属于 surface 系统；见 [Surface System](./system-surface.md)。

`useInputCapability().magneticPreviewEnabled`（`services/input-capability.tsx`）是两者之间唯一的开关。当主要输入设备是鼠标、任何精细指针能够悬停（`(any-hover: hover)` 且 `(any-pointer: fine)`），或者一旦出现过鼠标指针事件时，它为 true。所以它跟随的是输入方式而不是视口：带触控板的 iPad 会悬停，触屏笔记本也会，因为它有触控板。有指针时卡片永远不会打开。

## 触发点

`Byline`（`components/log/bylines.ts`）带有 `identityId` 和 `roleId`，所以一个标记不需要别的东西：

```tsx
<IdentityHover identityId={byline.identityId} roleId={byline.roleId}>
  {byline.handle}
</IdentityHover>
```

| 位置 | 标记 |
|---|---|
| `/works` 行的签名（`TimelineCommit`） | 桌面上，是悬停时哈希下方的 `<handle>`；手机上，是点击这一行的标记、团队或日期时展开的 `commit` / `Author:` 那一组，不带 `Role:`（卡片里有） |
| 作者块（`AuthorFields`，`components/log/embeds/shared.tsx`），以 feed 形式印出 | `Author:` 和 `Role:` 两行**合在一起**，作为一个区域（`IdentityHover` 的 `block`）：它们代表同一个身份，所以悬停时和手指下亮起的是整个块，而不是其中一行 |
| 角色行 | 这一行本身：它的 peek 就是这个身份（`components/log/commit-embed.tsx` 里的 `buildCommitPreview`），点一下打开卡片（`TimelineCommit` 的 `openIdentity`） |
| 指向某个角色或身份的 magic link（`<Badge role="meta-engineer">`，`components/magic-link/`） | 有指针时 peek 个人资料，此时按下会跳到这个角色的那一行；点一下打开卡片，如果是从 About 里打开的，就叠在 About 之上（`useOverAboutZ`）。见 [About System](./system-about.md) |

在 provider 之外，这些标记以纯文本印出。
