---
title: Visual Explainer 知识图片生成系统设计
created: 2026-08-01
updated: 2026-08-01
---

# Visual Explainer 知识图片生成系统设计

## 一、最终决策

当前项目将 `visual-explainer` 作为 Markdown 到知识图片的正式生成引擎。系统不直接把长文转成 PNG，而是建立一条可审查、可局部修改、可重现的流水线：

```text
指定 Markdown
  -> 内容盘点
  -> 1–5 张的分图方案
  -> 每张图的内容脚本
  -> 可编辑 HTML 草稿
  -> 多轮对话局部修订
  -> 用户显式定稿
  -> 渲染、QA 与 PNG 导出
```

默认为增量模式。`--hard` 表示忽略派生产物的缓存和局部锁定，从当前原文重新生成全部内容脚本与 HTML，但不删除历史修订日志。

## 二、核心原则

### 1. 原文是事实源，HTML 是可编辑表达

- Markdown 原文决定事实、结论和限定条件。
- `plan.md` 决定生成几张、每张回答什么问题。
- `briefs/*.md` 决定每张图取舍哪些内容。
- `drafts/*.html` 决定最终视觉表达。
- `images/*.png` 只是定稿 HTML 的导出快照，不可反向成为内容事实源。

### 2. 生成与发布分离

`prepare` 和 `revise` 只产生可审阅草稿。未获得用户的显式“定稿”指令时，不得生成或覆盖正式 `images/*.png`。

草稿阶段可产生临时预览 `previews/*.png`，但它必须带有 `draft` 标识，且不进入正式图片目录。

### 3. 增量的最小单位是“图”和“内容块”

不以整篇文章作为唯一缓存单位。系统要能识别：

- 只有原文的某个章节变化；
- 只有第 2 张图依赖该章节；
- 第 2 张的某张卡片需重生成；
- 其他已审阅内容和 HTML 保持不变。

### 4. 用户修改高于自动重生成

多轮对话中用户已确认或手工修订的内容默认锁定。增量生成不得静默覆盖锁定内容。如果原文变化与锁定内容冲突，应将状态标记为 `conflict`，等待用户决定。

## 三、目录设计

```text
docs/knowledge-images/
├── README.md
├── visual-explainer-workflow-design.md
└── articles/
    └── <article-slug>/
        ├── manifest.json
        ├── plan.md
        ├── source-map.json
        ├── briefs/
        │   ├── 01-overview.md
        │   ├── 02-mechanism.md
        │   └── 03-boundaries.md
        ├── drafts/
        │   ├── 01-overview.html
        │   ├── 02-mechanism.html
        │   └── 03-boundaries.html
        ├── previews/
        │   ├── 01-overview.draft.png
        │   ├── 02-mechanism.draft.png
        │   └── 03-boundaries.draft.png
        ├── images/
        │   ├── 01-overview.png
        │   ├── 02-mechanism.png
        │   └── 03-boundaries.png
        ├── revisions/
        │   ├── 0001-initial.json
        │   ├── 0002-tighten-overview.json
        │   └── 0003-fix-trust-boundary.json
        └── qa/
            ├── 01-overview.json
            ├── 02-mechanism.json
            └── 03-boundaries.json
```

### 目录边界

- `plan.md`：人可读的分图计划与覆盖清单。
- `source-map.json`：章节 ID、标题、哈希及它们与图片/内容块的依赖。
- `manifest.json`：构建状态、产物哈希、锁定、定稿与软件版本。
- `briefs/`：可独立审阅的图片内容脚本。
- `drafts/`：完整、自包含、可编辑的 HTML。
- `previews/`：多轮讨论所用的临时图片。
- `images/`：仅存放已定稿版本。
- `revisions/`：只追加的对话修订记录。
- `qa/`：每张图的自动和人工检查结果。

## 四、状态模型

### 文章状态

```text
new
  -> planned
  -> drafting
  -> reviewing
  -> approved
  -> rendering
  -> published

任意非 published 状态 -> conflict
published + 原文变化 -> stale
stale -> drafting / reviewing / approved
```

### 单图状态

| 状态 | 含义 | 允许的下一步 |
| --- | --- | --- |
| `planned` | 已决定该图回答的问题 | 生成 brief |
| `brief-ready` | 内容脚本已产生 | 审内容或生成 HTML |
| `draft-ready` | HTML 可预览 | 对话修订 |
| `reviewing` | 存在未确认修改 | 继续修订或撤销 |
| `approved` | 用户已明确定稿 | 运行正式渲染 |
| `published` | PNG 与定稿 HTML 哈希一致 | 发布或等待源文更新 |
| `stale` | 原文或依赖已变化 | 增量更新 |
| `conflict` | 原文变化与人工锁定冲突 | 用户决策 |

`approved` 不等于 `published`。前者是人的内容与视觉决策，后者还要求渲染、尺寸、溢出、控制台和图像完整性检查通过。

## 五、`manifest.json` 数据约定

```json
{
  "version": 1,
  "articleId": "chrome-extension-architecture",
  "source": "learn/frontend/browser/chrome-extension-architecture.md",
  "sourceHash": "sha256:...",
  "generator": {
    "engine": "visual-explainer",
    "skillVersion": "0.8.1",
    "pipelineVersion": 1
  },
  "build": {
    "mode": "incremental",
    "status": "reviewing",
    "updatedAt": "2026-08-01T12:00:00+08:00"
  },
  "figures": [
    {
      "id": "01-overview",
      "question": "Chrome Extension 的运行时与信任边界是什么？",
      "sourceSections": ["core-judgment", "runtime-model"],
      "briefHash": "sha256:...",
      "draftHash": "sha256:...",
      "approvedDraftHash": null,
      "publishedImageHash": null,
      "status": "reviewing",
      "locks": ["thesis", "trust-boundary"],
      "dirtyBlocks": ["service-worker-card"]
    }
  ]
}
```

所有派生产物都应记录哈希。是否增量重建由内容哈希和依赖关系决定，不依赖文件修改时间。

## 六、命令接口

建议统一入口：

```bash
npm run knowledge:image -- <command> <source-or-slug> [options]
```

### 1. 创建或增量更新草稿

```bash
npm run knowledge:image -- prepare learn/frontend/browser/chrome-extension-architecture.md
```

默认行为：

1. 解析 Markdown 章节和稳定 ID。
2. 比较 `source-map.json` 中的章节哈希。
3. 仅将依赖已变更章节的图标记为 dirty。
4. 仅重生成 dirty 图中未锁定的 brief 块。
5. 仅重构对应 HTML 块，保留其他 DOM 和手工修订。
6. 生成 `*.draft.png` 供讨论，不修改 `images/`。

### 2. 全量重新生成

```bash
npm run knowledge:image -- prepare learn/frontend/browser/chrome-extension-architecture.md --hard
```

`--hard` 的确切语义：

- 重新解析全部原文并重建分图计划。
- 重新生成全部 `briefs/*.md` 和 `drafts/*.html`。
- 忽略原有缓存、dirty 标记和内容块锁定。
- 将原有 `approved` / `published` 降级为 `reviewing`，必须重新定稿。
- 重建 `previews/`，但不直接覆盖正式 `images/`。
- 保留 `revisions/` 作为审计历史，并追加一条 `hard-regeneration` 记录。

`--hard` 是全量重生成，不是无痕清空历史，也不是自动发布。

### 3. 对话修订

```bash
npm run knowledge:image -- revise chrome-extension-architecture \
  --figure 02-mechanism \
  --instruction "将 Service Worker 生命周期放到视觉中心，保留 30 秒空闲终止的限定"
```

实际对话中用户不必输入 CLI，可直接说：

```text
第 2 张信息太密，把消息协议改成一条主路径；
保留 Service Worker 会终止这个重点，其他不动。
```

Agent 将这条对话转换为结构化 revision，然后只修改目标图的目标块。

### 4. 查看状态

```bash
npm run knowledge:image -- status chrome-extension-architecture
```

输出至少包含：

- 原文是否变更；
- 计划生成几张图；
- 每张图的状态、dirty 块和锁定块；
- 上次对话修订摘要；
- 是否可定稿，以及仍未通过的 QA。

### 5. 定稿

```bash
npm run knowledge:image -- approve chrome-extension-architecture
npm run knowledge:image -- approve chrome-extension-architecture --figure 01-overview
```

`approve` 必须是用户的显式行为。“看起来可以”“继续”“差不多”默认不是定稿；只有“定稿”“批准”“用这版出图”等明确表述才改变状态。

### 6. 生成正式图片

```bash
npm run knowledge:image -- render chrome-extension-architecture
```

`render` 只处理 `approved` 图。未定稿图片应跳过并报告，不得自动批准。

便捷命令：

```bash
npm run knowledge:image -- finalize chrome-extension-architecture
```

`finalize` 等于“校验当前全部图已经 approved → render → QA → 更新 manifest”，不得暗含 approve。

`finalize` 全部成功后默认还会执行一次安全清理。如果需要保留本轮草稿预览和调试文件，可显式使用：

```bash
npm run knowledge:image -- finalize chrome-extension-architecture --keep-work
```

安全清理只在所有定稿图片渲染和 QA 通过、manifest 已原子写入后执行。任何图片失败时都应保留中间产物，便于诊断和继续对话修订。

## 七、自动决定 1–5 张

图片数量由“有多少个不能在同一条阅读路径中清楚回答的主问题”决定，不按原文字数简单切页。

### 评估维度

| 维度 | 信号 |
| --- | --- |
| 核心问题 | 原文是否同时回答多个可独立成立的问题 |
| 表达类型 | 是否同时存在架构、时序、对比、风险或清单 |
| 信息密度 | 一张图是否需超过 4 个主区域或 12 个关键节点 |
| 阅读顺序 | 内容是否有两条以上并列主路径 |
| 发布用途 | 是要一张总览，还是一组可逐张传播的图 |

### 默认映射

- 1 张：单一问题，一种表达类型，约 3–8 个核心要点。
- 2 张：“总览 + 机制”或“原理 + 实践”。
- 3 张：“总览 + 机制 + 边界”，默认的长文组合。
- 4 张：再拆出对比、时序、风险或选型。
- 5 张：长篇专家文章上限，通常为“总览 + 三个核心视角 + 检查清单”。

如果超过 5 张仍不足以清晰表达，应建议将原文拆成两个图片系列，不通过缩小字号、去掉限定或将多张图硬塞进同一画布来满足数量上限。

## 八、多轮对话修订协议

### 用户可按四种粒度修改

1. **文章级**：“把整组图的风格改成编辑杂志感。”
2. **图片级**：“第 3 张删掉性能讨论，只保留安全边界。”
3. **内容块级**：“把第 2 张的 Service Worker 卡放到中间。”
4. **字段级**：“把‘特权中心’改成‘权限与协调中心’。”

模糊指令不可直接扩大为全量重写。例如“这里简单一点”应优先作用在当前讨论的图或块；实在无法唯一定位时再请求用户指定。

### Revision 记录

```json
{
  "id": 3,
  "createdAt": "2026-08-01T12:30:00+08:00",
  "target": {
    "figure": "02-mechanism",
    "block": "service-worker-card"
  },
  "instruction": "把 Service Worker 放到中间，保留 30 秒空闲终止限定",
  "beforeHash": "sha256:...",
  "afterHash": "sha256:...",
  "affectedFiles": [
    "briefs/02-mechanism.md",
    "drafts/02-mechanism.html"
  ],
  "locksAdded": ["service-worker-card.lifecycle-limit"],
  "status": "applied"
}
```

修订日志用于审计、撤销、定位回归和理解用户为什么改成当前版本。

### 锁定约定

- 用户明确说“保留”“不要再动”“这句定了”时，锁定目标块或字段。
- 用户只是提出一次修改，默认记录 revision，但不自动加永久锁。
- 增量更新遇到锁定块时，先比较新原文是否与锁定内容冲突。
- `--hard` 忽略锁定生成新草稿，但旧锁定仍保留在 revision 历史中。

## 九、增量依赖算法

### 步骤

1. 解析 frontmatter、H1–H3、段落、列表、表格、代码块和 Mermaid 块。
2. 为每个章节分配稳定 ID，优先基于标题层级路径，标题重命名时使用内容相似度迁移旧 ID。
3. 对规范化后的章节内容计算 SHA-256。
4. 从 `source-map.json` 查找变更、新增和删除章节。
5. 根据 `sourceSections -> figure -> block` 依赖图计算 dirty 集合。
6. 依次重建 dirty brief 块、HTML 块和草稿预览。
7. 如果重建结果与原哈希一致，不写文件，避免无意义 diff。
8. 对锁定块做冲突检查，不自动合并语义冲突。

### 会导致全组图 dirty 的变化

- 文章核心结论改变。
- 目标读者、输出比例或全局主题改变。
- 分图数量或阅读顺序改变。
- 共享设计 token、字体或全局模板改变。
- visual-explainer skill 或 pipeline 发生不兼容版本变化。

## 十、定稿与图片导出

### 定稿前门禁

每张图必须同时满足：

- `briefHash` 与当前 brief 一致。
- `draftHash` 与当前 HTML 一致。
- 无 dirty 块。
- 无 conflict。
- 自动 QA 通过。
- 用户已显式 approve 当前 `draftHash`。

用户定稿后如果 HTML 任何字节改变，`approvedDraftHash` 立即失效，图片回到 `reviewing`。

### 渲染流程

1. 用 headless Chromium 打开自包含 HTML。
2. 固定 viewport、device scale factor、color scheme 和字体环境。
3. 等待 `document.fonts.ready`、Mermaid 渲染完成和页面显式的 `data-render-ready="true"`。
4. 检查 console error、水平溢出、空节点、未渲染 Mermaid 和资源加载失败。
5. 截取固定画布或每个 `[data-figure]` 元素，不用不可预期的任意 full-page 高度。
6. 校验 PNG 尺寸、文件大小、alpha 和边界像素。
7. 将 PNG 与定稿 HTML 哈希写入 manifest。

### 默认输出规格

- 横图：1600 × 1000（16:10）。
- 竖图：1200 × 1500（4:5）。
- 方图：1200 × 1200。
- device scale factor：1，保持 CSS 像素与输出像素可预期；需要高分辨率时显式使用 `--scale 2`。
- 文件名：`NN-topic[-variant].png`，不包含 `final-final` 类人工版本后缀。

## 十一、QA 设计

### 自动检查

- HTML 完整且自包含，无意外外部资源依赖。
- 页面无 console error 和未处理 Promise rejection。
- 指定 viewport 下 `scrollWidth <= clientWidth`。
- 标题、主结论、来源标识和必需限定块存在。
- 一张图不超过规定的主区域、节点和最小字号阈值。
- 内部链接、DOM ID 与 `aria-labelledby` 引用有效。
- PNG 已生成且尺寸符合 manifest。

### 语义检查

- 每个核心结论都可通过 `source-map.json` 追溯到原文章节。
- 推论、建议与原文事实没有混淆。
- 限定条件没有因视觉压缩变成绝对表述。
- 1–5 张图覆盖 `plan.md` 声明的所有核心问题，无重复填充。
- 图与图之间的术语、色彩语义和阅读顺序一致。

### 视觉检查

- 首屏或主画布能在数秒内看出该图回答的问题。
- 中文无截断、重叠、孤立标点或过度拆行。
- 同一系列的字体、间距、边框和 3–5 个强调色保持一致。
- 不使用装饰性动画支撑信息理解；静态 PNG 仍能完整成立。
- 核心区域不依赖 hover、折叠或导航操作才可见。

## 十二、定稿后的中间产物清理

清理的目标是减少重复图片、临时文件和失败残留，但不破坏下一次默认增量生成所需的依赖状态。

### 定稿后必须保留

| 产物 | 保留原因 |
| --- | --- |
| `manifest.json` | 保存原文、brief、HTML、approve 和 PNG 哈希，是增量判断核心 |
| `source-map.json` | 保存章节到图片/内容块的依赖关系 |
| `plan.md` | 记录 1–5 张的分图逻辑和覆盖边界 |
| `briefs/*.md` | 内容审核与下次局部更新的语义基线 |
| `drafts/*.html` | 已定稿的可编辑视觉源，PNG 必须能由它重现 |
| `images/*.png` | 正式发布图片 |
| `revisions/*.json` | 保留多轮对话修订、锁定、撤销和审计记录 |
| `qa/*.json` | 只保留与当前正式 PNG 哈希一致的最终 QA 报告 |

### 定稿后默认删除

- `previews/*.draft.png`：对话过程的临时预览，已被正式 PNG 取代。
- `previews/*.failed.png`：渲染失败或局部失真版本。
- `qa/*.draft.json`：草稿阶段的检查结果。
- `.tmp/`：浏览器临时页、临时截图、字体缓存索引和原子写入中间文件。
- `*.new`、`*.tmp`、`*.partial`：未完成的原子替换产物。
- 已被当前 `draftHash` 取代、且 revision 日志中已记录变更的临时 HTML 备份。
- 与当前 `publishedImageHash` 不匹配、且未被标记为可回滚发布版本的旧 PNG 副本。

### 有条件保留

- 上一个正式 PNG：默认保留到新 PNG 已成功通过 QA 和哈希校验；完成原子替换后可删除。
- 人工标记的基线图：只有 `visual-regression` 测试明确引用时保留，不和普通草稿预览混在一起。
- 冲突现场：`conflict` 或 `render-failed` 状态下保留相关临时产物，直到冲突解决或用户显式放弃。

### 清理命令

```bash
# 预览将被删除的文件，不修改磁盘
npm run knowledge:image -- cleanup chrome-extension-architecture --dry-run

# 只清理安全的临时产物
npm run knowledge:image -- cleanup chrome-extension-architecture
```

`cleanup` 必须从 manifest 解析精确文件清单，不使用未校验的宽泛 glob，也不删除未在当前文章产物目录内的文件。每次实际清理都向 revision 日志追加一条记录，包含删除的路径、文件哈希与清理原因。

### 清理失败不影响已发布结果

清理发生错误时：

1. 保持已成功生成的 `images/*.png` 和 `published` 状态。
2. 将 `cleanupStatus` 记录为 `failed`，并列出未清理路径。
3. 不回滚已通过的渲染和 QA。
4. 后续可独立重试 `cleanup`，不需要重新生成图片。

## 十三、错误与冲突处理

| 情况 | 默认行为 |
| --- | --- |
| 原文路径不存在 | 立即停止，不创建空产物目录 |
| Markdown 无 H1 或结构无法解析 | 报告具体结构问题，等待修复 |
| 原文变化与锁定内容冲突 | 标记 `conflict`，展示原文新值、当前锁定值和建议合并方案 |
| 用户要求只改颜色 | 只修改全局 token 或目标图 CSS，不重做 brief |
| 用户改变核心结论 | 重建受影响 brief 和 HTML，取消相关 approve |
| 草稿渲染失败 | 保留旧预览，将新版标记为 `render-failed` |
| 正式渲染失败 | 不覆盖旧 PNG，不更新 `publishedImageHash` |
| 计划超过 5 张 | 停止并建议拆分图片系列 |

## 十四、实现模块

```text
scripts/knowledge-image/
├── cli.mjs
├── commands/
│   ├── prepare.mjs
│   ├── revise.mjs
│   ├── status.mjs
│   ├── approve.mjs
│   ├── render.mjs
│   ├── finalize.mjs
│   └── cleanup.mjs
├── core/
│   ├── parse-markdown.mjs
│   ├── build-source-map.mjs
│   ├── plan-figures.mjs
│   ├── diff-dependencies.mjs
│   ├── apply-revision.mjs
│   ├── manage-locks.mjs
│   └── manifest.mjs
├── render/
│   ├── browser.mjs
│   ├── screenshot.mjs
│   └── readiness.mjs
├── qa/
│   ├── structural.mjs
│   ├── semantic.mjs
│   └── image.mjs
└── schemas/
    ├── manifest.schema.json
    ├── source-map.schema.json
    └── revision.schema.json
```

当前 `scripts/render-knowledge-image.mjs` 可作为 `render/browser.mjs` 的原型，但实现新系统时应去掉 Infographic 分支，改为只渲染已批准的 Visual Explainer HTML，并实现固定画布、readiness 协议与不覆盖旧产物的原子替换。

## 十五、实施阶段

### 阶段 1：最小可用闭环

- 支持单篇 Markdown、1–5 张分图计划、brief、HTML 草稿和预览。
- 实现 `prepare`、`approve`、`render`、`status`、`cleanup`。
- 用文件级哈希先实现整篇增量，暂不做块级增量。
- 正式 PNG 只能来自 approved HTML。

### 阶段 2：多轮修订

- 实现 revision 追加日志、目标块定位、撤销与锁定。
- 实现 `revise` 和用户自然语言到 revision 的转换。
- 任何修订都自动取消目标图的 approve。

### 阶段 3：块级增量

- 实现章节稳定 ID、source map 和依赖图。
- 只重建 dirty 图与 dirty 块。
- 实现锁定冲突检查和 `--hard` 全量语义。

### 阶段 4：视觉回归

- 为每个画布保存基线图和视觉 diff。
- 对字体、截断、溢出、色彩对比度和空白突变设置阈值。
- 全局模板变更时可快速确认影响的全部图片。

## 十六、完成标准

- 默认执行只更新受影响产物，无意义的未变文件不产生 diff。
- `--hard` 能全量重建草稿，但保留审计历史且不自动覆盖正式图片。
- 用户可在多轮对话中按文章、图、块或字段修改，未指定区域保持不变。
- 原文变化不会静默覆盖用户锁定内容，语义冲突会显式停止。
- 每篇文章可根据实际认知负担生成 1–5 张，超过上限时建议拆分系列。
- 未明确定稿的 HTML 不得进入正式 `images/`。
- 正式 PNG 能追溯到确切原文哈希、brief、HTML、revision 和 approve 记录。
- 渲染失败、QA 失败或哈希不匹配时，不覆盖上一个有效正式图片。
- `finalize` 成功后默认清理草稿预览、临时文件和过期 QA，同时保留下次增量生成必需的状态与可编辑源。
- `cleanup --dry-run` 能精确展示删除清单，清理失败不影响已成功发布的 PNG。
