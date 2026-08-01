import path from "node:path";
import { marked } from "marked";
import { extractMermaidBlocks } from "./markdown-document.mjs";
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

function renderTree(categories) {
  return `<ul>${categories.map((category) => {
    const documentItems = category.documents.map((document) => `<li><a href="#${encodeURIComponent(document.id)}" data-document-id="${escapeHtml(document.id)}">${escapeHtml(document.title)}</a></li>`).join("");
    const documents = documentItems ? `<ul>${documentItems}</ul>` : "";
    const children = category.children.length ? renderTree(category.children) : "";
    const contents = `${documents}${children}`;
    return `<li class="category"><button type="button" aria-expanded="true">${escapeHtml(category.title)}</button><div class="category-contents">${contents || '<span class="empty">暂无文档</span>'}</div></li>`;
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
  const data = escapeScriptData({ documents, firstDocumentId });
  const tree = renderTree(knowledge.categories);
  const categoryCount = flattenCategories(knowledge.categories).length;
  return `<!doctype html>
<!-- 由构建脚本生成，请勿手工编辑 -->
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Personal Learn</title>
  <style>
    :root { color-scheme: light; --ink:#172033; --muted:#667085; --line:#d9dfeb; --accent:#3157d5; --paper:#fff; --nav:#f5f7fb; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:var(--paper); font:16px/1.72 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }
    .layout { display:grid; grid-template-columns:minmax(240px,320px) minmax(0,1fr); min-height:100vh; }
    aside { position:sticky; top:0; height:100vh; overflow:auto; padding:24px 18px; border-right:1px solid var(--line); background:var(--nav); }
    aside h1 { margin:0 0 4px; font-size:20px; } .meta { color:var(--muted); font-size:13px; margin-bottom:18px; }
    aside ul { list-style:none; margin:0; padding-left:14px; } aside>ul { padding:0; }
    .category>button { width:100%; border:0; padding:7px 8px; background:transparent; color:var(--ink); text-align:left; font-weight:650; cursor:pointer; }
    .category>button::before { content:"▾"; display:inline-block; width:18px; } .category>button[aria-expanded="false"]::before { content:"▸"; }
    .category>button[aria-expanded="false"]+.category-contents { display:none; }
    aside a { display:block; margin:2px 0; padding:5px 8px; border-radius:7px; color:#344054; text-decoration:none; }
    aside a:hover, aside a.active { color:var(--accent); background:#e7ecff; }
    main { min-width:0; padding:48px clamp(24px,6vw,88px) 96px; } article { max-width:920px; margin:0 auto; }
    article h1 { line-height:1.24; font-size:clamp(30px,4vw,46px); } article h2 { margin-top:2.2em; border-bottom:1px solid var(--line); }
    pre { overflow:auto; padding:16px; border-radius:10px; background:#111827; color:#e5e7eb; } code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
    :not(pre)>code { padding:.12em .35em; border-radius:4px; background:#eef1f6; }
    .table-wrap, article { overflow-wrap:anywhere; } table { display:block; width:100%; overflow:auto; border-collapse:collapse; }
    th,td { padding:8px 12px; border:1px solid var(--line); text-align:left; vertical-align:top; }
    blockquote { margin-left:0; padding-left:16px; border-left:4px solid #9badf0; color:#475467; }
    .diagram { margin:28px 0; padding:18px; overflow:auto; border:1px solid var(--line); border-radius:12px; background:#fff; }
    .diagram svg { display:block; max-width:100%; height:auto; margin:auto; }
    .empty,.error { color:var(--muted); }
    @media (max-width:760px) { .layout { grid-template-columns:1fr; } aside { position:relative; height:auto; border-right:0; border-bottom:1px solid var(--line); } main { padding:28px 18px 64px; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="knowledge-tree" aria-label="知识目录">
      <h1>Personal Learn</h1><div class="meta">${categoryCount} 个分类 · ${Object.keys(documents).length} 篇文档</div>${tree}
    </aside>
    <main class="document-view" tabindex="-1"><article></article></main>
  </div>
  <script>
    const knowledge = ${data};
    const article = document.querySelector("article");
    const view = document.querySelector("main");
    function selectDocument() {
      const requested = decodeURIComponent(location.hash.slice(1));
      const id = knowledge.documents[requested] ? requested : knowledge.firstDocumentId;
      const selected = id ? knowledge.documents[id] : null;
      document.querySelectorAll("[data-document-id]").forEach((link) => link.classList.toggle("active", link.dataset.documentId === id));
      if (!selected) {
        article.innerHTML = '<p class="error">知识索引中没有可显示的文档。</p>';
        document.title = "Personal Learn";
        return;
      }
      article.innerHTML = selected.html;
      document.title = selected.title + " · Personal Learn";
      view.focus({ preventScroll: true });
    }
    document.querySelectorAll(".category>button").forEach((button) => button.addEventListener("click", () => {
      button.setAttribute("aria-expanded", button.getAttribute("aria-expanded") === "false" ? "true" : "false");
    }));
    window.addEventListener("hashchange", selectDocument);
    selectDocument();
  </script>
</body>
</html>
`;
}
