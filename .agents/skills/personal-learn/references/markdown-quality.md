# Markdown 质量规范

## 元信息

正式学习文档使用最小 YAML frontmatter：

```yaml
---
title: 文档标题
domain: frontend
depth: expert
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

- `depth` 只能是 `beginner`、`survey`、`advanced`、`deep-dive` 或 `expert`。
- 保留 `created`；只有实质修改才更新 `updated`。
- `domain` 必须等于 `personal-learn-knowledge.json` 中所属文档的顶级分类路径。
- README 和轻量清单在元信息没有检索价值时可以省略 frontmatter。
- 不添加学习进度、掌握程度、生成阶段或虚构的个人状态。

## 结构

- 只使用一个 H1 标题，后续标题按层级嵌套，不跳级。
- 标题应表达文档论证，而不是套用统一模板。
- 推理使用段落，并列信息使用列表，重复字段比较才使用表格。
- 代码块标明正确语言，并保持示例足够精简、便于检查。
- 首次出现时解释缩写，除非根据配置可以安全假设读者已经熟悉。

## 链接与引用

- 仓库文件优先使用相对路径，并验证所有修改过的内部链接。
- 来源紧跟其支持的结论或段落。
- 使用有含义的链接文字，不使用裸 URL 或“点击这里”。
- 不在 README 中添加文档链接或知识地图。

## 完成检查

- 适用文档的 frontmatter、日期和所选档位有效。
- 标题层级、代码块、列表和表格能够正确渲染。
- 内部链接有效，外部来源确实支持相邻结论。
- 不存在尾随空格、占位文本、失效锚点或无说明的空章节。
- `git diff --check` 通过。
