const root = document.documentElement;
const modeStorageKey = root.dataset.themeStorageKey;
const skinStorageKey = root.dataset.skinStorageKey;
const allowedModes = new Set(["system", "light", "dark"]);
const allowedSkins = new Set(["ocean", "orchid"]);
const systemSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const elements = {
  requestedMode: document.querySelector("#requested-mode"),
  systemScheme: document.querySelector("#system-scheme"),
  resolvedScheme: document.querySelector("#resolved-scheme"),
  activeSkin: document.querySelector("#active-skin"),
  storageStatus: document.querySelector("#storage-status"),
  lastSource: document.querySelector("#last-source"),
  usedSchemeLabel: document.querySelector("#used-scheme-label"),
  themeColor: document.querySelector("#theme-color"),
  clearPreferences: document.querySelector("#clear-preferences"),
  localScheme: document.querySelector("#local-scheme"),
  localThemeCard: document.querySelector("#local-theme-card"),
  canvas: document.querySelector("#theme-canvas"),
  canvasRenderCount: document.querySelector("#canvas-render-count")
};

const boot = window.__THEME_BOOT__ ?? {};
const state = {
  mode: allowedModes.has(boot.mode) ? boot.mode : "system",
  skin: allowedSkins.has(boot.skin) ? boot.skin : "ocean",
  resolvedScheme: boot.resolvedScheme === "dark" ? "dark" : "light",
  storageStatus: boot.storageStatus === "unavailable" ? "unavailable" : "available",
  source: "boot"
};

let canvasRenderCount = 0;
let canvasFrame = 0;

function getSystemScheme() {
  return systemSchemeQuery.matches ? "dark" : "light";
}

function resolveScheme(mode) {
  return mode === "system" ? getSystemScheme() : mode;
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
    state.storageStatus = "available";
    return true;
  } catch (error) {
    state.storageStatus = "unavailable";
    return false;
  }
}

function removePreference(key) {
  try {
    localStorage.removeItem(key);
    state.storageStatus = "available";
    return true;
  } catch (error) {
    state.storageStatus = "unavailable";
    return false;
  }
}

function syncControls() {
  const activeMode = document.querySelector(`input[name="mode"][value="${state.mode}"]`);
  const activeSkin = document.querySelector(`input[name="skin"][value="${state.skin}"]`);
  if (activeMode) activeMode.checked = true;
  if (activeSkin) activeSkin.checked = true;
}

function updateStatus() {
  const systemScheme = getSystemScheme();
  elements.requestedMode.value = state.mode;
  elements.systemScheme.value = systemScheme;
  elements.resolvedScheme.value = state.resolvedScheme;
  elements.activeSkin.value = state.skin;
  elements.storageStatus.value = state.storageStatus;
  elements.lastSource.value = state.source;
  elements.usedSchemeLabel.textContent = state.resolvedScheme;
}

function updateBrowserChromeColor() {
  const canvasColor = getComputedStyle(root).getPropertyValue("--color-canvas").trim();
  if (canvasColor) elements.themeColor.content = canvasColor;
}

function scheduleCanvasRender() {
  window.cancelAnimationFrame(canvasFrame);
  canvasFrame = window.requestAnimationFrame(renderCanvas);
}

function applyTheme({ source, persist = false }) {
  state.resolvedScheme = resolveScheme(state.mode);
  state.source = source;

  root.dataset.theme = state.mode;
  root.dataset.scheme = state.resolvedScheme;
  root.dataset.skin = state.skin;
  root.dataset.storageStatus = state.storageStatus;

  /* 精确设置 used color scheme，让原生控件与 light-dark() 跟随解析结果。 */
  root.style.colorScheme = state.resolvedScheme;

  if (persist) {
    writePreference(modeStorageKey, state.mode);
    writePreference(skinStorageKey, state.skin);
    root.dataset.storageStatus = state.storageStatus;
  }

  syncControls();
  updateStatus();
  updateBrowserChromeColor();
  scheduleCanvasRender();

  window.dispatchEvent(
    new CustomEvent("themechange", {
      detail: {
        requestedMode: state.mode,
        systemScheme: getSystemScheme(),
        resolvedScheme: state.resolvedScheme,
        skin: state.skin,
        source
      }
    })
  );
}

function renderCanvas() {
  const canvas = elements.canvas;
  const context = canvas.getContext("2d");
  if (!context) return;

  const styles = getComputedStyle(root);
  const colors = {
    background: styles.getPropertyValue("--color-surface-muted").trim(),
    line: styles.getPropertyValue("--color-canvas-line").trim(),
    fill: styles.getPropertyValue("--color-canvas-fill").trim(),
    text: styles.getPropertyValue("--color-canvas-text").trim()
  };
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(canvas.clientWidth, 280);
  const height = Math.max(canvas.clientHeight, 160);

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);

  const padding = 28;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const values = [0.22, 0.48, 0.4, 0.76, 0.62, 0.9];

  context.strokeStyle = colors.line;
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = padding + (plotHeight / 3) * index;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  context.strokeStyle = colors.fill;
  context.lineWidth = 4;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();
  values.forEach((value, index) => {
    const x = padding + (plotWidth / (values.length - 1)) * index;
    const y = padding + plotHeight * (1 - value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  context.fillStyle = colors.fill;
  values.forEach((value, index) => {
    const x = padding + (plotWidth / (values.length - 1)) * index;
    const y = padding + plotHeight * (1 - value);
    context.beginPath();
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = colors.text;
  context.font = "700 13px ui-monospace, monospace";
  context.fillText(`${state.skin} / ${state.resolvedScheme}`, padding, 18);

  canvasRenderCount += 1;
  elements.canvasRenderCount.value = `render count: ${canvasRenderCount}`;
}

document.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener("change", (event) => {
    const mode = event.target.value;
    if (!allowedModes.has(mode)) return;
    state.mode = mode;
    applyTheme({ source: "user-mode", persist: true });
  });
});

document.querySelectorAll('input[name="skin"]').forEach((input) => {
  input.addEventListener("change", (event) => {
    const skin = event.target.value;
    if (!allowedSkins.has(skin)) return;
    state.skin = skin;
    applyTheme({ source: "user-skin", persist: true });
  });
});

elements.clearPreferences.addEventListener("click", () => {
  removePreference(modeStorageKey);
  removePreference(skinStorageKey);
  state.mode = "system";
  state.skin = "ocean";
  applyTheme({ source: "clear", persist: false });
});

elements.localScheme.addEventListener("change", (event) => {
  const localScheme = event.target.value;
  if (localScheme === "inherit") {
    delete elements.localThemeCard.dataset.localScheme;
    elements.localThemeCard.style.colorScheme = "";
  } else if (localScheme === "light" || localScheme === "dark") {
    elements.localThemeCard.dataset.localScheme = localScheme;
    elements.localThemeCard.style.colorScheme = localScheme;
  }
});

function handleSystemSchemeChange() {
  if (state.mode === "system") {
    applyTheme({ source: "system-change", persist: false });
  } else {
    state.source = "system-change-ignored";
    updateStatus();
  }
}

systemSchemeQuery.addEventListener("change", handleSystemSchemeChange);

window.addEventListener("storage", (event) => {
  if (event.key === modeStorageKey) {
    state.mode = allowedModes.has(event.newValue) ? event.newValue : "system";
    applyTheme({ source: "cross-tab-mode", persist: false });
  }

  if (event.key === skinStorageKey) {
    state.skin = allowedSkins.has(event.newValue) ? event.newValue : "ocean";
    applyTheme({ source: "cross-tab-skin", persist: false });
  }
});

window.addEventListener("resize", scheduleCanvasRender);

applyTheme({ source: "boot", persist: false });
root.dataset.appReady = "true";
window.requestAnimationFrame(() => {
  root.dataset.ready = "true";
});
