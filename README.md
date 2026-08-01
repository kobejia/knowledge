# Knowledge

一个用于持续研究、归纳和验证知识的个人知识库。Skill 默认不会自动启用，必须显式调用。

这里不追求教程数量或知识点覆盖率，而是围绕重要问题持续理解其核心模型、演化过程、证据、约束、取舍与边界。内容首先服务于个人学习，同时保持对其他读者可理解。

**一、生成知识文档**

1. 显式调用 `/personal-learn`，提供新主题或现有 Markdown 路径。
2. 选择内容档位：`beginner`、`advanced`、`expert`、`deep-dive` 或 `survey`。
3. 技术主题确认是否需要配套实践。
4. 确认分类后生成文档并更新知识索引；Skill 会自动完成测试、内容校验和预览构建。
5. 前往 IMA 知识库，选择「本地文件夹」导入整个知识库，或选择「本地文件」导入指定文档；完成后即可在手机端随时查阅。

```text
/personal-learn 生成 WebAssembly Component Model 知识文档
/personal-learn 深化 learn/frontend/browser/chrome-extension-architecture.md 的安全边界
```

新文档写入 `learn/`，分类索引记录在 `personal-learn-knowledge.json`。

**二、生成知识归纳图**

1. 准备至少包含 H1 和 H2 的 Markdown。
2. 执行 `prepare`，生成 1–5 张草稿。
3. 查看 `status`，在对话中逐张修订。
4. 明确“定稿”后执行 `approve`。
5. 执行 `finalize`，完成 PNG 导出、QA 和临时文件清理。

```bash
npm run knowledge:image -- prepare <markdown-path> [--hard]
npm run knowledge:image -- status <article-slug>
npm run knowledge:image -- approve <article-slug> [--figure <figure-id>]
npm run knowledge:image -- finalize <article-slug> [--keep-work]
```

**三、命令参数**

| 参数 | 含义 |
| --- | --- |
| `<markdown-path>` | 源 Markdown 的项目内路径，例如 `learn/frontend/browser/chrome-extension-architecture.md` |
| `<article-slug>` | 文章产物 ID，默认取源文件名，例如 `chrome-extension-architecture` |
| `--hard` | 忽略派生产物缓存，全量重建 brief 和 HTML；不自动批准或发布 |
| `--figure <figure-id>` | 只批准或渲染指定图片 |
| `--keep-work` | 定稿后保留草稿预览和调试产物 |

默认不加 `--hard`，按内容哈希增量生成。普通的“继续”不会批准草稿，必须明确说“定稿”。

**四、产物位置**

| 产物 | 路径 |
| --- | --- |
| 分图计划 | `docs/knowledge-images/articles/<article-slug>/plan.md` |
| 草稿预览 | `docs/knowledge-images/articles/<article-slug>/previews/` |
| 可编辑 HTML | `docs/knowledge-images/articles/<article-slug>/drafts/` |
| 正式 PNG | `docs/knowledge-images/articles/<article-slug>/images/` |
| 状态与 QA | `manifest.json`、`source-map.json`、`qa/`、`revisions/` |

详细设计见 `docs/knowledge-images/README.md`，项目检查统一运行 `npm run check`。
