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

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    min-width: 320px;
    scroll-behavior: smooth;
    background: var(--canvas);
  }

  body {
    margin: 0;
    min-width: 320px;
    overflow-x: hidden;
    color: var(--ink);
    background: var(--canvas);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 17px;
    line-height: 1.85;
    text-rendering: optimizeLegibility;
  }

  button,
  input {
    font: inherit;
  }

  button,
  a {
    -webkit-tap-highlight-color: transparent;
  }

  button:focus-visible,
  a:focus-visible,
  [tabindex="-1"]:focus-visible,
  [tabindex="0"]:focus-visible {
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

  .skip-link:focus {
    transform: translateY(0);
  }

  .app-shell {
    min-height: 100dvh;
    background: var(--paper);
  }

  .library-sidebar,
  .article-outline {
    display: none;
  }

  .library-header {
    display: grid;
    gap: 3px;
    margin-bottom: 18px;
  }

  .brand-name {
    color: var(--ink);
    font-size: 20px;
    letter-spacing: -0.02em;
  }

  .meta {
    color: var(--muted);
    font-size: 13px;
  }

  .mobile-toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr) 68px;
    align-items: center;
    min-height: calc(56px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 12px 0;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
  }

  .toolbar-title {
    overflow: hidden;
    padding: 0 8px;
    color: var(--ink);
    font-size: 14px;
    font-weight: 720;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar-button,
  .theme-choice,
  .sheet-tab,
  .sheet-close {
    min-height: 44px;
    border: 1px solid var(--line);
    border-radius: 9px;
    color: var(--accent);
    background: var(--paper);
    cursor: pointer;
  }

  .toolbar-button:hover,
  .theme-choice:hover,
  .sheet-tab:hover,
  .sheet-close:hover {
    background: var(--accent-soft);
  }

  .toolbar-button:active,
  .theme-choice:active,
  .sheet-tab:active,
  .sheet-close:active {
    transform: translateY(1px);
  }

  .document-view {
    min-width: 0;
    padding: 30px 18px 88px;
    background: var(--paper);
  }

  .document-context {
    max-width: 760px;
    min-height: 1.85em;
    margin: 0 auto 10px;
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
  }

  article {
    max-width: 760px;
    margin: 0 auto;
    overflow-wrap: anywhere;
  }

  article h1 {
    margin: 0 0 22px;
    color: var(--ink);
    font-size: clamp(28px, 8vw, 34px);
    line-height: 1.25;
    letter-spacing: -0.035em;
  }

  article h2 {
    margin: 2.4em 0 0.75em;
    color: var(--ink);
    font-size: clamp(23px, 6vw, 30px);
    line-height: 1.35;
    letter-spacing: -0.025em;
    scroll-margin-top: 76px;
  }

  article h3 {
    margin: 2em 0 0.7em;
    color: var(--ink);
    font-size: clamp(19px, 5vw, 23px);
    line-height: 1.4;
    letter-spacing: -0.015em;
    scroll-margin-top: 76px;
  }

  article h4 {
    margin: 1.8em 0 0.65em;
    color: var(--ink);
    font-size: 1.08em;
  }

  article p,
  article li {
    color: var(--ink);
  }

  article p {
    margin: 0.95em 0;
  }

  article ul,
  article ol {
    padding-left: 1.4em;
  }

  article li + li {
    margin-top: 0.42em;
  }

  article a {
    color: var(--accent);
    text-decoration-thickness: 1px;
    text-underline-offset: 0.2em;
  }

  article a:hover {
    text-decoration-thickness: 2px;
  }

  article img {
    max-width: 100%;
    height: auto;
  }

  article blockquote {
    margin: 1.5em 0;
    padding: 14px 16px;
    border-left: 3px solid var(--accent);
    border-radius: 0 10px 10px 0;
    color: var(--ink);
    background: var(--accent-soft);
  }

  article blockquote > :first-child {
    margin-top: 0;
  }

  article blockquote > :last-child {
    margin-bottom: 0;
  }

  article pre {
    max-width: 100%;
    margin: 1.5em 0;
    padding: 18px;
    overflow: auto;
    border-radius: 12px;
    color: var(--code-ink);
    background: var(--code);
    font-size: 0.88em;
    line-height: 1.72;
    tab-size: 2;
  }

  article code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  article :not(pre) > code {
    padding: 0.12em 0.35em;
    border-radius: 5px;
    color: var(--ink);
    background: var(--accent-soft);
  }

  article hr {
    margin: 2.6em 0;
    border: 0;
    border-top: 1px solid var(--line);
  }

  .table-scroll,
  .diagram {
    max-width: 100%;
    margin: 1.6em 0;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--paper);
  }

  .table-scroll table {
    width: 100%;
    min-width: 680px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 10px 12px;
    border: 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  th {
    color: var(--muted);
    background: var(--canvas);
    font-size: 0.88em;
  }

  .diagram {
    padding: 16px;
    background: #fbfcfb;
  }

  .diagram svg {
    display: block;
    max-width: 100%;
    height: auto;
    margin: auto;
  }

  .diagram.is-wide svg {
    min-width: 640px;
  }

  .empty,
  .error,
  .outline-empty {
    color: var(--muted);
  }

  .error {
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--canvas);
  }

  .document-loading {
    padding: 32px 0;
    color: var(--muted);
  }

  .knowledge-tree ul {
    margin: 0;
    padding-left: 16px;
    list-style: none;
  }

  .knowledge-tree > ul,
  .desktop-tree > ul {
    padding-left: 0;
  }

  .category-toggle {
    width: 100%;
    min-height: 44px;
    padding: 8px;
    border: 0;
    color: var(--ink);
    background: transparent;
    text-align: left;
    font-weight: 700;
    cursor: pointer;
  }

  .category-toggle::after {
    content: "收起";
    float: right;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }

  .category-toggle:hover {
    color: var(--accent);
  }

  .category-toggle[aria-expanded="false"]::after {
    content: "展开";
  }

  .category-toggle[aria-expanded="false"] + .category-contents {
    display: none;
  }

  .knowledge-tree a,
  .outline-list a {
    display: block;
    margin: 2px 0;
    padding: 8px;
    border-radius: 8px;
    color: var(--muted);
    line-height: 1.5;
    text-decoration: none;
  }

  .knowledge-tree a:hover,
  .knowledge-tree a[aria-current="page"],
  .outline-list a:hover,
  .outline-list a[aria-current="location"] {
    color: var(--accent);
    background: var(--accent-soft);
  }

  .theme-controls {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
  }

  .library-sidebar > .theme-controls {
    margin-top: auto;
    padding-top: 16px;
  }

  .theme-choice {
    padding: 6px 8px;
    font-size: 13px;
  }

  .theme-choice[aria-pressed="true"],
  .sheet-tab[aria-selected="true"] {
    color: var(--paper);
    background: var(--accent);
  }

  .outline-title {
    color: var(--ink);
    font-size: 14px;
  }

  .outline-list {
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }

  .outline-list a {
    font-size: 13px;
  }

  .outline-level-3 {
    padding-left: 12px;
  }

  .mobile-sheet {
    width: min(100%, 560px);
    max-width: none;
    max-height: min(82dvh, 760px);
    margin: auto 0 0 auto;
    padding: 0;
    border: 0;
    border-radius: 16px 16px 0 0;
    color: var(--ink);
    background: var(--paper);
    box-shadow: var(--shadow);
  }

  .mobile-sheet::backdrop {
    background: rgb(18 35 40 / 0.44);
  }

  .mobile-sheet-inner {
    display: flex;
    max-height: min(82dvh, 760px);
    flex-direction: column;
    padding: 12px 16px calc(20px + env(safe-area-inset-bottom));
  }

  .sheet-handle {
    width: 40px;
    height: 4px;
    margin: 0 auto 12px;
    border-radius: 4px;
    background: var(--line);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .sheet-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin: 12px 0;
    padding: 4px;
    border-radius: 12px;
    background: var(--nav);
  }

  .sheet-tab,
  .sheet-close {
    padding: 7px 12px;
  }

  .sheet-panel {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .sheet-panel[hidden] {
    display: none;
  }

  .mobile-sheet .theme-controls {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }

  @media (min-width: 768px) and (max-width: 1199px) {
    .app-shell {
      display: grid;
      grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
      grid-template-rows: auto 1fr;
    }

    .library-sidebar {
      position: sticky;
      top: 0;
      grid-column: 1;
      grid-row: 1 / -1;
      display: flex;
      height: 100dvh;
      flex-direction: column;
      overflow: auto;
      padding: 22px 16px;
      border-right: 1px solid var(--line);
      background: var(--nav);
    }

    .mobile-toolbar {
      grid-column: 2;
      grid-row: 1;
    }

    .mobile-toolbar [data-open-sheet="library"] {
      visibility: hidden;
    }

    .document-view {
      grid-column: 2;
      grid-row: 2;
      padding: 46px clamp(28px, 6vw, 68px) 96px;
    }
  }

  @media (min-width: 1200px) {
    .app-shell {
      display: grid;
      grid-template-columns: clamp(260px, 20vw, 320px) minmax(0, 1fr) clamp(200px, 16vw, 260px);
    }

    .library-sidebar,
    .article-outline {
      position: sticky;
      top: 0;
      display: flex;
      height: 100dvh;
      flex-direction: column;
      overflow: auto;
      padding: 24px 18px;
    }

    .library-sidebar {
      border-right: 1px solid var(--line);
      background: var(--nav);
    }

    .article-outline {
      border-left: 1px solid var(--line);
      background: var(--paper);
    }

    .mobile-toolbar {
      display: none;
    }

    .document-view {
      padding: 58px clamp(36px, 6vw, 88px) 110px;
    }

    article h1 {
      font-size: clamp(34px, 4vw, 46px);
      line-height: 1.2;
    }

    article h2,
    article h3 {
      scroll-margin-top: 24px;
    }
  }

  @media (max-width: 767px) {
    article pre {
      margin-right: -18px;
      margin-left: -18px;
      border-radius: 0;
    }

    .table-scroll,
    .diagram {
      margin-right: -18px;
      margin-left: -18px;
      border-right: 0;
      border-left: 0;
      border-radius: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }

    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;
