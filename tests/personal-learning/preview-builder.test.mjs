import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPreview } from "../../scripts/build-preview.mjs";
import { renderMarkdown, renderPreviewPage } from "../../scripts/lib/render-preview.mjs";
import { namespaceSvg } from "../../scripts/lib/render-mermaid.mjs";

async function createPreviewFixture({ invalidMermaid = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "personal-learning-preview-"));
  const directory = path.join(root, "learn/frontend/vue");
  await mkdir(directory, { recursive: true });
  const diagram = invalidMermaid ? "flowchart LR\nA --" : "flowchart LR\nA --> B";
  const document = `---
title: Vue 响应式
domain: frontend
depth: advanced
created: 2026-08-01
updated: 2026-08-01
---

# Vue 响应式

[个人配置](../../../personal-learning-config.yaml)

## 核心模型

响应式系统跟踪读取，并在依赖变化后重新执行对应任务。

> 状态变化只应更新真正依赖它的工作。

| 对象 | 职责 |
| --- | --- |
| 状态 | 保存当前值 |
| 任务 | 响应依赖变化 |

\`\`\`js
const state = { count: 1 };
\`\`\`

\`\`\`mermaid
${diagram}
\`\`\`
`;
  await writeFile(path.join(directory, "reactivity.md"), document);
  await writeFile(path.join(root, "personal-learning-config.yaml"), "version: 1\n");
  const knowledge = {
    version: 1,
    classificationMode: "automatic",
    contentRoot: "learn",
    categories: [{
      id: "frontend", title: "前端", path: "frontend", documents: [],
      children: [{
        id: "frontend-vue", title: "Vue", path: "vue", children: [],
        documents: [{ id: "vue-reactivity", title: "Vue 响应式", path: "reactivity.md" }]
      }]
    }]
  };
  await writeFile(path.join(root, "personal-learning-knowledge.json"), JSON.stringify(knowledge, null, 2));
  return root;
}

test("renders GFM and Mermaid as inline SVG", async () => {
  const html = await renderMarkdown(`| A | B |
| - | - |
| 1 | 2 |

\`\`\`mermaid
flowchart LR
A --> B
\`\`\``);
  assert.match(html, /<table>/);
  assert.match(html, /<svg[^>]*>/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});

test("identifies an invalid Mermaid block", async () => {
  await assert.rejects(
    renderMarkdown("```mermaid\nflowchart LR\nA --\n```", { relativePath: "learn/broken.md" }),
    /learn\/broken\.md.*block 1/i
  );
});

test("namespaces Mermaid ids and references", () => {
  const svg = '<svg id="my-svg"><style>#my-svg .node{fill:red}</style><marker id="my-svg-pointEnd"/><path marker-end="url(#my-svg-pointEnd)"/></svg>';
  const result = namespaceSvg(svg, "vue-reactivity-1");
  assert.match(result, /id="personal-learning-vue-reactivity-1"/);
  assert.match(result, /url\(#personal-learning-vue-reactivity-1-pointEnd\)/);
  assert.doesNotMatch(result, /my-svg/);
});

test("builds an offline tree and hash-routed documents", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");
  assert.match(html, /由构建脚本生成，请勿手工编辑/);
  assert.match(html, /data-document-id="vue-reactivity"/);
  assert.match(html, /\\u003csvg/);
  assert.match(html, /class="category-contents"[^>]*><ul>/);
  assert.match(html, /href=\\"personal-learning-config\.yaml\\"/);
  assert.match(html, /addEventListener\("hashchange"/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
  assert.doesNotMatch(html, /@import\s+/);
});

test("builds the responsive reader shell", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");

  assert.match(html, /class="skip-link" href="#document-view"/);
  assert.match(html, /class="app-shell"/);
  assert.match(html, /class="library-sidebar\b/);
  assert.match(html, /class="mobile-toolbar"/);
  assert.match(html, /class="document-view" id="document-view"/);
  assert.match(html, /class="article-outline" aria-label="本文目录"/);
  assert.match(html, /<dialog[^>]+class="mobile-sheet"/);
  assert.match(html, /data-sheet-panel="library"/);
  assert.match(html, /data-sheet-panel="outline"/);
  assert.match(html, /data-theme-choice="auto"/);
  assert.match(html, /data-theme-choice="light"/);
  assert.match(html, /data-theme-choice="dark"/);
});

test("embeds the responsive and dual-theme style contract", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");

  assert.match(html, /--accent:\s*#176b63/);
  assert.match(html, /@media \(prefers-color-scheme:\s*dark\)/);
  assert.match(html, /\[data-theme="light"\]/);
  assert.match(html, /\[data-theme="dark"\]/);
  assert.match(html, /@media \(min-width:\s*1200px\)/);
  assert.match(html, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/);
  assert.match(html, /@media \(max-width:\s*767px\)/);
  assert.match(html, /min-height:\s*100dvh/);
  assert.match(html, /max-width:\s*760px/);
  assert.match(html, /font-size:\s*17px/);
  assert.match(html, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("embeds backward-compatible document and section routing", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");

  assert.match(html, /function decodeHashRoute/);
  assert.match(html, /function encodeHashRoute/);
  assert.match(html, /split\("\/", 2\)/);
  assert.match(html, /addEventListener\("hashchange"/);
  assert.match(html, /history\.replaceState/);
  assert.match(html, /data-heading-id/);
  assert.match(html, /const documentChanged = documentId !== state\.activeDocumentId/);
  assert.doesNotMatch(html, /const nextHash = encodeHashRoute\(state\.activeDocumentId, headingId\)/);
});

test("embeds accessible dialog, theme, and section observation behavior", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");

  assert.match(html, /showModal\(\)/);
  assert.match(html, /addEventListener\("cancel"/);
  assert.match(html, /addEventListener\("popstate"/);
  assert.match(html, /event\.key === "ArrowRight"/);
  assert.match(html, /localStorage\.getItem\("personal-learning-theme"\)/);
  assert.match(html, /localStorage\.removeItem\(themeStorageKey\)/);
  assert.match(html, /articleTitle\.focus/);
  assert.match(html, /IntersectionObserver/);
  assert.doesNotMatch(html, /addEventListener\("scroll"/);
});

test("renders a safe empty knowledge state", () => {
  const html = renderPreviewPage({
    knowledge: { categories: [] },
    documents: {}
  });

  assert.match(html, /0 个分类，0 篇文档/);
  assert.match(html, /没有可阅读的文档/);
  assert.match(html, /firstDocumentId/);
});

test("preserves the old preview on build failure", async () => {
  const root = await createPreviewFixture({ invalidMermaid: true });
  const output = path.join(root, "personal-learning-preview.html");
  await writeFile(output, "previous-preview");
  await assert.rejects(buildPreview(root, output), /Mermaid block 1/);
  assert.equal(await readFile(output, "utf8"), "previous-preview");
});
