import { BridgeError, createBridgeClient } from "./bridge-core.mjs";

const root = document.documentElement;
const controls = [...document.querySelectorAll(".web-actions button")];
const webLog = document.querySelector("#web-log");
const platformOutput = document.querySelector("#web-platform");
const sessionOutput = document.querySelector("#web-session");
const pendingOutput = document.querySelector("#pending-count");
const lifecycleOutput = document.querySelector("#lifecycle-state");
const resultOutput = document.querySelector("#last-result");

const sessionId = typeof crypto.randomUUID === "function"
  ? `page-${crypto.randomUUID().slice(0, 8)}`
  : `page-${Date.now().toString(36)}`;

const state = {
  platform: null,
  bridge: null,
  lifecycle: "foreground",
  lastResult: { status: "idle", text: "尚未调用" },
  log: []
};

function clock() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false
  }).format(new Date());
}

function addLog(type, message, detail = undefined) {
  state.log.push({ type, message, detail, at: Date.now() });
  if (state.log.length > 80) state.log.shift();

  const row = document.createElement("li");
  row.dataset.type = type;
  const time = document.createElement("time");
  time.textContent = clock();
  const label = document.createElement("strong");
  label.textContent = type;
  const text = document.createElement("span");
  text.textContent = message;
  row.append(time, label, text);
  webLog.prepend(row);
}

function syncState() {
  platformOutput.textContent = state.platform ?? "waiting";
  platformOutput.dataset.platform = state.platform ?? "waiting";
  sessionOutput.value = sessionId;
  pendingOutput.value = String(state.bridge?.snapshot().pending.length ?? 0);
  lifecycleOutput.value = state.lifecycle;
  resultOutput.value = state.lastResult.text;
  resultOutput.dataset.status = state.lastResult.status;
}

function diagnostic(entry) {
  const messages = {
    "request-sent": `发送 ${entry.detail.method}`,
    "request-resolved": `${entry.detail.method} 成功`,
    "request-rejected": `${entry.detail.method} 失败：${entry.detail.code}`,
    timeout: `${entry.detail.method} 超时`,
    "late-or-duplicate-response": `忽略晚到或重复响应 ${entry.detail.id}`,
    "stale-session": "忽略其他页面会话的消息",
    "bridge-invalidated": "当前 Bridge 会话已失效",
    "event-received": `收到事件 ${entry.detail.name}`,
    "message-rejected": `拒绝无效消息 ${entry.detail.code}`
  };
  addLog("BRIDGE", messages[entry.type] ?? entry.type, entry.detail);
  syncState();
}

function sendThroughPlatform(message) {
  if (state.platform === "android") {
    if (typeof window.AndroidBridge?.postMessage !== "function") {
      throw new BridgeError("TRANSPORT_MISSING", "AndroidBridge.postMessage is unavailable");
    }
    window.AndroidBridge.postMessage(JSON.stringify(message));
    return;
  }

  const handler = window.webkit?.messageHandlers?.bridge;
  if (state.platform === "ios" && typeof handler?.postMessage === "function") {
    handler.postMessage(message);
    return;
  }

  throw new BridgeError("TRANSPORT_MISSING", "No native transport is installed");
}

function errorText(error) {
  const code = error instanceof BridgeError ? error.code : "UNKNOWN_ERROR";
  return `${code}: ${error.message}`;
}

async function callCapability(method, params = {}) {
  if (!state.bridge) throw new BridgeError("BRIDGE_NOT_READY", "Bridge handshake has not completed");
  const promise = state.bridge.call(method, params);
  syncState();
  try {
    const result = await promise;
    state.lastResult = { status: "success", text: `${method} → ${JSON.stringify(result)}`, value: result };
    addLog("RESULT", `${method} 返回成功`, result);
    return result;
  } catch (error) {
    state.lastResult = { status: "error", text: `${method} → ${errorText(error)}`, code: error.code };
    addLog("ERROR", `${method} → ${errorText(error)}`);
    throw error;
  } finally {
    syncState();
  }
}

window.__installNativeTransport = (platform) => {
  if (!new Set(["android", "ios"]).has(platform)) {
    throw new BridgeError("INVALID_PLATFORM", `Unsupported platform ${platform}`);
  }

  state.bridge?.invalidate("Native transport was replaced");
  state.platform = platform;
  state.lifecycle = "foreground";
  state.lastResult = { status: "ready", text: "Bridge ready，等待调用" };
  state.bridge = createBridgeClient({
    sessionId,
    send: sendThroughPlatform,
    timeoutMs: 400,
    onDiagnostic: diagnostic
  });

  state.bridge.on("app.lifecycle", (data) => {
    state.lifecycle = data.phase;
    state.lastResult = { status: "event", text: `app.lifecycle → ${data.phase}`, value: data };
    addLog("EVENT", `生命周期变为 ${data.phase}`);
    syncState();
  });

  controls.forEach((button) => {
    button.disabled = false;
  });
  root.dataset.webReady = "true";
  addLog("READY", `${platform} transport / ${sessionId}`);
  syncState();
  return { platform, sessionId };
};

window.__bridgeReceive = (message) => state.bridge?.receive(message) ?? false;

window.__bridgeSnapshot = () => ({
  platform: state.platform,
  sessionId,
  lifecycle: state.lifecycle,
  lastResult: structuredClone(state.lastResult),
  bridge: state.bridge?.snapshot() ?? null,
  log: structuredClone(state.log)
});

document.querySelector("#get-app-info").addEventListener("click", () => {
  callCapability("bridge.getAppInfo").catch(() => {});
});

document.querySelector("#choose-image").addEventListener("click", () => {
  callCapability("media.chooseImage", { maxCount: 1, source: ["camera", "library"] }).catch(() => {});
});

document.querySelector("#run-slow").addEventListener("click", () => {
  callCapability("system.slowOperation").catch(() => {});
});

document.querySelector("#run-concurrent").addEventListener("click", async () => {
  if (!state.bridge) return;
  const completionOrder = [];
  const appInfo = state.bridge.call("bridge.getAppInfo").then(
    (value) => {
      completionOrder.push("bridge.getAppInfo");
      return value;
    },
    (error) => {
      completionOrder.push(`bridge.getAppInfo:${error.code}`);
      throw error;
    }
  );
  const navigation = state.bridge.call("navigation.openNativePage", { route: "trip/detail" }).then(
    (value) => {
      completionOrder.push("navigation.openNativePage");
      return value;
    },
    (error) => {
      completionOrder.push(`navigation.openNativePage:${error.code}`);
      throw error;
    }
  );
  syncState();

  const results = await Promise.allSettled([appInfo, navigation]);
  state.lastResult = {
    status: results.every((result) => result.status === "fulfilled") ? "success" : "error",
    text: `完成顺序：${completionOrder.join(" → ")}`,
    completionOrder,
    results: results.map((result) => result.status)
  };
  addLog("RESULT", state.lastResult.text);
  syncState();
});

document.querySelector("#clear-web-log").addEventListener("click", () => {
  webLog.replaceChildren();
  state.log.length = 0;
});

controls.forEach((button) => {
  button.disabled = true;
});
syncState();
