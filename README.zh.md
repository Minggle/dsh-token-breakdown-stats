# dsh-token-breakdown-stats

[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-247bbf)](https://github.com/topics/dsh-plugin)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-%3E%3D0.2.0--rc.2-4d6bfe)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | 中文

一个 [dsh](https://github.com/deepseek-ai/deepseek-harness) 插件（`dsh-plugin`
topic）：替换输入框下方的统计胶囊，让会话 token 总量覆盖**主 Agent 及其调用的全部子
Agent**，点击弹出按计费桶、按子 Agent、按模型三个维度的分项统计。

## 简介

dsh 会话输入框下方的统计胶囊只统计**主 Agent** 的 token 用量。当主 Agent 调用子
Agent 时，子 Agent 消耗的 token 在会话底部完全看不到。

本插件替换该胶囊，让底部显示**会话总量（主 Agent + 它调用的全部子 Agent）**，点击
后弹出的对话框按计费桶、按子 Agent、按模型三个维度分项统计。

## 变化点

| | 原生胶囊 | 本插件 |
|---|---|---|
| 胶囊文字 | 主 Agent 总量 + 缓存命中 | **会话总量**（主 + 子）+ 缓存命中 + 子 Agent 个数 |
| 对话框 | 四个计费桶 | 计费桶、主/子占比、子 Agent 汇总、按模型一行 |
| 时间/活动胶囊 | 轮次、步骤、速度、耗时 | 与原有一致（原样还原） |

子 Agent 一律以**汇总**呈现：胶囊显示个数，对话框折叠成一块（个数、其中几个仍在运行、占
会话总量比例、以及折叠后的四个桶）。不逐个列出行——一个会话可能调起几十个子 Agent，而逐
个明细本来就在会话头部的子 Agent 目录里。

对话框内容：

- **总用量** —— 四个互斥计费桶（未缓存输入、缓存读取、缓存写入、输出）与缓存命中率，
  覆盖整棵会话树。
- **主 Agent** —— 已载入轮次观测到的 提供方/模型，以及该会话自身的四个桶。
- **子 Agent（N）** —— 汇总块：共几个、其中几个仍在运行、占会话总量比例，以及折叠后的
  四个桶。
- **按模型** —— 由已载入轮次折叠出的每个 提供方/模型 用量。
- 会话尚未调用子 Agent 时显示友好提示。

## 实现方式

插件注册与原生 `ui-chat` 完全相同的 dock 单元 —— `conversation.composer.dock`、
id `stats`、order `0` —— 因此是**替换**内置胶囊，而不是新增一个。list slot 拒绝同 id 同
priority 的第二次注册，所以这里显式传 `priority: -1`（低于原生行的 0，lowest renders）。

所有数字都来自持久投影，分页与压缩都不会改变它们：

- `tokenUsage` —— 每个会话四个互斥的提供方计费桶。
- `subagentCatalog` —— 会话的直属子级，按父会话事件顺序，带模式与可选标签。
- `SessionSummary.projectionValues` —— 同一批投影外加子 Agent 身份（`label`）与
  计时，按会话 id 寻址。
- `ChatSnapshot.nodes.values()` —— keyed store 里所有已物化的 Chat Node。
  `turn-tail` 行**故意不**进 `legacy.nodes`，所以逐轮次的 `routes`（提供方/模型）
  只能从这里读；legacy 切片仍然用于步骤数折叠。

`compact` / `detailed` 偏好读取与原生胶囊相同的 `ui-chat` 配置域；`compact` 只保留
速度与缓存命中的纯文本展示，不弹对话框。

## 已知限制

- **拿不到每个子 Agent 的模型名。** 客户端的 `tokenUsage` 投影只有四个桶，没有路由
  信息，因此子 Agent 行只显示用量，不显示模型。模型归属覆盖主会话已载入的轮次。
- **后代发现是 best-effort。** `subagentCatalog` 只是直属子级；孙 Agent 在其自身目录
  被加载后才会出现（与原生子 Agent 目录同一规则）。未加载的层级不会凭空生成。
- **模型归属只覆盖已载入轮次。** `turn-tail` 行只对已载入窗口内**已关闭**的轮次存在，
  因此在很长、分页的会话上，模型行与按模型一节可能落后于持久总量。这一版里 chat 目标的
  assistant 节点不带 `providerMetadata`，没有第二个来源可退——至少要载入一个已关闭轮次，
  模型行才会显示会话用过的模型。
- **compact 模式** 保持原生行为（仅速度与缓存命中）。

## 安装

bundle 就是一个普通目录，`client.js` 已提交，无需构建。先从本地克隆安装：

```powershell
git clone https://github.com/Minggle/dsh-token-breakdown-stats.git
```

然后在 dsh 会话里用 `plugin_manager` 把 bundle 装进 profile：

```
plugin_manager  action: install_bundle
               target: <克隆目录的绝对路径>
```

补丁行 id 为 `token-breakdown-stats`。重启应用（或等 live patch 重载生效），输入框下方
的胶囊即被替换。

改完源码后重新生成 `client.js`：

```powershell
node build.mjs
```

## 验证

```powershell
node src/smoke.test.cjs
```

冒烟测试通过 mock 的 `window.__ModuleLoader__` 和一个最小 React 运行时加载构建产物
`client.js`，断言汇总数学、胶囊文字、对话框各节、Escape 关闭、compact 模式以及中英
语言键对齐。

## 文件

- `index.js` —— Host 半边（不需要 Host 行）。
- `client.js` —— 生成的浏览器产物（请勿手改）。
- `src/entry.js` —— slot 注册与 mode hook。
- `src/stats-pills.js` —— 两个胶囊与分项统计对话框。
- `src/token-aggregator.cjs` —— 纯聚合与路由折叠。
- `src/smoke.test.cjs` —— Node 冒烟测试。
- `locale/{en,zh}.json` —— 语言字典（唯一数据源）。
- `icon.svg` —— 原创图标。
- `build.mjs` —— 把 `src/` 内联成单个 `client.js`。

## 环境要求

- DeepSeek Harness `>= 0.2.0-rc.2`（插件读取 `ChatSnapshot.nodes`、
  `SessionSummary.projectionValues`，并依赖 `conversation.composer.dock` 的
  list cell priority 规则）。
- desktop 或 web profile；Web GUI 渲染胶囊。

## 安装事故记录（2026-10-15）

早期版本曾让桌面版 web boot 失败：`1 entry did not activate:
@deepseek-ai/dsh-client-ui-chat: failed`。当时移除了 bundle，并从应用自己写
的备份（`cordis.patch.yml.bak-*`）恢复了 profile，用户数据无损。

两个根因记录在此，因为它们都很容易再次引入：

1. **list slot 拒绝同 id 同 priority 的第二次注册。** 原生 `ui-chat` 行以
   priority 0 占着 `conversation.composer.dock` 的 id `stats`，替换者必须传
   严格更低的 `priority`（本插件用 `-1`）。slot 的 `register` 会抛
   `already has an entry with id "stats" at priority 0 … register at a
   different priority to shadow it (lowest renders)`；而插件的 inject 回调
   是在 dock 属主的 fiber 里执行的，所以失败记在属主头上而不是插件头上。
2. **受限 Client 上下文访问未声明 service 会抛错。** 未在 entry 的 `inject`
   里声明 `configForms` 就读 `ctx.configForms`，会抛
   `cannot get property "configForms" without inject`。现在插件只声明
   `['slots', 'locale']`，其余一律防御式读取。

冒烟测试里有两个 mock 分别复现这两种失败模式，所以回归会先让测试红，而不是
让 boot 崩。

## 许可证

[MIT](LICENSE)
