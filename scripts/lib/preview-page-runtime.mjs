export function previewPageRuntime() {
  const dataNode = document.getElementById("knowledge-data");
  const article = document.getElementById("document-article");
  const documentView = document.getElementById("document-view");
  const documentContext = document.querySelector(".document-context");
  const toolbarTitle = document.querySelector(".toolbar-title");
  const sheet = document.getElementById("mobile-sheet");
  const sheetTitle = document.getElementById("sheet-title");
  const outlineLists = [...document.querySelectorAll("[data-outline-list]")];
  const themeButtons = [...document.querySelectorAll("[data-theme-choice]")];
  const sheetTabs = [...document.querySelectorAll("[data-sheet-tab]")];
  const themeStorageKey = "personal-learning-theme";
  const sheetHistoryKey = "personalLearnSheet";

  const state = {
    activeDocumentId: null,
    observer: null,
    sheetOpener: null,
    pendingNavigation: null,
    focusTarget: null
  };

  function renderFatalError(message) {
    documentContext.textContent = "";
    article.replaceChildren();
    const error = document.createElement("p");
    error.className = "error";
    error.textContent = message;
    article.append(error);
  }

  let model;
  try {
    model = JSON.parse(dataNode.textContent);
  } catch {
    renderFatalError("预览数据无法读取，请重新运行构建命令。");
    return;
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function decodeHashRoute(hash = window.location.hash) {
    const raw = hash.replace(/^#/, "");
    if (!raw) {
      return { documentId: model.firstDocumentId, headingId: null };
    }
    const [documentPart, headingPart] = raw.split("/", 2);
    return {
      documentId: safeDecode(documentPart),
      headingId: headingPart ? safeDecode(headingPart) : null
    };
  }

  function encodeHashRoute(documentId, headingId = null) {
    if (!documentId) return "#";
    const documentPart = encodeURIComponent(documentId);
    return headingId
      ? "#" + documentPart + "/" + encodeURIComponent(headingId)
      : "#" + documentPart;
  }

  function slugifyHeading(text, usedIds) {
    const base = text
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
    let candidate = base;
    let index = 2;
    while (usedIds.has(candidate)) {
      candidate = base + "-" + index;
      index += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }

  function prepareHeadings() {
    const usedIds = new Set();
    return [...article.querySelectorAll("h2, h3")].map((heading) => {
      const preferredId = heading.id && !usedIds.has(heading.id)
        ? heading.id
        : slugifyHeading(heading.textContent, usedIds);
      if (heading.id && preferredId === heading.id) usedIds.add(heading.id);
      heading.id = preferredId;
      heading.setAttribute("data-heading-id", preferredId);
      heading.tabIndex = -1;
      return heading;
    });
  }

  function prepareWideContent() {
    for (const table of article.querySelectorAll("table")) {
      if (table.parentElement?.classList.contains("table-scroll")) continue;
      const wrapper = document.createElement("div");
      wrapper.className = "table-scroll";
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "可横向滚动的数据表格");
      table.before(wrapper);
      wrapper.append(table);
    }

    for (const figure of article.querySelectorAll(".diagram")) {
      const svg = figure.querySelector("svg");
      const viewBoxWidth = svg?.viewBox?.baseVal?.width ?? 0;
      const width = Number.parseFloat(svg?.getAttribute("width") ?? "0");
      figure.classList.toggle("is-wide", Math.max(viewBoxWidth, width) > 760);
      if (figure.classList.contains("is-wide")) {
        figure.tabIndex = 0;
        figure.setAttribute("role", "region");
        figure.setAttribute("aria-label", "可横向滚动的图表");
      }
    }
  }

  function setActiveHeading(headingId) {
    for (const link of document.querySelectorAll("[data-outline-heading]")) {
      if (link.dataset.outlineHeading === headingId) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  function buildOutline(headings) {
    for (const list of outlineLists) {
      list.replaceChildren();
      if (!headings.length) {
        const empty = document.createElement("li");
        empty.className = "outline-empty";
        empty.textContent = "本文没有分节";
        list.append(empty);
        continue;
      }

      for (const heading of headings) {
        const item = document.createElement("li");
        item.className = "outline-level-" + heading.tagName.slice(1);
        const link = document.createElement("a");
        link.href = encodeHashRoute(state.activeDocumentId, heading.id);
        link.dataset.outlineHeading = heading.id;
        link.textContent = heading.textContent;
        item.append(link);
        list.append(item);
      }
    }
  }

  function observeHeadings(headings) {
    state.observer?.disconnect();
    state.observer = null;
    if (!headings.length || !("IntersectionObserver" in window)) return;

    state.observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => Math.abs(left.boundingClientRect.top) - Math.abs(right.boundingClientRect.top));
      if (!visible.length) return;
      const headingId = visible[0].target.dataset.headingId;
      setActiveHeading(headingId);
      const nextHash = encodeHashRoute(state.activeDocumentId, headingId);
      if (window.location.hash !== nextHash && !sheet.open) {
        history.replaceState(history.state, "", nextHash);
      }
    }, {
      rootMargin: "-12% 0px -72% 0px",
      threshold: [0, 1]
    });

    for (const heading of headings) state.observer.observe(heading);
  }

  function setCurrentDocument(documentId) {
    for (const link of document.querySelectorAll("[data-document-id]")) {
      if (link.dataset.documentId === documentId) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  function focusRenderedTarget(heading) {
    if (!state.focusTarget) return;
    if (state.focusTarget === "heading" && heading) {
      heading.focus({ preventScroll: true });
    } else {
      documentView.focus({ preventScroll: true });
    }
    state.focusTarget = null;
  }

  function renderDocument() {
    if (!model.firstDocumentId || !Object.keys(model.documents).length) {
      state.activeDocumentId = null;
      documentContext.textContent = "";
      article.innerHTML = '<div class="error"><strong>没有可阅读的文档</strong><p>请先在 learn 目录添加 Markdown，并重新生成预览。</p></div>';
      toolbarTitle.textContent = "Personal Learn";
      buildOutline([]);
      setCurrentDocument(null);
      return;
    }

    const route = decodeHashRoute();
    const documentId = model.documents[route.documentId]
      ? route.documentId
      : model.firstDocumentId;
    const selectedDocument = model.documents[documentId];

    if (documentId !== route.documentId || !window.location.hash) {
      history.replaceState(history.state, "", encodeHashRoute(documentId));
    }

    state.activeDocumentId = documentId;
    documentContext.textContent = selectedDocument.categoryPath.join(" / ");
    article.innerHTML = selectedDocument.html;
    toolbarTitle.textContent = selectedDocument.title;
    document.title = selectedDocument.title + " | Personal Learn";
    setCurrentDocument(documentId);
    prepareWideContent();
    const headings = prepareHeadings();
    buildOutline(headings);
    observeHeadings(headings);

    const targetHeading = route.headingId
      ? headings.find((heading) => heading.id === route.headingId)
      : null;
    setActiveHeading(targetHeading?.id ?? null);

    requestAnimationFrame(() => {
      if (targetHeading) targetHeading.scrollIntoView({ block: "start" });
      else if (state.focusTarget) window.scrollTo({ top: 0, behavior: "auto" });
      focusRenderedTarget(targetHeading);
    });
  }

  function readStoredTheme() {
    try {
      return localStorage.getItem("personal-learning-theme");
    } catch {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The page remains usable when storage is unavailable.
    }
  }

  function applyTheme(theme, persist = false) {
    const choice = ["auto", "light", "dark"].includes(theme) ? theme : "auto";
    if (choice === "auto") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = choice;
    }
    for (const button of themeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === choice));
    }
    if (persist) storeTheme(choice);
  }

  function setCategoryExpanded(categoryId, expanded) {
    for (const button of document.querySelectorAll("[data-category-toggle]")) {
      if (button.dataset.categoryToggle !== categoryId) continue;
      button.setAttribute("aria-expanded", String(expanded));
    }
  }

  function selectSheetPanel(panelName, { focus = false } = {}) {
    const selectedName = panelName === "outline" ? "outline" : "library";
    for (const tab of sheetTabs) {
      const selected = tab.dataset.sheetTab === selectedName;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    }
    for (const panel of document.querySelectorAll("[data-sheet-panel]")) {
      panel.hidden = panel.dataset.sheetPanel !== selectedName;
    }
    sheetTitle.textContent = selectedName === "outline" ? "本文目录" : "知识文库";
  }

  function restoreSheetFocus() {
    const opener = state.sheetOpener;
    state.sheetOpener = null;
    if (opener?.isConnected) opener.focus();
  }

  function openSheet(panelName, opener, { pushHistory = true } = {}) {
    selectSheetPanel(panelName);
    state.sheetOpener = opener ?? state.sheetOpener;
    if (!sheet.open) sheet.showModal();
    if (pushHistory && !history.state?.[sheetHistoryKey]) {
      history.pushState({ ...history.state, [sheetHistoryKey]: true }, "", window.location.href);
    }
    const selectedTab = sheetTabs.find((tab) => tab.dataset.sheetTab === (panelName === "outline" ? "outline" : "library"));
    selectedTab?.focus();
  }

  function closeSheet({ useHistory = true, restoreFocus = true } = {}) {
    if (sheet.open) sheet.close();
    if (restoreFocus) restoreSheetFocus();
    if (useHistory && history.state?.[sheetHistoryKey]) history.back();
  }

  function applyNavigation(hash, focusTarget) {
    state.focusTarget = focusTarget;
    if (window.location.hash === hash) {
      renderDocument();
    } else {
      window.location.hash = hash;
    }
  }

  function navigate(hash, focusTarget) {
    if (sheet.open && history.state?.[sheetHistoryKey]) {
      state.pendingNavigation = { hash, focusTarget };
      closeSheet({ useHistory: true, restoreFocus: false });
      return;
    }
    if (sheet.open) closeSheet({ useHistory: false, restoreFocus: false });
    applyNavigation(hash, focusTarget);
  }

  document.addEventListener("click", (event) => {
    const categoryToggle = event.target.closest("[data-category-toggle]");
    if (categoryToggle) {
      const expanded = categoryToggle.getAttribute("aria-expanded") !== "true";
      setCategoryExpanded(categoryToggle.dataset.categoryToggle, expanded);
      return;
    }

    const themeChoice = event.target.closest("[data-theme-choice]");
    if (themeChoice) {
      applyTheme(themeChoice.dataset.themeChoice, true);
      return;
    }

    const openButton = event.target.closest("[data-open-sheet]");
    if (openButton) {
      openSheet(openButton.dataset.openSheet, openButton);
      return;
    }

    if (event.target.closest("[data-close-sheet]")) {
      closeSheet();
      return;
    }

    const tab = event.target.closest("[data-sheet-tab]");
    if (tab) {
      selectSheetPanel(tab.dataset.sheetTab, { focus: true });
      return;
    }

    const documentLink = event.target.closest("[data-document-id]");
    if (documentLink) {
      event.preventDefault();
      navigate(encodeHashRoute(documentLink.dataset.documentId), "article");
      return;
    }

    const outlineLink = event.target.closest("[data-outline-heading]");
    if (outlineLink) {
      event.preventDefault();
      navigate(encodeHashRoute(state.activeDocumentId, outlineLink.dataset.outlineHeading), "heading");
    }
  });

  for (const tab of sheetTabs) {
    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;
      const currentIndex = sheetTabs.indexOf(tab);
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % sheetTabs.length;
      if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + sheetTabs.length) % sheetTabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = sheetTabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      selectSheetPanel(sheetTabs[nextIndex].dataset.sheetTab, { focus: true });
    });
  }

  sheet.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSheet();
  });

  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) closeSheet();
  });

  window.addEventListener("hashchange", renderDocument);
  window.addEventListener("popstate", (event) => {
    if (state.pendingNavigation) {
      const pending = state.pendingNavigation;
      state.pendingNavigation = null;
      if (sheet.open) sheet.close();
      applyNavigation(pending.hash, pending.focusTarget);
      return;
    }
    if (sheet.open && !event.state?.[sheetHistoryKey]) {
      sheet.close();
      restoreSheetFocus();
    } else if (!sheet.open && event.state?.[sheetHistoryKey]) {
      openSheet("library", state.sheetOpener, { pushHistory: false });
    }
  });

  applyTheme(readStoredTheme() ?? "auto");
  selectSheetPanel("library");
  renderDocument();
}
