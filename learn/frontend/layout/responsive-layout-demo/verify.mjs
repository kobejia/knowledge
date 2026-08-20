import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const demoDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = await mkdtemp(path.join(tmpdir(), "responsive-layout-demo-"));
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const consoleProblems = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    consoleProblems.push(`${message.type()}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

async function status(id) {
  return page.$eval(id, (element) => element.textContent);
}

async function setRange(value) {
  await page.$eval(
    "#host-width",
    (input, nextValue) => {
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    String(value)
  );
  await page.waitForFunction(
    (expected) => document.querySelector("#host-width-output").value === `${expected}px`,
    {},
    value
  );
}

try {
  await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(demoDirectory, "index.html")).href, {
    waitUntil: "load"
  });

  await setRange(320);
  assert.match(await status("#main-status"), /2 列/);
  assert.match(await status("#embed-status"), /2 列.*宿主错配/);

  await page.select("#strategy", "intrinsic");
  await page.waitForFunction(() => /1 列/.test(document.querySelector("#embed-status").textContent));
  assert.match(await status("#main-status"), /2 列.*上下文匹配/);
  assert.match(await status("#embed-status"), /1 列.*上下文匹配/);

  await page.select("#strategy", "container");
  await page.waitForFunction(() => /1 列/.test(document.querySelector("#embed-status").textContent));
  assert.match(await status("#embed-status"), /1 列.*无溢出/);

  await setRange(640);
  await page.waitForFunction(() => /2 列/.test(document.querySelector("#embed-status").textContent));
  assert.match(await status("#embed-status"), /2 列.*无溢出/);

  await page.select("#content-profile", "stress");
  await page.waitForFunction(() =>
    document.querySelector(".card-token").textContent.startsWith("tenant_")
  );
  assert.match(await status("#embed-status"), /无溢出/);

  await page.screenshot({
    path: path.join(outputDirectory, "wide-container.png"),
    fullPage: true
  });

  await page.setViewport({ width: 375, height: 900, deviceScaleFactor: 1 });
  await page.select("#content-profile", "rtl");
  await page.waitForFunction(() => document.querySelector(".responsive-card").dir === "rtl");
  await page.waitForFunction(() => /无溢出/.test(document.querySelector("#embed-status").textContent));
  assert.equal(
    await page.$eval(".responsive-card", (element) => element.dir),
    "rtl"
  );

  await page.screenshot({
    path: path.join(outputDirectory, "narrow-rtl.png"),
    fullPage: true
  });

  assert.deepEqual(consoleProblems, []);
  console.log(JSON.stringify({
    status: "PASS",
    browser: await browser.version(),
    screenshots: outputDirectory,
    checks: [
      "viewport context mismatch",
      "intrinsic one-column fallback",
      "container threshold transition",
      "long-content overflow",
      "narrow RTL layout",
      "console warnings and errors"
    ]
  }, null, 2));
} finally {
  await browser.close();
}
