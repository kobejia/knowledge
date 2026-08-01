import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    name: "automated tests",
    command: process.execPath,
    args: ["--test", "tests/personal-learning/knowledge-image.test.mjs", "tests/personal-learning/knowledge-validator.test.mjs", "tests/personal-learning/preview-builder.test.mjs"]
  },
  {
    name: "personal-learning configuration contract",
    command: "sh",
    args: ["tests/personal-learning/test-config.sh"]
  },
  {
    name: "personal-learning structure contract",
    command: "sh",
    args: ["tests/personal-learning/test-structure.sh"]
  },
  {
    name: "knowledge repository validation",
    command: process.execPath,
    args: ["scripts/validate-knowledge.mjs"]
  },
  {
    name: "offline preview build",
    command: process.execPath,
    args: ["scripts/build-preview.mjs"]
  }
];

for (const check of checks) {
  console.log(`\n> ${check.name}`);
  const result = spawnSync(check.command, check.args, {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`FAIL: ${check.name}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPASS: repository checks completed");
