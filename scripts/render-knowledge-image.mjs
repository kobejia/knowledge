import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderToString } from '@antv/infographic/ssr';
import puppeteer from 'puppeteer';

const [input, outputBase] = process.argv.slice(2);
if (!input || !outputBase) {
  console.error('Usage: node scripts/render-knowledge-image.mjs <infographic.md|visual.html> <output-base>');
  process.exit(1);
}

const source = await fs.readFile(input, 'utf8');
await fs.mkdir(path.dirname(outputBase), { recursive: true });

let html;
let artifactSelector;
if (input.endsWith('.md')) {
  const match = source.match(/```infographic\n([\s\S]*?)\n```/);
  if (!match) throw new Error(`No infographic fenced block found in ${input}`);
  const svg = await renderToString(match[1]);
  await fs.writeFile(`${outputBase}.svg`, svg);
  html = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f8fafc}#artifact{display:inline-block;padding:32px}svg{display:block;background:white;border-radius:18px;box-shadow:0 16px 50px rgba(15,23,42,.12)}</style><main id="artifact">${svg}</main>`;
  artifactSelector = '#artifact';
  await fs.writeFile(`${outputBase}.html`, html);
} else {
  html = source;
}

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(input.endsWith('.md') ? `${outputBase}.html` : input)).href, { waitUntil: 'networkidle0' });
  const dimensions = await page.evaluate(() => ({
    width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  if (artifactSelector) {
    const artifact = await page.$(artifactSelector);
    if (!artifact) throw new Error(`Missing artifact selector: ${artifactSelector}`);
    await artifact.screenshot({ path: `${outputBase}.png` });
  } else {
    await page.screenshot({ path: `${outputBase}.png`, fullPage: true });
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ input, output: `${outputBase}.png`, ...dimensions }));
} finally {
  await browser.close();
}
