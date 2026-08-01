import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";
import { categorySchema, knowledgeSchema } from "./knowledge-schema.mjs";
import { parseMarkdownDocument } from "./markdown-document.mjs";

const ajv = new Ajv({ allErrors: true });
ajv.addSchema(categorySchema);
const validateKnowledge = ajv.compile(knowledgeSchema);

function schemaError() {
  return validateKnowledge.errors.map((error) => {
    const location = error.instancePath || "root";
    const detail = error.keyword === "additionalProperties"
      ? `unknown property ${error.params.additionalProperty}`
      : error.message;
    return `${location}: ${detail}`;
  }).join("; ");
}

function assertUnique(values, value, label) {
  if (values.has(value)) throw new Error(`duplicate ${label}: ${value}`);
  values.add(value);
}

function walkCategories(categories, parentSegments, visit) {
  for (const category of categories) {
    const segments = [...parentSegments, category.path];
    visit({ category, segments });
    walkCategories(category.children, segments, visit);
  }
}

async function listMarkdown(directory, relativeBase = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeBase, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listMarkdown(absolutePath, relativePath));
    else if (entry.isFile() && entry.name.endsWith(".md")) result.push(relativePath);
  }
  return result;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function validateDocument(repoRoot, contentRootReal, document) {
  const absolutePath = path.join(repoRoot, document.relativePath);
  let resolved;
  try {
    resolved = await realpath(absolutePath);
  } catch {
    throw new Error(`${document.relativePath}: indexed file does not exist`);
  }
  if (!inside(contentRootReal, resolved)) {
    throw new Error(`${document.relativePath}: path escapes contentRoot`);
  }
  const parsed = parseMarkdownDocument(await readFile(resolved, "utf8"), document.relativePath);
  if (parsed.data.title !== document.item.title) {
    throw new Error(`${document.relativePath}: title does not match index`);
  }
  if (parsed.data.domain !== document.topLevelDomain) {
    throw new Error(`${document.relativePath}: domain must be ${document.topLevelDomain}`);
  }
  for (const link of parsed.links) {
    const cleanTarget = decodeURIComponent(link.split(/[?#]/, 1)[0]);
    if (!cleanTarget) continue;
    const linkedPath = path.resolve(path.dirname(resolved), cleanTarget);
    if (!inside(repoRoot, linkedPath)) throw new Error(`${document.relativePath}: link escapes repository: ${link}`);
    try {
      await stat(linkedPath);
    } catch {
      throw new Error(`${document.relativePath}: broken internal link ${link}`);
    }
  }
  return { ...document, absolutePath: resolved, parsed };
}

export async function validateRepository(repoRoot) {
  const root = await realpath(repoRoot);
  const knowledgePath = path.join(root, "personal-learn-knowledge.json");
  let knowledge;
  try {
    knowledge = JSON.parse(await readFile(knowledgePath, "utf8"));
  } catch (error) {
    throw new Error(`personal-learn-knowledge.json: ${error.message}`);
  }
  if (!validateKnowledge(knowledge)) throw new Error(`invalid knowledge schema: ${schemaError()}`);

  const categoryIds = new Set();
  const documentIds = new Set();
  const indexedPaths = new Set();
  const documents = [];
  walkCategories(knowledge.categories, [], ({ category, segments }) => {
    assertUnique(categoryIds, category.id, "category id");
    for (const item of category.documents) {
      assertUnique(documentIds, item.id, "document id");
      const relativePath = path.posix.join(knowledge.contentRoot, ...segments, item.path);
      if (indexedPaths.has(relativePath)) throw new Error(`duplicate document path: ${relativePath}`);
      indexedPaths.add(relativePath);
      documents.push({
        item,
        category,
        segments,
        topLevelDomain: segments[0],
        relativePath
      });
    }
  });

  const contentRoot = path.join(root, knowledge.contentRoot);
  let contentRootReal;
  try {
    contentRootReal = await realpath(contentRoot);
  } catch {
    throw new Error(`${knowledge.contentRoot}: contentRoot does not exist`);
  }
  if (!inside(root, contentRootReal)) throw new Error(`${knowledge.contentRoot}: contentRoot escapes repository`);

  const validatedDocuments = [];
  for (const document of documents) {
    validatedDocuments.push(await validateDocument(root, contentRootReal, document));
  }

  const files = await listMarkdown(contentRoot);
  const actualPaths = new Set(files.map((file) => path.posix.join(knowledge.contentRoot, file)));
  for (const relativePath of actualPaths) {
    if (!indexedPaths.has(relativePath)) throw new Error(`${relativePath}: Markdown is not indexed`);
  }
  for (const relativePath of indexedPaths) {
    if (!actualPaths.has(relativePath)) throw new Error(`${relativePath}: indexed file does not exist`);
  }
  return { knowledge, documents: validatedDocuments };
}
