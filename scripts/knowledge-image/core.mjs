import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export const ROOT = process.cwd();
export const ARTICLES_ROOT = path.join(ROOT, 'docs/knowledge-images/articles');

export const hash = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
export const slugify = (value) => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
  .replace(/^-|-$/g, '') || 'article';

export async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

export async function readJson(file, fallback = null) {
  if (!await exists(file)) return fallback;
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function writeIfChanged(file, content) {
  const previous = await fs.readFile(file, 'utf8').catch(() => null);
  if (previous === content) return false;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.new`;
  await fs.writeFile(temporary, content);
  await fs.rename(temporary, file);
  return true;
}

export async function writeJson(file, value) {
  return writeIfChanged(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function parseArticle(markdown, source) {
  const parsed = matter(markdown);
  const lines = parsed.content.split(/\r?\n/);
  const title = parsed.data.title || lines.find((line) => /^# /.test(line))?.slice(2).trim();
  if (!title) throw new Error(`Markdown 缺少 title 或 H1：${source}`);
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    const match = !inFence && line.match(/^##\s+(.+)/);
    if (match) {
      if (current) sections.push(current);
      current = { title: match[1].trim(), lines: [] };
    } else if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  if (!sections.length) throw new Error(`Markdown 至少需要一个 H2：${source}`);
  const used = new Map();
  return {
    title,
    metadata: parsed.data,
    sections: sections.map((section, index) => {
      const base = slugify(section.title.replace(/^[一二三四五六七八九十\d]+[、.]?\s*/, ''));
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      const content = section.lines.join('\n').trim();
      return { id, index, title: section.title, content, hash: hash(content) };
    }),
  };
}

function plainText(value) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function concise(value, limit = 88) {
  const text = plainText(value);
  return text.length > limit ? `${text.slice(0, limit - 1).replace(/[，、；：,.!?\s]+$/u, '')}…` : text;
}

function cleanTitle(value) {
  return value.replace(/^[一二三四五六七八九十\d.]+[、.]?\s*/, '').trim();
}

function sectionPoints(section) {
  const listItems = [...section.content.matchAll(/^\s*[-*]\s+(.+)$/gm)].map((match) => concise(match[1]));
  if (listItems.length) return listItems.slice(0, 4);
  return plainText(section.content).split(/(?<=[。！？.!?])\s*/).filter((item) => item.length >= 12).slice(0, 3).map((item) => concise(item));
}

export function planFigures(article) {
  const count = Math.max(1, Math.min(5, Math.ceil(article.sections.length / 2)));
  const groups = Array.from({ length: count }, () => []);
  article.sections.forEach((section, index) => groups[Math.floor(index * count / article.sections.length)].push(section));
  return groups.map((sections, index) => {
    const firstTopic = cleanTitle(sections[0].title);
    const topic = sections.length === 1 ? firstTopic : `${firstTopic}等 ${sections.length} 个主题`;
    return {
      id: `${String(index + 1).padStart(2, '0')}-${slugify(sections[0].title).slice(0, 42)}`,
      title: topic,
      question: `${topic}：核心模型、约束与取舍`,
      sourceSections: sections.map((section) => section.id),
      sections,
    };
  });
}

export function makeBrief(article, figure) {
  const blocks = figure.sections.map((section) => {
    const points = sectionPoints(section);
    const items = points.length ? points : ['该部分需要在视觉审阅时进一步压缩。'];
    return `## ${section.title}\n\n${items.map((item) => `- ${item}`).join('\n')}`;
  }).join('\n\n');
  return `---\ntitle: ${JSON.stringify(figure.title)}\nsource: ${JSON.stringify(article.title)}\nfigure: ${figure.id}\n---\n\n# ${figure.question}\n\n${blocks}\n`;
}

const escapeHtml = (value) => value.replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

export function makeHtml(article, figure, brief) {
  const cards = figure.sections.map((section, index) => {
    const points = sectionPoints(section);
    return `<article class="ve-card"><span class="index">${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(section.title)}</h2><ul>${(points.length ? points : ['待进一步提炼']).map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul></article>`;
  }).join('');
  return `<!doctype html>
<html lang="zh-CN" data-render-ready="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(figure.title)}</title><style>
:root{--bg:#f3efe6;--surface:#fffdf8;--border:#b9ae98;--text:#20251f;--text-dim:#63685e;--accent:#a24832;--sage:#49675b;--gold:#c49742}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:"IBM Plex Sans","Noto Sans SC",sans-serif;background:var(--bg);color:var(--text)}main{width:1600px;height:1000px;padding:72px 84px;display:grid;grid-template-rows:auto 1fr auto;gap:42px;background:linear-gradient(90deg,rgba(73,103,91,.07) 1px,transparent 1px),var(--bg);background-size:80px 80px}.eyebrow{font:600 20px "IBM Plex Mono","Noto Sans Mono",monospace;letter-spacing:.08em;color:var(--accent)}h1{font-family:"Noto Serif SC","Songti SC",serif;font-size:58px;line-height:1.15;margin:12px 0 0;max-width:1280px}.grid{display:grid;grid-template-columns:repeat(${Math.min(3, figure.sections.length)},minmax(0,1fr));gap:24px;align-content:stretch}.ve-card{min-width:0;padding:30px 32px;border:1px solid var(--border);border-radius:18px;background:var(--surface);box-shadow:0 12px 30px rgba(54,48,37,.08)}.index{font:700 18px "IBM Plex Mono",monospace;color:var(--accent)}h2{font-size:30px;line-height:1.25;margin:16px 0 22px;color:var(--sage)}ul{margin:0;padding-left:1.2em}li{font-size:21px;line-height:1.55;margin:.5em 0;overflow-wrap:break-word}footer{display:flex;justify-content:space-between;gap:24px;border-top:1px solid var(--border);padding-top:20px;font:17px "IBM Plex Mono","Noto Sans Mono",monospace;color:var(--text-dim)}
</style></head><body><main data-figure="${figure.id}" data-brief-hash="${hash(brief)}"><header><div class="eyebrow">KNOWLEDGE MAP · ${String(figure.sourceSections.length).padStart(2, '0')} TOPICS</div><h1>${escapeHtml(figure.question)}</h1></header><section class="grid">${cards}</section><footer><span>${escapeHtml(article.title)}</span><span>${escapeHtml(figure.id)}</span></footer></main></body></html>\n`;
}

export function articleDir(slug) { return path.join(ARTICLES_ROOT, slug); }

export async function resolveTarget(target) {
  const candidate = path.resolve(ROOT, target);
  if (target.endsWith('.md') || await exists(candidate)) {
    if (!candidate.startsWith(`${ROOT}${path.sep}`)) throw new Error('原文必须位于当前项目内');
    if (!await exists(candidate)) throw new Error(`原文不存在：${target}`);
    return { sourcePath: candidate, slug: slugify(path.basename(candidate, '.md')) };
  }
  const manifest = await readJson(path.join(articleDir(target), 'manifest.json'));
  if (!manifest) throw new Error(`未找到文章产物：${target}`);
  return { sourcePath: path.resolve(ROOT, manifest.source), slug: target, manifest };
}

export async function appendRevision(dir, event) {
  const revisionDir = path.join(dir, 'revisions');
  await fs.mkdir(revisionDir, { recursive: true });
  const entries = await fs.readdir(revisionDir);
  const id = entries.filter((name) => /^\d{4}-/.test(name)).length + 1;
  const name = `${String(id).padStart(4, '0')}-${event.type}.json`;
  await writeJson(path.join(revisionDir, name), { id, createdAt: new Date().toISOString(), ...event });
}
