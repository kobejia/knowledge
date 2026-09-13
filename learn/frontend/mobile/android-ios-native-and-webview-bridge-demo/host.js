import {
  BRIDGE_VERSION,
  createEvent,
  createRequest,
  createResponse,
  validateEnvelope
} from "./bridge-core.mjs";

const root = document.documentElement;
const frame = document.querySelector("#webview-frame");
const platformSelect = document.querySelector("#platform");
const profileSelect = document.querySelector("#fault-profile");
const nativeLog = document.querySelector("#native-log");
const hostPlatform = document.querySelector("#host-platform");
const hostSession = document.querySelector("#host-session");
const hostProfile = document.querySelector("#host-profile");
const transportBadge = document.querySelector("#transport-badge");

const state = {
  platform: platformSelect.value,
  profile: profileSelect.value,
  sessionId: null,
  generation: 0,
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
  const item = { type, message, detail, at: Date.now() };
  state.log.push(item);
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
  nativeLog.prepend(row);
}

function syncStatus() {
  hostPlatform.value = state.platform;
  hostProfile.value = state.profile;
  hostSession.value = state.sessionId ?? "booting";
  transportBadge.textContent = state.sessionId ? `${state.platform} / ready` : `${state.platform} / booting`;
  transportBadge.dataset.status = state.sessionId ? "ready" : "booting";
}

function responseDelay(method) {
  if (state.profile === "reorder") {
    return method === "bridge.getAppInfo" ? 260 : 60;
  }
  if (state.profile === "timeout" && method === "system.slowOperation") return 1200;
  if (method === "media.chooseImage") return 160;
  if (method === "system.slowOperation") return 180;
  return 90;
}

function capabilityResult(request) {
  if (state.profile === "version") {
    return {
      ok: false,
      code: "VERSION_UNSUPPORTED",
      message: `Host rejected Bridge protocol v${BRIDGE_VERSION}`,
      retryable: false
    };
  }

  if (request.method === "bridge.getAppInfo") {
    return {
      ok: true,
      result: {
        platform: state.platform,
        appVersion: "6.2.0-demo",
        bridgeVersion: BRIDGE_VERSION,
        capabilities: ["bridge.getAppInfo", "media.chooseImage", "navigation.openNativePage"]
      }
    };
  }

  if (request.method === "media.chooseImage") {
    if (state.profile === "deny") {
      return {
        ok: false,
        code: "PERMISSION_DENIED",
        message: "Photo library permission was denied",
        retryable: false
      };
    }
    return {
      ok: true,
      result: {
        assetId: `${state.platform}-asset-27`,
        width: 1280,
        height: 960
      }
    };
  }

  if (request.method === "navigation.openNativePage") {
    return {
      ok: true,
      result: {
        route: request.params.route ?? "unknown",
        presentedBy: state.platform
      }
    };
  }

  if (request.method === "system.slowOperation") {
    return {
      ok: true,
      result: {
        completed: true,
        profile: state.profile
      }
    };
  }

  return {
    ok: false,
    code: "METHOD_NOT_FOUND",
    message: `No native capability is registered for ${request.method}`,
    retryable: false
  };
}

function deliver(message) {
  if (message.sessionId !== state.sessionId) {
    addLog("STALE", `丢弃旧会话响应 ${message.id ?? message.name}`, {
      expected: state.sessionId,
      received: message.sessionId
    });
    return false;
  }

  const receiver = frame.contentWindow?.__bridgeReceive;
  if (typeof receiver !== "function") {
    addLog("DROP", "H5 receiver 不可用，响应未投递");
    return false;
  }

  receiver(message);
  const label = message.kind === "event" ? message.name : message.id;
  addLog("NATIVE→H5", `${message.kind} ${label}`);
  return true;
}

function handleFromWeb(rawMessage, context) {
  let request;
  try {
    request = validateEnvelope(typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage);
  } catch (error) {
    addLog("REJECT", `消息结构无效：${error.code ?? "INVALID_MESSAGE"}`);
    return;
  }

  if (context.sourceWindow !== frame.contentWindow || context.sourceOrigin !== location.origin) {
    addLog("ORIGIN_REJECTED", `拒绝来自 ${context.sourceOrigin} 的 ${request.method}`);
    return;
  }

  if (request.kind !== "request") {
    addLog("REJECT", `宿主只接受 request，收到 ${request.kind}`);
    return;
  }

  if (request.sessionId !== state.sessionId) {
    addLog("STALE", `拒绝旧页面会话请求 ${request.id}`);
    return;
  }

  addLog("H5→NATIVE", `${request.method} / ${request.id}`);
  const payload = capabilityResult(request);
  const delay = responseDelay(request.method);

  setTimeout(() => {
    const response = createResponse(request, payload);
    deliver(response);
  }, delay);
}

function installTransport() {
  const page = frame.contentWindow;
  if (!page || typeof page.__installNativeTransport !== "function") {
    addLog("BOOT", "H5 页面尚未暴露 transport 安装入口");
    return;
  }

  state.platform = platformSelect.value;

  delete page.AndroidBridge;
  if (page.webkit) delete page.webkit;

  if (state.platform === "android") {
    page.AndroidBridge = Object.freeze({
      postMessage(serialized) {
        handleFromWeb(serialized, { sourceWindow: page, sourceOrigin: location.origin });
      }
    });
  } else {
    page.webkit = {
      messageHandlers: {
        bridge: Object.freeze({
          postMessage(message) {
            handleFromWeb(message, { sourceWindow: page, sourceOrigin: location.origin });
          }
        })
      }
    };
  }

  const snapshot = page.__installNativeTransport(state.platform);
  state.sessionId = snapshot.sessionId;
  addLog("BOOT", `${state.platform} transport 已安装`, { sessionId: state.sessionId });
  syncStatus();
  root.dataset.appReady = "true";
}

function reloadWebView(reason) {
  const previous = state.sessionId;
  state.sessionId = null;
  state.generation += 1;
  root.dataset.appReady = "false";
  syncStatus();
  addLog("RELOAD", `${reason}；旧会话 ${previous ?? "none"} 失效`);
  frame.src = `./webview.html?generation=${state.generation}`;
}

frame.addEventListener("load", installTransport);

platformSelect.addEventListener("change", () => {
  state.platform = platformSelect.value;
  reloadWebView("切换宿主平台");
});

profileSelect.addEventListener("change", () => {
  state.profile = profileSelect.value;
  addLog("PROFILE", `切换为 ${state.profile}`);
  syncStatus();
});

document.querySelector("#emit-background").addEventListener("click", () => {
  if (!state.sessionId) return;
  deliver(createEvent({
    sessionId: state.sessionId,
    name: "app.lifecycle",
    data: { phase: "background" }
  }));
});

document.querySelector("#simulate-untrusted").addEventListener("click", () => {
  if (!state.sessionId) return;
  const request = createRequest({
    id: `untrusted:${Date.now()}`,
    sessionId: state.sessionId,
    method: "media.chooseImage",
    params: {}
  });
  handleFromWeb(request, {
    sourceWindow: frame.contentWindow,
    sourceOrigin: "https://ads.example.invalid"
  });
});

document.querySelector("#reload-webview").addEventListener("click", () => {
  reloadWebView("用户请求重载");
});

document.querySelector("#clear-log").addEventListener("click", () => {
  nativeLog.replaceChildren();
  state.log.length = 0;
});

window.__bridgeLabSnapshot = () => ({
  platform: state.platform,
  profile: state.profile,
  sessionId: state.sessionId,
  generation: state.generation,
  log: structuredClone(state.log),
  guest: frame.contentWindow?.__bridgeSnapshot?.() ?? null
});

syncStatus();
