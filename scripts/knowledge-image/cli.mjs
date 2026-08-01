#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import {
  ROOT, appendRevision, articleDir, exists, hash, makeBrief, makeHtml,
  parseArticle, planFigures, readJson, resolveTarget, writeIfChanged, writeJson,
} from './core.mjs';

const [command, target, ...args] = process.argv.slice(2);
if (!command || !target) usage();
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const has = (name) => args.includes(name);

function usage() {
  console.error('Usage: npm run knowledge:image -- <prepare|status|approve|render|finalize|cleanup> <source-or-slug> [--hard] [--figure id] [--dry-run] [--keep-work]');
  process.exit(1);
}

async function prepare() {
  const { sourcePath, slug } = await resolveTarget(target);
  const dir = articleDir(slug);
  const source = await fs.readFile(sourcePath, 'utf8');
  const article = parseArticle(source, path.relative(ROOT, sourcePath));
  const sourceHash = hash(source);
  const old = await readJson(path.join(dir, 'manifest.json'));
  if (old?.sourceHash === sourceHash && !has('--hard')) {
    console.log(JSON.stringify({ command: 'prepare', slug, changed: false, reason: 'source-unchanged' }, null, 2));
    return;
  }
  const figures = planFigures(article);
  await fs.mkdir(dir, { recursive: true });
  const nextFigures = [];
  for (const figure of figures) {
    const brief = makeBrief(article, figure);
    const html = makeHtml(article, figure, brief);
    const briefFile = path.join(dir, 'briefs', `${figure.id}.md`);
    const draftFile = path.join(dir, 'drafts', `${figure.id}.html`);
    await writeIfChanged(briefFile, brief);
    await writeIfChanged(draftFile, html);
    const previous = old?.figures?.find((item) => item.id === figure.id);
    const unchanged = !has('--hard') && previous?.draftHash === hash(html);
    nextFigures.push({
      id: figure.id, title: figure.title, question: figure.question,
      sourceSections: figure.sourceSections, briefHash: hash(brief), draftHash: hash(html),
      approvedDraftHash: unchanged ? previous.approvedDraftHash : null,
      publishedImageHash: unchanged ? previous.publishedImageHash : null,
      status: unchanged ? previous.status : 'draft-ready', locks: previous?.locks || [], dirtyBlocks: [],
    });
  }
  const now = new Date().toISOString();
  const manifest = {
    version: 1, articleId: slug, title: article.title, source: path.relative(ROOT, sourcePath), sourceHash,
    generator: { engine: 'visual-explainer', skillVersion: '0.8.1', pipelineVersion: 1 },
    build: { mode: has('--hard') ? 'hard' : 'incremental', status: 'reviewing', updatedAt: now, cleanupStatus: old?.build?.cleanupStatus || null },
    figures: nextFigures,
  };
  const sourceMap = {
    version: 1, sourceHash,
    sections: article.sections.map(({ id, index, title, hash: sectionHash }) => ({ id, index, title, hash: sectionHash })),
    dependencies: figures.map(({ id, sourceSections }) => ({ figure: id, sourceSections })),
  };
  const plan = `# ${article.title}：知识图片计划\n\n共 ${figures.length} 张。每张图回答一个可独立审阅的主问题。\n\n${figures.map((figure, index) => `## ${index + 1}. ${figure.title}\n\n- ID：\`${figure.id}\`\n- 主问题：${figure.question}\n- 来源章节：${figure.sections.map((section) => section.title).join('、')}`).join('\n\n')}\n`;
  await writeJson(path.join(dir, 'source-map.json'), sourceMap);
  await writeIfChanged(path.join(dir, 'plan.md'), plan);
  await writeJson(path.join(dir, 'manifest.json'), manifest);
  await appendRevision(dir, { type: has('--hard') ? 'hard-regeneration' : 'prepare', status: 'applied', sourceHash, figures: figures.map(({ id }) => id) });
  await renderPreviews(dir, nextFigures);
  console.log(JSON.stringify({ command: 'prepare', slug, changed: true, figures: figures.length, previews: nextFigures.length, directory: path.relative(ROOT, dir) }, null, 2));
}

async function renderPreviews(dir, figures) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    for (const figure of figures) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(dir, 'drafts', `${figure.id}.html`)).href, { waitUntil: 'networkidle0' });
      await page.evaluate(async () => { await document.fonts.ready; });
      const readiness = await page.evaluate(() => ({
        ready: document.documentElement.dataset.renderReady === 'true',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.documentElement.scrollHeight > document.documentElement.clientHeight,
      }));
      if (!readiness.ready || readiness.overflow) throw new Error(`${figure.id} 草稿预览 QA 失败：${JSON.stringify(readiness)}`);
      const output = path.join(dir, 'previews', `${figure.id}.draft.png`);
      await fs.mkdir(path.dirname(output), { recursive: true });
      await page.screenshot({ path: output });
      await page.close();
    }
  } finally { await browser.close(); }
}

async function status() {
  const { slug, sourcePath, manifest: supplied } = await resolveTarget(target);
  const manifest = supplied || await readJson(path.join(articleDir(slug), 'manifest.json'));
  const sourceHash = hash(await fs.readFile(sourcePath, 'utf8'));
  console.log(JSON.stringify({ articleId: slug, sourceChanged: sourceHash !== manifest.sourceHash, build: manifest.build, figures: manifest.figures.map((figure) => ({ id: figure.id, status: figure.status, approved: figure.approvedDraftHash === figure.draftHash, dirtyBlocks: figure.dirtyBlocks, locks: figure.locks })) }, null, 2));
}

async function approve() {
  const { slug } = await resolveTarget(target);
  const dir = articleDir(slug);
  const manifestFile = path.join(dir, 'manifest.json');
  const manifest = await readJson(manifestFile);
  const figureId = option('--figure');
  const selected = manifest.figures.filter((figure) => !figureId || figure.id === figureId);
  if (!selected.length) throw new Error(`未找到图片：${figureId}`);
  for (const figure of selected) {
    const draft = await fs.readFile(path.join(dir, 'drafts', `${figure.id}.html`), 'utf8');
    figure.draftHash = hash(draft);
    figure.approvedDraftHash = figure.draftHash;
    figure.status = 'approved';
  }
  manifest.build.status = manifest.figures.every((figure) => figure.status === 'approved' || figure.status === 'published') ? 'approved' : 'reviewing';
  manifest.build.updatedAt = new Date().toISOString();
  await writeJson(manifestFile, manifest);
  await appendRevision(dir, { type: 'approve', status: 'applied', figures: selected.map(({ id, approvedDraftHash }) => ({ id, approvedDraftHash })) });
  console.log(JSON.stringify({ command: 'approve', slug, figures: selected.map(({ id }) => id) }, null, 2));
}

async function render({ finalize = false } = {}) {
  const { slug } = await resolveTarget(target);
  const dir = articleDir(slug);
  const manifestFile = path.join(dir, 'manifest.json');
  const manifest = await readJson(manifestFile);
  const figureId = option('--figure');
  const selected = manifest.figures.filter((figure) => !figureId || figure.id === figureId);
  if (!selected.length) throw new Error(`未找到图片：${figureId}`);
  if (finalize && selected.some((figure) => figure.status !== 'approved' && figure.status !== 'published')) throw new Error('finalize 要求所有目标图片已 approve');
  const browser = await puppeteer.launch({ headless: true });
  const rendered = [];
  try {
    for (const figure of selected) {
      if (figure.status !== 'approved') continue;
      const draftFile = path.join(dir, 'drafts', `${figure.id}.html`);
      const draft = await fs.readFile(draftFile, 'utf8');
      if (hash(draft) !== figure.approvedDraftHash) {
        figure.status = 'reviewing'; figure.approvedDraftHash = null;
        throw new Error(`${figure.id} 的 HTML 在 approve 后发生变化，请重新 approve`);
      }
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(draftFile).href, { waitUntil: 'networkidle0' });
      await page.evaluate(async () => { await document.fonts.ready; });
      const qa = await page.evaluate(() => ({
        ready: document.documentElement.dataset.renderReady === 'true',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.documentElement.scrollHeight > document.documentElement.clientHeight,
        width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      }));
      if (!qa.ready || qa.overflow || errors.length) throw new Error(`${figure.id} QA 失败：${JSON.stringify({ ...qa, errors })}`);
      const temporary = path.join(dir, '.tmp', `${figure.id}.png`);
      const output = path.join(dir, 'images', `${figure.id}.png`);
      await fs.mkdir(path.dirname(temporary), { recursive: true });
      await fs.mkdir(path.dirname(output), { recursive: true });
      await page.screenshot({ path: temporary });
      await page.close();
      const png = await fs.readFile(temporary);
      await fs.rename(temporary, output);
      figure.publishedImageHash = hash(png);
      figure.status = 'published';
      await writeJson(path.join(dir, 'qa', `${figure.id}.json`), { version: 1, figure: figure.id, draftHash: figure.draftHash, imageHash: figure.publishedImageHash, viewport: { width: 1600, height: 1000 }, checks: { ...qa, consoleErrors: errors, passed: true }, checkedAt: new Date().toISOString() });
      rendered.push(figure.id);
    }
  } finally { await browser.close(); }
  manifest.build.status = manifest.figures.every((figure) => figure.status === 'published') ? 'published' : 'reviewing';
  manifest.build.updatedAt = new Date().toISOString();
  await writeJson(manifestFile, manifest);
  if (rendered.length) await appendRevision(dir, { type: 'render', status: 'applied', figures: rendered });
  console.log(JSON.stringify({ command: finalize ? 'finalize' : 'render', slug, rendered, skipped: selected.filter((figure) => !rendered.includes(figure.id)).map(({ id }) => id) }, null, 2));
  if (finalize && rendered.length && !has('--keep-work')) await cleanup(false);
}

async function cleanup(log = true) {
  const { slug } = await resolveTarget(target);
  const dir = articleDir(slug);
  const manifestFile = path.join(dir, 'manifest.json');
  const manifest = await readJson(manifestFile);
  const candidates = [];
  for (const figure of manifest.figures) {
    for (const relative of [`previews/${figure.id}.draft.png`, `previews/${figure.id}.failed.png`, `qa/${figure.id}.draft.json`]) {
      const file = path.join(dir, relative); if (await exists(file)) candidates.push({ file, relative, reason: 'superseded-intermediate' });
    }
  }
  const tmp = path.join(dir, '.tmp');
  if (await exists(tmp)) {
    for (const name of await fs.readdir(tmp)) candidates.push({ file: path.join(tmp, name), relative: `.tmp/${name}`, reason: 'temporary-render-file' });
  }
  if (has('--dry-run')) { console.log(JSON.stringify({ command: 'cleanup', slug, dryRun: true, files: candidates.map(({ relative, reason }) => ({ path: relative, reason })) }, null, 2)); return; }
  const deleted = [];
  try {
    for (const item of candidates) { const content = await fs.readFile(item.file); await fs.unlink(item.file); deleted.push({ path: item.relative, hash: hash(content), reason: item.reason }); }
    await fs.rmdir(tmp).catch(() => {});
    manifest.build.cleanupStatus = 'passed';
    manifest.build.updatedAt = new Date().toISOString();
    await writeJson(manifestFile, manifest);
    if (deleted.length) await appendRevision(dir, { type: 'cleanup', status: 'applied', deleted });
  } catch (error) {
    manifest.build.cleanupStatus = 'failed'; manifest.build.cleanupError = error.message;
    await writeJson(manifestFile, manifest); throw error;
  }
  if (log) console.log(JSON.stringify({ command: 'cleanup', slug, dryRun: false, deleted }, null, 2));
}

try {
  if (command === 'prepare') await prepare();
  else if (command === 'status') await status();
  else if (command === 'approve') await approve();
  else if (command === 'render') await render();
  else if (command === 'finalize') await render({ finalize: true });
  else if (command === 'cleanup') await cleanup();
  else usage();
} catch (error) { console.error(`knowledge:image: ${error.message}`); process.exitCode = 1; }
