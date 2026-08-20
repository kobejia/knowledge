import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { zstdDecompress } from "node:zlib";
import { fileURLToPath } from "node:url";

export const DSH_VERSION = "0.1.0-rc.7";
export const TOOL_MARKER = "DSH_TOOL_ROUND_TRIP";

const decompress = promisify(zstdDecompress);
const modulePath = fileURLToPath(import.meta.url);
const zstdFrameMagic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function sseEvents(response, events) {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "close"
  });
  for (const event of events) response.write(`data: ${event}\n\n`);
  response.end();
}

function textEvents(text, usage = { prompt_tokens: 7, completion_tokens: 5 }) {
  return [
    JSON.stringify({
      choices: [{ delta: { role: "assistant", content: null, reasoning_content: "" } }]
    }),
    JSON.stringify({ choices: [{ delta: { content: text } }] }),
    JSON.stringify({ choices: [{ delta: { content: "" }, finish_reason: "stop" }], usage }),
    "[DONE]"
  ];
}

function toolEvents({ toolName = "bash", command = `printf ${TOOL_MARKER}` } = {}) {
  const argumentsJson = JSON.stringify({
    command,
    description: "Prove the DeepSeek Harness tool round trip."
  });
  return [
    JSON.stringify({
      choices: [{ delta: { role: "assistant", content: null, reasoning_content: "" } }]
    }),
    JSON.stringify({
      choices: [{ delta: { content: null, reasoning_content: "Use the safe bash tool and inspect its result." } }]
    }),
    JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "dsh-demo-call",
            type: "function",
            function: { name: toolName, arguments: argumentsJson }
          }]
        }
      }]
    }),
    JSON.stringify({
      choices: [{ delta: { content: "" }, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 11, completion_tokens: 4 }
    }),
    "[DONE]"
  ];
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function startMockDeepSeekServer({ mode }) {
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      const body = await readJsonBody(request);
      const serializedMessages = JSON.stringify(body.messages ?? []);
      const isTitleRequest = serializedMessages.includes("Generate the session title");
      const hasToolResult = Array.isArray(body.messages)
        && body.messages.some((message) => message.role === "tool" || message.tool_call_id);
      const kind = isTitleRequest ? "title" : hasToolResult ? "after-tool" : "initial";
      requests.push({ kind, path: request.url, body });

      if (mode === "failure" && !isTitleRequest) {
        response.writeHead(400, {
          "content-type": "application/json",
          "x-request-id": "dsh-demo-intentional-failure"
        });
        response.end(JSON.stringify({
          error: {
            message: "Intentional local provider failure for the DeepSeek Harness demo.",
            type: "invalid_request_error",
            code: "demo_failure"
          }
        }));
        return;
      }

      if (isTitleRequest) {
        sseEvents(response, textEvents("Harness tool round trip", {
          prompt_tokens: 3,
          completion_tokens: 2
        }));
        return;
      }

      if (hasToolResult) {
        const toolMessage = body.messages.find((message) => message.role === "tool" || message.tool_call_id);
        const toolOutput = typeof toolMessage?.content === "string"
          ? toolMessage.content.trim()
          : JSON.stringify(toolMessage?.content ?? "");
        sseEvents(response, textEvents(`Harness received the tool result: ${toolOutput}`));
        return;
      }

      if (mode === "no-tool") {
        sseEvents(response, textEvents("The simulated model answered without requesting a tool."));
        return;
      }

      if (mode === "unknown-tool") {
        sseEvents(response, toolEvents({ toolName: "missing_tool" }));
        return;
      }

      if (mode === "write-file" || mode === "read-only-write") {
        sseEvents(response, toolEvents({
          command: `printf ${TOOL_MARKER} > harness-proof.txt && cat harness-proof.txt`
        }));
        return;
      }

      sseEvents(response, toolEvents());
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: error.message } }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Mock server did not receive a TCP port.");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

function spawnCapture(command, args, options, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, stdout, stderr, timedOut });
    });
  });
}

async function findFiles(root, predicate) {
  const matches = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (predicate(candidate)) matches.push(candidate);
    }
  }
  await visit(root);
  return matches;
}

async function readSessionRows(dshHome) {
  const candidates = await findFiles(
    path.join(dshHome, "sessions"),
    (candidate) => candidate.endsWith(".jsonl.zstd") || candidate.endsWith(".jsonl")
  );
  if (candidates.length === 0) return { sessionFile: null, rows: [] };

  const sessionFile = candidates.sort().at(-1);
  const bytes = await readFile(sessionFile);
  let text;
  if (sessionFile.endsWith(".zstd")) {
    const frameStarts = [];
    let offset = 0;
    while ((offset = bytes.indexOf(zstdFrameMagic, offset)) !== -1) {
      frameStarts.push(offset);
      offset += zstdFrameMagic.length;
    }
    if (frameStarts[0] !== 0) throw new Error("Session log does not start with a zstd frame.");
    const frames = await Promise.all(frameStarts.map((start, index) => {
      const end = frameStarts[index + 1] ?? bytes.length;
      return decompress(bytes.subarray(start, end));
    }));
    text = Buffer.concat(frames).toString("utf8");
  } else {
    text = bytes.toString("utf8");
  }
  const rows = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  return { sessionFile, rows };
}

function assistantText(event) {
  if (event.type !== "assistant/message") return "";
  return (event.data?.message?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function toolResultText(event) {
  if (event.type !== "tool/result") return "";
  return (event.data?.message?.content ?? [])
    .filter((block) => block.type === "tool-result")
    .flatMap((block) => block.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function summarize({ mode, processResult, requests, sessionFile, rows, tempRoot, keepArtifacts }) {
  const events = rows.filter((row) => row.type !== "session");
  const importantTypes = new Set([
    "turn/start",
    "step/start",
    "request/header",
    "assistant/message",
    "tool/call",
    "tool/result",
    "step/end",
    "turn/end",
    "request/error"
  ]);
  const importantEvents = events
    .filter((event) => importantTypes.has(event.type))
    .map((event) => ({ type: event.type, seq: event.seq, step: event.data?.step }));
  const toolCall = events.find((event) => event.type === "tool/call");
  const toolResult = events.find((event) => event.type === "tool/result");
  const finalMessage = events.findLast((event) => event.type === "assistant/message");
  const resultText = toolResultText(toolResult ?? {});

  return {
    status: processResult.timedOut
      ? "TIMEOUT"
      : processResult.exitCode === 0 ? "PASS" : mode === "failure" ? "EXPECTED_FAILURE" : "FAIL",
    mode,
    dshVersion: DSH_VERSION,
    process: {
      exitCode: processResult.exitCode,
      signal: processResult.signal,
      stdout: processResult.stdout.trim(),
      stderr: processResult.stderr.trim()
    },
    providerRequests: requests.map(({ kind, path: requestPath, body }) => ({
      kind,
      path: requestPath,
      model: body.model,
      toolCount: Array.isArray(body.tools) ? body.tools.length : 0
    })),
    session: {
      persisted: sessionFile !== null,
      file: keepArtifacts ? sessionFile : undefined,
      eventCount: events.length,
      importantEvents,
      toolCall: toolCall === undefined ? null : {
        name: toolCall.data?.name,
        arguments: toolCall.data?.arguments
      },
      toolResultText: resultText,
      toolResultContainsMarker: resultText.includes(TOOL_MARKER),
      toolResultContainsSandboxDenial: resultText.includes("sandbox: file access denied"),
      toolResultIsError: toolResult?.data?.message?.content?.some((block) => block.isError === true) ?? false,
      finalText: assistantText(finalMessage ?? {})
    },
    artifacts: keepArtifacts ? tempRoot : undefined
  };
}

export async function runHarnessDemo({ mode = "success", keepArtifacts = false } = {}) {
  if (!new Set(["success", "no-tool", "unknown-tool", "write-file", "read-only-write", "failure"]).has(mode)) {
    throw new Error(`Unknown demo mode: ${mode}`);
  }

  const tempRoot = await mkdtemp(path.join(tmpdir(), "deepseek-harness-demo-"));
  const workspace = path.join(tempRoot, "workspace");
  const dshHome = path.join(tempRoot, "dsh-home");
  await mkdir(workspace);
  const server = await startMockDeepSeekServer({ mode });

  try {
    const environment = {
      ...process.env,
      DSH_HOME: dshHome,
      DSH_PERMISSION_MODE: mode === "read-only-write" ? "read-only" : "workspace-write",
      DEEPSEEK_API_KEY: "sk-dsh-harness-demo-local-only",
      DEEPSEEK_BASE_URL: server.baseUrl,
      NO_COLOR: "1"
    };
    delete environment.DSH_TELEMETRY_MODE;

    const tasks = {
      success: "Use the bash tool to prove the local Harness tool round trip, then report its exact output.",
      "no-tool": "Answer directly without using a tool.",
      "unknown-tool": "Demonstrate how the Harness records a call to an unavailable tool.",
      "write-file": "Write a proof file inside the temporary workspace, read it, and report the result.",
      "read-only-write": "Attempt the same proof-file write under the read-only file policy.",
      failure: "Trigger the intentional local provider failure and stop."
    };
    const processResult = await spawnCapture(
      "pnpm",
      ["dlx", `@deepseek-ai/dsh@${DSH_VERSION}`, "--profile", "headless", tasks[mode]],
      { cwd: workspace, env: environment }
    );
    const { sessionFile, rows } = await readSessionRows(dshHome);
    return summarize({
      mode,
      processResult,
      requests: server.requests,
      sessionFile,
      rows,
      tempRoot,
      keepArtifacts
    });
  } finally {
    await server.close();
    if (!keepArtifacts) await rm(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const mode = process.argv.includes("--failure")
    ? "failure"
    : process.argv.includes("--no-tool")
      ? "no-tool"
      : process.argv.includes("--unknown-tool")
        ? "unknown-tool"
        : process.argv.includes("--write-file")
          ? "write-file"
          : process.argv.includes("--read-only-write") ? "read-only-write" : "success";
  const keepArtifacts = process.argv.includes("--keep");
  const summary = await runHarnessDemo({ mode, keepArtifacts });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status === "FAIL" || summary.status === "TIMEOUT") process.exitCode = 1;
}
