import matter from "gray-matter";
import { DEPTHS } from "./knowledge-schema.mjs";

export function extractInternalLinks(content) {
  const links = [];
  const pattern = /!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of content.matchAll(pattern)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|data:|#)/i.test(target)) continue;
    links.push(target);
  }
  return links;
}

export function extractMermaidBlocks(content) {
  const blocks = [];
  const pattern = /```mermaid[^\n]*\n([\s\S]*?)```/g;
  for (const match of content.matchAll(pattern)) {
    const source = match[1].trim();
    if (!source) throw new Error(`Mermaid block ${blocks.length + 1} is empty`);
    blocks.push({ index: blocks.length, source, raw: match[0] });
  }
  return blocks;
}

export function parseMarkdownDocument(source, relativePath) {
  const { data, content } = matter(source);
  for (const key of ["title", "domain", "depth", "created", "updated"]) {
    if (data[key] === undefined) throw new Error(`${relativePath}: missing frontmatter ${key}`);
  }
  if (!DEPTHS.includes(data.depth)) {
    throw new Error(`${relativePath}: invalid depth ${data.depth}`);
  }
  for (const key of ["created", "updated"]) {
    data[key] = data[key] instanceof Date
      ? data[key].toISOString().slice(0, 10)
      : String(data[key]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data[key])) {
      throw new Error(`${relativePath}: invalid ${key} ${data[key]}`);
    }
  }
  return {
    data,
    content,
    links: extractInternalLinks(content),
    mermaidBlocks: extractMermaidBlocks(content)
  };
}
