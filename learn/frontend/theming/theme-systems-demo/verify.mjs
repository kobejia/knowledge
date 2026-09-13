import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDemoServer } from "./serve.mjs";

const demoRoot = path.dirname(fileURLToPath(import.meta.url));

const [html, css, app] = await Promise.all([
  readFile(path.join(demoRoot, "index.html"), "utf8"),
  readFile(path.join(demoRoot, "styles.css"), "utf8"),
  readFile(path.join(demoRoot, "app.js"), "utf8")
]);

const earlyBootIndex = html.indexOf("bootTheme");
const stylesheetIndex = html.indexOf('rel="stylesheet"');
assert(earlyBootIndex >= 0, "index.html must contain an early theme bootstrap");
assert(stylesheetIndex > earlyBootIndex, "theme bootstrap must run before the stylesheet is discovered");

for (const mode of ["system", "light", "dark"]) {
  assert(html.includes(`name="mode" value="${mode}"`), `missing ${mode} mode control`);
}

for (const skin of ["ocean", "orchid"]) {
  assert(html.includes(`name="skin" value="${skin}"`), `missing ${skin} skin control`);
  assert(css.includes(`data-skin="${skin}"`), `missing ${skin} token mapping`);
}

for (const token of [
  "--brand-accent-light",
  "--color-canvas",
  "--color-surface",
  "--color-text",
  "--color-accent",
  "--color-canvas-fill"
]) {
  assert(css.includes(token), `missing token ${token}`);
}

function tokenValue(selector, token) {
  const ruleStart = css.indexOf(`${selector} {`);
  assert(ruleStart >= 0, `missing rule ${selector}`);
  const ruleEnd = css.indexOf("}", ruleStart);
  const rule = css.slice(ruleStart, ruleEnd);
  const match = rule.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
  assert(match, `missing hexadecimal ${token} in ${selector}`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

const lightRule = ':root[data-scheme="light"]';
const darkRule = ':root[data-scheme="dark"]';
const schemeTokens = {
  light: {
    canvas: tokenValue(lightRule, "--color-canvas"),
    surface: tokenValue(lightRule, "--color-surface"),
    mutedSurface: tokenValue(lightRule, "--color-surface-muted"),
    text: tokenValue(lightRule, "--color-text"),
    mutedText: tokenValue(lightRule, "--color-text-muted"),
    border: tokenValue(lightRule, "--color-border"),
    focus: tokenValue(lightRule, "--color-focus")
  },
  dark: {
    canvas: tokenValue(darkRule, "--color-canvas"),
    surface: tokenValue(darkRule, "--color-surface"),
    mutedSurface: tokenValue(darkRule, "--color-surface-muted"),
    text: tokenValue(darkRule, "--color-text"),
    mutedText: tokenValue(darkRule, "--color-text-muted"),
    border: tokenValue(darkRule, "--color-border"),
    focus: tokenValue(darkRule, "--color-focus")
  }
};

for (const [scheme, tokens] of Object.entries(schemeTokens)) {
  for (const [foreground, background, minimum, label] of [
    [tokens.text, tokens.canvas, 4.5, "text/canvas"],
    [tokens.text, tokens.surface, 4.5, "text/surface"],
    [tokens.mutedText, tokens.surface, 4.5, "muted-text/surface"],
    [tokens.border, tokens.surface, 3, "border/surface"],
    [tokens.border, tokens.mutedSurface, 3, "border/muted-surface"],
    [tokens.focus, tokens.canvas, 3, "focus/canvas"]
  ]) {
    const ratio = contrastRatio(foreground, background);
    assert(ratio >= minimum, `${scheme} ${label} contrast ${ratio.toFixed(2)} is below ${minimum}:1`);
  }
}

for (const skin of ["ocean", "orchid"]) {
  const selector = `:root[data-skin="${skin}"]`;
  for (const [suffix, surface] of [
    ["light", schemeTokens.light.surface],
    ["dark", schemeTokens.dark.surface]
  ]) {
    const accent = tokenValue(selector, `--brand-accent-${suffix}`);
    const accentStrong = tokenValue(selector, `--brand-accent-strong-${suffix}`);
    const accentSoft = tokenValue(selector, `--brand-soft-${suffix}`);
    assert(
      contrastRatio(accent, surface) >= 4.5,
      `${skin} ${suffix} accent does not support normal text against the scheme surface`
    );
    assert(
      contrastRatio(accentStrong, accentSoft) >= 4.5,
      `${skin} ${suffix} strong/soft accent pair is below 4.5:1`
    );
  }
}

for (const contract of [
  "prefers-reduced-motion: reduce",
  "forced-colors: active",
  "light-dark(",
  "color-scheme: light dark",
  'data-local-scheme="light"',
  'data-local-scheme="dark"'
]) {
  assert(css.includes(contract), `missing CSS contract ${contract}`);
}

for (const behavior of [
  'matchMedia("(prefers-color-scheme: dark)")',
  'addEventListener("change", handleSystemSchemeChange)',
  'addEventListener("storage"',
  "localStorage.setItem",
  "localStorage.removeItem",
  "renderCanvas",
  'dataset.appReady = "true"',
  'new CustomEvent("themechange"'
]) {
  assert(app.includes(behavior), `missing runtime behavior ${behavior}`);
}

for (const script of ["app.js", "serve.mjs", "verify.mjs", "browser-verify.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(demoRoot, script)], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, `${script} syntax check failed: ${result.stderr}`);
}

const server = createDemoServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();
  assert(address && typeof address === "object", "demo server did not expose an address");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const [resource, expectedType] of [
    ["/", "text/html"],
    ["/styles.css", "text/css"],
    ["/app.js", "text/javascript"]
  ]) {
    const response = await fetch(`${baseUrl}${resource}`);
    assert.equal(response.status, 200, `${resource} did not return HTTP 200`);
    assert(
      response.headers.get("content-type")?.startsWith(expectedType),
      `${resource} returned the wrong content type`
    );
    assert((await response.text()).length > 100, `${resource} returned an unexpectedly small body`);
  }

  const missing = await fetch(`${baseUrl}/missing.txt`);
  assert.equal(missing.status, 404, "missing resources must return HTTP 404");
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

console.log("PASS: theme systems demo static and HTTP contracts verified");
