import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const demoDirectory = path.dirname(fileURLToPath(import.meta.url));
const runDemo = path.join(demoDirectory, "run-demo.mjs");
const appLog = path.join(demoDirectory, "fixtures", "app.log");
const expectedLiteralArguments = ["two words", "$HOME", "*.md", "-dash"];

const errorRecords = readFileSync(appLog, "utf8")
  .split(/\r?\n/u)
  .filter((line) => line.includes(" ERROR "));
assert.equal(errorRecords.length, 2, "app.log must retain the two-record exercise baseline");

const result = spawnSync(process.execPath, [runDemo, "--json"], {
  cwd: demoDirectory,
  encoding: "utf8",
  windowsHide: true,
  timeout: 30000
});

if (result.error) throw result.error;
assert.equal(result.status, 0, result.stderr);

const report = JSON.parse(result.stdout);
assert.deepEqual(report.direct.expected, expectedLiteralArguments);
assert.deepEqual(report.direct.actual, expectedLiteralArguments);
assert.ok(report.shells.length > 0, "at least one shell profile must be exercised");

for (const shell of report.shells) {
  assert.deepEqual(shell.literalArguments, expectedLiteralArguments, `${shell.id}: literal arguments`);
  assert.deepEqual(shell.expandedVariable, ["value with spaces"], `${shell.id}: quoted variable must remain one argument`);
  assert.equal(shell.pipeline.status, 0, `${shell.id}: pipeline status`);
  assert.equal(shell.pipeline.stdout, "error: timeout\n", `${shell.id}: pipeline output`);
  assert.equal(shell.redirection.status, 0, `${shell.id}: redirection status`);
  assert.equal(shell.redirection.shellStdout, "", `${shell.id}: redirected stdout must leave the shell capture`);
  assert.equal(shell.redirection.shellStderr, "", `${shell.id}: redirected stderr must leave the shell capture`);
  assert.equal(shell.redirection.stdoutFile, "OUT\n", `${shell.id}: stdout file`);
  assert.equal(shell.redirection.stderrFile, "ERR\n", `${shell.id}: stderr file`);
  assert.equal(shell.explicitFailureStatus, 7, `${shell.id}: explicit native exit status`);
  assert.equal(shell.upstreamFailurePipelineStatus, 0, `${shell.id}: final successful stage controls the default pipeline status`);
  if (shell.pipefailStatus !== null) {
    assert.equal(shell.pipefailStatus, 7, `${shell.id}: pipefail exposes upstream failure`);
  }
}

assert.equal(report.lab.kept, false);
assert.equal(report.lab.cleaned, true);
assert.equal(existsSync(report.lab.path), false, "temporary lab must be removed after the demo");

process.stdout.write(`PASS: command-line demo verified ${report.shells.map(({ id }) => id).join(", ")} on ${report.platform} ${report.node}\n`);
