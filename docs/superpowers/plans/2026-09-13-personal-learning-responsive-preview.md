# Personal Learning Responsive Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The repository requires explicit user authorization before invoking either skill.

**Goal:** Rebuild the generated Personal Learning preview as a responsive reading interface with a three-column PC layout, a focused H5 layout, article navigation, global light and dark themes, and accessible mobile navigation.

**Architecture:** Keep the offline single-file output and existing Markdown pipeline. Split page presentation and browser behavior into focused build-time modules, then have `render-preview.mjs` compose their source into the generated HTML. Enhance rendered article HTML in the browser without changing Markdown or the knowledge index.

**Tech Stack:** Node.js ES modules, native HTML, native CSS, browser JavaScript, `dialog`, `IntersectionObserver`, Node test runner, pnpm.

---

## Execution constraints

- Work in `/Users/jiajun/github-coding/knowledge`.
- Do not modify the existing deleted files shown by `git status`.
- Do not create a Git worktree unless the user explicitly authorizes the `using-git-worktrees` skill.
- Do not commit, push, merge, or rewrite history without a separate explicit user instruction.
- Modify the generator, not `personal-learning-preview.html` by hand.
- Do not modify Markdown content or `personal-learning-knowledge.json`.
- Do not add dependencies.
- Keep every validation claim scoped. Node tests and build checks do not prove actual PC or H5 rendering.

## File map

### Create

- `scripts/lib/preview-page-styles.mjs`
  - Owns all semantic design tokens, responsive layout rules, long-form article styles, dialog styles, focus states, and reduced-motion behavior.
- `scripts/lib/preview-page-runtime.mjs`
  - Owns document routing, deterministic heading IDs, article outline creation, active-section observation, mobile dialog behavior, category synchronization, theme persistence, and content enhancement.

### Modify

- `scripts/lib/render-preview.mjs`
  - Continues to own Markdown rendering, internal-link rewriting, category-tree HTML, embedded document data, and full-page HTML composition.
  - Imports and embeds the new style and runtime modules.
- `tests/personal-learning/preview-builder.test.mjs`
  - Adds structural contract tests for the responsive shell, style tokens, runtime behavior, backward-compatible routing, and offline output.
- `personal-learning-preview.html`
  - Recreated only by `pnpm build:preview` after source tests pass.

### Reference only

- `docs/superpowers/specs/2026-09-13-personal-learning-responsive-preview-design.md`
  - Approved behavior and visual contract.
- `scripts/build-preview.mjs`
  - Existing atomic build entry point. No change expected.
- `scripts/check.mjs`
  - Existing repository-wide validation entry point. No change expected.

## Task 1: Lock the responsive shell contract with failing tests

**Files:**

- Modify: `tests/personal-learning/preview-builder.test.mjs`
- Test: `tests/personal-learning/preview-builder.test.mjs`

- [ ] **Step 1: Expand the preview fixture with real long-form elements**

In `createPreviewFixture`, replace the existing `document` assignment with this complete template string. Keep the existing `diagram` variable and invalid Mermaid switch.

```js
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
```

This fixture gives later tests a real H2, quote, table, code block, and wide visual without creating a second fixture builder.

- [ ] **Step 2: Add a failing semantic-shell test**

Add this test after the existing `builds an offline tree and hash-routed documents` test:

```js
test("builds the responsive reader shell", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");

  assert.match(html, /class="skip-link" href="#document-view"/);
  assert.match(html, /class="app-shell"/);
  assert.match(html, /class="library-sidebar"/);
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
```

- [ ] **Step 3: Add a failing responsive-style test**

Add this test immediately after the semantic-shell test:

```js
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
```

- [ ] **Step 4: Run the new tests and verify the expected failure**

Run:

```bash
pnpm exec node --test tests/personal-learning/preview-builder.test.mjs
```

Expected result: the existing tests pass, while the two new tests fail because `.skip-link`, `.app-shell`, `.mobile-toolbar`, `.article-outline`, `.mobile-sheet`, and the new design tokens do not exist yet.

- [ ] **Step 5: Record a no-commit checkpoint**

Run:

```bash
git status --short
```

Expected result: only `tests/personal-learning/preview-builder.test.mjs` is modified by this task, in addition to the pre-existing user deletions and the approved untracked design and plan documents. Do not stage or commit.

## Task 2: Add the responsive visual system and semantic page shell

**Files:**

- Create: `scripts/lib/preview-page-styles.mjs`
- Modify: `scripts/lib/render-preview.mjs`
- Test: `tests/personal-learning/preview-builder.test.mjs`

- [ ] **Step 1: Create the style module with one global token system**

Create `scripts/lib/preview-page-styles.mjs` with this export shape:

```js
export const previewPageStyles = String.raw`
  :root {
    color-scheme: light dark;
    --canvas: #f3f6f5;
    --paper: #fbfcfb;
    --nav: #edf2f2;
    --ink: #172c33;
    --muted: #607178;
    --line: #d7e0e1;
    --accent: #176b63;
    --accent-soft: #e5f1ef;
    --code: #1b2a30;
    --code-ink: #dfecea;
    --focus: #176b63;
    --shadow: 0 18px 48px rgb(31 52 58 / 0.12);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --canvas: #10191d;
      --paper: #162227;
      --nav: #132025;
      --ink: #e7efed;
      --muted: #a9b6b7;
      --line: #2c3e43;
      --accent: #73c4b5;
      --accent-soft: #203c3a;
      --code: #0e171a;
      --code-ink: #d8e8e5;
      --focus: #8bd0c3;
      --shadow: 0 18px 48px rgb(3 10 12 / 0.34);
    }
  }

  :root[data-theme="light"] {
    color-scheme: light;
    --canvas: #f3f6f5;
    --paper: #fbfcfb;
    --nav: #edf2f2;
    --ink: #172c33;
    --muted: #607178;
    --line: #d7e0e1;
    --accent: #176b63;
    --accent-soft: #e5f1ef;
    --code: #1b2a30;
    --code-ink: #dfecea;
    --focus: #176b63;
    --shadow: 0 18px 48px rgb(31 52 58 / 0.12);
  }

  :root[data-theme="dark"] {
    color-scheme: dark;
    --canvas: #10191d;
    --paper: #162227;
    --nav: #132025;
    --ink: #e7efed;
    --muted: #a9b6b7;
    --line: #2c3e43;
    --accent: #73c4b5;
    --accent-soft: #203c3a;
    --code: #0e171a;
    --code-ink: #d8e8e5;
    --focus: #8bd0c3;
    --shadow: 0 18px 48px rgb(3 10 12 / 0.34);
  }

  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    min-width: 320px;
    color: var(--ink);
    background: var(--canvas);
    font: 17px/1.85 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    overflow-x: hidden;
  }
  button, input { font: inherit; }
  button, a { -webkit-tap-highlight-color: transparent; }
  button:focus-visible, a:focus-visible, [tabindex="-1"]:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 3px;
  }
  .skip-link {
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 40;
    padding: 10px 14px;
    border-radius: 8px;
    color: var(--paper);
    background: var(--ink);
    transform: translateY(-160%);
  }
  .skip-link:focus { transform: translateY(0); }
  .app-shell { min-height: 100dvh; background: var(--paper); }
  .library-sidebar, .article-outline { display: none; }
  .mobile-toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr) 68px;
    align-items: center;
    min-height: 56px;
    padding: env(safe-area-inset-top) 12px 0;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
  }
  .toolbar-title {
    overflow: hidden;
    color: var(--ink);
    font-size: 14px;
    font-weight: 720;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toolbar-button, .theme-choice, .sheet-tab, .sheet-close {
    min-height: 44px;
    border: 1px solid var(--line);
    border-radius: 9px;
    color: var(--accent);
    background: var(--paper);
    cursor: pointer;
  }
  .toolbar-button:active, .theme-choice:active, .sheet-tab:active, .sheet-close:active {
    transform: translateY(1px);
  }
  .document-view { min-width: 0; padding: 30px 18px 88px; background: var(--paper); }
  .library-header { display: grid; gap: 3px; margin-bottom: 18px; }
  .brand-name { color: var(--ink); font-size: 20px; letter-spacing: -0.02em; }
  .meta { color: var(--muted); font-size: 13px; }
  .document-context { max-width: 760px; margin: 0 auto 12px; color: var(--accent); font-size: 13px; font-weight: 700; }
  article { max-width: 760px; margin: 0 auto; overflow-wrap: anywhere; }
  article h1 { margin: 0 0 22px; font-size: clamp(28px, 8vw, 34px); line-height: 1.25; letter-spacing: -0.035em; }
  article h2 { margin: 2.4em 0 0.75em; font-size: clamp(23px, 6vw, 30px); line-height: 1.35; letter-spacing: -0.025em; scroll-margin-top: 76px; }
  article h3 { margin: 2em 0 0.7em; font-size: clamp(19px, 5vw, 23px); line-height: 1.4; scroll-margin-top: 76px; }
  article p, article li { color: var(--ink); }
  article a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 0.2em; }
  article img { max-width: 100%; height: auto; }
  article blockquote { margin: 1.5em 0; padding: 14px 16px; border-left: 3px solid var(--accent); border-radius: 0 10px 10px 0; color: var(--ink); background: var(--accent-soft); }
  article pre { max-width: 100%; margin: 1.5em 0; padding: 18px; overflow: auto; border-radius: 12px; color: var(--code-ink); background: var(--code); }
  article code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  article :not(pre) > code { padding: 0.12em 0.35em; border-radius: 5px; background: var(--accent-soft); }
  .table-scroll, .diagram { max-width: 100%; margin: 1.6em 0; overflow: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
  .table-scroll table { width: 100%; min-width: 680px; border-collapse: collapse; }
  th, td { padding: 10px 12px; border: 0; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  th { color: var(--muted); background: var(--canvas); font-size: 0.88em; }
  .diagram { padding: 16px; background: #fbfcfb; }
  .diagram svg { display: block; max-width: 100%; height: auto; margin: auto; }
  .diagram.is-wide svg { min-width: 640px; }
  .empty, .error, .outline-empty { color: var(--muted); }
  .mobile-sheet { width: min(100%, 560px); max-height: min(82dvh, 760px); margin: auto 0 0 auto; padding: 0; border: 0; border-radius: 16px 16px 0 0; color: var(--ink); background: var(--paper); box-shadow: var(--shadow); }
  .mobile-sheet::backdrop { background: rgb(18 35 40 / 0.44); }
  .mobile-sheet-inner { display: flex; max-height: min(82dvh, 760px); flex-direction: column; padding: 12px 16px calc(20px + env(safe-area-inset-bottom)); }
  .sheet-handle { width: 40px; height: 4px; margin: 0 auto 12px; border-radius: 4px; background: var(--line); }
  .sheet-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sheet-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 12px 0; padding: 4px; border-radius: 12px; background: var(--nav); }
  .sheet-tab[aria-selected="true"], .theme-choice[aria-pressed="true"] { color: var(--paper); background: var(--accent); }
  .sheet-panel { min-height: 0; overflow: auto; }
  .sheet-panel[hidden] { display: none; }
  .knowledge-tree ul { margin: 0; padding-left: 16px; list-style: none; }
  .knowledge-tree > ul { padding-left: 0; }
  .category-toggle { width: 100%; min-height: 44px; padding: 8px; border: 0; color: var(--ink); background: transparent; text-align: left; font-weight: 700; cursor: pointer; }
  .category-toggle::after { content: "收起"; float: right; color: var(--muted); font-size: 12px; font-weight: 500; }
  .category-toggle[aria-expanded="false"]::after { content: "展开"; }
  .category-toggle[aria-expanded="false"] + .category-contents { display: none; }
  .knowledge-tree a, .outline-list a { display: block; margin: 2px 0; padding: 8px; border-radius: 8px; color: var(--muted); text-decoration: none; }
  .knowledge-tree a:hover, .knowledge-tree a[aria-current="page"], .outline-list a:hover, .outline-list a[aria-current="location"] { color: var(--accent); background: var(--accent-soft); }
  .theme-controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .library-sidebar > .theme-controls { margin-top: auto; padding-top: 16px; }
  .outline-title { color: var(--ink); font-size: 14px; }
  .outline-list { margin: 14px 0 0; padding: 0; list-style: none; }
  .outline-level-3 { padding-left: 12px; }

  @media (min-width: 768px) and (max-width: 1199px) {
    .app-shell { display: grid; grid-template-columns: minmax(250px, 300px) minmax(0, 1fr); grid-template-rows: auto 1fr; }
    .library-sidebar { position: sticky; top: 0; grid-column: 1; grid-row: 1 / -1; display: flex; height: 100dvh; flex-direction: column; overflow: auto; padding: 22px 16px; border-right: 1px solid var(--line); background: var(--nav); }
    .mobile-toolbar { grid-column: 2; grid-row: 1; }
    .mobile-toolbar [data-open-sheet="library"] { visibility: hidden; }
    .document-view { grid-column: 2; grid-row: 2; padding: 46px clamp(28px, 6vw, 68px) 96px; }
  }

  @media (min-width: 1200px) {
    .app-shell { display: grid; grid-template-columns: clamp(260px, 20vw, 320px) minmax(0, 1fr) clamp(200px, 16vw, 260px); }
    .library-sidebar, .article-outline { position: sticky; top: 0; display: flex; height: 100dvh; flex-direction: column; overflow: auto; padding: 24px 18px; }
    .library-sidebar { border-right: 1px solid var(--line); background: var(--nav); }
    .article-outline { border-left: 1px solid var(--line); background: var(--paper); }
    .mobile-toolbar { display: none; }
    .document-view { padding: 58px clamp(36px, 6vw, 88px) 110px; }
    article h1 { font-size: clamp(34px, 4vw, 46px); line-height: 1.2; }
    article h2, article h3 { scroll-margin-top: 24px; }
  }

  @media (max-width: 767px) {
    article pre { margin-right: -18px; margin-left: -18px; border-radius: 0; }
    .table-scroll, .diagram { margin-right: -18px; margin-left: -18px; border-right: 0; border-left: 0; border-radius: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
  }
`;
```

Before finishing this step, verify the string contains no long dash characters and no second accent hue.

- [ ] **Step 2: Make category trees reusable for desktop and mobile**

Change `renderTree` in `render-preview.mjs` to accept an ID prefix and emit synchronization hooks:

```js
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
```

Call it twice inside `renderPreviewPage`:

```js
const desktopTree = renderTree(knowledge.categories, "desktop");
const mobileTree = renderTree(knowledge.categories, "mobile");
```

- [ ] **Step 3: Add category paths to embedded document data**

Add this helper beside `flattenCategories`:

```js
function documentCategoryPaths(categories, trail = [], result = {}) {
  for (const category of categories) {
    const nextTrail = [...trail, category.title];
    for (const document of category.documents) result[document.id] = nextTrail;
    documentCategoryPaths(category.children, nextTrail, result);
  }
  return result;
}
```

Then replace the current `data` assignment inside `renderPreviewPage`:

```js
const categoryPaths = documentCategoryPaths(knowledge.categories);
const documentsWithPaths = Object.fromEntries(Object.entries(documents).map(([id, document]) => [id, {
  ...document,
  categoryPath: categoryPaths[id] ?? []
}]));
const data = escapeScriptData({ documents: documentsWithPaths, firstDocumentId });
```

- [ ] **Step 4: Replace the old two-column HTML shell**

Import the style and runtime modules:

```js
import { previewPageRuntime } from "./preview-page-runtime.mjs";
import { previewPageStyles } from "./preview-page-styles.mjs";
```

The runtime module is created in Task 4. Until then, add a temporary exported empty function in `preview-page-runtime.mjs`:

```js
export function previewPageRuntime() {}
```

Replace the existing `<style>`, body shell, and inline behavior script with this composition. Keep the existing doctype, generated-file comment, language, charset, viewport, and title.

```js
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
```

- [ ] **Step 5: Run the two new tests**

Run:

```bash
pnpm exec node --test tests/personal-learning/preview-builder.test.mjs
```

Expected result: the semantic-shell and responsive-style tests pass. The existing offline test may require selector updates from `.category > button` to `.category-toggle`; update only assertions that describe retired markup.

- [ ] **Step 6: Run a source cleanliness check**

Run:

```bash
rg -n $'\u2014|\u2013|#[0-9a-fA-F]{6}' scripts/lib/preview-page-styles.mjs scripts/lib/render-preview.mjs
```

Expected result: no long dash characters. Hex values should belong only to the approved teal and cold-neutral token families listed in the design document.

## Task 3: Lock routing, outline, dialog, and theme runtime contracts

**Files:**

- Modify: `tests/personal-learning/preview-builder.test.mjs`
- Test: `tests/personal-learning/preview-builder.test.mjs`

- [ ] **Step 1: Add a failing runtime-contract test**

Add:

```js
test("embeds backward-compatible document and section routing", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");

  assert.match(html, /function decodeHashRoute/);
  assert.match(html, /function slugifyHeading/);
  assert.match(html, /function renderDocument/);
  assert.match(html, /function buildOutline/);
  assert.match(html, /encodeURIComponent\(sectionId\)/);
  assert.match(html, /addEventListener\("hashchange"/);
  assert.match(html, /aria-current/);
});
```

- [ ] **Step 2: Add a failing interaction-contract test**

Add:

```js
test("embeds accessible dialog, theme, and section observation behavior", async () => {
  const root = await createPreviewFixture();
  const output = path.join(root, "personal-learning-preview.html");
  await buildPreview(root, output);
  const html = await readFile(output, "utf8");

  assert.match(html, /IntersectionObserver/);
  assert.match(html, /showModal/);
  assert.match(html, /addEventListener\("cancel"/);
  assert.match(html, /addEventListener\("popstate"/);
  assert.match(html, /personal-learning-theme/);
  assert.match(html, /localStorage\.getItem/);
  assert.match(html, /localStorage\.setItem/);
  assert.doesNotMatch(html, /addEventListener\(["']scroll["']/);
});
```

- [ ] **Step 3: Run the new tests and verify failure**

Run:

```bash
pnpm exec node --test tests/personal-learning/preview-builder.test.mjs
```

Expected result: the two new runtime tests fail because `previewPageRuntime` is still empty.

## Task 4: Implement the browser runtime

**Files:**

- Modify: `scripts/lib/preview-page-runtime.mjs`
- Test: `tests/personal-learning/preview-builder.test.mjs`

- [ ] **Step 1: Parse embedded data and maintain explicit runtime state**

Implement `previewPageRuntime` as a browser-only function. Start with these exact state bindings and decoding helpers:

```js
export function previewPageRuntime() {
  const knowledge = JSON.parse(document.querySelector("#knowledge-data").textContent);
  const article = document.querySelector("#document-article");
  const view = document.querySelector("#document-view");
  const context = document.querySelector(".document-context");
  const toolbarTitle = document.querySelector(".toolbar-title");
  const sheet = document.querySelector("#mobile-sheet");
  const outlineLists = [...document.querySelectorAll("[data-outline-list]")];
  const themeStorageKey = "personal-learning-theme";
  let currentDocumentId = null;
  let headingObserver = null;
  let lastSheetTrigger = null;
  let focusTarget = null;

  function safeDecode(value) {
    try { return decodeURIComponent(value); } catch { return value; }
  }

  function decodeHashRoute() {
    const [documentPart = "", ...sectionParts] = location.hash.slice(1).split("/");
    return {
      documentId: safeDecode(documentPart),
      sectionId: safeDecode(sectionParts.join("/"))
    };
  }

  function encodeHashRoute(documentId, sectionId = "") {
    const documentPart = encodeURIComponent(documentId);
    return sectionId ? `#${documentPart}/${encodeURIComponent(sectionId)}` : `#${documentPart}`;
  }
```

Keep every later helper inside this function so stringifying it produces a self-contained offline runtime.

- [ ] **Step 2: Generate deterministic heading IDs**

Add these helpers inside `previewPageRuntime`:

```js
  function slugifyHeading(value, fallback) {
    const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN")
      .replace(/\s+/gu, "-")
      .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized || fallback;
  }

  function prepareHeadings() {
    const title = article.querySelector("h1");
    if (title) {
      title.id = "document-title";
      title.tabIndex = -1;
    }

    const seen = new Map();
    return [...article.querySelectorAll("h2, h3")].map((heading, index) => {
      const base = slugifyHeading(heading.textContent, `section-${index + 1}`);
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      heading.id = count === 1 ? base : `${base}-${count}`;
      heading.tabIndex = -1;
      return heading;
    });
  }
```

- [ ] **Step 3: Enhance wide article content without changing semantics**

Add:

```js
  function enhanceArticleContent() {
    article.querySelectorAll("table").forEach((table) => {
      if (table.parentElement.classList.contains("table-scroll")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table-scroll";
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "可横向滚动的数据表格");
      table.before(wrapper);
      wrapper.append(table);
    });

    article.querySelectorAll(".diagram svg").forEach((svg) => {
      const width = svg.viewBox?.baseVal?.width ?? 0;
      svg.closest(".diagram")?.classList.toggle("is-wide", width > 620);
    });
  }
```

This wraps rather than restyles the table element, preserving native row and cell semantics.

- [ ] **Step 4: Build both article outlines from the same heading list**

Add:

```js
  function buildOutline(headings, documentId) {
    for (const list of outlineLists) {
      list.replaceChildren();
      if (!headings.length) {
        const item = document.createElement("li");
        item.className = "outline-empty";
        item.textContent = "本文没有可跳转章节";
        list.append(item);
        continue;
      }

      for (const heading of headings) {
        const item = document.createElement("li");
        item.className = heading.tagName === "H3" ? "outline-level-3" : "outline-level-2";
        const link = document.createElement("a");
        link.href = encodeHashRoute(documentId, heading.id);
        link.dataset.sectionId = heading.id;
        link.textContent = heading.textContent;
        link.addEventListener("click", () => {
          focusTarget = "section";
          closeSheetForNavigation();
        });
        item.append(link);
        list.append(item);
      }
    }
  }
```

- [ ] **Step 5: Observe the active section without a scroll listener**

Add:

```js
  function setActiveSection(sectionId) {
    document.querySelectorAll("[data-section-id]").forEach((link) => {
      if (link.dataset.sectionId === sectionId) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function observeHeadings(headings) {
    headingObserver?.disconnect();
    headingObserver = null;
    if (!headings.length || !("IntersectionObserver" in window)) return;
    headingObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: "-16% 0px -70% 0px", threshold: [0, 1] });
    headings.forEach((heading) => headingObserver.observe(heading));
  }
```

- [ ] **Step 6: Implement global theme state**

Add:

```js
  function readTheme() {
    try {
      const value = localStorage.getItem(themeStorageKey);
      return ["light", "dark"].includes(value) ? value : "auto";
    } catch {
      return "auto";
    }
  }

  function applyTheme(value, persist = true) {
    if (value === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === value));
    });
    if (!persist) return;
    try {
      if (value === "auto") localStorage.removeItem(themeStorageKey);
      else localStorage.setItem(themeStorageKey, value);
    } catch {
      // System theme remains active when storage is unavailable.
    }
  }
```

Bind every `[data-theme-choice]` button to `applyTheme(button.dataset.themeChoice)`, then call `applyTheme(readTheme(), false)` during startup.

- [ ] **Step 7: Implement category synchronization**

Add:

```js
  document.querySelectorAll("[data-category-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const categoryId = button.dataset.categoryToggle;
      const expanded = button.getAttribute("aria-expanded") !== "true";
      document.querySelectorAll("[data-category-toggle]").forEach((peer) => {
        if (peer.dataset.categoryToggle === categoryId) peer.setAttribute("aria-expanded", String(expanded));
      });
    });
  });
```

Do not synchronize DOM focus or scroll positions between the two trees.

- [ ] **Step 8: Implement the mobile dialog and browser-back behavior**

Add `selectSheetPanel`, `openSheet`, `closeSheet`, and `closeSheetForNavigation` with these rules:

```js
  function selectSheetPanel(name) {
    document.querySelectorAll("[data-sheet-tab]").forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.sheetTab === name));
    });
    document.querySelectorAll("[data-sheet-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.sheetPanel !== name;
    });
  }

  function restoreSheetFocus() {
    const target = lastSheetTrigger;
    lastSheetTrigger = null;
    target?.focus({ preventScroll: true });
  }

  function openSheet(name, trigger) {
    selectSheetPanel(name);
    lastSheetTrigger = trigger;
    if (typeof sheet.showModal === "function") sheet.showModal();
    else sheet.setAttribute("open", "");
    if (!history.state?.personalLearnSheet) {
      history.pushState({ ...history.state, personalLearnSheet: true }, "", location.href);
    }
  }

  function closeSheet(fromHistory = false) {
    if (!sheet.open && !sheet.hasAttribute("open")) return;
    if (typeof sheet.close === "function") sheet.close();
    else sheet.removeAttribute("open");
    const shouldReturnHistory = !fromHistory && history.state?.personalLearnSheet;
    restoreSheetFocus();
    if (shouldReturnHistory) history.back();
  }

  function closeSheetForNavigation() {
    if (!sheet.open && !sheet.hasAttribute("open")) return;
    if (typeof sheet.close === "function") sheet.close();
    else sheet.removeAttribute("open");
    if (history.state?.personalLearnSheet) {
      const nextState = { ...history.state };
      delete nextState.personalLearnSheet;
      history.replaceState(nextState, "", location.href);
    }
    restoreSheetFocus();
  }
```

Bind controls:

```js
  document.querySelectorAll("[data-open-sheet]").forEach((button) => {
    button.addEventListener("click", () => openSheet(button.dataset.openSheet, button));
  });
  document.querySelector("[data-close-sheet]").addEventListener("click", () => closeSheet());
  document.querySelectorAll("[data-sheet-tab]").forEach((button) => {
    button.addEventListener("click", () => selectSheetPanel(button.dataset.sheetTab));
  });
  const sheetTabs = [...document.querySelectorAll("[data-sheet-tab]")];
  sheetTabs.forEach((button, index) => {
    button.addEventListener("keydown", (event) => {
      const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!direction && !["Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? sheetTabs.length - 1
          : (index + direction + sheetTabs.length) % sheetTabs.length;
      const nextTab = sheetTabs[nextIndex];
      selectSheetPanel(nextTab.dataset.sheetTab);
      nextTab.focus();
    });
  });
  sheet.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSheet();
  });
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) closeSheet();
  });
  window.addEventListener("popstate", () => {
    if (sheet.open || sheet.hasAttribute("open")) closeSheet(true);
  });
```

- [ ] **Step 9: Render documents and preserve old hashes**

Add:

```js
  function updateDocumentLinks(documentId) {
    document.querySelectorAll("[data-document-id]").forEach((link) => {
      if (link.dataset.documentId === documentId) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function renderDocument() {
    const route = decodeHashRoute();
    const documentId = knowledge.documents[route.documentId] ? route.documentId : knowledge.firstDocumentId;
    const selected = documentId ? knowledge.documents[documentId] : null;

    updateDocumentLinks(documentId);
    if (!selected) {
      headingObserver?.disconnect();
      article.innerHTML = '<div class="error"><h1 id="document-title" tabindex="-1">暂无可显示内容</h1><p>知识索引中没有可显示的文档。</p></div>';
      context.textContent = "";
      toolbarTitle.textContent = "Personal Learn";
      outlineLists.forEach((list) => list.replaceChildren());
      document.title = "Personal Learn";
      currentDocumentId = null;
      return;
    }

    const changed = currentDocumentId !== documentId;
    let headings = [...article.querySelectorAll("h2, h3")];
    if (changed) {
      article.innerHTML = selected.html;
      enhanceArticleContent();
      headings = prepareHeadings();
      buildOutline(headings, documentId);
      observeHeadings(headings);
      currentDocumentId = documentId;
    }

    context.textContent = selected.categoryPath.join(" / ");
    toolbarTitle.textContent = selected.title;
    document.title = `${selected.title} | Personal Learn`;

    requestAnimationFrame(() => {
      const section = route.sectionId ? document.getElementById(route.sectionId) : null;
      if (section) {
        section.scrollIntoView({ block: "start" });
        setActiveSection(section.id);
        if (focusTarget === "section") section.focus({ preventScroll: true });
      } else if (changed) {
        view.scrollIntoView({ block: "start" });
        if (focusTarget === "document") article.querySelector("h1")?.focus({ preventScroll: true });
      }
      focusTarget = null;
    });
  }
```

Bind document links before startup:

```js
  document.querySelectorAll("[data-document-id]").forEach((link) => {
    link.addEventListener("click", () => {
      focusTarget = "document";
      closeSheetForNavigation();
    });
  });
  window.addEventListener("hashchange", renderDocument);
  renderDocument();
}
```

- [ ] **Step 10: Run the runtime tests**

Run:

```bash
pnpm exec node --test tests/personal-learning/preview-builder.test.mjs
```

Expected result: all preview-builder tests pass. If a regex fails because `Function.prototype.toString()` preserves different spacing, adjust the regex without weakening the behavioral contract.

- [ ] **Step 11: Check for forbidden continuous scroll behavior**

Run:

```bash
rg -n "addEventListener\([\"']scroll|window\.scrollY|requestAnimationFrame\([^)]*scroll" scripts/lib/preview-page-runtime.mjs scripts/lib/render-preview.mjs
```

Expected result: no matches.

## Task 5: Add explicit empty-state and offline-output tests

**Files:**

- Modify: `tests/personal-learning/preview-builder.test.mjs`
- Test: `tests/personal-learning/preview-builder.test.mjs`

- [ ] **Step 1: Import `renderPreviewPage`**

Change the existing import to:

```js
import { renderMarkdown, renderPreviewPage } from "../../scripts/lib/render-preview.mjs";
```

- [ ] **Step 2: Add an empty-knowledge test**

Add:

```js
test("renders a safe empty knowledge state", () => {
  const html = renderPreviewPage({
    knowledge: { categories: [] },
    documents: {}
  });

  assert.match(html, /0 个分类，0 篇文档/);
  assert.match(html, /暂无可显示内容/);
  assert.match(html, /knowledge-data/);
});
```

The `暂无可显示内容` string is part of the embedded runtime source, so it remains testable without adding a DOM test dependency.

- [ ] **Step 3: Strengthen the existing offline-output assertion**

Keep the existing no-external-resource assertion and add:

```js
assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|@import\s+url/);
```

This protects the single-file offline contract after splitting source modules.

- [ ] **Step 4: Run the complete preview test file**

Run:

```bash
pnpm exec node --test tests/personal-learning/preview-builder.test.mjs
```

Expected result: all tests pass.

## Task 6: Regenerate the checked-in preview and run automated checks

**Files:**

- Modify by generator: `personal-learning-preview.html`
- Verify: all files in scope

- [ ] **Step 1: Confirm source changes are limited to the approved scope**

Run:

```bash
git status --short
```

Expected result: the source changes for this feature are limited to the two new `scripts/lib/preview-page-*.mjs` files, `scripts/lib/render-preview.mjs`, the preview test file, the approved design and plan documents, and the pre-existing user deletions.

- [ ] **Step 2: Run the focused tests before regenerating the large artifact**

Run:

```bash
pnpm test
```

Expected result: all Node tests pass.

- [ ] **Step 3: Build the preview through the official entry point**

Run:

```bash
pnpm build:preview
```

Expected result:

```text
PASS: built personal-learning-preview.html with 23 documents
```

The exact document count may increase if the user added indexed documents after this plan was written. A changed count is acceptable only if `personal-learning-knowledge.json` already changed outside this task.

- [ ] **Step 4: Run the full repository validator**

Run:

```bash
pnpm check
```

Expected result:

```text
PASS: repository checks completed
```

- [ ] **Step 5: Check patch formatting and generated-file provenance**

Run:

```bash
git diff --check
```

Expected result: no output.

Run:

```bash
sed -n '1,8p' personal-learning-preview.html
```

Expected result: the generated-file warning remains directly below the doctype.

- [ ] **Step 6: Scan only newly authored interface copy for forbidden dash characters**

Run:

```bash
rg -n $'\u2014|\u2013' scripts/lib/preview-page-styles.mjs scripts/lib/preview-page-runtime.mjs scripts/lib/render-preview.mjs
```

Expected result: no matches. Do not scan or rewrite existing Markdown article content as part of this feature.

## Task 7: Verify real PC and H5 rendering

**Files:**

- Verify: `personal-learning-preview.html`
- Optional evidence directory outside the repository: `/Users/jiajun/.codex/visualizations/2026/09/13/01a09af9-e1b7-70d2-97b6-57790def7132/qa/`

- [ ] **Step 1: Serve the generated file locally**

Start a local static server from the repository without writing server artifacts into it:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Expected result: `http://127.0.0.1:4173/personal-learning-preview.html` loads the generated page. Keep this command in a managed terminal session so it can be stopped after QA.

- [ ] **Step 2: Capture the PC layout at 1440 x 1000**

Use the user-authorized browser capability to open the local page and set the viewport to `1440 x 1000`.

Verify with DOM measurements and a screenshot:

- `.library-sidebar` is visible and between `260px` and `320px` wide.
- `.article-outline` is visible and between `200px` and `260px` wide.
- `article` is no wider than `760px`.
- `.mobile-toolbar` is not displayed.
- `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

Expected result: three stable columns, readable center content, no page-level horizontal overflow.

- [ ] **Step 3: Capture the medium layout at 1024 x 768**

Verify:

- `.library-sidebar` is visible.
- `.article-outline` is not displayed.
- `.mobile-toolbar` is visible only as the compact reading toolbar for the article column.
- The library button is hidden because the desktop library is already present.
- The outline button opens the shared dialog.
- The article remains no wider than `760px`.

Expected result: two columns with no compressed right outline.

- [ ] **Step 4: Capture the H5 layout at 390 x 844 and 360 x 800**

At both sizes verify:

- `.library-sidebar` and `.article-outline` are not displayed.
- `.mobile-toolbar` is visible and sticky.
- Computed paragraph font size is at least `17px`.
- The full category tree does not appear before the article.
- Both toolbar buttons have a minimum height of `44px`.
- The page has no horizontal overflow.
- A code block scrolls within itself.
- A table scrolls within `.table-scroll`.
- A wide Mermaid diagram scrolls within `.diagram`.

Expected result: the article begins immediately below the toolbar and remains readable without zooming.

- [ ] **Step 5: Verify document and section navigation**

In both PC and H5 layouts:

1. Open `#vue-reactivity` and verify the correct article title.
2. Select the `核心模型` outline link.
3. Verify the URL becomes `#vue-reactivity/%E6%A0%B8%E5%BF%83%E6%A8%A1%E5%9E%8B` or the browser-equivalent encoded form.
4. Reload the page.
5. Verify the same article loads and the section is aligned below the sticky toolbar.
6. Open an existing old-style document hash with no section and verify it still loads.

Expected result: old links remain valid and new section links are reload-safe.

- [ ] **Step 6: Verify dialog interaction and focus**

At `390 x 844`:

1. Focus and activate `文库` using the keyboard.
2. Verify the dialog opens on the knowledge-library tab.
3. Press the right arrow or click `本文目录` and verify the visible panel changes.
4. Press Esc and verify the dialog closes and focus returns to `文库`.
5. Open the dialog again, then use browser back and verify only the dialog closes.
6. Open the dialog and select another document. Verify the dialog closes, the article changes, the page returns to the article top, and focus moves to its H1.

Expected result: pointer, keyboard, Esc, and browser-back flows all work without trapping the user.

- [ ] **Step 7: Verify themes**

At PC and H5 sizes:

1. Set the operating browser preference to light and choose `自动`.
2. Verify the light tokens are active.
3. Set the preference to dark and verify `自动` follows it.
4. Choose `浅色` while the browser preference is dark and verify the page remains light.
5. Reload and verify the manual selection persists.
6. Choose `自动`, reload, and verify the stored manual preference is removed.
7. Inspect links, buttons, quotes, inline code, code blocks, table headers, and focus outlines for readable contrast.

Expected result: one global theme is active at a time, and the same teal hue remains the only accent family.

- [ ] **Step 8: Verify representative real documents**

Use at least these document types from the current index:

- A long conceptual article with many H2 sections.
- A document with a wide table.
- A document with a long code block.
- A document with Mermaid diagrams.
- The apparel categories article, which contains several wide tables.

Expected result: the layout works across content types, not only the default fixture or first article.

- [ ] **Step 9: Stop the local server**

Send an interrupt to the managed terminal session.

Expected result: port `4173` is no longer listening. Do not delete screenshots or visual evidence unless the user asks.

## Task 8: Final scope and quality audit

**Files:**

- Verify: `scripts/lib/preview-page-styles.mjs`
- Verify: `scripts/lib/preview-page-runtime.mjs`
- Verify: `scripts/lib/render-preview.mjs`
- Verify: `tests/personal-learning/preview-builder.test.mjs`
- Verify: `personal-learning-preview.html`

- [ ] **Step 1: Re-run all automated checks after browser-driven fixes**

Run:

```bash
pnpm test
pnpm build:preview
pnpm check
git diff --check
```

Expected result: every command passes and the preview rebuild reports the current indexed document count.

- [ ] **Step 2: Audit the final diff without inspecting the 3.25 MB artifact line-by-line**

Run:

```bash
git diff --stat
git diff -- scripts/lib/preview-page-styles.mjs scripts/lib/preview-page-runtime.mjs scripts/lib/render-preview.mjs tests/personal-learning/preview-builder.test.mjs
```

Then confirm the generated artifact changed only because `pnpm build:preview` was run from the modified generator.

Expected result: no unrelated Markdown, knowledge-index, documentation deletion, or dependency change is part of the feature.

- [ ] **Step 3: Run the final pre-flight searches**

Run:

```bash
rg -n "addEventListener\([\"']scroll|window\.scrollY|h-screen|height:\s*100vh|#[0-9a-fA-F]{6}" scripts/lib/preview-page-styles.mjs scripts/lib/preview-page-runtime.mjs scripts/lib/render-preview.mjs
```

Review every match:

- No scroll listener or `window.scrollY` is allowed.
- No `100vh` layout is allowed. Use `100dvh`.
- Hex colors must belong to the approved cold-neutral and teal token set.

- [ ] **Step 4: Check acceptance criteria against evidence**

Confirm each acceptance criterion in the approved design document has either:

- a passing automated test,
- a verified DOM measurement,
- a browser interaction result,
- or a screenshot in the optional evidence directory.

Do not claim Lighthouse, production hosting, external link availability, or device-specific Safari behavior unless those checks were actually performed.

- [ ] **Step 5: Report completion without committing**

The completion report must list:

- source files created and modified,
- generated artifact rebuilt,
- exact automated commands and results,
- exact browser viewports checked,
- any validation not performed,
- confirmation that pre-existing deletions were preserved,
- confirmation that no commit or push occurred.

Stop after the report. Ask separately if the user wants a commit, branch, or other integration action.
