# Markdown 到知识图片

> 正式引擎已选定 `visual-explainer`。当前已实现可运行的第一阶段闭环；块级增量和结构化对话修订仍按 [Visual Explainer 知识图片生成系统设计](visual-explainer-workflow-design.md) 继续演进。`infographic` 产物仅作为首轮对照实验保留。

## 快速开始

在 Codex 对话中使用时，需要显式调用并指定源文件：

```text
/visual-explainer 将 learn/frontend/browser/chrome-extension-architecture.md 生成知识归纳图
```

生成草稿后可以直接用自然语言指定局部修改，例如“第 2 张只保留消息协议主路径，其他图不动”。只有“定稿”“全部定稿”“批准当前版本”等明确表达才允许进入正式图片目录。

```bash
# 默认增量：原文哈希未变化时不改写任何产物
npm run knowledge:image -- prepare <markdown-path>

# 全量重建 brief 和 HTML 草稿，不自动发布
npm run knowledge:image -- prepare <markdown-path> --hard

# 查看原文变化、图片状态和批准状态
npm run knowledge:image -- status <article-slug>

# 用户明确“定稿”后执行；也可以用 --figure 只批准一张
npm run knowledge:image -- approve <article-slug> [--figure <figure-id>]

# 只渲染 approved 图片，或校验全部已批准后统一定稿
npm run knowledge:image -- render <article-slug> [--figure <figure-id>]
npm run knowledge:image -- finalize <article-slug> [--keep-work]

# 预览或执行安全清理
npm run knowledge:image -- cleanup <article-slug> --dry-run
npm run knowledge:image -- cleanup <article-slug>
```

`prepare` 会根据文章 H2 主题生成 1–5 张图的 `plan.md`、逐图 `briefs/*.md` 和自包含 `drafts/*.html`。第一阶段以文件哈希为增量单位：原文完全未变时直接跳过；原文变化时重新规划草稿，但只有 HTML 与已批准版本哈希一致的图片才能保留批准状态。

`approve` 是独立门禁。普通的“继续”“看看效果”不会被视为定稿；HTML 在批准后发生任何变化，都必须重新批准才能输出正式 PNG。

## 设计目标

将原文、编辑摘要、视觉源码和导出图片分层保存。任何一次修改都应能回答：是原文理解错了、内容脚本压缩过度，还是视觉表达不合适。

## 正式处理流程

```text
指定 Markdown
  -> 读取 frontmatter、标题、结论、图表和限定条件
  -> 自动规划 1–5 张图
  -> briefs/*.md（可审核的内容脚本）
  -> drafts/*.html（可编辑视觉源）
  -> 多轮对话修订
  -> 用户显式 approve
  -> images/*.png + qa/*.json
  -> 安全清理临时预览和渲染文件
```

## 目录

```text
docs/knowledge-images/articles/<article-slug>/
├── manifest.json
├── plan.md
├── source-map.json
├── briefs/*.md
├── drafts/*.html
├── previews/*.draft.png
├── images/*.png
├── revisions/*.json
└── qa/*.json
```

`manifest.json`、`source-map.json`、brief、HTML、正式 PNG、最终 QA 和 revision 日志会在定稿后保留，作为增量更新与审计基础。临时预览、失败截图、草稿 QA 和 `.tmp/` 渲染文件可由 `cleanup` 精确删除。

## 表达规则

| 内容结构 | 首选 | 理由 |
| --- | --- | --- |
| A/B 对比、3–8 项清单、路线图、时间线 | Visual Explainer HTML 表格或 CSS 时间线 | 兼顾结构稳定与后续局部修改 |
| 组件、信任边界、数据流和失败路径 | Visual Explainer Mermaid 或卡片总览 | 可同时表达总览、细节卡片和讲解 |
| 含大量数字和指标 | 数据图表 | 避免用装饰性图形替代精确比较 |
| 非结构化概念或插画 | 位图生成 | 仅在模板和 HTML 无法表达时使用 |

## 迭代约定

1. 先审 `brief.md`，只处理知识取舍。
2. 再审视觉源码，只处理层级、文案长度和版式。
3. 最后审导出图片，检查溢出、字号、对比度和裁切。
4. 原文结论变化时，从 `brief.md` 开始重生成；只改颜色或间距时，不重做摘要。

## 验收标准

- 每个视觉结论都能在原文中找到依据。
- 限定条件不得因压缩而变成绝对结论。
- 一张图有一条主阅读路径，首屏能看出核心判断。
- 中文文字无错字、无截断、无生成式伪字。
- HTML 在桌面宽度下无水平溢出，在 768px 以下可自然收缩。
- 视觉源码和导出图片保留同一版本对应关系。

## 首轮样例

| 原文 | Infographic | Visual Explainer | 对照记录 |
| --- | --- | --- | --- |
| `learn/frontend/vue/vuex-pinia.md` | [PNG](samples/vuex-pinia/infographic.png) · [DSL](samples/vuex-pinia/infographic.md) | [PNG](samples/vuex-pinia/visual.png) · [HTML](samples/vuex-pinia/visual.html) | [QA](samples/vuex-pinia/qa.md) |
| `learn/ai/tools/codex-high-efficiency-guide.md` | [PNG](samples/codex-high-efficiency/infographic.png) · [DSL](samples/codex-high-efficiency/infographic.md) | [PNG](samples/codex-high-efficiency/visual.png) · [HTML](samples/codex-high-efficiency/visual.html) | [QA](samples/codex-high-efficiency/qa.md) |
| `learn/frontend/browser/chrome-extension-architecture.md` | [PNG](samples/chrome-extension-architecture/infographic.png) · [DSL](samples/chrome-extension-architecture/infographic.md) | [PNG](samples/chrome-extension-architecture/visual.png) · [HTML](samples/chrome-extension-architecture/visual.html) | [QA](samples/chrome-extension-architecture/qa.md) |

## 首轮对照观察

| 维度 | Infographic | Visual Explainer |
| --- | --- | --- |
| 生成与修改速度 | 快，改 DSL 后数秒即可重新渲染 | 慢，需同时处理 HTML、CSS 和内容层级 |
| 中文排版 | 对长句和标题较敏感，本轮出现拆字、意外折行和标题截断 | 可控，三篇均未出现文字截断 |
| 信息密度 | 低到中，适合 3–6 个短语级要点 | 中到高，可保留核心结论、机制、限定和选型建议 |
| 一致性 | 高，模板能快速统一多张图 | 取决于视觉规范和 HTML 模板是否复用 |
| 适合作为主流程 | 适合短摘要卡、路线图和对比图 | 适合当前仓库的专家级、边界密集型文章 |

首轮对照已经结束，正式流程统一使用 `visual-explainer`。Infographic 文件继续保留，便于回看当时的选型依据，不再作为新增知识图片的默认产物。
