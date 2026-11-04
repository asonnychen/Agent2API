# AGENTS.md

> **涉及分支、发版、版本号的操作，一律按 Skill `release-flow` 执行：**
> **`.agents/skills/release-flow/SKILL.md`** —— 动手前先读它，细则一律以该文件为准，本文件只作入口指路。
>
> 覆盖范围：切分支 / 给 PR 选 base / 合并 PR / 回复 Issue、PR / 改版本号 / 写更新日志 /
> 打 tag / 挂 GitHub Release / 发 beta 预发布版 / 发版验收 / 排查发版失败。

## 两条红线（先问人，不得自行推进）

1. **发版**：改版本号、推 `main` / `beta`、打 tag、挂 Release 之前，先把版本号与「这次要发什么」讲清楚，等用户确认；**未经确认不得推任何分支或 tag** —— tag 一旦推出去就会触发构建、产出公开的安装包与镜像，收不回来。
2. **更新日志**：写好的日志（= 发布提交信息 = Release 正文）必须先给用户逐条过目；按反馈改完**再确认一次**才能提交。

其余细则（分支落脚点、署名与 AI 落款、六处版本号、正式版 / beta 完整流程、验收清单、已知坑与排查）见上述 Skill。

## 文档落点

安装 / 部署 / 升级 / 排错说明只在 `docs/install.md`（英文版 `docs/install.en.md`，两份一一对应）里维护；各语言 README 只留「快速开始」速查表 + 一个指向安装文档的链接，**不要再把安装细节写回 README**。产物名、端口、环境变量、安装脚本参数有改动时，两份一起改。

**README 语言落点：根 `README.md` 是英文**（GitHub 默认展示），简体中文在 `docs/README.zh-CN.md`。中文仍是文案源语言，改支持矩阵等内容时两份同步，别把中文写回根目录。

## 本地构建

`npm run dist` 编译两个插件与桌面端，把安装包和插件 zip 一起放进 `dist/`（已忽略，不入库）。

安装包**不捆绑插件**：分发给别的机器时必须连插件 zip 一起给，由界面「插件 → 从文件安装…」手动装。插件只支持从文件安装，不做联网检查更新。

只编插件：`node build/make-dist.mjs --skip-tauri`；只编桌面端：`node build/make-dist.mjs --skip-plugins`。

## Agent skills

### Issue tracker

Issue 与 spec 记在 GitHub Issues（`asonnychen/Agent2API`），统一用 `gh` CLI 读写。见 `docs/agents/issue-tracker.md`。

### Triage labels

沿用五个规范标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文：根目录 `GLOSSARY.md` + `docs/adr/`。见 `docs/agents/domain.md`。
