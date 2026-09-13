import path from "node:path";
import { marked } from "marked";
import { extractMermaidBlocks } from "./markdown-document.mjs";
import { previewPageRuntime } from "./preview-page-runtime.mjs";
import { previewPageStyles } from "./preview-page-styles.mjs";
import { renderMermaid } from "./render-mermaid.mjs";

function escapeScriptData(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function renderMarkdown(source, context = { relativePath: "<inline>" }) {
  const diagrams = extractMermaidBlocks(source);
  let prepared = source;
  const rendered = [];
  for (const diagram of diagrams) {
    const token = `<!--PERSONAL_LEARN_DIAGRAM_${diagram.index}-->`;
    prepared = prepared.replace(diagram.raw, token);
    const svg = await renderMermaid(diagram.source, { ...context, index: diagram.index });
    rendered.push({ token, html: `<figure class="diagram">${svg}</figure>` });
  }
  let html = await marked.parse(prepared, { gfm: true });
  for (const diagram of rendered) html = html.replace(diagram.token, diagram.html);
  return html;
}

function flattenCategories(categories, result = []) {
  for (const category of categories) {
    result.push(category);
    flattenCategories(category.children, result);
  }
  return result;
}

function documentCategoryPaths(categories, trail = [], result = {}) {
  for (const category of categories) {
    const nextTrail = [...trail, category.title];
    for (const document of category.documents) result[document.id] = nextTrail;
    documentCategoryPaths(category.children, nextTrail, result);
  }
  return result;
}

function renderTree(categories, prefix) {
  return `<ul>${categories.map((category) => {
    const documentItems = category.documents.map((document) => `<li><a href="#${encodeURIComponent(document.id)}" data-document-id="${escapeHtml(document.id)}">${escapeHtml(document.title)}</a></li>`).join("");
    const documents = documentItems ? `<ul>${documentItems}</ul>` : "";
    const children = category.children.length ? renderTree(category.children, prefix) : "";
    const contents = `${documents}${children}`;
    const contentId = `${prefix}-category-${escapeHtml(category.id)}`;
    return `<li class="category" data-category-id="${escapeHtml(category.id)}"><button class="category-toggle" type="button" data-category-toggle="${escapeHtml(category.id)}" aria-expanded="true" aria-controls="${contentId}">${escapeHtml(category.title)}</button><div class="category-contents" id="${contentId}">${contents || '<span class="empty">暂无文档</span>'}</div></li>`;
  }).join("")}</ul>`;
}

function documentPathMap(documents) {
  return new Map(documents.map((document) => [document.relativePath, document.item.id]));
}

function rewriteDocumentLinks(content, document, paths) {
  return content.replace(/(\[[^\]]*\]\()([^)\s]+)(\))/g, (whole, open, target, close) => {
    if (/^(?:https?:|mailto:|data:|#)/i.test(target)) return whole;
    const [withoutHash] = target.split("#", 2);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(document.relativePath), withoutHash));
    const id = paths.get(resolved);
    return id
      ? `${open}#${encodeURIComponent(id)}${close}`
      : `${open}${encodeURI(resolved)}${close}`;
  });
}

export async function renderAllDocuments(model) {
  const paths = documentPathMap(model.documents);
  const result = {};
  for (const document of model.documents) {
    const content = rewriteDocumentLinks(document.parsed.content, document, paths);
    result[document.item.id] = {
      id: document.item.id,
      title: document.item.title,
      relativePath: document.relativePath,
      html: await renderMarkdown(content, { relativePath: document.relativePath })
    };
  }
  return result;
}

export function renderPreviewPage({ knowledge, documents }) {
  const firstDocumentId = Object.keys(documents)[0] ?? null;
  const categoryPaths = documentCategoryPaths(knowledge.categories);
  const documentsWithPaths = Object.fromEntries(Object.entries(documents).map(([id, document]) => [id, {
    ...document,
    categoryPath: categoryPaths[id] ?? []
  }]));
  const data = escapeScriptData({ documents: documentsWithPaths, firstDocumentId });
  const desktopTree = renderTree(knowledge.categories, "desktop");
  const mobileTree = renderTree(knowledge.categories, "mobile");
  const categoryCount = flattenCategories(knowledge.categories).length;
  const runtime = `(${previewPageRuntime.toString()})();`;

  return `<!doctype html>
<!-- 由构建脚本生成，请勿手工编辑 -->
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Personal Learn</title>
  <style>${previewPageStyles}</style>
</head>
<body>
  <a class="skip-link" href="#document-view">跳到正文</a>
  <div class="app-shell">
    <aside class="library-sidebar knowledge-tree" aria-label="知识文库">
      <header class="library-header">
        <strong class="brand-name">Personal Learn</strong>
        <span class="meta">${categoryCount} 个分类，${Object.keys(documents).length} 篇文档</span>
      </header>
      <div class="desktop-tree">${desktopTree}</div>
      <div class="theme-controls" aria-label="外观">
        <button class="theme-choice" type="button" data-theme-choice="auto" aria-pressed="true">自动</button>
        <button class="theme-choice" type="button" data-theme-choice="light" aria-pressed="false">浅色</button>
        <button class="theme-choice" type="button" data-theme-choice="dark" aria-pressed="false">深色</button>
      </div>
    </aside>
    <header class="mobile-toolbar">
      <button class="toolbar-button" type="button" data-open-sheet="library">文库</button>
      <span class="toolbar-title">Personal Learn</span>
      <button class="toolbar-button" type="button" data-open-sheet="outline">目录</button>
    </header>
    <main class="document-view" id="document-view" tabindex="-1">
      <div class="document-context" aria-label="文章分类"></div>
      <article id="document-article"></article>
    </main>
    <nav class="article-outline" aria-label="本文目录">
      <strong class="outline-title">本文目录</strong>
      <ol class="outline-list" data-outline-list="desktop"></ol>
    </nav>
  </div>
  <dialog class="mobile-sheet" id="mobile-sheet" aria-labelledby="sheet-title">
    <div class="mobile-sheet-inner">
      <div class="sheet-handle" aria-hidden="true"></div>
      <header class="sheet-header">
        <strong id="sheet-title">阅读目录</strong>
        <button class="sheet-close" type="button" data-close-sheet>关闭</button>
      </header>
      <div class="sheet-tabs" role="tablist" aria-label="目录类型">
        <button class="sheet-tab" id="library-tab" type="button" role="tab" data-sheet-tab="library" aria-controls="library-panel" aria-selected="true">知识文库</button>
        <button class="sheet-tab" id="outline-tab" type="button" role="tab" data-sheet-tab="outline" aria-controls="outline-panel" aria-selected="false">本文目录</button>
      </div>
      <section class="sheet-panel knowledge-tree" id="library-panel" role="tabpanel" aria-labelledby="library-tab" data-sheet-panel="library">${mobileTree}</section>
      <section class="sheet-panel" id="outline-panel" role="tabpanel" aria-labelledby="outline-tab" data-sheet-panel="outline" hidden>
        <ol class="outline-list" data-outline-list="mobile"></ol>
      </section>
      <div class="theme-controls" aria-label="外观">
        <button class="theme-choice" type="button" data-theme-choice="auto" aria-pressed="true">自动</button>
        <button class="theme-choice" type="button" data-theme-choice="light" aria-pressed="false">浅色</button>
        <button class="theme-choice" type="button" data-theme-choice="dark" aria-pressed="false">深色</button>
      </div>
    </div>
  </dialog>
  <script type="application/json" id="knowledge-data">${data}</script>
  <script>${runtime}</script>
</body>
</html>
`;
}
