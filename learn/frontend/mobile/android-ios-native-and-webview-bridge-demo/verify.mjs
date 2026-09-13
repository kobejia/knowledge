import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BridgeError,
  createBridgeClient,
  createEvent,
  createResponse,
  validateEnvelope
} from "./bridge-core.mjs";
import { createDemoServer } from "./serve.mjs";

const demoRoot = path.dirname(fileURLToPath(import.meta.url));

function clientHarness(options = {}) {
  const sent = [];
  const diagnostics = [];
  const client = createBridgeClient({
    sessionId: options.sessionId ?? "test-page",
    timeoutMs: options.timeoutMs ?? 100,
    send(message) {
      sent.push(message);
    },
    onDiagnostic(entry) {
      diagnostics.push(entry);
    }
  });
  return { client, sent, diagnostics };
}

{
  const { client, sent } = clientHarness();
  const promise = client.call("bridge.getAppInfo");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, "request");
  assert.equal(client.snapshot().pending.length, 1);
  client.receive(createResponse(sent[0], { ok: true, result: { platform: "android" } }));
  assert.deepEqual(await promise, { platform: "android" });
  assert.equal(client.snapshot().pending.length, 0);
}

{
  const { client, sent } = clientHarness();
  const first = client.call("bridge.getAppInfo");
  const second = client.call("navigation.openNativePage", { route: "trip/detail" });
  client.receive(createResponse(sent[1], { ok: true, result: { order: 2 } }));
  client.receive(createResponse(sent[0], { ok: true, result: { order: 1 } }));
  assert.deepEqual(await Promise.all([first, second]), [{ order: 1 }, { order: 2 }]);
}

{
  const { client, sent } = clientHarness();
  const promise = client.call("media.chooseImage");
  client.receive(createResponse(sent[0], {
    ok: false,
    code: "PERMISSION_DENIED",
    message: "Photo access denied",
    retryable: false
  }));
  await assert.rejects(promise, (error) => error instanceof BridgeError && error.code === "PERMISSION_DENIED");
}

{
  const { client, sent, diagnostics } = clientHarness({ timeoutMs: 20 });
  const promise = client.call("system.slowOperation");
  await assert.rejects(promise, (error) => error instanceof BridgeError && error.code === "BRIDGE_TIMEOUT");
  assert.equal(client.receive(createResponse(sent[0], { ok: true, result: { late: true } })), false);
  assert(diagnostics.some((entry) => entry.type === "late-or-duplicate-response"));
}

{
  const { client } = clientHarness();
  const promise = client.call("system.slowOperation");
  client.invalidate("test page reload");
  await assert.rejects(promise, (error) => error instanceof BridgeError && error.code === "BRIDGE_INVALIDATED");
  assert.equal(client.snapshot().active, false);
}

{
  const { client } = clientHarness();
  let lifecycle = "foreground";
  client.on("app.lifecycle", (data) => {
    lifecycle = data.phase;
  });
  assert.equal(client.receive(createEvent({
    sessionId: "test-page",
    name: "app.lifecycle",
    data: { phase: "background" }
  })), true);
  assert.equal(lifecycle, "background");
  assert.equal(client.receive(createEvent({
    sessionId: "another-page",
    name: "app.lifecycle",
    data: { phase: "foreground" }
  })), false);
  assert.equal(lifecycle, "background");
}

assert.throws(
  () => validateEnvelope({ protocol: "wrong", version: 1, kind: "event", sessionId: "x", name: "x" }),
  (error) => error instanceof BridgeError && error.code === "INVALID_PROTOCOL"
);

const [hostHtml, webviewHtml, css, hostScript, webviewScript] = await Promise.all([
  readFile(path.join(demoRoot, "index.html"), "utf8"),
  readFile(path.join(demoRoot, "webview.html"), "utf8"),
  readFile(path.join(demoRoot, "styles.css"), "utf8"),
  readFile(path.join(demoRoot, "host.js"), "utf8"),
  readFile(path.join(demoRoot, "webview.js"), "utf8")
]);

for (const id of [
  "platform",
  "fault-profile",
  "emit-background",
  "simulate-untrusted",
  "reload-webview",
  "webview-frame",
  "native-log"
]) {
  assert(hostHtml.includes(`id="${id}"`), `host page is missing #${id}`);
}

for (const id of [
  "get-app-info",
  "choose-image",
  "run-concurrent",
  "run-slow",
  "pending-count",
  "last-result",
  "web-log"
]) {
  assert(webviewHtml.includes(`id="${id}"`), `WebView page is missing #${id}`);
}

for (const contract of [
  "AndroidBridge",
  "messageHandlers",
  "sourceOrigin",
  "ORIGIN_REJECTED",
  "VERSION_UNSUPPORTED",
  "PERMISSION_DENIED"
]) {
  assert(hostScript.includes(contract), `host is missing ${contract}`);
}

for (const contract of ["createBridgeClient", "Promise.allSettled", "app.lifecycle", "timeoutMs: 400"]) {
  assert(webviewScript.includes(contract), `WebView client is missing ${contract}`);
}

assert(css.includes("@media (max-width: 500px)"), "demo requires a narrow viewport layout");
assert(css.includes("prefers-reduced-motion: reduce"), "demo requires a reduced-motion fallback");

for (const script of ["bridge-core.mjs", "host.js", "webview.js", "serve.mjs", "verify.mjs", "browser-verify.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(demoRoot, script)], { encoding: "utf8" });
  assert.equal(result.status, 0, `${script} syntax check failed: ${result.stderr}`);
}

const server = createDemoServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  for (const [resource, type] of [
    ["/", "text/html"],
    ["/webview.html", "text/html"],
    ["/styles.css", "text/css"],
    ["/host.js", "text/javascript"],
    ["/webview.js", "text/javascript"],
    ["/bridge-core.mjs", "text/javascript"]
  ]) {
    const response = await fetch(`${baseUrl}${resource}`);
    assert.equal(response.status, 200, `${resource} did not return HTTP 200`);
    assert(response.headers.get("content-type")?.startsWith(type), `${resource} has the wrong content type`);
    assert((await response.text()).length > 100, `${resource} returned an unexpectedly small body`);
  }
  const missing = await fetch(`${baseUrl}/missing.txt`);
  assert.equal(missing.status, 404);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log("PASS: Bridge protocol, static contracts, syntax, and HTTP resources verified");
