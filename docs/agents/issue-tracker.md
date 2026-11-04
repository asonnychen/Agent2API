# 问题追踪器：GitHub

本仓库的 issue 与 spec 都以 GitHub issue 的形式存在。所有操作统一使用 `gh` CLI。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行正文用 heredoc。
- **读取 issue**：`gh issue view <number> --json number,title,body,labels,comments`。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，配合相应的 `--label` 与 `--state` 过滤。
- **把 issue 变成某个父 issue 的子 issue**：`gh issue create --parent <parent> ...`，或事后再执行 `gh issue edit <parent> --add-sub-issue <child>`（`gh` 2.94+）。旧版 `gh`：`gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`（用数据库 id，见下面 **阻塞关系**）。若环境不支持子 issue，就在子 issue 正文顶部写一行 `Part of #<parent>`。
- **阻塞关系**：优先用 GitHub **原生 issue 依赖**，这是规范且界面上可见的表示。添加一条边：`gh issue create --blocked-by <n>,<n> ...` 或 `gh issue edit <child> --add-blocked-by <blocker>`（`gh` 2.94+）。旧版 `gh`：`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`，其中 `<blocker-db-id>` 是阻塞者的数字**数据库 id**（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`，**不是** `#number` 也不是 `node_id`）。若依赖功能不可用，退化为在子 issue 正文顶部写 `Blocked by: #<n>, #<n>`。当所有阻塞者都已关闭时，该 ticket 即可开工。
- **统计未关闭的阻塞者**：`gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by`（只算未关闭的；为 0 表示可以开工）。`gh issue view <n> --json blockedBy` 也会列出已关闭的阻塞者，所以要过滤：`--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`。
- **评论**：`gh issue comment <number> --body "..."`
- **加 / 去标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：先用 `gh issue comment <number> --body "..."` 说明原因，再 `gh issue close <number>`。对已关闭的 issue 使用 `gh issue close --comment` 会丢掉评论但仍以 0 退出。

仓库从 `git remote -v` 推断；在克隆目录里运行 `gh` 会自动这么做。

只往用户自己的仓库提 issue。除非用户拥有 `mattpocock/skills`（这些技能的来源仓库），否则绝不要往那里提。在 fork 中 `gh` 可能默认指向上游父仓库，所以每次会话首次 `gh issue create` 之前，先用 `gh repo view --json nameWithOwner` 确认目标仓库；若不是用户自己的仓库，先跟用户确认。

## 把 PR 当作 triage 入口

**PRs as a request surface: no**（外部 PR 是否作为需求入口：否）。_若本仓库把外部 PR 当作功能请求处理，改成 `yes`；`/triage` 会读这个开关。_

设为 `yes` 时，PR 走与 issue 相同的标签与状态，使用对应的 `gh pr` 命令：

- **读取 PR**：`gh pr view <number>`，然后 `gh pr view <number> --comments`（非 TTY 下 `--comments` 只打印评论，不含正文），diff 用 `gh pr diff <number>`。
- **列出待 triage 的外部 PR**：`gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`。
- **评论 / 加标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 与 PR 共用一个编号空间，所以裸写 `#42` 可能指任何一个：先用 `gh pr view 42` 解析，失败再退回 `gh issue view 42`。

## 当某个技能说「发布到 issue 追踪器」

创建一个 GitHub issue。

## 当某个技能说「取出相关 ticket」

按上面 **读取 issue** 的方式读。

## Wayfinding 操作

供 `/wayfinder` 使用。**地图（map）** 是一个 issue，**子 issue** 是 ticket。

- **地图**：一个带 `wayfinder:map` 标签的 issue，正文承载 Notes / Decisions-so-far / Fog。`gh issue create --label wayfinder:map`。
- **子 ticket**：作为 GitHub 子 issue 挂到地图上（见 **把 issue 变成某个父 issue 的子 issue**）。若子 issue 不可用，就把子 issue 加进地图正文的任务列表，并在子 issue 正文顶部写 `Part of #<map>`。标签：`wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。被认领后，ticket 分配给推进它的开发者。
- **阻塞关系**：见「约定」下的 **阻塞关系**。
- **前沿查询（frontier）**：列出地图下所有未关闭的子 issue（`gh issue list --state open`，范围限定为地图的子 issue / 任务列表），剔除存在未关闭阻塞者的（见 **统计未关闭的阻塞者**，或 `Blocked by` 行里指向的未关闭 issue）以及已有 assignee 的；按地图顺序取第一个。
- **认领**：`gh issue edit <n> --add-assignee @me`，这是本次会话的第一次写操作。
- **解决**：`gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`，再把上下文指针（gist + 链接）追加到地图的 Decisions-so-far。
