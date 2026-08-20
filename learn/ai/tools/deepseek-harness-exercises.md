---
title: DeepSeek Harness 全面练习：工具循环、事件日志与权限边界
domain: ai
depth: deep-dive
created: 2026-08-20
updated: 2026-08-20
---

# DeepSeek Harness 全面练习：工具循环、事件日志与权限边界

这组练习围绕[DeepSeek Harness 工具往返实验脚本](./deepseek-harness-demo/run-demo.mjs)展开。先阅读[DeepSeek Harness：把模型变成可执行 Agent 的插件化运行时](./deepseek-harness.md)，再按以下闭环操作：

```text
运行 → 观察 → 推理 → 修改 → 验证
```

练习目标不是熟悉几个 CLI 参数，而是能够用证据区分四件事：模型提出了什么、Harness 执行了什么、环境实际发生了什么，以及会话日志记录了什么。

## 运行基线

先执行完整验证：

```sh
node learn/ai/tools/deepseek-harness-demo/verify.mjs
```

预期顶层状态为 `PASS`。首次运行需要从 npm registry 下载固定版本的官方 `@deepseek-ai/dsh`；模型端始终是本机模拟服务，不会读取真实 DeepSeek API Key。

然后分别运行四条基础路径：

```sh
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --no-tool
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --unknown-tool
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --failure
```

## 练习一：先预测四条路径的因果结构

运行前填写预测矩阵。只统计主任务请求，不把 `kind: title` 的辅助标题请求算进去。

| 路径 | 主模型请求数 | step 数 | `tool/call` | `tool/result` | 进程退出 |
| --- | ---: | ---: | --- | --- | --- |
| 成功路径 |  |  |  |  |  |
| `--no-tool` |  |  |  |  |  |
| `--unknown-tool` |  |  |  |  |  |
| `--failure` |  |  |  |  |  |

运行后解释：为什么“模型请求数”“step 数”和“HTTP 请求总数”不是同一个指标？

<details>
<summary>答案与评价标准</summary>

本仓库验证结果：

| 路径 | 主模型请求数 | step 数 | `tool/call` | `tool/result` | 进程退出 |
| --- | ---: | ---: | --- | --- | --- |
| 成功路径 | 2 | 2 | `bash` | 成功结果 | 0 |
| `--no-tool` | 1 | 1 | 无 | 无 | 0 |
| `--unknown-tool` | 2 | 2 | `missing_tool` | 工具错误结果 | 0 |
| `--failure` | 1 次失败请求 | 1 | 无 | 无 | 1 |

每条路径还可能有一个 `kind: title` 请求。它是会话标题插件的辅助调用，不携带工具 schema，也不属于主任务 step。一个 step 对应 Agent Loop 的一次主模型请求及其工具调用；HTTP 请求总数则还可能包括标题、压缩或其他插件发起的模型操作。

未知工具不会让整个进程立即崩溃。Harness 把“工具未注册”编码成错误 `tool/result`，让模型在第二个 step 中看见失败并决定如何回应。提供商 HTTP 400 发生在模型请求边界，主循环没有得到 assistant 消息，因此 headless 任务失败退出。

</details>

## 练习二：给每个行为找到真正的所有者

阅读 `deepseek-harness-demo/run-demo.mjs`，把下面的行为归给“模拟模型”“Harness”“工具/环境”或“用户/部署配置”：

1. 生成 `bash` 和参数 JSON；
2. 把 25 个工具 schema 发给主模型请求；
3. 真正执行 `printf DSH_TOOL_ROUND_TRIP`；
4. 把命令输出写成 `tool/result`；
5. 决定使用 `workspace-write`；
6. 第二次请求中出现上一条工具结果；
7. 返回最终自然语言文本。

再回答：如果把 `toolEvents()` 中的工具名改成 `missing_tool`，能否证明模型获得了一个新工具？

<details>
<summary>答案与评价标准</summary>

1. 模拟模型：本地 SSE 服务构造了工具调用响应。
2. Harness：当前 headless profile 的工具插件注册表组装并发送 schema；本次配置实测为 25 个，不是所有模式的固定常数。
3. 工具/环境：Harness 的 Bash provider 在临时工作区启动真实进程。
4. Harness：工具流水线把执行结果规范化并追加为会话事件。
5. 用户/部署配置：Demo 通过 `DSH_PERMISSION_MODE` 选择文件策略，Harness 插件负责落实。
6. Harness：Agent Loop 从会话投影下一次模型历史。
7. 模拟模型：第二个 SSE 响应根据收到的 tool message 生成文本；Harness 只传递、记录和输出它。

把工具名写进模型响应只证明模型**请求**了该名称，不能证明注册表存在该能力。`--unknown-tool` 正是反例：`tool/call` 存在，但 `tool/result` 标记工具错误。

完整答案应指出，工具可用性至少要求注册、作用域、策略和提供方都成立；“模型知道一个名称”不构成执行授权。

</details>

## 练习三：从事件日志重建一次 turn

保留一份真实日志：

```sh
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --keep
```

记录输出的 `artifacts` 与 `session.file`，然后仅使用 `importantEvents` 回答：

1. 第一个 `assistant/message` 为什么在 `tool/call` 之前？
2. `tool/result` 为什么必须在第一个 `step/end` 之前？
3. 第二个 `step/start` 为什么仍属于同一个 turn？
4. 如果最终模型回复已经显示在 stdout，为什么还需要 `turn/end`？

完成后删除你保留的临时目录。

<details>
<summary>答案与评价标准</summary>

- 第一个 `assistant/message` 是模型的权威输出，其中包含结构化工具调用；`tool/call` 是 Harness 决定开始调度该调用的持久事实。
- 工具结果属于产生它的 step。先记录 `tool/result` 再结束 step，才能让该步骤在日志中形成完整边界。
- 工具结果意味着模型仍欠最终判断，因此 Agent Loop 在同一个用户轮次里开启第二个 step；用户没有提交新任务，所以不是新 turn。
- stdout 是 headless 产品的输出界面；`turn/end` 是会话状态机的持久边界。恢复、统计和其他消费者不能从“终端看见了一行字”推断轮次已经完成。

优秀答案还应指出，日志文件由多个追加的 zstd frame 组成。Demo 逐 frame 解压后再解析 JSONL；只解第一个 frame 会误以为文件仅有 session header。

</details>

## 练习四：区分三类失败

依次比较：

```sh
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --unknown-tool
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --read-only-write
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --failure
```

关注 `toolResultIsError`、`toolResultContainsSandboxDenial`、工具结果文本和进程退出码。解释下面三个现象：

1. 未注册工具为什么得到 `toolResultIsError: true`？
2. Bash 写入被沙箱拒绝时，为什么 `toolResultIsError` 仍是 `false`？
3. 提供商 HTTP 400 为什么没有 `tool/result`？

<details>
<summary>答案与评价标准</summary>

- 未注册工具表示 Harness 无法完成“调用这个工具”这一协议操作，因此整个工具结果块是错误。
- `bash` 工具本身被正确找到并成功运行了执行流程；失败的是其内部子进程，结果通过 stderr、`[exit code: 1]` 和沙箱拒绝标记返回。这里 `isError: false` 表示工具协议完成，不表示 Shell 命令退出码为 0。
- HTTP 400 发生在模型适配器请求阶段，模型没有产生任何工具调用，因而没有需要执行或记录的工具结果。

这是 Agent 可观测性中的关键区分：提供商失败、工具分发失败和工具内部任务失败属于不同层，不能统一压成“Agent 出错了”。

</details>

## 练习五：验证文件策略，而不是相信模式名称

运行相同写入命令的两个权限场景：

```sh
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --write-file
node learn/ai/tools/deepseek-harness-demo/run-demo.mjs --read-only-write
```

两个场景都在自动创建的临时工作区中尝试：

```sh
printf DSH_TOOL_ROUND_TRIP > harness-proof.txt && cat harness-proof.txt
```

回答：

1. 哪一个场景的工具结果包含标记？
2. 哪一个场景出现沙箱拒绝？
3. 为什么仍不能由这次 macOS 实验推出“所有操作系统上的 read-only 都是完整边界”？
4. 如果命令只发起网络请求，read-only 是否承诺阻止它？

<details>
<summary>答案与评价标准</summary>

- `workspace-write` 允许临时工作区内写入，随后 `cat` 返回标记。
- `read-only` 在本次 macOS 实测中返回 `Operation not permitted`、沙箱拒绝标记和退出码 1，没有创建可读的证明文件。
- 官方沙箱接口区分 `full` 与 `partial` 强制，平台后端、内核 ABI 和文件边界不同。一次 macOS 成功拒绝只能证明该环境、版本、路径和命令的行为。
- 当前 `SandboxMode` 主要定义文件系统效果；官方明确把网络与进程可见性排除在这套词汇之外。因此不能从 `read-only` 名称推导网络隔离。

优秀答案会把“策略配置”“后端报告的强制程度”“这次命令的观测结果”分开，不以其中一个替代另外两个。

</details>

## 练习六：能力存在、能力暴露和能力使用不是一回事

比较成功路径与 `--no-tool` 的 `providerRequests`：两者的初始主请求都携带工具 schema，但只有成功路径产生工具调用。再做一个设计题：

假设要让一个“只读代码审查”Preset 不允许 Shell，下面哪种方案更符合 Harness 架构，为什么？

1. 保留 `bash` schema，只在提示词中要求模型不要调用；
2. 让模型调用后统一返回拒绝；
3. 不在该 Agent Preset 中挂载 Bash 工具 Consumer，同时保留文件读取能力；
4. 删除整个 Host plane 的 Shell provider。

<details>
<summary>答案与评价标准</summary>

首选 3：Preset 决定该 Agent 可见的能力集合。不挂载 Bash Consumer 后，工具 schema 不进入该 Agent 的模型请求；其他 Preset 仍可通过共享 Host 能力使用 Shell。

- 方案 1 只有软约束，模型仍看见工具，也可能调用。
- 方案 2 可以作为防御策略，但制造无意义调用和错误恢复成本，不如从能力面移除。
- 方案 4 会影响同进程其他 Agent，除非部署目标就是全局移除 Shell，否则范围过大。

完整答案应区分：Provider 是否存在、Consumer 是否向当前 Agent 注册、策略是否允许、模型是否实际选择调用。这四层都不同。

</details>

## 练习七：为一次模式对比设计有效实验

你要比较标准模式与 PTC 模式是否真的减少多工具任务的成本。基于本 Demo 的观测方式，设计实验协议，至少固定和记录：

- 模型、推理强度与任务样本；
- 工作区初始状态；
- 可用工具与权限；
- 模型请求数、工具子调用数、token、墙钟时间；
- 成功标准、错误分类与重复次数；
- 会话日志中需要保留的证据。

说明为什么不能只比较最终答案是否“看起来正确”。

<details>
<summary>答案与评价标准</summary>

一个合格实验应让两种模式使用相同模型、任务、初始仓库、权限与最终验收，只改变工具呈现/编排方式。至少记录：

- 主模型请求与辅助请求分开计数；
- 原生工具调用数和 Code Mode 内部子调用数分别计数；
- 输入、输出、推理与缓存 token；
- 首次成功时间、总时间、重试与失败层级；
- 最终文件 diff、测试结果和未完成事项；
- 每轮的模式配置、版本、事件日志和随机性条件。

最终答案可能掩盖无效调用、重试、越权尝试、未运行测试或偶然成功。PTC 的核心假设是用生成程序减少往返，所以必须测量中间过程，而不能只看文本质量。重复样本用于避免把单次模型随机性误当成模式效果。

</details>

## 完成标准

- 能从事件顺序解释 turn、step、模型请求和工具调用的关系。
- 能区分模型意图、Harness 协议、工具内部退出和提供商错误。
- 能说明“工具存在”“向当前 Agent 暴露”“策略允许”“模型使用”四个不同事实。
- 能用实际工具结果验证文件策略，并保留平台与强制程度边界。
- 能从 append-only 日志重建因果链，又不把它误解为完全确定性回放。
- 能为模式比较设计同口径、可复核的实验，而不是凭最终回答做印象判断。
