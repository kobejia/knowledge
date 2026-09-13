function safePathSegment(value, label) {
  if (typeof value !== "string" || !value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error(`${label} 包含不安全的路径片段。`);
  }
  return value;
}

function joinRepositoryPath(...segments) {
  return segments.filter(Boolean).join("/");
}

export function stripFrontmatter(source) {
  return source.replace(/^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*\r?\n/, "");
}

export function createWebPreviewModel(knowledge) {
  if (!knowledge || knowledge.contentRoot !== "learn" || !Array.isArray(knowledge.categories)) {
    throw new Error("知识索引必须以 learn 作为内容根目录。");
  }

  const documents = {};
  const documentIdByPath = {};
  let firstDocumentId = null;
  let categoryCount = 0;

  function visit(categories, parentPath, categoryTrail) {
    for (const category of categories) {
      categoryCount += 1;
      const categoryPath = joinRepositoryPath(parentPath, safePathSegment(category.path, `分类 ${category.id}`));
      const nextTrail = [...categoryTrail, category.title];

      for (const document of category.documents ?? []) {
        const id = safePathSegment(document.id, "文档 ID");
        const relativePath = joinRepositoryPath(categoryPath, safePathSegment(document.path, `文档 ${id}`));
        if (!relativePath.endsWith(".md")) throw new Error(`文档 ${id} 必须引用 Markdown 文件。`);
        if (documents[id] || documentIdByPath[relativePath]) throw new Error(`文档 ${id} 的 ID 或路径重复。`);
        documents[id] = {
          id,
          title: document.title,
          relativePath,
          categoryPath: nextTrail
        };
        documentIdByPath[relativePath] = id;
        firstDocumentId ??= id;
      }

      visit(category.children ?? [], categoryPath, nextTrail);
    }
  }

  visit(knowledge.categories, knowledge.contentRoot, []);
  return {
    categories: knowledge.categories,
    documents,
    documentIdByPath,
    firstDocumentId,
    categoryCount
  };
}
