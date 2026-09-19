---
title: 研发交付 Harness 自我演化专家练习：经验晋升与回归门禁
domain: ai
depth: expert
created: 2026-09-20
updated: 2026-09-20
---

# 研发交付 Harness 自我演化专家练习：经验晋升与回归门禁

先读[研发交付 Harness 的自我演化](./engineering-harness-self-evolution.md)，再使用[最小 Demo](./engineering-harness-self-evolution-demo/run-demo.mjs)。这个实验只模拟**一条经验候选能否晋升**：交付报告声称浏览器行为已验证时，实际证据是否包含浏览器验证。练习按“运行 → 观察 → 推理 → 修改 → 验证”推进。

Demo 使用 Node.js 内置能力，不需要模型 API、网络或第三方依赖。从仓库根目录先运行：

```sh
node learn/ai/tools/engineering-harness-self-evolution-demo/verify.mjs
```

预期得到 `"status": "PASS"`。这仅验证模拟器的固定案例，不代表真实 Coding Agent 已按这条规则行动。

## 练习一：先预测，后观察

运行前，先阅读 [`core.mjs`](./engineering-harness-self-evolution-demo/core.mjs) 中的四个案例与三条规则。预测下表中的漏报、误报和晋升结果，然后依次运行：

```sh
node learn/ai/tools/engineering-harness-self-evolution-demo/run-demo.mjs --scenario=none
node learn/ai/tools/engineering-harness-self-evolution-demo/run-demo.mjs --scenario=blanket
node learn/ai/tools/engineering-harness-self-evolution-demo/run-demo.mjs --scenario=scoped
node learn/ai/tools/engineering-harness-self-evolution-demo/run-demo.mjs --scenario=scoped --approve
node learn/ai/tools/engineering-harness-self-evolution-demo/run-demo.mjs --scenario=single-signal --approve
```

| 场景 | 漏报案例 | 误报案例 | 决策状态 |
| --- | --- | --- | --- |
| `none` |  |  |  |
| `blanket` |  |  |  |
| `scoped` |  |  |  |
| `scoped --approve` |  |  |  |
| `single-signal --approve` |  |  |  |

运行后解释：为什么 `blanket` 即使抓住一个真实问题，也不能晋升？为什么 `--approve` 不能让证据不足的候选晋升？

<details>
<summary>答案与评价标准</summary>

| 场景 | 漏报案例 | 误报案例 | 决策状态 |
| --- | --- | --- | --- |
| `none` | `ui-claim-build-only`、`ui-claim-unit-only` | 无 | `REJECTED_BY_EVAL` |
| `blanket` | `ui-claim-unit-only` | `build-claim-build-only` | `REJECTED_BY_EVAL` |
| `scoped` | 无 | 无 | `READY_FOR_HUMAN_REVIEW` |
| `scoped --approve` | 无 | 无 | `PROMOTED` |
| `single-signal --approve` | 无 | 无 | `INSUFFICIENT_EVIDENCE` |

`blanket` 把“有构建、无浏览器证据”直接视为问题，却没有检查报告到底声称了什么。它误伤只声称构建已通过的任务，也漏掉“声称浏览器已验证、但只有单测”的留出案例。`--approve` 在本 Demo 中仅是审批输入；证据和评测门禁排在审批之前，不能用人为确认绕过它们。

</details>

## 练习二：检验“两个反馈”是否真是两个独立证据

先预测两种改动的结果，再在自己的工作树中临时修改 `core.mjs`，分别运行 `--scenario=scoped --approve`：

1. 将第二条 `corrections` 的 `taskId` 改成第一条的 `TASK-101`；
2. 恢复 `taskId`，再把第二条的 `sourceRef` 置为空字符串。

观察 `candidate.observations`、`candidate.sourcedObservations`、`candidate.independentTasks` 和 `decision`。最后恢复文件，并重新运行 `verify.mjs`。这些改动仅供练习，不需要提交。

<details>
<summary>答案与评价标准</summary>

第一种改动仍有两次观察、两条带来源的观察，但只来自一个独立任务；第二种仍有两次观察，却只有一条带来源的观察，也只剩一个有证据的独立任务。两种情况下 `candidate.sufficient` 都是 `false`，决策为 `INSUFFICIENT_EVIDENCE`。

合格解释应指出：去重和来源检查只防止这个小模型把重复或无法追溯的记录当成独立证据。现实中两条不同任务也可能共享一个根因或同一位审查者的偏差，仍需人工归因；“至少两个任务”是 Demo 的教学阈值，不是普适门槛。

</details>

## 练习三：让一个看似更积极的规则经受反例

在 `core.mjs` 中把 `rules.scoped` 临时改成“任何没有浏览器证据的案例都报错”，先预测四个案例的结果，再运行：

```sh
node learn/ai/tools/engineering-harness-self-evolution-demo/run-demo.mjs --scenario=scoped
node learn/ai/tools/engineering-harness-self-evolution-demo/verify.mjs
```

记录哪几个案例变成误报，解释为什么 `verify.mjs` 失败。随后恢复原规则，再次运行验证，确认回到 `PASS`。给出一条比“见不到浏览器证据就报错”更准确的规则说明，写明触发条件和不触发条件。

<details>
<summary>答案与评价标准</summary>

修改后的规则会把 `build-claim-build-only` 误报，因为该任务只声称构建已验证；另外，`ui-claim-browser-tested` 有浏览器证据，不应报错。修改后本来应通过的反例失败，`verify.mjs` 的断言会报告失败；恢复原规则后应重新输出 `PASS`。

准确的规则说明可以是：“当交付结果声称浏览器行为已验证，而记录中没有浏览器验证证据时，提示证据不足；仅声称构建通过的任务不触发。”它仍不解决证据造假、浏览器测试质量或任务实际是否需要浏览器验证，需要另设门禁。

</details>

## 练习四：设计下一轮改进，而不是继续追加提示词

基于 Demo 输出，写一张简短的经验晋升卡，包含：原始证据、归因假说、目标与反例、拟落盘资产、负责人、发布后指标和退役条件。然后回答：如果新模型已经能稳定辨别这类交付声明，或者项目改为自动附加浏览器证据，这条规则应如何处理？

请指出至少一个 Demo **无法证明**、必须在真实项目里另行测量的结果。你的方案应保留人工判断入口，同时给出可以自动运行的检查。

<details>
<summary>答案与评价标准</summary>

一个可接受的候选卡会指向 `TASK-101` 与 `TASK-128` 的评审记录，将失败限定为“浏览器已验证的声明缺少对应证据”；目标案例是两种缺证据的浏览器声明，反例是只声称构建通过和真正有浏览器证据的任务。优先考虑交付结果的结构化字段与确定性检查；用项目文档解释声明口径，保留负责人审阅，并把四类案例作为回归集。发布后观察同类评审意见的复发、误报和补证据所需时间，而不是只数规则触发次数。

退役条件可以是：证据被新的自动附件机制可靠覆盖，或在新任务分布下误报和维护成本超过收益。模型升级后应重放目标与反例，并比较有无该规则的结果；能稳定不用它时，可以删去多余提示或改为更便宜的检查。真实项目仍需测量 Agent 是否读取并遵循规则、浏览器证据是否真实、最终交付质量是否改善。固定样本的 `PASS` 无法证明这些结果。

</details>

## 结束检查

恢复练习中修改过的 Demo 文件后，从仓库根目录再次运行 `verify.mjs`。如果无法恢复到 `PASS`，先对照四个案例、两条纠正记录和 `rules.scoped` 的原始条件检查；不要把练习产生的失败当成原有工作流缺陷。
