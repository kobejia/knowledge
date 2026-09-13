import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { detectShellProfiles, runShell } from "./shell-profiles.mjs";

const demoDirectory = path.dirname(fileURLToPath(import.meta.url));
const argvProbe = path.join(demoDirectory, "argv-probe.mjs");
const streamProbe = path.join(demoDirectory, "stream-probe.mjs");
const lineFilter = path.join(demoDirectory, "line-filter.mjs");
const fixtureDirectory = path.join(demoDirectory, "fixtures");

function parseOptions(argv) {
  const options = { json: false, keep: false, profile: "auto" };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--json") options.json = true;
    else if (option === "--keep") options.keep = true;
    else if (option === "--profile") {
      options.profile = argv[index + 1];
      if (!options.profile) throw new Error("--profile requires a profile id");
      index += 1;
    } else {
      throw new Error(`unknown option: ${option}`);
    }
  }
  return options;
}

function commandResult(result) {
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    signal: result.signal
  };
}

function parseProbe(result, label) {
  const normalized = commandResult(result);
  if (normalized.status !== 0) {
    throw new Error(`${label} failed with ${normalized.status}: ${normalized.stderr}`);
  }
  try {
    return { ...normalized, payload: JSON.parse(normalized.stdout) };
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

function directScenario(labDirectory) {
  const expected = ["two words", "$HOME", "*.md", "-dash"];
  const result = spawnSync(process.execPath, [argvProbe, ...expected], {
    cwd: labDirectory,
    encoding: "utf8",
    windowsHide: true
  });
  const parsed = parseProbe(result, "direct argv probe");
  return { expected, actual: parsed.payload.argv };
}

function shellScenario(profile, labDirectory) {
  const environment = { ...process.env, SHELL_LAB_VALUE: "value with spaces" };
  const literalValues = ["two words", "$HOME", "*.md", "-dash"];

  const literal = parseProbe(
    runShell(profile, profile.invocation(argvProbe, literalValues), { cwd: labDirectory, env: environment }),
    `${profile.id} literal argv probe`
  );

  const variableCommand = `${profile.invocation(argvProbe, [])} ${profile.variableExpression}`;
  const variable = parseProbe(
    runShell(profile, variableCommand, { cwd: labDirectory, env: environment }),
    `${profile.id} variable argv probe`
  );

  const producer = profile.invocation(streamProbe, [
    "--stdout", "alpha",
    "--stdout", "error: timeout",
    "--stdout", "omega"
  ]);
  const consumer = profile.invocation(lineFilter, ["error"]);
  const pipeline = commandResult(runShell(profile, `${producer} | ${consumer}`, {
    cwd: labDirectory,
    env: environment
  }));

  const standardOutputPath = path.join(labDirectory, `${profile.id}-stdout.txt`);
  const standardErrorPath = path.join(labDirectory, `${profile.id}-stderr.txt`);
  const redirectionCommand = [
    profile.invocation(streamProbe, ["--stdout", "OUT", "--stderr", "ERR"]),
    ">", profile.quote(standardOutputPath),
    "2>", profile.quote(standardErrorPath)
  ].join(" ");
  const redirection = commandResult(runShell(profile, redirectionCommand, {
    cwd: labDirectory,
    env: environment
  }));

  const failureCommand = profile.invocation(streamProbe, ["--exit", "7"]);
  const failure = commandResult(runShell(profile, failureCommand, {
    cwd: labDirectory,
    env: environment
  }));

  const upstreamFailure = profile.invocation(streamProbe, ["--stdout", "error", "--exit", "7"]);
  const downstreamSuccess = profile.invocation(lineFilter, ["error"]);
  const pipelineFailure = commandResult(runShell(profile, `${upstreamFailure} | ${downstreamSuccess}`, {
    cwd: labDirectory,
    env: environment
  }));

  const pipefail = profile.pipefailPrefix === null
    ? null
    : commandResult(runShell(
      profile,
      `${profile.pipefailPrefix}${upstreamFailure} | ${downstreamSuccess}`,
      { cwd: labDirectory, env: environment }
    ));

  return {
    id: profile.id,
    family: profile.family,
    command: profile.command,
    literalArguments: literal.payload.argv,
    expandedVariable: variable.payload.argv,
    pipeline: {
      status: pipeline.status,
      stdout: pipeline.stdout,
      stderr: pipeline.stderr
    },
    redirection: {
      status: redirection.status,
      shellStdout: redirection.stdout,
      shellStderr: redirection.stderr,
      stdoutFile: readFileSync(standardOutputPath, "utf8"),
      stderrFile: readFileSync(standardErrorPath, "utf8")
    },
    explicitFailureStatus: failure.status,
    upstreamFailurePipelineStatus: pipelineFailure.status,
    pipefailStatus: pipefail?.status ?? null
  };
}

function safeRemoveLab(labDirectory, temporaryRoot) {
  const relative = path.relative(temporaryRoot, labDirectory);
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || relative === "") {
    throw new Error(`refusing to remove unsafe lab path: ${labDirectory}`);
  }
  if (!path.basename(labDirectory).startsWith("cross-platform-command-line-")) {
    throw new Error(`refusing to remove unexpected lab path: ${labDirectory}`);
  }
  rmSync(labDirectory, { recursive: true, force: true });
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const temporaryRoot = realpathSync(tmpdir());
  const labDirectory = mkdtempSync(path.join(temporaryRoot, "cross-platform-command-line-"));
  let report;

  try {
    cpSync(fixtureDirectory, path.join(labDirectory, "fixtures"), { recursive: true });
    writeFileSync(path.join(labDirectory, "two words.txt"), "space in filename\n", "utf8");
    writeFileSync(path.join(labDirectory, ".hidden-note"), "hidden by naming convention\n", "utf8");
    writeFileSync(path.join(labDirectory, "-dash-name.txt"), "leading dash\n", "utf8");
    writeFileSync(path.join(labDirectory, "你好.txt"), "unicode filename\n", "utf8");

    const detectedProfiles = detectShellProfiles();
    const selectedProfiles = options.profile === "auto"
      ? detectedProfiles
      : detectedProfiles.filter((profile) => profile.id === options.profile);

    if (selectedProfiles.length === 0) {
      throw new Error(`shell profile not available: ${options.profile}; detected: ${detectedProfiles.map(({ id }) => id).join(", ") || "none"}`);
    }

    report = {
      platform: process.platform,
      node: process.version,
      lab: { path: labDirectory, kept: options.keep, cleaned: false },
      fixtures: ["fixtures/app.log", "fixtures/names.txt", "two words.txt", ".hidden-note", "-dash-name.txt", "你好.txt"],
      direct: directScenario(labDirectory),
      shells: selectedProfiles.map((profile) => shellScenario(profile, labDirectory)),
      unavailableProfiles: ["sh", "bash", "zsh", "cmd", "pwsh", "windows-powershell"]
        .filter((id) => !detectedProfiles.some((profile) => profile.id === id))
    };
  } finally {
    if (!options.keep) safeRemoveLab(labDirectory, temporaryRoot);
  }

  report.lab.cleaned = !existsSync(labDirectory);
  process.stdout.write(`${JSON.stringify(report, null, options.json ? 0 : 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`FAIL: ${error.message}\n`);
  process.exitCode = 1;
}
