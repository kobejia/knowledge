import assert from 'node:assert/strict';
import test from 'node:test';
import { makeBrief, makeHtml, parseArticle, planFigures, slugify } from '../../scripts/knowledge-image/core.mjs';

const markdown = `---\ntitle: 测试文章\n---\n# 测试文章\n\n## 一、模型\n\n- 事实一\n- 事实二\n\n## 二、边界\n\n这是一个需要被提炼的边界说明。它还包含第二个判断。\n\n## 三、实践\n\n- 建议一\n`;

test('parseArticle creates stable section ids and hashes', () => {
  const article = parseArticle(markdown, 'test.md');
  assert.equal(article.title, '测试文章');
  assert.equal(article.sections.length, 3);
  assert.match(article.sections[0].hash, /^sha256:/);
});

test('planFigures keeps output in the 1-5 range and covers every section', () => {
  const article = parseArticle(markdown, 'test.md');
  const figures = planFigures(article);
  assert.equal(figures.length, 2);
  assert.deepEqual(figures.flatMap((figure) => figure.sourceSections), article.sections.map((section) => section.id));
});

test('generated visual is self-contained and render-ready', () => {
  const article = parseArticle(markdown, 'test.md');
  const figure = planFigures(article)[0];
  const brief = makeBrief(article, figure);
  const html = makeHtml(article, figure, brief);
  assert.match(brief, /# .*核心模型/);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /data-render-ready="true"/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});

test('slugify produces a safe fallback', () => {
  assert.equal(slugify('***'), 'article');
});
