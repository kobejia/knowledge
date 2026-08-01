import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPreview } from "../../scripts/build-preview.mjs";
import { renderMarkdown } from "../../scripts/lib/render-preview.mjs";

async function createPreviewFixture({ invalidMermaid = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "personal-learn-preview-"));
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

\`\`\`mermaid
${diagram}
\`\`\`
`;
  await writeFile(path.join(directory, "reactivity.md"), document);
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
  await writeFile(path.join(root, "personal-learn-knowledge.json"), JSON.stringify(knowledge, null, 2));
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

test("builds an offline tree and hash-routed documents", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learn-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");
  assert.match(html, /由构建脚本生成，请勿手工编辑/);
  assert.match(html, /data-document-id="vue-reactivity"/);
  assert.match(html, /\\u003csvg/);
  assert.match(html, /category-contents"><ul>/);
  assert.match(html, /addEventListener\("hashchange"/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
});

test("preserves the old preview on build failure", async () => {
  const root = await createPreviewFixture({ invalidMermaid: true });
  const output = path.join(root, "personal-learn-preview.html");
  await writeFile(output, "previous-preview");
  await assert.rejects(buildPreview(root, output), /Mermaid block 1/);
  assert.equal(await readFile(output, "utf8"), "previous-preview");
});
