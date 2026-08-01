import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateRepository } from "../../scripts/lib/knowledge-model.mjs";

const markdown = `---
title: Vue 响应式
domain: frontend
depth: advanced
created: 2026-08-01
updated: 2026-08-01
---

# Vue 响应式
`;

function baseKnowledge() {
  return {
    version: 1,
    classificationMode: "confirm",
    contentRoot: "learn",
    categories: [{
      id: "frontend",
      title: "前端",
      path: "frontend",
      documents: [],
      children: [{
        id: "frontend-vue",
        title: "Vue",
        path: "vue",
        children: [],
        documents: [{ id: "vue-reactivity", title: "Vue 响应式", path: "reactivity.md" }]
      }]
    }]
  };
}

async function fixture(mutator = () => {}) {
  const root = await mkdtemp(path.join(tmpdir(), "personal-learn-"));
  const documentPath = path.join(root, "learn/frontend/vue/reactivity.md");
  await mkdir(path.dirname(documentPath), { recursive: true });
  await writeFile(documentPath, markdown);
  const knowledge = baseKnowledge();
  await mutator({ root, knowledge, documentPath });
  await writeFile(path.join(root, "personal-learn-knowledge.json"), JSON.stringify(knowledge, null, 2));
  return root;
}

test("accepts recursive categories and advanced", async () => {
  const result = await validateRepository(await fixture());
  assert.equal(result.documents[0].relativePath, "learn/frontend/vue/reactivity.md");
});

test("rejects unknown fields and invalid classification mode", async (t) => {
  await t.test("unknown field", async () => {
    const root = await fixture(({ knowledge }) => { knowledge.preview = true; });
    await assert.rejects(validateRepository(root), /preview/);
  });
  await t.test("classification mode", async () => {
    const root = await fixture(({ knowledge }) => { knowledge.classificationMode = "manual"; });
    await assert.rejects(validateRepository(root), /classificationMode/);
  });
});

test("rejects unsafe or duplicate identities", async (t) => {
  await t.test("path traversal", async () => {
    const root = await fixture(({ knowledge }) => { knowledge.categories[0].path = ".."; });
    await assert.rejects(validateRepository(root), /path/);
  });
  await t.test("duplicate category id", async () => {
    const root = await fixture(({ knowledge }) => { knowledge.categories.push(structuredClone(knowledge.categories[0])); });
    await assert.rejects(validateRepository(root), /category id.*frontend/i);
  });
  await t.test("duplicate document id", async () => {
    const root = await fixture(({ knowledge }) => { knowledge.categories[0].children[0].documents.push({ id: "vue-reactivity", title: "副本", path: "copy.md" }); });
    await assert.rejects(validateRepository(root), /document id.*vue-reactivity/i);
  });
});

test("rejects filesystem and metadata drift", async (t) => {
  await t.test("missing indexed file", async () => {
    const root = await fixture(({ knowledge }) => { knowledge.categories[0].children[0].documents[0].path = "missing.md"; });
    await assert.rejects(validateRepository(root), /missing\.md/);
  });
  await t.test("unindexed markdown", async () => {
    const root = await fixture(async ({ root }) => { await writeFile(path.join(root, "learn/frontend/vue/extra.md"), markdown); });
    await assert.rejects(validateRepository(root), /extra\.md/);
  });
  for (const [name, from, to, expected] of [
    ["title", "title: Vue 响应式", "title: 错误标题", /title/],
    ["domain", "domain: frontend", "domain: ai", /domain/],
    ["depth", "depth: advanced", "depth: master", /depth/],
    ["date", "updated: 2026-08-01", "updated: someday", /updated/]
  ]) {
    await t.test(name, async () => {
      const root = await fixture(async ({ documentPath }) => { await writeFile(documentPath, markdown.replace(from, to)); });
      await assert.rejects(validateRepository(root), expected);
    });
  }
  await t.test("broken internal link", async () => {
    const root = await fixture(async ({ documentPath }) => { await writeFile(documentPath, `${markdown}\n[缺失](./missing.md)\n`); });
    await assert.rejects(validateRepository(root), /missing\.md/);
  });
});
