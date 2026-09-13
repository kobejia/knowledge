import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createDemoServer } from "./serve.mjs";

const chromeCandidates = [
  process.env.BRIDGE_DEMO_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined,
  process.platform === "linux" ? "/usr/bin/google-chrome" : undefined,
  process.platform === "linux" ? "/usr/bin/chromium" : undefined
].filter(Boolean);

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function waitFor(check, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`${label}${lastError ? `: ${lastError.message}` : ""}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const response = await client.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  assert(!response.exceptionDetails, response.exceptionDetails?.exception?.description ?? "Browser evaluation failed");
  return response.result.value;
}

const chromePath = await firstExisting(chromeCandidates);
assert(chromePath, "Chrome/Chromium not found; set BRIDGE_DEMO_CHROME to its executable path");

const server = createDemoServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const serverAddress = server.address();
assert(serverAddress && typeof serverAddress === "object");

const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "bridge-lab-chrome-"));
const demoUrl = `http://127.0.0.1:${serverAddress.port}`;
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=0",
  `--user-data-dir=${profileDirectory}`,
  "about:blank"
], { stdio: ["ignore", "ignore", "pipe"] });

let stderr = "";
chrome.stderr.setEncoding("utf8");
chrome.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const errors = [];
let page;

try {
  const portFile = path.join(profileDirectory, "DevToolsActivePort");
  const devToolsPort = await waitFor(async () => {
    const content = await readFile(portFile, "utf8");
    return Number.parseInt(content.split(/\r?\n/, 1)[0], 10);
  }, "Chrome did not expose a DevTools port");

  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`);
    const list = await response.json();
    return list.find((item) => item.type === "page") ?? null;
  }, "Chrome did not expose a page target");

  page = new CdpClient(targets.webSocketDebuggerUrl);
  await page.open();
  await Promise.all([page.call("Page.enable"), page.call("Runtime.enable"), page.call("Log.enable")]);

  page.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    errors.push(`exception: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
  });
  page.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type === "error") errors.push(`console: ${args.map((arg) => arg.value ?? arg.description).join(" ")}`);
  });
  page.on("Log.entryAdded", ({ entry }) => {
    if (entry.level === "error") errors.push(`log: ${entry.text}`);
  });

  await page.call("Page.navigate", { url: demoUrl });
  await waitFor(
    async () => evaluate(page, 'document.documentElement.dataset.appReady === "true" && document.querySelector("#webview-frame").contentDocument?.documentElement.dataset.webReady === "true"'),
    "Bridge Lab did not become ready"
  );

  const initial = await evaluate(page, "window.__bridgeLabSnapshot()");
  assert.equal(initial.platform, "android");
  assert.equal(initial.guest.platform, "android");
  assert.match(initial.sessionId, /^page-/);

  await evaluate(page, 'document.querySelector("#webview-frame").contentDocument.querySelector("#get-app-info").click()');
  const androidResult = await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.guest.lastResult.value?.platform === "android" ? snapshot : null;
  }, "Android transport did not return app info");
  assert.equal(androidResult.guest.bridge.pending.length, 0);

  const firstSession = androidResult.sessionId;
  await evaluate(page, `(() => {
    const select = document.querySelector("#platform");
    select.value = "ios";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  const iosReady = await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.platform === "ios" && snapshot.guest?.platform === "ios" && snapshot.sessionId !== firstSession
      ? snapshot
      : null;
  }, "iOS transport did not become ready");
  assert.match(iosReady.sessionId, /^page-/);

  await evaluate(page, `(() => {
    const select = document.querySelector("#fault-profile");
    select.value = "reorder";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#webview-frame").contentDocument.querySelector("#run-concurrent").click();
  })()`);
  const reordered = await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.guest.lastResult.completionOrder?.length === 2 ? snapshot : null;
  }, "Concurrent requests did not finish");
  assert.deepEqual(reordered.guest.lastResult.completionOrder, [
    "navigation.openNativePage",
    "bridge.getAppInfo"
  ]);

  await evaluate(page, `(() => {
    const select = document.querySelector("#fault-profile");
    select.value = "deny";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#webview-frame").contentDocument.querySelector("#choose-image").click();
  })()`);
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.guest.lastResult.code === "PERMISSION_DENIED";
  }, "Permission denial was not surfaced");

  await evaluate(page, `(() => {
    const select = document.querySelector("#fault-profile");
    select.value = "timeout";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#webview-frame").contentDocument.querySelector("#run-slow").click();
  })()`);
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.guest.lastResult.code === "BRIDGE_TIMEOUT";
  }, "Slow operation did not time out");

  await evaluate(page, `(() => {
    const select = document.querySelector("#fault-profile");
    select.value = "normal";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#emit-background").click();
  })()`);
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.guest.lifecycle === "background";
  }, "Lifecycle event was not delivered");

  await evaluate(page, `(() => {
    const select = document.querySelector("#fault-profile");
    select.value = "version";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#webview-frame").contentDocument.querySelector("#get-app-info").click();
  })()`);
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.guest.lastResult.code === "VERSION_UNSUPPORTED";
  }, "Version incompatibility was not surfaced");

  await evaluate(page, 'document.querySelector("#simulate-untrusted").click()');
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.log.some((entry) => entry.type === "ORIGIN_REJECTED");
  }, "Untrusted origin was not rejected");

  const sessionBeforeReload = (await evaluate(page, "window.__bridgeLabSnapshot()")).sessionId;
  await evaluate(page, `(() => {
    const select = document.querySelector("#fault-profile");
    select.value = "timeout";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#webview-frame").contentDocument.querySelector("#run-slow").click();
  })()`);
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.guest.bridge.pending.length === 1;
  }, "Slow operation was not pending before reload");
  await evaluate(page, 'document.querySelector("#reload-webview").click()');
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.sessionId && snapshot.sessionId !== sessionBeforeReload && snapshot.guest?.platform === "ios";
  }, "WebView did not create a new session");
  await waitFor(async () => {
    const snapshot = await evaluate(page, "window.__bridgeLabSnapshot()");
    return snapshot.log.some((entry) => entry.type === "STALE" && entry.message.includes("旧会话响应"));
  }, "Old session response was not discarded", 4_000);

  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false
  });
  const narrow = await evaluate(page, `({
    hostWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    guestWidth: document.querySelector("#webview-frame").contentDocument.documentElement.scrollWidth,
    guestViewport: document.querySelector("#webview-frame").contentWindow.innerWidth
  })`);
  assert(narrow.hostWidth <= narrow.viewport, `Host overflows narrow viewport: ${JSON.stringify(narrow)}`);
  assert(narrow.guestWidth <= narrow.guestViewport, `WebView page overflows narrow viewport: ${JSON.stringify(narrow)}`);

  assert.deepEqual(errors, [], `Browser emitted errors: ${errors.join(" | ")}`);
  const version = await page.call("Browser.getVersion");
  console.log(`PASS: Bridge Lab browser interactions verified in ${version.product}`);
} finally {
  page?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    chrome.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  await new Promise((resolve) => server.close(() => resolve()));
  await rm(profileDirectory, { recursive: true, force: true });
  if (chrome.exitCode && chrome.exitCode !== 0) {
    console.error(stderr);
  }
}
