#!/usr/bin/env node
import process from "node:process";
import { validateRepository } from "./lib/knowledge-model.mjs";

const repoRoot = process.argv[2] ?? process.cwd();
try {
  const { documents } = await validateRepository(repoRoot);
  console.log(`PASS: validated ${documents.length} knowledge documents`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
