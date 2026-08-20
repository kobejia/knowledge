import assert from "node:assert/strict";
import { DSH_VERSION, TOOL_MARKER, runHarnessDemo } from "./run-demo.mjs";

function eventIndex(events, type, occurrence = 1) {
  let seen = 0;
  return events.findIndex((event) => {
    if (event.type !== type) return false;
    seen += 1;
    return seen === occurrence;
  });
}

const success = await runHarnessDemo();
assert.equal(success.status, "PASS", success.process.stderr);
assert.equal(success.dshVersion, DSH_VERSION);
assert.equal(success.process.exitCode, 0);
assert.match(success.process.stdout, new RegExp(TOOL_MARKER));
assert.equal(success.session.persisted, true);
assert.equal(success.session.toolCall?.name, "bash");
assert.match(success.session.toolCall?.arguments ?? "", new RegExp(TOOL_MARKER));
assert.equal(success.session.toolResultContainsMarker, true);
assert.match(success.session.finalText, new RegExp(TOOL_MARKER));

const events = success.session.importantEvents;
const firstStep = eventIndex(events, "step/start", 1);
const toolCall = eventIndex(events, "tool/call");
const toolResult = eventIndex(events, "tool/result");
const firstStepEnd = eventIndex(events, "step/end", 1);
const secondStep = eventIndex(events, "step/start", 2);
const finalMessage = eventIndex(events, "assistant/message", 2);
const turnEnd = eventIndex(events, "turn/end");
assert.ok(firstStep >= 0 && firstStep < toolCall);
assert.ok(toolCall < toolResult);
assert.ok(toolResult < firstStepEnd);
assert.ok(firstStepEnd < secondStep);
assert.ok(secondStep < finalMessage);
assert.ok(finalMessage < turnEnd);
assert.equal(success.providerRequests.some((request) => request.kind === "initial"), true);
assert.equal(success.providerRequests.some((request) => request.kind === "after-tool"), true);

const noTool = await runHarnessDemo({ mode: "no-tool" });
assert.equal(noTool.status, "PASS", noTool.process.stderr);
assert.equal(noTool.session.toolCall, null);
assert.equal(noTool.session.toolResultContainsMarker, false);
assert.equal(noTool.providerRequests.filter((request) => request.kind !== "title").length, 1);
assert.match(noTool.session.finalText, /without requesting a tool/);

const unknownTool = await runHarnessDemo({ mode: "unknown-tool" });
assert.equal(unknownTool.status, "PASS", unknownTool.process.stderr);
assert.equal(unknownTool.session.toolCall?.name, "missing_tool");
assert.equal(unknownTool.session.toolResultIsError, true);
assert.equal(unknownTool.providerRequests.some((request) => request.kind === "after-tool"), true);

const workspaceWrite = await runHarnessDemo({ mode: "write-file" });
assert.equal(workspaceWrite.status, "PASS", workspaceWrite.process.stderr);
assert.equal(workspaceWrite.session.toolCall?.name, "bash");
assert.equal(workspaceWrite.session.toolResultContainsMarker, true);
assert.equal(workspaceWrite.session.toolResultIsError, false);

const readOnlyWrite = await runHarnessDemo({ mode: "read-only-write" });
assert.equal(readOnlyWrite.status, "PASS", readOnlyWrite.process.stderr);
assert.equal(readOnlyWrite.session.toolCall?.name, "bash");
assert.equal(readOnlyWrite.session.toolResultContainsMarker, false);
assert.equal(readOnlyWrite.session.toolResultContainsSandboxDenial, true);
assert.equal(readOnlyWrite.session.toolResultIsError, false);
assert.match(readOnlyWrite.session.toolResultText, /exit code: 1/);

const failure = await runHarnessDemo({ mode: "failure" });
assert.equal(failure.status, "EXPECTED_FAILURE");
assert.notEqual(failure.process.exitCode, 0);
assert.equal(failure.session.persisted, true);
assert.equal(failure.session.toolCall, null);
assert.equal(failure.providerRequests.some((request) => request.kind === "initial"), true);
assert.match(
  `${failure.process.stdout}\n${failure.process.stderr}`,
  /Intentional local provider failure|INVALID_REQUEST|demo_failure/i
);

console.log(JSON.stringify({
  status: "PASS",
  dshVersion: DSH_VERSION,
  checks: [
    "official headless profile boot",
    "local DeepSeek-compatible SSE adapter path",
    "real bash tool call and result",
    "two-step agent loop",
    "append-only persisted session log",
    "direct answer without a tool",
    "unknown-tool error as a tool result",
    "workspace-write file effect",
    "read-only file-effect denial",
    "intentional provider failure"
  ],
  success: {
    eventCount: success.session.eventCount,
    providerRequests: success.providerRequests.map((request) => request.kind),
    finalText: success.session.finalText
  },
  noTool: {
    eventCount: noTool.session.eventCount,
    providerRequests: noTool.providerRequests.map((request) => request.kind)
  },
  unknownTool: {
    eventCount: unknownTool.session.eventCount,
    toolResultIsError: unknownTool.session.toolResultIsError
  },
  permissions: {
    workspaceWriteIsError: workspaceWrite.session.toolResultIsError,
    readOnlyWriteIsError: readOnlyWrite.session.toolResultIsError,
    readOnlyWriteDenied: readOnlyWrite.session.toolResultContainsSandboxDenial
  },
  failure: {
    exitCode: failure.process.exitCode,
    providerRequests: failure.providerRequests.map((request) => request.kind)
  }
}, null, 2));
