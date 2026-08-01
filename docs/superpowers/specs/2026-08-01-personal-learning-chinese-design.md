# Personal Learn 中文化与配置瘦身设计

## 背景

`personal-learning` 已能统一学习文档、Demo 和练习题的生成流程，但 skill 正文与专项规范仍以英文编写，和仓库主要使用语言不一致。根配置中的 `level_recommendations` 还把内置内容档位与个人画像混在一起，既造成概念误导，也与“每次由用户选择档位”的交互规则重复。

本轮在保持 skill 标识、路径和内部档位标识兼容的前提下，将可见说明中文化，删除推荐档位配置，并对现有 skill 做一次范围内的结构和一致性优化。

## 目标

- 将 `SKILL.md` 的 frontmatter 描述、标题与正文翻译为中文。
- 将四份 `references/*.md` 的标题与正文翻译为中文。
- 保持 `personal-learning`、目录名、文件名、脚本名和四个内部档位标识不变。
- 从根配置和默认模板中删除 `level_recommendations`。
- 让配置校验器采用严格 schema，拒绝未知字段和残留的推荐档位字段。
- 显式按 UTF-8 读取中文 YAML，避免受 `LC_ALL=C` 等环境设置影响。
- 收敛重复规则，避免 `SKILL.md` 与 `editorial-policy.md` 同时维护两份正式档位定义。
- 更新测试与行为评估，使其反映“始终由用户选择档位，不从配置推荐”的行为。

## 非目标

- 不重命名 skill、目录、reference 文件、脚本或配置文件。
- 不把 `expert`、`beginner`、`deep-dive`、`survey` 改成中文内部值。
- 不修改既定交互顺序：理解或消歧、选择档位、技术主题确认 Demo 与练习题。
- 不合并或重新拆分 reference 文件。
- 不扩展博客、知识地图、构建系统或其他仓库功能。
- 不修改现有知识文档的语言和正文。

## 中文化边界

以下内容改成中文：

- `SKILL.md` frontmatter 中的 `description`；
- `SKILL.md` 的所有标题、说明、步骤、问题和约束；
- `editorial-policy.md`、`markdown-quality.md`、`demo-quality.md`、`exercise-quality.md` 的所有自然语言内容；
- reference 中用于解释内部值的表头和说明。

以下内容保持英文或现状：

- frontmatter 的 `name: personal-learning`；
- `.agents/skills/personal-learning/` 及其子目录和文件名；
- `personal-learning-config.yaml`；
- `init-config.sh`、`validate-config.sh` 及命令参数；
- `expert`、`beginner`、`deep-dive`、`survey`；
- Markdown、HTML、CSS、JavaScript、README、Demo 等通用技术名称；
- 现有脚本的命令行消息，本轮不做界面本地化扩张。

## 档位定义归属

`references/editorial-policy.md` 是四档正式语义的唯一事实来源，保留每档的完整内容边界。

`SKILL.md` 只负责交互：

- 展示专家、入门、全面、了解四个选项及一句摘要；
- 明确必须等待用户选择；
- 不根据配置或画像自动推荐、预选或代替用户决定。

两处允许存在面向不同目的的摘要，但不得复制相同的完整定义。测试只验证选项、顺序和内部标识存在，不通过逐句匹配锁死中文措辞。

## 配置 schema

根配置和默认模板统一为：

```yaml
version: 1
language: zh-CN

learner:
  goal: 通过高质量知识文档扩展视野、增加知识深度并强化复杂系统分析能力
  experience:
    frontend_years: 10
  known_domains:
    - frontend
    - browser
    - javascript
    - web-engineering
```

允许字段固定为：

- 根：`version`、`language`、`learner`；
- `learner`：`goal`、`experience`、`known_domains`；
- `learner.experience`：`frontend_years`。

任何未知字段均视为配置错误。这样残留的 `level_recommendations` 会得到明确拒绝，而不是被静默忽略。数组和标量继续执行现有类型与非空校验。

## 校验器优化

`validate-config.sh` 中的 Ruby 逻辑调整为：

1. 使用 `File.read(path, encoding: "UTF-8")` 读取配置。
2. 捕获 YAML 解析错误和无效 UTF-8 错误。
3. 在逐项类型校验前检查每一级 mapping 的未知键。
4. 错误信息包含具体字段路径和允许字段。
5. 删除所有档位推荐值的解析与允许值检查。

初始化器不变，继续保证配置存在时拒绝覆盖。

## Skill review 优化

中文化时同步处理以下问题：

- 删除“基于配置推荐档位”的所有表述。
- 保留配置仅提供个人背景，不把熟悉领域推导成未声明的框架或项目经验。
- 保留技术主题分别确认 Demo 与练习题、非技术主题跳过的既定规则。
- 保持 Markdown 始终加载，Demo 与练习题 reference 按选择加载。
- 合并同一文件内语义重复的句子，使 `SKILL.md` 继续控制在 500 词以内；中文改用行数、段落重复和人工审查判断精简度，不机械使用英文词数作为唯一指标。
- 统一“Demo”“练习题”“档位”“正文”等术语。
- 不把稳定规则重新移回配置。

## 测试策略

按 RED-GREEN-REFACTOR 修改现有 skill。

### RED

先修改测试，新增以下断言：

- 根配置和模板不能包含 `level_recommendations`。
- 校验器必须拒绝包含未知根字段的配置，尤其是旧的 `level_recommendations`。
- `SKILL.md` 的 `description`、主要标题和关键交互语句为中文。
- 四份 references 具有中文标题和关键术语。
- `SKILL.md` 中理解、档位、主题分类的顺序保持不变。
- eval 1 不再期待基于画像推荐专家档。

在实现修改前运行测试，确认其因当前英文内容与旧字段存在而失败。

### GREEN

删除两份配置中的推荐段，收紧校验器，中文化 skill 与 references，并更新 eval。运行相同测试并确认通过。

### REFACTOR

检查中文是否存在翻译腔、重复定义、过度使用强制语气或术语不一致；精简后再次运行完整测试。

## 完成标准

- `SKILL.md` 和四份 references 的自然语言内容已中文化。
- 所有兼容性标识、路径、文件名和内部档位值保持不变。
- 根配置和模板不再包含 `level_recommendations`。
- 配置校验器显式读取 UTF-8，并拒绝所有未知字段。
- skill 不再依据配置或画像推荐、预选档位。
- eval 预期与新行为一致。
- 配置、结构、shell 语法、JSON、本地 Markdown 链接和 `git diff --check` 全部通过。
