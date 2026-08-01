# Personal Learn Knowledge System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `personal-learning` 升级为画像自适应的五档学习 skill，并用独立 JSON 管理 `learn/` 分类、生成包含 Mermaid SVG 的单文件离线预览。

**Architecture:** `personal-learning-config.yaml` 保存画像和正文生成前的大纲审阅开关；`personal-learning-knowledge.json` 是分类树和文档索引的唯一事实源。Node 脚本复用同一套严格校验逻辑，构建器读取索引和 Markdown，将 Mermaid 真实渲染成 SVG，再把导航、正文和样式嵌入 `personal-learning-preview.html`。

**Tech Stack:** Node.js 22、Node 内置 test runner、Ajv 8.20.0、marked 18.0.7、gray-matter 4.0.3、`@mermaid-js/mermaid-cli` 11.16.0、POSIX shell、Markdown、JSON、HTML/CSS/JavaScript。

---

## 文件职责

- Create `package.json`, `package-lock.json`: Node 版本、锁定依赖、test/validate/build/check 命令。
- Create `personal-learning-knowledge.json`: 分类模式、递归分类树、文档索引。
- Create `scripts/lib/knowledge-schema.mjs`: 严格 JSON schema 与五档枚举。
- Create `scripts/lib/markdown-document.mjs`: frontmatter、内部链接、Mermaid 图块解析。
- Create `scripts/lib/knowledge-model.mjs`: 分类树展开、路径安全、JSON/Markdown 双向一致性。
- Create `scripts/validate-knowledge.mjs`: 校验 CLI。
- Create `scripts/lib/render-mermaid.mjs`: Mermaid CLI API 到 SVG。
- Create `scripts/lib/render-preview.mjs`: Markdown 渲染、知识树数据与单文件 HTML 模板。
- Create `scripts/build-preview.mjs`: 原子生成预览的 CLI 与可测试 API。
- Create `tests/personal-learning/knowledge-validator.test.mjs`, `preview-builder.test.mjs`: Node 测试。
- Create `.agents/skills/personal-learning/references/visual-policy.md`: 图表选择、解释与验证规范。
- Create and commit `personal-learning-preview.html`: 可重建的离线产物。
- Modify `SKILL.md`, three existing references, evals and shell tests.
- Move four existing documents into the approved `learn/` hierarchy; only change metadata required by the move.

## Task 1: 建立 Node 工具链和知识契约 RED 测试

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tests/personal-learning/knowledge-validator.test.mjs`
- Create: `scripts/lib/knowledge-schema.mjs`

- [ ] **Step 1: 创建精确依赖和命令**

```json
{
  "name": "personal-knowledge",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test tests/personal-learning/*.test.mjs",
    "validate:knowledge": "node scripts/validate-knowledge.mjs",
    "build:preview": "node scripts/build-preview.mjs",
    "check": "npm run test && sh tests/personal-learning/test-config.sh && sh tests/personal-learning/test-structure.sh && npm run validate:knowledge && npm run build:preview"
  },
  "dependencies": {
    "@mermaid-js/mermaid-cli": "11.16.0",
    "ajv": "8.20.0",
    "gray-matter": "4.0.3",
    "marked": "18.0.7"
  }
}
```

Run: `npm install`

Expected: 生成 `package-lock.json`，退出码 0；不得使用 `--force`。

- [ ] **Step 2: 写最小合法 fixture 和失败测试**

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateRepository } from "../../scripts/lib/knowledge-model.mjs";

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "personal-learning-"));
  await mkdir(path.join(root, "learn/frontend/vue"), { recursive: true });
  await writeFile(path.join(root, "learn/frontend/vue/reactivity.md"), `---\ntitle: Vue 响应式\ndomain: frontend\ndepth: advanced\ncreated: 2026-08-01\nupdated: 2026-08-01\n---\n\n# Vue 响应式\n`);
  const knowledge = { version: 1, classificationMode: "confirm", contentRoot: "learn", categories: [{ id: "frontend", title: "前端", path: "frontend", documents: [], children: [{ id: "frontend-vue", title: "Vue", path: "vue", children: [], documents: [{ id: "vue-reactivity", title: "Vue 响应式", path: "reactivity.md" }] }] }], ...overrides };
  await writeFile(path.join(root, "personal-learning-knowledge.json"), JSON.stringify(knowledge, null, 2));
  return root;
}

test("accepts recursive categories and advanced", async () => {
  const result = await validateRepository(await fixture());
  assert.equal(result.documents[0].relativePath, "learn/frontend/vue/reactivity.md");
});

test("rejects unknown fields", async () => {
  await assert.rejects(validateRepository(await fixture({ preview: true })), /preview/);
});
```

再分别测试：`classificationMode: manual`、路径穿越、重复分类 ID、重复文档 ID、缺失文件、未索引 Markdown、错误 title/domain/depth/date、失效相对链接。每个错误断言必须包含具体字段、ID 或路径。

- [ ] **Step 3: 运行 RED 测试**

Run: `npm test -- tests/personal-learning/knowledge-validator.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/lib/knowledge-model.mjs`。

- [ ] **Step 4: 写严格 schema**

```js
const segment = "^(?!\\.{1,2}$)(?!.*[/\\\\])[A-Za-z0-9][A-Za-z0-9._-]*$";
export const DEPTHS = ["survey", "beginner", "advanced", "deep-dive", "expert"];
export const documentSchema = {
  type: "object", additionalProperties: false, required: ["id", "title", "path"],
  properties: {
    id: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
    title: { type: "string", minLength: 1 }, path: { type: "string", pattern: segment }
  }
};
export const categorySchema = {
  $id: "category", type: "object", additionalProperties: false,
  required: ["id", "title", "path", "children", "documents"],
  properties: {
    id: documentSchema.properties.id, title: documentSchema.properties.title,
    path: documentSchema.properties.path,
    children: { type: "array", items: { $ref: "category" } },
    documents: { type: "array", items: documentSchema }
  }
};
export const knowledgeSchema = {
  type: "object", additionalProperties: false,
  required: ["version", "classificationMode", "contentRoot", "categories"],
  properties: {
    version: { const: 1 }, classificationMode: { enum: ["confirm", "automatic"] },
    contentRoot: { const: "learn" },
    categories: { type: "array", minItems: 1, items: { $ref: "category" } }
  }
};
```

- [ ] **Step 5: Commit RED 契约**

```bash
git add package.json package-lock.json scripts/lib/knowledge-schema.mjs tests/personal-learning/knowledge-validator.test.mjs
git commit -m "test: define personal learn knowledge contract"
```

## Task 2: 实现知识模型校验器

**Files:**
- Create: `scripts/lib/markdown-document.mjs`
- Create: `scripts/lib/knowledge-model.mjs`
- Create: `scripts/validate-knowledge.mjs`
- Modify: `tests/personal-learning/knowledge-validator.test.mjs`

- [ ] **Step 1: 实现 Markdown 解析**

```js
import matter from "gray-matter";
import { DEPTHS } from "./knowledge-schema.mjs";

export function parseMarkdownDocument(source, relativePath) {
  const { data, content } = matter(source);
  for (const key of ["title", "domain", "depth", "created", "updated"]) {
    if (data[key] === undefined) throw new Error(`${relativePath}: missing ${key}`);
  }
  if (!DEPTHS.includes(data.depth)) throw new Error(`${relativePath}: invalid depth ${data.depth}`);
  for (const key of ["created", "updated"]) {
    data[key] = data[key] instanceof Date ? data[key].toISOString().slice(0, 10) : String(data[key]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data[key])) throw new Error(`${relativePath}: invalid ${key}`);
  }
  return { data, content, links: extractInternalLinks(content), mermaidBlocks: extractMermaidBlocks(content) };
}
```

实现并导出 `extractInternalLinks` 与 `extractMermaidBlocks`。链接忽略 `http:`, `https:`, `mailto:`, `#` 和 data URL；Mermaid 返回 `{index, source}` 并拒绝空块。

- [ ] **Step 2: 实现递归展开和一致性校验**

```js
export async function validateRepository(repoRoot) {
  const knowledge = JSON.parse(await readFile(path.join(repoRoot, "personal-learning-knowledge.json"), "utf8"));
  validateSchema(knowledge);
  const categoryIds = new Set(), documentIds = new Set(), documents = [];
  walkCategories(knowledge.categories, [], ({ category, segments }) => {
    assertUnique(categoryIds, category.id, "category id");
    for (const item of category.documents) {
      assertUnique(documentIds, item.id, "document id");
      documents.push({ item, category, segments, relativePath: path.posix.join("learn", ...segments, item.path) });
    }
  });
  await validateDocuments(repoRoot, documents);
  await assertIndexMatchesFilesystem(repoRoot, documents);
  return { knowledge, documents };
}
```

Ajv 使用 `{allErrors: true}`。`realpath` 后文件必须仍位于 `<repo>/learn`；JSON title 等于 frontmatter title；顶层分类 path 等于 frontmatter domain；索引和 `learn/**/*.md` 双向一致；相对链接去除 query/hash 后必须存在。

- [ ] **Step 3: 创建 CLI**

```js
#!/usr/bin/env node
import process from "node:process";
import { validateRepository } from "./lib/knowledge-model.mjs";
const root = process.argv[2] ?? process.cwd();
try {
  const { documents } = await validateRepository(root);
  console.log(`PASS: validated ${documents.length} knowledge documents`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
```

- [ ] **Step 4: 运行 GREEN 测试并提交**

Run: `npm test -- tests/personal-learning/knowledge-validator.test.mjs`

Expected: 所有合法/非法 schema、路径、索引、frontmatter、链接测试 PASS。

```bash
git add scripts/lib/markdown-document.mjs scripts/lib/knowledge-model.mjs scripts/validate-knowledge.mjs tests/personal-learning/knowledge-validator.test.mjs
git commit -m "feat: validate personal learn knowledge index"
```

## Task 3: 创建索引并迁移文档

**Files:**
- Create: `personal-learning-knowledge.json`
- Move four approved documents into `learn/`
- Modify: `learn/frontend/browser/chrome-extension-architecture.md`
- Modify: `tests/personal-learning/test-structure.sh`

- [ ] **Step 1: 先扩展结构测试并观察失败**

```sh
test -f "$repo_root/personal-learning-knowledge.json"
for relative_path in \
  learn/frontend/vue/vuex-pinia.md \
  learn/frontend/browser/chrome-extension-architecture.md \
  learn/ai/tools/codex-high-efficiency-guide.md \
  learn/reference/awards/awards-catalog.md
do
  test -f "$repo_root/$relative_path" || exit 1
done
for old_path in vue browser ai awards; do test ! -e "$repo_root/$old_path" || exit 1; done
```

Run: `sh tests/personal-learning/test-structure.sh`

Expected: FAIL because the JSON does not exist。

- [ ] **Step 2: 执行固定迁移**

```bash
mkdir -p learn/frontend/vue learn/frontend/browser learn/ai/tools learn/reference/awards
git mv vue/vuex-pinia.md learn/frontend/vue/vuex-pinia.md
git mv browser/chrome-extension-architecture.md learn/frontend/browser/chrome-extension-architecture.md
git mv ai/codex-high-efficiency-guide.md learn/ai/tools/codex-high-efficiency-guide.md
git mv awards/awards-catalog.md learn/reference/awards/awards-catalog.md
```

只把 Chrome Extension 的 `domain: browser` 改成 `domain: frontend`。保留其余日期、档位和正文；Vue 文件如需 CRLF 规范化，先确认语义 diff 为空。

- [ ] **Step 3: 创建完整 JSON**

顶层顺序固定为 `frontend`, `ai`, `reference`；写入以下完整内容：

```json
{
  "version": 1,
  "classificationMode": "automatic",
  "contentRoot": "learn",
  "categories": [
    {
      "id": "frontend", "title": "前端", "path": "frontend", "documents": [],
      "children": [
        { "id": "frontend-vue", "title": "Vue", "path": "vue", "children": [], "documents": [{ "id": "vuex-pinia", "title": "Vue 状态管理演进：从 Vuex 到 Pinia", "path": "vuex-pinia.md" }] },
        { "id": "frontend-browser", "title": "浏览器", "path": "browser", "children": [], "documents": [{ "id": "chrome-extension-architecture", "title": "Chrome Extension：运行时模型、权限边界与架构取舍", "path": "chrome-extension-architecture.md" }] }
      ]
    },
    {
      "id": "ai", "title": "人工智能", "path": "ai", "documents": [],
      "children": [{ "id": "ai-tools", "title": "工具", "path": "tools", "children": [], "documents": [{ "id": "codex-high-efficiency-guide", "title": "Codex：从上手到高效协作", "path": "codex-high-efficiency-guide.md" }] }]
    },
    {
      "id": "reference", "title": "资料", "path": "reference", "documents": [],
      "children": [{ "id": "reference-awards", "title": "奖项与荣誉", "path": "awards", "children": [], "documents": [{ "id": "awards-catalog", "title": "奖项与荣誉清单（第一轮）", "path": "awards-catalog.md" }] }]
    }
  ]
}
```

JSON title 必须逐字等于对应 frontmatter title。

- [ ] **Step 4: 校验迁移并提交**

Run: `npm run validate:knowledge && sh tests/personal-learning/test-structure.sh && rg -n '\]\((\.\./)*(vue|browser|ai|awards)/' . --glob '*.md'`

Expected: 前两项 PASS，`rg` 无输出，`git diff --summary` 显示四个 rename。

```bash
git add personal-learning-knowledge.json learn tests/personal-learning/test-structure.sh
git commit -m "refactor: organize personal learning documents"
```

## Task 4: 用契约测试升级 skill、档位与视觉规范

**Files:**
- Modify: `tests/personal-learning/test-config.sh`, `test-structure.sh`
- Modify: `.agents/skills/personal-learning/SKILL.md`
- Modify: three existing reference files and `evals/evals.json`
- Create: `.agents/skills/personal-learning/references/visual-policy.md`

- [ ] **Step 1: 写失败契约**

`test-structure.sh` 检查 `进阶（\`advanced\`）`、`personal-learning-knowledge.json`、`classificationMode`、`references/visual-policy.md`，并检查三个 reference 都包含 `advanced`。`test-config.sh` 将 `classificationMode` 和 `contentRoot` 追加到合法画像配置并断言被拒绝。

Run: `sh tests/personal-learning/test-structure.sh; sh tests/personal-learning/test-config.sh`

Expected: 结构测试 FAIL；配置越界测试 PASS。

- [ ] **Step 2: 更新 evals 为十类可观察行为**

覆盖：confirm 的 2–3 候选与自由输入；automatic 唯一归属；automatic 并列/新顶级分类；已索引文档沿用归属；熟悉/陌生领域的 expert 不同起点；advanced 边界；适合绘图；不适合绘图；非技术图表并跳过实践；无效 JSON/Mermaid 阻止完成声明。

- [ ] **Step 3: 修改 skill 工作流**

在 `SKILL.md` 中加入五档，保持档位必须由用户选择。实践确认后新增：

```markdown
### 4. 归类与落盘

读取 `<repo>/personal-learning-knowledge.json` 并先运行知识校验。

- `confirm`：给出 2–3 个互斥的“分类 + 目标路径”候选，允许用户自行输入；确认后再写入。
- `automatic`：唯一明确归属时自动处理；并列候选、新顶级分类、路径占用或用户指定位置冲突时才确认。
- 修改已索引文档时沿用原归属，除非用户要求移动、主题明显改变或索引冲突。
```

始终加载 `visual-policy.md`；生成后更新 JSON、运行 `npm run validate:knowledge` 与 `npm run build:preview`，再报告路径、分类和验证范围。

- [ ] **Step 4: 更新 references**

`editorial-policy.md` 加入 `advanced`，并写明“档位决定目标，画像决定起点”；熟悉领域压缩基础、陌生领域补齐专家推理的最小背景、相邻领域类比说明差异。`markdown-quality.md` 与 `practice-quality.md` 接受 `advanced`，且 Markdown domain 匹配 JSON 顶级分类。

`visual-policy.md` 完整定义 Mermaid/表格/文本树；flowchart/sequence/state/class/ER/mindmap/timeline/gantt/对比表/目录树的选择；C4 式按解释价值缩放；图前问题、图后解读；五档密度倾向；画像影响抽象层级；实际渲染与失败披露。

- [ ] **Step 5: 运行并提交**

Run: `sh tests/personal-learning/test-config.sh && sh tests/personal-learning/test-structure.sh && node -e 'JSON.parse(require("node:fs").readFileSync(".agents/skills/personal-learning/evals/evals.json", "utf8"))'`

Expected: PASS。

```bash
git add .agents/skills/personal-learning tests/personal-learning/test-config.sh tests/personal-learning/test-structure.sh
git commit -m "feat: expand personal learn workflow"
```

## Task 5: 实现 Markdown 与 Mermaid 渲染

**Files:**
- Create: `scripts/lib/render-mermaid.mjs`
- Create: `scripts/lib/render-preview.mjs`
- Create: `tests/personal-learning/preview-builder.test.mjs`

- [ ] **Step 1: 写 RED 测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown } from "../../scripts/lib/render-preview.mjs";

test("renders GFM and Mermaid as inline SVG", async () => {
  const html = await renderMarkdown("| A | B |\n| - | - |\n| 1 | 2 |\n\n```mermaid\nflowchart LR\nA --> B\n```");
  assert.match(html, /<table>/);
  assert.match(html, /<svg[^>]*>/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});

test("identifies an invalid Mermaid block", async () => {
  await assert.rejects(renderMarkdown("```mermaid\nflowchart LR\nA --\n```", { relativePath: "learn/broken.md" }), /learn\/broken\.md.*block 1/i);
});
```

Run: `npm test -- tests/personal-learning/preview-builder.test.mjs`

Expected: FAIL with missing `render-preview.mjs`。

- [ ] **Step 2: 实现临时文件 Mermaid 渲染器**

```js
export async function renderMermaid(source, context) {
  const dir = await mkdtemp(path.join(tmpdir(), "personal-learning-mermaid-"));
  const input = path.join(dir, "diagram.mmd"), output = path.join(dir, "diagram.svg");
  try {
    await writeFile(input, source, "utf8");
    await run(input, output, { quiet: true, backgroundColor: "transparent" });
    return await readFile(output, "utf8");
  } catch (error) {
    throw new Error(`${context.relativePath}: Mermaid block ${context.index + 1}: ${error.message}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 3: 实现 Markdown 渲染并测试**

实现 `export async function renderMarkdown(source, context = { relativePath: "<inline>" })`。用 `extractMermaidBlocks` 先将图块替换为不可碰撞 token，逐块渲染后调用 `marked.parse`，最后把 token 替换为 `<figure class="diagram">${svg}</figure>`。普通代码必须保持转义。

Run: `npm test -- tests/personal-learning/preview-builder.test.mjs`

Expected: 合法图得到 `<svg>`；非法图错误包含路径和块序号。

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/render-mermaid.mjs scripts/lib/render-preview.mjs tests/personal-learning/preview-builder.test.mjs
git commit -m "feat: render markdown and mermaid for preview"
```

## Task 6: 构建单文件离线预览

**Files:**
- Modify: `scripts/lib/render-preview.mjs`
- Create: `scripts/build-preview.mjs`
- Modify: `tests/personal-learning/preview-builder.test.mjs`
- Create: `personal-learning-preview.html`

- [ ] **Step 1: 写端到端失败测试**

```js
import { buildPreview } from "../../scripts/build-preview.mjs";

test("builds an offline tree and hash-routed documents", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");
  assert.match(html, /由构建脚本生成，请勿手工编辑/);
  assert.match(html, /data-document-id="vue-reactivity"/);
  assert.match(html, /<svg[^>]*>/);
  assert.match(html, /addEventListener\("hashchange"/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
});

test("preserves the old preview on build failure", async () => {
  const root = await createPreviewFixture({ invalidMermaid: true });
  const output = path.join(root, "personal-learning-preview.html");
  await writeFile(output, "previous-preview");
  await assert.rejects(buildPreview(root, output), /Mermaid block 1/);
  assert.equal(await readFile(output, "utf8"), "previous-preview");
});
```

- [ ] **Step 2: 实现 HTML 模板**

输出含 `<aside aria-label="知识目录">`、`<main tabindex="-1">`、嵌入式 CSS 和 JSON 数据。脚本按 `location.hash` 选择文档，无效 hash 回退第一篇；点击树节点更新 hash/active/title；分类可折叠；无文档时显示错误和可选列表。所有嵌入 JSON 将 `<` 转义为 `\\u003c`。文档相对链接构建时转换为 `#<document-id>`，无法映射则失败。

- [ ] **Step 3: 实现原子构建 API/CLI**

```js
export async function buildPreview(repoRoot, outputPath = path.join(repoRoot, "personal-learning-preview.html")) {
  const model = await validateRepository(repoRoot);
  const rendered = await renderAllDocuments(repoRoot, model);
  const html = renderPreviewPage({ knowledge: model.knowledge, documents: rendered });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, html, "utf8");
    await rename(temporary, outputPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
```

使用 `pathToFileURL(process.argv[1]).href === import.meta.url` 保护 CLI 分支，确保测试导入模块时不会自动构建。直接执行成功打印 `PASS: built personal-learning-preview.html with 4 documents`，失败打印 `FAIL:` 并非零退出。

- [ ] **Step 4: 测试、构建和单文件检查**

Run: `npm test -- tests/personal-learning/preview-builder.test.mjs && npm run build:preview`

Expected: PASS，并生成含四篇文档和 Chrome Extension 内联 SVG 的 HTML。

Run: `rg -n "<script[^>]+src=|<link[^>]+href=|https?://[^\\\"']+\\.(js|css)" personal-learning-preview.html`

Expected: 无输出；普通资料链接允许保留。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-preview.mjs scripts/lib/render-preview.mjs tests/personal-learning/preview-builder.test.mjs personal-learning-preview.html
git commit -m "feat: build offline personal learn preview"
```

## Task 7: 全量自动验证与浏览器验收

**Files:**
- Modify only when a new failing test proves a defect in Tasks 1–6.

- [ ] **Step 1: 自动检查**

Run: `npm run check`

Expected: Node tests、配置契约、结构契约、4 篇知识文档校验和预览构建全部 PASS。

Run: `git diff --check && node --check scripts/validate-knowledge.mjs && node --check scripts/build-preview.mjs && sh -n tests/personal-learning/test-config.sh && sh -n tests/personal-learning/test-structure.sh`

Expected: 退出码 0，无输出。

- [ ] **Step 2: 浏览器验收**

打开 `file:///Users/jiajun/Documents/knowledge/personal-learning-preview.html`，检查：左侧三大分类及子树；四篇文档切换；分类折叠；active 状态；hash 刷新保持；Chrome Extension SVG；表格/代码/长文档可读；离线可用；控制台无预览自身错误。

- [ ] **Step 3: 生成幂等性**

Run: `npm run build:preview && git diff --exit-code -- personal-learning-preview.html`

Expected: PASS，第二次构建无 diff。

- [ ] **Step 4: 修复验收缺陷时坚持 RED-GREEN**

先在相应 `.test.mjs` 添加失败断言，确认 FAIL，再修改最小实现并运行 `npm run check`。仅有实际修复时提交：

若缺陷位于预览交互，使用：

```bash
git add scripts/lib/render-preview.mjs scripts/build-preview.mjs tests/personal-learning/preview-builder.test.mjs personal-learning-preview.html
git commit -m "fix: correct personal learn preview behavior"
```

若缺陷位于校验器，则改为暂存 `scripts/lib/knowledge-model.mjs`、`scripts/lib/markdown-document.mjs` 和 `tests/personal-learning/knowledge-validator.test.mjs`，提交消息使用 `fix: correct personal learn validation`。

- [ ] **Step 5: 最终状态检查**

Run: `git status --short && git log --oneline -7`

Expected: 工作树干净；提交历史依次包含契约、校验器、迁移、skill、渲染和预览，不创建空提交。
