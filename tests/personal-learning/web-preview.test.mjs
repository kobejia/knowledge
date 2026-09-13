import assert from "node:assert/strict";
import test from "node:test";
import { createWebPreviewModel, stripFrontmatter } from "../../web/personal-learning/model.mjs";

test("builds fetchable document paths from the knowledge index", () => {
  const model = createWebPreviewModel({
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
        documents: [{ id: "vue-runtime", title: "Vue Runtime", path: "runtime.md" }]
      }]
    }]
  });

  assert.equal(model.firstDocumentId, "vue-runtime");
  assert.equal(model.documents["vue-runtime"].relativePath, "learn/frontend/vue/runtime.md");
  assert.deepEqual(model.documents["vue-runtime"].categoryPath, ["前端", "Vue"]);
  assert.equal(model.documentIdByPath["learn/frontend/vue/runtime.md"], "vue-runtime");
  assert.equal(model.categoryCount, 2);
});

test("rejects paths that can escape the learn content root", () => {
  assert.throws(() => createWebPreviewModel({
    contentRoot: "learn",
    categories: [{
      id: "unsafe",
      title: "Unsafe",
      path: "..",
      documents: [],
      children: []
    }]
  }), /不安全的路径片段/);
});

test("removes YAML frontmatter before browser rendering", () => {
  const markdown = "---\ntitle: Demo\ndepth: overview\n---\n# Demo\n";
  assert.equal(stripFrontmatter(markdown), "# Demo\n");
  assert.equal(stripFrontmatter("# No frontmatter\n"), "# No frontmatter\n");
});
