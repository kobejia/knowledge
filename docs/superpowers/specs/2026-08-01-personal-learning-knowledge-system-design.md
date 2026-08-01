# Personal Learn 知识分类、档位与可视化设计

## 背景

当前 `personal-learning` 已统一生成前交互、个人画像、Markdown 质量规范和配套实践，但仍有三类缺口：

1. 四个档位混合了“建立视野”和“内容深度”，缺少从会用走向理解机制的进阶层。
2. skill 没有稳定的文档归类与落盘流程，生成工具可能自行决定目录，导致知识结构漂移。
3. 规范强调模型、架构和取舍，但没有可执行的图表选择与验证规则，复杂内容仍容易退化为长段文字。

本设计在不恢复 README 知识地图的前提下，将学习文档迁入 `learn/`，以独立 JSON 管理知识分类和文档索引，并生成一个可离线打开的单文件 HTML 预览。个人画像继续只由 YAML 管理。

## 目标

- 将内容档位扩展为“了解、入门、进阶、全面、专家”五档，并明确相邻档位的边界。
- 同一档位结合完整用户画像与主题熟悉度调整起点、术语密度、例子和推理跨度，而不是机械套模板。
- 为新文档提供 `confirm` 和 `automatic` 两种归类模式。
- 使用 `personal-learning-knowledge.json` 作为知识分类、目录层级和文档索引的唯一事实源。
- 将现有知识文档迁入 `learn/` 下的多级领域目录。
- 建立 Markdown 友好的丰富图表策略，覆盖架构、层次、流程、状态、时序、数据模型、演化和取舍。
- 将 Markdown 和 Mermaid 在构建时渲染后嵌入 `personal-learning-preview.html`，提供无需服务器的本地浏览体验。
- 用校验脚本、构建测试和 skill 评估场景约束不同生成工具的行为。

## 非目标

- 不把 `personal-learning-config.yaml` 变成目录、分类或知识地图配置。
- 不让 skill 自动选择内容档位、实践范围或图表数量。
- 不建设在线站点、CMS、全文搜索、文档编辑器、评论、学习进度或同步服务。
- 不把图表数量设为固定指标，也不为“看起来丰富”添加无解释价值的图。
- 不把社区 skill 作为运行时强依赖。
- 不在本轮支持 Word、PDF、PPT 或其他非 Markdown 学习文档。

## 总体架构

采用“画像、知识结构、内容、预览”四层分离：

```text
personal-learning-config.yaml
  -> 只描述学习者画像与输出语言

personal-learning-knowledge.json
  -> 分类模式、领域树、目录路径与文档索引的唯一事实源

learn/**/*.md
  -> 学习内容及最小 frontmatter

scripts/build-preview.mjs
  -> 校验 JSON 与 Markdown
  -> Markdown 转 HTML
  -> Mermaid 转 SVG
  -> 生成 personal-learning-preview.html
```

目标仓库结构：

```text
.
├── personal-learning-config.yaml
├── personal-learning-knowledge.json
├── personal-learning-preview.html
├── learn/
│   ├── frontend/
│   │   ├── vue/
│   │   │   └── vuex-pinia.md
│   │   └── browser/
│   │       └── chrome-extension-architecture.md
│   ├── ai/
│   │   └── tools/
│   │       └── codex-high-efficiency-guide.md
│   └── reference/
│       └── awards/
│           └── awards-catalog.md
├── scripts/
│   ├── validate-knowledge.mjs
│   └── build-preview.mjs
└── .agents/skills/personal-learning/
    ├── SKILL.md
    └── references/
        └── visual-policy.md
```

`personal-learning-preview.html` 是生成产物并提交到 Git，但文件头必须注明“由构建脚本生成，请勿手工编辑”。

## 配置职责边界

### `personal-learning-config.yaml`

继续只保存个人差异：

- 输出语言；
- 学习目标；
- 已明确的经验；
- 已明确的熟悉领域。

不得加入分类模式、内容根目录、分类树、文档索引、档位推荐或预览选项。画像只能影响表达起点，不能替用户选择档位，也不能推断未声明的项目、框架或掌握程度。

### `personal-learning-knowledge.json`

保存知识结构和归类行为。首版 schema：

```json
{
  "version": 1,
  "classificationMode": "confirm",
  "contentRoot": "learn",
  "categories": [
    {
      "id": "frontend",
      "title": "前端",
      "path": "frontend",
      "children": [
        {
          "id": "frontend-vue",
          "title": "Vue",
          "path": "vue",
          "children": [],
          "documents": [
            {
              "id": "vuex-pinia",
              "title": "Vuex 与 Pinia",
              "path": "vuex-pinia.md"
            }
          ]
        }
      ],
      "documents": []
    }
  ]
}
```

约束如下：

- `classificationMode` 只能是 `confirm` 或 `automatic`。
- `contentRoot` 首版固定为 `learn`；保留字段是为了让路径含义显式，不支持任意外部目录。
- `categories` 是递归树；分类节点使用仓库内稳定、唯一的 `id`。
- 子分类的 `path` 只表示相对父分类的一段目录名；文档 `path` 只表示相对所属分类的文件名。
- 所有路径必须是规范化相对路径，不得包含绝对路径、`..`、空段或符号链接逃逸。
- 文档 `id` 全局唯一；分类 `id` 全局唯一。
- JSON 中的每篇文档必须存在于文件系统，`learn/` 中受管理的 Markdown 也必须被 JSON 索引。
- 文档 frontmatter 的 `title` 与 `domain` 必须和索引归属一致；`domain` 对应 `learn/` 下第一级领域，例如 `frontend`、`ai`、`reference`。
- 分类与文档的展示顺序由数组顺序决定，不额外引入排序字段。

首版不在 JSON 中复制摘要、正文、深度或日期，以避免 Markdown frontmatter 与索引形成双重事实源。

## 文档归类流程

归类只决定“写到哪里、属于什么分类”，不决定档位、是否生成配套实践或是否绘图。

### `confirm` 模式

1. skill 根据主题语义、现有分类和相邻文档生成 2–3 个“分类 + 目标路径”候选。
2. 候选必须互斥，并按匹配程度排序；不得要求用户自行设计整个目录。
3. 用户可以选择候选，也可以输入自己的分类或路径。
4. skill 校验选择；若是新分类，明确展示将新增的分类节点和路径。
5. 用户确认后创建文档，并原子性更新 JSON 索引。

### `automatic` 模式

skill 默认选择最匹配的现有分类并直接处理。只有以下情况才暂停确认：

- 两个或以上候选没有明显优先级；
- 主题与现有分类匹配度低，需要新建第一级分类；
- 目标路径已被其他文档占用；
- 用户指定位置与 JSON 结构冲突。

自动模式允许在明确归属下新建较低层级分类，但必须在完成说明中报告最终分类、路径和新增节点。不得为了消除一次歧义而移动或重命名现有文档。

### 更新顺序与失败处理

逻辑事务顺序为：

```text
决定分类
  -> 校验目标路径与 JSON
  -> 写入或修改 Markdown
  -> 更新 JSON
  -> 运行全量一致性校验
  -> 构建预览
```

若 JSON 校验或预览构建失败，不得宣称完成。实现时应使用临时文件生成新 JSON 和 HTML，再以重命名替换，避免留下截断文件。已有用户修改必须保留；涉及冲突文件时停止并报告。

## 五档内容设计

档位定义进入 `editorial-policy.md`，`SKILL.md` 只保留简短说明和交互顺序。

| 内部标识 | 名称 | 核心目标 | 明确边界 |
| --- | --- | --- | --- |
| `survey` | 了解 | 建立视野地图，理解价值、主要组成、关系和关键问题 | 不追求可独立操作，也不展开完整机制论证 |
| `beginner` | 入门 | 建立最小可用理解，掌握必要概念和一条基本路径 | 不穷举替代方案或高级失败模式 |
| `advanced` | 进阶 | 从“会用”进入核心机制、关键设计、常见取舍与失败 | 不追求全面覆盖历史、争议和所有主要方案 |
| `deep-dive` | 全面 | 系统覆盖基础、机制、演化、主要方案、证据、争议、边界和连接 | 不以具体生产决策或专家判断为唯一中心 |
| `expert` | 专家 | 支持架构设计和高质量判断，聚焦生产约束、复杂失败、替代方案与开放问题 | 不等于百科全书式“全部内容” |

档位仍必须由用户明确选择，不根据画像自动推荐、预选或替代用户决定。

## 画像自适应

档位决定目标，画像决定起点和表达方式。生成前综合读取 `learner.goal`、`learner.experience`、`learner.known_domains` 和当前主题，不以单一字段机械分支。

同一“专家”档可以有不同起点：

- 对画像已明确熟悉的领域，压缩常规术语与基础用法，优先进入机制、架构、权衡和复杂失败。
- 对陌生领域，先建立完成专家推理所必需的最小背景和领域语言，再进入同样的专家目标；不能因为选择专家档就假设用户已经掌握该领域。
- 对相邻领域，可用已知领域建立有限类比，但必须说明因果结构或约束不相同的部分。

画像可以调整：

- 前置知识解释量；
- 术语密度和首次定义策略；
- 示例所依赖的技术背景；
- 推理步长和跨领域连接；
- 哪些基础内容可以压缩。

画像不能调整：

- 用户选择的档位目标；
- 来源与验证门槛；
- 对关键推理、边界和失败模式的必要说明；
- 未被配置明确声明的掌握程度。

## 图表策略

新增 `references/visual-policy.md`，创建或实质修改正式学习文档时始终加载。策略以 Markdown 可维护性为优先，作者源只使用三类表达：

- Mermaid 图；
- Markdown 表格；
- 文本目录树。

不将独立 SVG、Draw.io 文件或位图作为默认作者源。复杂架构借鉴 C4 的分层缩放思想，但不要求完整绘制固定四层；只画对当前问题有解释价值的层级。

### 类型选择矩阵

| 要表达的关系 | 默认形式 |
| --- | --- |
| 系统上下文、组件、分层、数据流、因果关系 | Mermaid flowchart，必要时使用 subgraph |
| 调用顺序、协议交互、异步协作 | Mermaid sequence diagram |
| 生命周期、状态转换、异常恢复 | Mermaid state diagram |
| 类、接口与静态关系 | Mermaid class diagram |
| 实体、字段与数据关系 | Mermaid ER diagram |
| 概念及其分支 | Mermaid mindmap |
| 历史演化与里程碑 | Mermaid timeline |
| 阶段、计划与依赖 | Mermaid gantt，仅在时间和依赖都重要时使用 |
| 方案、能力和取舍的重复字段比较 | Markdown 表格 |
| 目录、模块和文件层级 | 文本树 |

### 使用规则

- 图表数量由认知负担和解释价值决定，不设最低数量。
- 技术与非技术文档都可以使用丰富图表，但不得把没有明确关系的信息强塞进图中。
- 架构、层次、关键流程或状态转换是核心论证且仅靠文字难以快速把握时，应优先加入合适图表。
- 一张图只回答一个主要问题；复杂系统拆成“上下文 -> 容器或模块 -> 关键内部机制”等有价值的视角。
- 图前说明它回答的问题，图后解释阅读顺序、关键边界、容易误读处和结论。
- 表格只用于重复字段比较；叙事、因果链和长解释不用表格替代。
- 文本树只表达层级，不同时承担流程或依赖关系。
- 图中的术语、边界和方向必须与正文一致。

### 档位与图表密度

- `survey`：优先领域地图、组成关系和简短对比。
- `beginner`：优先单路径流程、最小架构和关键状态。
- `advanced`：加入内部机制、关键时序、状态和典型失败路径。
- `deep-dive`：覆盖主要视角、演化和方案取舍，但避免重复表达。
- `expert`：突出信任边界、数据边界、生产约束、异常路径和替代架构。

这些是选择倾向，不是固定模板。画像进一步影响图中的抽象层级与术语密度。

### Mermaid 验证

- Markdown 中保留可读的 Mermaid fenced code block，保证 Git diff 友好。
- 若当前环境可用构建工具，必须实际解析并渲染 Mermaid；解析失败视为构建失败。
- 若仅执行文档编辑而构建工具不可用，至少检查代码块闭合、图类型、节点标识和常见结构错误，并明确披露未完成实际渲染。
- 本仓库的正式预览构建会将 Mermaid 转成内联 SVG，因此成功生成预览即提供实际语法验证证据。

## 本地预览

`personal-learning-preview.html` 是一个构建时生成、可双击离线打开的单文件应用：

- 左侧显示可折叠的知识分类树，顺序来自 JSON。
- 右侧显示选中文档的已渲染 HTML。
- 当前文档写入 URL hash，刷新后保持选择，也可以复制本地链接定位文档。
- Mermaid 在构建时转成内联 SVG，不依赖浏览器运行时或网络 CDN。
- Markdown 内容、样式、导航数据和 SVG 全部嵌入一个 HTML 文件。
- 默认打开 URL hash 指定的文档；没有有效 hash 时打开索引中的第一篇文档。
- 未找到文档时显示明确错误和可选文档列表，不显示空白页。

首版明确不加入搜索、标签过滤、目录编辑、Markdown 编辑、热更新、响应式移动端专项优化或主题切换。

## 构建工具与依赖

实现阶段新增最小 Node 工具链和锁文件。依赖选择应满足：

- Markdown 解析支持常用 GFM 表格、列表、代码块和链接；
- Mermaid 能在构建环境中真实解析并输出 SVG；
- 生成结果不依赖网络；
- 依赖版本固定并提交 lockfile；
- 使用当前维护中的官方包，并在实现时核对其最新官方文档与 Node 版本要求。

社区 Mermaid 或 Draw.io skills 只作为设计参考，不安装为 `personal-learning` 的强制依赖。图形判断、质量门槛和 C4 式分层原则应内化进 `visual-policy.md`，保证换工具后规则仍然成立。

## 现有文档迁移

迁移映射固定为：

| 现路径 | 新路径 |
| --- | --- |
| `vue/vuex-pinia.md` | `learn/frontend/vue/vuex-pinia.md` |
| `browser/chrome-extension-architecture.md` | `learn/frontend/browser/chrome-extension-architecture.md` |
| `ai/codex-high-efficiency-guide.md` | `learn/ai/tools/codex-high-efficiency-guide.md` |
| `awards/awards-catalog.md` | `learn/reference/awards/awards-catalog.md` |

迁移后删除空的 `vue/`、`browser/`、`ai/` 和 `awards/` 目录，修复所有仓库内相对链接。README 仍只保留项目介绍，不添加知识树或逐篇链接。

迁移同时检查 frontmatter：正式学习文档补齐或修正 `title`、`domain`、`depth`、`created`、`updated`；其中 `depth` 允许五个新档位，`domain` 与新路径的第一级领域一致。轻量资料清单是否需要 frontmatter 继续遵循 `markdown-quality.md`，但只要纳入 JSON，就必须至少能从 JSON 获得标题与路径。

## Skill 流程调整

必要交互顺序调整为：

1. 理解用户输入；有实质歧义时给出互斥选项，否则用一至两句话说明理解。
2. 由用户从五档中选择内容档位。
3. 技术主题确认一次是否需要完整配套实践；非技术主题跳过。
4. 读取知识 JSON，根据 `classificationMode` 确认或自动决定分类与路径。
5. 读取编辑、Markdown、图表规范；选择实践后再读取实践规范。
6. 生成或修改文档，必要时生成配套实践。
7. 更新 JSON，运行一致性校验，并重建离线预览。
8. 报告文档路径、分类、档位、图表与实践验证范围。

对已有文档的实质修改沿用其 JSON 归属，不重复询问分类；只有用户明确要求移动、主题已明显改变或索引冲突时才重新归类。纯拼写和机械格式调整仍可跳过完整交互，也不必无意义地重建未受影响的内容，但提交前必须保证 JSON 与预览没有过期。

## 校验与错误处理

`scripts/validate-knowledge.mjs` 至少检查：

- JSON 是有效 UTF-8 和合法 JSON；
- 顶层字段、枚举和版本有效，未知字段按严格 schema 拒绝；
- 分类与文档 ID 唯一；
- 路径安全、规范化且没有重复解析结果；
- JSON 索引与 `learn/**/*.md` 双向一致；
- Markdown frontmatter 的标题、领域、深度和日期有效；
- 所有受管理 Markdown 的仓库内链接可解析；
- JSON 不索引生成物、Demo 资源或 `learn/` 外文件。

`scripts/build-preview.mjs` 必须先调用或复用同一校验逻辑，然后渲染全部受管理文档。任何 Markdown 读取、Mermaid 解析或 SVG 生成失败都以非零状态退出，并指出文档路径和图块位置。不得生成部分成功的 HTML 覆盖上一份可用预览。

## 测试与评估策略

实现继续采用 RED-GREEN-REFACTOR。先更新测试和评估场景并确认旧实现失败，再修改 skill、规则、脚本和文档。

### 客观测试

- 五档均被 schema、规范和 skill 接受，旧四档断言失败后更新。
- `advanced` 与 `beginner`、`deep-dive` 的边界在 reference 中可检索。
- `personal-learning-config.yaml` 仍拒绝分类、目录和档位推荐字段。
- 知识 JSON 接受合法递归树，拒绝未知字段、重复 ID、路径穿越、文件缺失和未索引 Markdown。
- `confirm` 与 `automatic` 是仅有的分类模式。
- 四篇现有文档全部迁移并被索引，旧路径不存在，内部链接有效。
- 预览构建生成单文件 HTML，不包含 CDN URL 或外部运行时依赖。
- 每个 Mermaid 图块都能实际解析并转成内联 SVG；错误图块导致构建失败且保留旧预览。
- HTML 左侧树、右侧内容区和 hash 路由在无服务器条件下可用。
- `git diff --check`、JSON 解析、shell 语法和 Node 测试全部通过。

### Skill 评估场景

至少覆盖：

1. 明确的新技术主题、`confirm` 模式：给出 2–3 个分类与路径候选，并允许自定义输入。
2. 明确的新主题、`automatic` 模式且存在唯一匹配：不追加目录问题，完成后报告归类。
3. `automatic` 模式出现并列候选或需要新建第一级分类：暂停并请求确认。
4. 修改已索引文档：沿用原分类，不重复询问。
5. 同为 `expert`，一个主题属于画像熟悉领域，一个属于陌生领域：两者目标相同但前置解释和术语起点不同。
6. 用户选择 `advanced`：内容进入机制、设计和常见失败，但没有伪装成全面综述。
7. 核心架构或流程适合绘图：选择正确 Mermaid 类型，图前后都有解释，构建可渲染。
8. 不适合绘图的内容：不为了数量强加图表。
9. 非技术主题：仍可按关系需要使用时间线、概念图或表格，同时跳过配套实践确认。
10. JSON 与文件系统不一致或 Mermaid 无效：停止完成声明并给出可定位错误。

人工评审重点是档位边界、画像适配是否自然、分类判断是否合理、图表是否降低认知负担，以及正文与图表是否共同支持核心论证。

## 完成标准

- 五档定义完整且互不替代，`advanced` 已贯穿 skill、规范、frontmatter 和实践规则。
- 档位由用户选择；画像只调整起点与表达，不机械决定内容。
- `personal-learning-config.yaml` 继续只承担个人画像。
- `personal-learning-knowledge.json` 成为分类、目录树和文档索引的唯一事实源。
- `confirm` 和 `automatic` 按设计工作，且自动模式只在明确例外中请求确认。
- 四篇现有内容迁入指定 `learn/` 路径，旧目录清理，链接和 frontmatter 有效。
- `visual-policy.md` 提供丰富、Markdown 友好的类型路由、解释要求和验证门槛。
- 离线 HTML 从 JSON 与 Markdown 构建，Mermaid 已转为内联 SVG，无网络依赖。
- 预览、JSON 和 Markdown 不存在双重事实源或静默漂移。
- 客观测试、skill 评估、实际预览检查和 `git diff --check` 全部通过。
