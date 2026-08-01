#!/usr/bin/env node
import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { validateRepository } from "./lib/knowledge-model.mjs";
import { renderAllDocuments, renderPreviewPage } from "./lib/render-preview.mjs";

export async function buildPreview(repoRoot, outputPath = path.join(repoRoot, "personal-learning-preview.html")) {
  const model = await validateRepository(repoRoot);
  const documents = await renderAllDocuments(model);
  const html = renderPreviewPage({ knowledge: model.knowledge, documents });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, html, "utf8");
    await rename(temporary, outputPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return Object.keys(documents).length;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const count = await buildPreview(process.cwd());
    console.log(`PASS: built personal-learning-preview.html with ${count} documents`);
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
