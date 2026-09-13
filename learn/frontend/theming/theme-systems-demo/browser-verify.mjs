import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createDemoServer } from "./serve.mjs";

const chromeCandidates = [
  process.env.THEME_DEMO_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined,
  process.platform === "linux" ? "/usr/bin/google-chrome" : undefined,
  process.platform === "linux" ? "/usr/bin/chromium" : undefined
].filter(Boolean);

async function firstExistingPath(paths) {
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

async function waitFor(check, message, timeout = 10_000) {
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
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
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

      const listeners = this.listeners.get(message.method) ?? [];
      for (const listener of listeners) listener(message.params);
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

  waitForEvent(method, timeout = 10_000) {
    return new Promise((resolve, reject) => {
      const listeners = this.listeners.get(method) ?? [];
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
      listeners.push((params) => {
        clearTimeout(timer);
        resolve(params);
      });
      this.listeners.set(method, listeners);
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  assert(!result.exceptionDetails, result.exceptionDetails?.text ?? "browser evaluation failed");
  return result.result.value;
}

async function waitForReady(client) {
  try {
    await waitFor(
      async () =>
        evaluate(
          client,
          'document.readyState === "complete" && document.documentElement.dataset.appReady === "true"'
        ),
      "page did not become ready"
    );
  } catch (error) {
    const diagnostics = await evaluate(
      client,
      `({
        url: location.href,
        readyState: document.readyState,
        appReadyFlag: document.documentElement?.dataset.appReady ?? null,
        transitionReadyFlag: document.documentElement?.dataset.ready ?? null,
        hasAppScript: [...document.scripts].some((script) => script.src.endsWith('/app.js'))
      })`
    ).catch((diagnosticError) => ({ diagnosticError: diagnosticError.message }));
    error.message += `: ${JSON.stringify(diagnostics)}`;
    throw error;
  }
}

const chromePath = await firstExistingPath(chromeCandidates);
assert(chromePath, "Chrome/Chromium not found; set THEME_DEMO_CHROME to its executable path");

const server = createDemoServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const serverAddress = server.address();
assert(serverAddress && typeof serverAddress === "object");
const demoUrl = `http://127.0.0.1:${serverAddress.port}`;
const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "theme-systems-chrome-"));
const chrome = spawn(
  chromePath,
  [
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
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
);

let chromeStderr = "";
chrome.stderr.setEncoding("utf8");
chrome.stderr.on("data", (chunk) => {
  chromeStderr += chunk;
});

const clients = [];
const browserErrors = [];

try {
  const activePortFile = path.join(profileDirectory, "DevToolsActivePort");
  const devToolsPort = await waitFor(async () => {
    const content = await readFile(activePortFile, "utf8");
    return Number.parseInt(content.split(/\r?\n/, 1)[0], 10);
  }, "Chrome did not expose a DevTools port");

  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`);
    const items = await response.json();
    return items.some((item) => item.type === "page") ? items : null;
  }, "Chrome did not expose a page target");
  const pageTarget = targets.find((item) => item.type === "page");
  const page = new CdpClient(pageTarget.webSocketDebuggerUrl);
  clients.push(page);
  await page.open();
  await Promise.all([page.call("Page.enable"), page.call("Runtime.enable"), page.call("Log.enable")]);

  page.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    browserErrors.push(`exception: ${exceptionDetails.text}`);
  });
  page.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type === "error") browserErrors.push(`console: ${args.map((arg) => arg.value ?? arg.description).join(" ")}`);
  });
  page.on("Log.entryAdded", ({ entry }) => {
    if (entry.level === "error") browserErrors.push(`log: ${entry.text}`);
  });

  await page.call("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-color-scheme", value: "dark" }]
  });
  const loaded = page.waitForEvent("Page.loadEventFired");
  await page.call("Page.navigate", { url: demoUrl });
  await loaded;
  await waitForReady(page);

  const initial = await evaluate(
    page,
    `({
      mode: document.documentElement.dataset.theme,
      scheme: document.documentElement.dataset.scheme,
      skin: document.documentElement.dataset.skin,
      system: document.querySelector('#system-scheme').value,
      canvas: document.querySelector('#theme-canvas').toDataURL(),
      canvasRenders: document.querySelector('#canvas-render-count').value,
      lightDarkSupported: CSS.supports('color', 'light-dark(white, black)')
    })`
  );
  assert.equal(initial.mode, "system");
  assert.equal(initial.scheme, "dark");
  assert.equal(initial.skin, "ocean");
  assert.equal(initial.system, "dark");
  assert.match(initial.canvasRenders, /render count: [1-9]/);

  const explicitLight = await evaluate(
    page,
    `(async () => {
      document.querySelector('input[name="mode"][value="light"]').click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        mode: document.documentElement.dataset.theme,
        scheme: document.documentElement.dataset.scheme,
        stored: localStorage.getItem(document.documentElement.dataset.themeStorageKey),
        canvas: document.querySelector('#theme-canvas').toDataURL()
      };
    })()`
  );
  assert.deepEqual(
    { mode: explicitLight.mode, scheme: explicitLight.scheme, stored: explicitLight.stored },
    { mode: "light", scheme: "light", stored: "light" }
  );
  assert.notEqual(explicitLight.canvas, initial.canvas, "Canvas must be redrawn with different theme pixels");

  await page.call("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-color-scheme", value: "light" }]
  });
  await delay(100);
  assert.equal(await evaluate(page, "document.documentElement.dataset.scheme"), "light");

  await evaluate(page, 'document.querySelector(\'input[name="mode"][value="system"]\').click()');
  assert.equal(await evaluate(page, "document.documentElement.dataset.scheme"), "light");

  await page.call("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-color-scheme", value: "dark" }]
  });
  await waitFor(
    async () => (await evaluate(page, "document.documentElement.dataset.scheme")) === "dark",
    "system mode did not react to a media-query change"
  );

  const localAndSkin = await evaluate(
    page,
    `(() => {
      document.querySelector('input[name="skin"][value="orchid"]').click();
      const select = document.querySelector('#local-scheme');
      select.value = 'light';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const card = document.querySelector('#local-theme-card');
      return {
        skin: document.documentElement.dataset.skin,
        storedSkin: localStorage.getItem(document.documentElement.dataset.skinStorageKey),
        localScheme: getComputedStyle(card).colorScheme
      };
    })()`
  );
  assert.deepEqual(localAndSkin, { skin: "orchid", storedSkin: "orchid", localScheme: "light" });

  const secondTargetResponse = await fetch(
    `http://127.0.0.1:${devToolsPort}/json/new?${encodeURIComponent(demoUrl)}`,
    { method: "PUT" }
  );
  assert(secondTargetResponse.ok, "could not create a second browser tab");
  const secondTarget = await secondTargetResponse.json();
  const secondPage = new CdpClient(secondTarget.webSocketDebuggerUrl);
  clients.push(secondPage);
  await secondPage.open();
  await Promise.all([secondPage.call("Runtime.enable"), secondPage.call("Page.enable")]);
  await waitForReady(secondPage);
  assert.equal(await evaluate(secondPage, "document.documentElement.dataset.skin"), "orchid");

  await evaluate(page, 'document.querySelector(\'input[name="skin"][value="ocean"]\').click()');
  await waitFor(
    async () => (await evaluate(secondPage, "document.documentElement.dataset.skin")) === "ocean",
    "second tab did not receive the storage event"
  );
  assert.equal(await evaluate(secondPage, "document.querySelector('#last-source').value"), "cross-tab-skin");

  const activateFirstPage = await fetch(
    `http://127.0.0.1:${devToolsPort}/json/activate/${pageTarget.id}`
  );
  assert(activateFirstPage.ok, "could not reactivate the first browser tab");

  await page.call("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [
      { name: "prefers-color-scheme", value: "dark" },
      { name: "forced-colors", value: "active" }
    ]
  });
  const forcedColors = await evaluate(page, "matchMedia('(forced-colors: active)').matches");
  assert.equal(forcedColors, true, "Chrome did not activate forced-colors emulation");

  await evaluate(
    page,
    `(() => {
      localStorage.setItem(document.documentElement.dataset.themeStorageKey, 'sepia');
      localStorage.setItem(document.documentElement.dataset.skinStorageKey, 'unknown-brand');
    })()`
  );
  const reloaded = page.waitForEvent("Page.loadEventFired");
  await page.call("Page.navigate", { url: `${demoUrl}/?invalid-value-check=1` });
  await reloaded;
  await waitForReady(page);
  const invalidValueFallback = await evaluate(
    page,
    `({
      mode: document.documentElement.dataset.theme,
      scheme: document.documentElement.dataset.scheme,
      skin: document.documentElement.dataset.skin
    })`
  );
  assert.deepEqual(invalidValueFallback, { mode: "system", scheme: "dark", skin: "ocean" });

  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false
  });
  const narrowLayout = await evaluate(
    page,
    `({
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      mainWidth: Math.round(document.querySelector('main').getBoundingClientRect().width),
      controlsWidth: Math.round(document.querySelector('.control-panel').getBoundingClientRect().width)
    })`
  );
  assert(
    narrowLayout.scrollWidth <= narrowLayout.innerWidth,
    `narrow viewport has horizontal overflow: ${JSON.stringify(narrowLayout)}`
  );

  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  const wideLayout = await evaluate(
    page,
    `({ innerWidth, scrollWidth: document.documentElement.scrollWidth })`
  );
  assert(wideLayout.scrollWidth <= wideLayout.innerWidth, "wide viewport has horizontal overflow");

  assert.deepEqual(browserErrors, [], `browser errors found:\n${browserErrors.join("\n")}`);
  console.log(
    `PASS: Chrome theme interactions verified (light-dark=${initial.lightDarkSupported}, forced-colors-emulation=${forcedColors})`
  );
} catch (error) {
  if (browserErrors.length > 0) error.message += `\nBrowser errors:\n${browserErrors.join("\n")}`;
  if (chromeStderr) error.message += `\nChrome stderr tail:\n${chromeStderr.slice(-2000)}`;
  throw error;
} finally {
  for (const client of clients) client.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(() => resolve()));
  await rm(profileDirectory, { recursive: true, force: true });
}
