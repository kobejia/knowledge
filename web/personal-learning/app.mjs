import { marked } from "/_vendor/marked/marked.esm.js";
import { previewPageRuntime } from "/_app/preview-page-runtime.mjs";
import { previewPageStyles } from "/_app/preview-page-styles.mjs";
import { createWebPreviewModel, stripFrontmatter } from "/_app/model.mjs";

const indexUrl = "/personal-learning-knowledge.json";
let diagramSequence = 0;
let mermaidPromise;

function installStyles() {
  if (!document.querySelector("[data-preview-styles]")) {
    const style = document.createElement("style");
    style.dataset.previewStyles = "true";
    style.textContent = previewPageStyles;
    document.head.append(style);
  }
  document.getElementById("boot-styles")?.remove();
  document.querySelector("[data-boot-message]")?.remove();
}

function createTree(categories, prefix) {
  const list = document.createElement("ul");
  for (const category of categories) {
    const item = document.createElement("li");
    item.className = "category";
    item.dataset.categoryId = category.id;

    const button = document.createElement("button");
    const contentId = `${prefix}-category-${category.id}`;
    button.className = "category-toggle";
    button.type = "button";
    button.dataset.categoryToggle = category.id;
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", contentId);
    button.textContent = category.title;

    const contents = document.createElement("div");
    contents.className = "category-contents";
    contents.id = contentId;

    if (category.documents?.length) {
      const documents = document.createElement("ul");
      for (const entry of category.documents) {
        const documentItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${encodeURIComponent(entry.id)}`;
        link.dataset.documentId = entry.id;
        link.textContent = entry.title;
        documentItem.append(link);
        documents.append(documentItem);
      }
      contents.append(documents);
    }

    if (category.children?.length) contents.append(createTree(category.children, prefix));
    if (!contents.childElementCount) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = "暂无文档";
      contents.append(empty);
    }

    item.append(button, contents);
    list.append(item);
  }
  return list;
}

function repositoryUrl(relativePath) {
  return `/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function resolveRepositoryTarget(documentPath, target) {
  try {
    const base = new URL(repositoryUrl(documentPath), window.location.origin);
    const resolved = new URL(target, base);
    if (resolved.origin !== window.location.origin) return null;
    const encodedHash = resolved.hash.replace(/^#/, "");
    let hash = encodedHash;
    try {
      hash = decodeURIComponent(encodedHash);
    } catch {
      // Preserve a malformed fragment as text instead of failing the article.
    }
    return { path: decodeURIComponent(resolved.pathname.replace(/^\//, "")), hash };
  } catch {
    return null;
  }
}

function rewriteLocalResources(fragment, selectedDocument, model) {
  for (const link of fragment.querySelectorAll("a[href]")) {
    const target = link.getAttribute("href");
    if (!target || /^(?:https?:|mailto:|tel:)/i.test(target) || target.startsWith("//")) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
      link.removeAttribute("href");
      continue;
    }
    if (target.startsWith("#")) {
      link.href = `#${encodeURIComponent(selectedDocument.id)}/${encodeURIComponent(target.slice(1))}`;
      continue;
    }
    const resolved = resolveRepositoryTarget(selectedDocument.relativePath, target);
    if (!resolved) continue;
    const targetDocumentId = model.documentIdByPath[resolved.path];
    if (targetDocumentId) {
      link.href = resolved.hash
        ? `#${encodeURIComponent(targetDocumentId)}/${encodeURIComponent(resolved.hash)}`
        : `#${encodeURIComponent(targetDocumentId)}`;
    } else {
      link.href = repositoryUrl(resolved.path) + (resolved.hash ? `#${encodeURIComponent(resolved.hash)}` : "");
    }
  }

  for (const element of fragment.querySelectorAll("img[src], audio[src], video[src], source[src]")) {
    const target = element.getAttribute("src");
    if (!target || /^(?:https?:|data:|blob:)/i.test(target)) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) {
      element.removeAttribute("src");
      continue;
    }
    const resolved = resolveRepositoryTarget(selectedDocument.relativePath, target);
    if (resolved) element.src = repositoryUrl(resolved.path);
  }
}

async function renderDiagrams(fragment, selectedDocument) {
  const diagrams = [...fragment.querySelectorAll("pre > code.language-mermaid")];
  if (!diagrams.length) return;
  mermaidPromise ??= import("/_vendor/mermaid/mermaid.esm.min.mjs");
  const { default: mermaid } = await mermaidPromise;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });

  for (const code of diagrams) {
    const pre = code.parentElement;
    try {
      const id = `personal-learning-${selectedDocument.id}-${++diagramSequence}`.replace(/[^a-zA-Z0-9_-]/g, "-");
      const { svg } = await mermaid.render(id, code.textContent);
      const figure = document.createElement("figure");
      figure.className = "diagram";
      figure.innerHTML = svg;
      pre.replaceWith(figure);
    } catch {
      pre.insertAdjacentHTML("afterend", '<p class="error">此 Mermaid 图表无法渲染。</p>');
    }
  }
}

async function loadDocumentHtml(selectedDocument, model) {
  const response = await fetch(repositoryUrl(selectedDocument.relativePath), { cache: "no-store" });
  if (!response.ok) throw new Error(`文章“${selectedDocument.title}”读取失败（HTTP ${response.status}）。`);
  const markdown = stripFrontmatter(await response.text());
  const template = document.createElement("template");
  template.innerHTML = await marked.parse(markdown, { gfm: true });
  rewriteLocalResources(template.content, selectedDocument, model);
  await renderDiagrams(template.content, selectedDocument);
  return template.innerHTML;
}

function renderBootError(error) {
  installStyles();
  const article = document.getElementById("document-article");
  article.replaceChildren();
  const message = document.createElement("p");
  message.className = "error";
  message.textContent = error instanceof Error ? error.message : "知识库加载失败，请刷新后重试。";
  article.append(message);
  document.documentElement.dataset.appReady = "error";
}

async function start() {
  installStyles();
  const response = await fetch(indexUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`知识索引读取失败（HTTP ${response.status}）。`);
  const model = createWebPreviewModel(await response.json());
  document.querySelector("[data-library-meta]").textContent = `${model.categoryCount} 个分类，${Object.keys(model.documents).length} 篇文档`;
  for (const target of document.querySelectorAll("[data-knowledge-tree]")) {
    target.replaceChildren(createTree(model.categories, target.dataset.knowledgeTree));
  }
  await previewPageRuntime({
    model,
    loadDocumentHtml: (selectedDocument) => loadDocumentHtml(selectedDocument, model)
  });
  document.documentElement.dataset.appReady = "true";
}

start().catch(renderBootError);
