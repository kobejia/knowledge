(function initializeApp(globalObject) {
  "use strict";

  const core = globalObject.VaultLabCore;
  const originalSamples = globalObject.VaultLabSamples;
  if (!core || !originalSamples) throw new Error("Vault Lab dependencies failed to load");

  const elements = {
    query: document.querySelector("#query"),
    preset: document.querySelector("#preset"),
    chunkSize: document.querySelector("#chunk-size"),
    topK: document.querySelector("#top-k"),
    topKOutput: document.querySelector("#top-k-output"),
    statusFilter: document.querySelector("#status-filter"),
    linkBoost: document.querySelector("#link-boost"),
    run: document.querySelector("#run-query"),
    runStatus: document.querySelector("#run-status"),
    noteList: document.querySelector("#note-list"),
    noteEditor: document.querySelector("#note-editor"),
    applyNote: document.querySelector("#apply-note"),
    resetVault: document.querySelector("#reset-vault"),
    diagnostics: document.querySelector("#diagnostics"),
    resultList: document.querySelector("#result-list"),
    answer: document.querySelector("#answer"),
    answerStatus: document.querySelector("#answer-status"),
    citations: document.querySelector("#citation-list"),
    context: document.querySelector("#context-output"),
    metricNotes: document.querySelector("#metric-notes"),
    metricChunks: document.querySelector("#metric-chunks"),
    metricTerms: document.querySelector("#metric-terms"),
    metricResults: document.querySelector("#metric-results")
  };

  const presetQueries = {
    sync: "为什么同步不能替代备份？",
    evidence: "怎样让 AI 回答能够追溯来源？",
    decision: "Atlas 为什么选择本地 Markdown 文件？",
    injection: "网页里的指令可以让 Agent 自动执行吗？",
    semantic: "怎样重新发现早已遗忘但意思相关的想法？"
  };

  let rawNotes = cloneSamples();
  let selectedPath = rawNotes[0].path;
  let lastRun = null;

  function cloneSamples() {
    return originalSamples.map((note) => ({ ...note }));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function currentOptions() {
    return {
      query: elements.query.value.trim(),
      chunkSize: Number(elements.chunkSize.value),
      topK: Number(elements.topK.value),
      status: elements.statusFilter.value,
      linkBoost: elements.linkBoost.checked
    };
  }

  function renderNoteList(notes) {
    elements.noteList.replaceChildren();
    for (const note of notes) {
      const button = element("button", "note-button");
      button.type = "button";
      button.dataset.path = note.path;
      button.setAttribute("aria-current", String(note.path === selectedPath));
      button.append(
        element("span", "", note.title),
        element("span", "note-state", String(note.properties.status ?? "unknown"))
      );
      button.addEventListener("click", () => selectNote(note.path));
      elements.noteList.append(button);
    }
  }

  function selectNote(path) {
    selectedPath = path;
    const selected = rawNotes.find((note) => note.path === selectedPath);
    elements.noteEditor.value = selected?.content ?? "";
    for (const button of elements.noteList.querySelectorAll(".note-button")) {
      button.setAttribute("aria-current", String(button.dataset.path === selectedPath));
    }
  }

  function renderMetrics(run) {
    elements.metricNotes.textContent = `${run.notes.length} notes`;
    elements.metricChunks.textContent = `${run.chunks.length} chunks`;
    elements.metricTerms.textContent = `${new Set(run.queryTokens).size} terms`;
    elements.metricResults.textContent = `${run.results.length} sources`;
  }

  function renderDiagnostics(run) {
    elements.diagnostics.replaceChildren();
    const items = [];

    if (!run.results.length) {
      items.push({ type: "weak", text: "没有召回证据。过滤器可能排除了相关笔记，或问题使用了 BM25 无法连接的同义表达。" });
    }
    if (run.results.some((result) => result.suspicious)) {
      items.push({ type: "risk", text: "召回结果包含疑似提示注入。系统把它标记为不可信数据；告警模式只能辅助观察，不能替代权限隔离。" });
    }
    if (run.results.length && run.results.every((result) => result.lexicalScore < 1)) {
      items.push({ type: "weak", text: "词法匹配较弱。当前 Demo 没有向量语义能力，不能因为结果看起来合理就声称找到了同义内容。" });
    }
    if (!items.length) {
      items.push({ type: "", text: "已取得可检查的词法证据。下一步仍需判断来源是否可信、片段是否完整、引用是否支持结论。" });
    }

    for (const item of items) {
      elements.diagnostics.append(element("p", `diagnostic${item.type ? ` diagnostic--${item.type}` : ""}`, item.text));
    }
  }

  function renderResults(results) {
    elements.resultList.replaceChildren();
    for (const [index, result] of results.entries()) {
      const card = element("li", "result-card");
      card.dataset.path = result.notePath;
      card.dataset.risk = String(result.suspicious);

      const header = element("div", "result-header");
      const identity = element("div");
      identity.append(
        element("h3", "", result.noteTitle),
        element("p", "result-path", `${result.notePath} · ${result.heading}`)
      );
      header.append(identity, element("span", "rank", `#${index + 1} · ${result.score.toFixed(3)}`));

      const snippet = element("p", "result-snippet", result.text);
      const scores = element("div", "score-row");
      scores.append(
        element("span", "", `BM25 ${result.lexicalScore.toFixed(3)}`),
        element("span", "", `link ${result.graphScore.toFixed(3)}`),
        element("span", "", `matched ${result.matchedTerms.slice(0, 8).join(", ") || "none"}`)
      );
      const meta = element("div", "result-meta");
      meta.append(
        element("span", "", `status=${result.properties.status ?? "unknown"}`),
        element("span", "", `trust=${result.properties.trust ?? "unspecified"}`)
      );
      if (result.suspicious) meta.append(element("span", "risk-chip", "UNTRUSTED INSTRUCTION"));
      card.append(header, snippet, scores, meta);
      elements.resultList.append(card);
    }
  }

  function renderAnswer(answer) {
    elements.answer.replaceChildren();
    elements.citations.replaceChildren();
    elements.answerStatus.textContent = answer.status;

    for (const paragraph of answer.summary.split(/\n\n+/)) {
      elements.answer.append(element("p", "", paragraph));
    }
    for (const warning of answer.warnings) {
      elements.answer.append(element("p", "answer-warning", warning));
    }
    for (const citation of answer.citations) {
      elements.citations.append(element("li", "", `[${citation.marker}] ${citation.path} → ${citation.heading}`));
    }
  }

  function run() {
    elements.runStatus.dataset.ready = "false";
    elements.runStatus.textContent = "正在重建派生状态";
    const options = currentOptions();
    lastRun = core.runLab(rawNotes, options);
    renderNoteList(lastRun.notes);
    selectNote(selectedPath);
    renderMetrics(lastRun);
    renderDiagnostics(lastRun);
    renderResults(lastRun.results);
    renderAnswer(lastRun.answer);
    elements.context.textContent = lastRun.context;
    elements.runStatus.dataset.ready = "true";
    elements.runStatus.textContent = `完成 · ${lastRun.results.length}/${lastRun.chunks.length}`;
  }

  elements.preset.addEventListener("change", () => {
    elements.query.value = presetQueries[elements.preset.value];
    run();
  });
  elements.topK.addEventListener("input", () => {
    elements.topKOutput.value = elements.topK.value;
  });
  elements.run.addEventListener("click", run);
  elements.applyNote.addEventListener("click", () => {
    const selected = rawNotes.find((note) => note.path === selectedPath);
    if (selected) selected.content = elements.noteEditor.value;
    run();
  });
  elements.resetVault.addEventListener("click", () => {
    rawNotes = cloneSamples();
    selectedPath = rawNotes[0].path;
    run();
  });

  globalObject.VaultLabApp = Object.freeze({
    getLastRun: () => lastRun,
    getRawNotes: () => rawNotes.map((note) => ({ ...note }))
  });

  elements.topKOutput.value = elements.topK.value;
  run();
})(globalThis);
