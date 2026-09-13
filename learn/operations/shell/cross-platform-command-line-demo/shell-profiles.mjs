import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

function quotePosix(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function quoteCmd(value) {
  if (/[\r\n%]/u.test(value)) {
    throw new Error("CMD demo values cannot contain newlines or percent signs");
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function canRun(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000
  });
  return !result.error && result.status === 0;
}

function posixProfile(id, command) {
  return {
    id,
    family: "posix",
    command,
    quote: quotePosix,
    invocation(script, args) {
      return [quotePosix(process.execPath), quotePosix(script), ...args.map(quotePosix)].join(" ");
    },
    variableExpression: '"$SHELL_LAB_VALUE"',
    shellArgs(commandText) {
      return ["-c", commandText];
    },
    pipefailPrefix: id === "bash" || id === "zsh" ? "set -o pipefail; " : null
  };
}

function powerShellProfile(id, command) {
  return {
    id,
    family: "powershell",
    command,
    quote: quotePowerShell,
    invocation(script, args) {
      return ["&", quotePowerShell(process.execPath), quotePowerShell(script), ...args.map(quotePowerShell)].join(" ");
    },
    variableExpression: '"$env:SHELL_LAB_VALUE"',
    shellArgs(commandText) {
      return ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `${commandText}; exit $LASTEXITCODE`];
    },
    pipefailPrefix: null
  };
}

function cmdProfile(command) {
  return {
    id: "cmd",
    family: "cmd",
    command,
    quote: quoteCmd,
    invocation(script, args) {
      return [quoteCmd(process.execPath), quoteCmd(script), ...args.map(quoteCmd)].join(" ");
    },
    variableExpression: '"%SHELL_LAB_VALUE%"',
    shellArgs(commandText) {
      return ["/d", "/v:off", "/c", commandText];
    },
    pipefailPrefix: null
  };
}

export function detectShellProfiles() {
  const profiles = [];

  if (process.platform === "win32") {
    const commandShell = process.env.ComSpec ?? process.env.COMSPEC ?? "cmd.exe";
    if (canRun(commandShell, ["/d", "/c", "exit 0"])) profiles.push(cmdProfile(commandShell));
  } else {
    for (const [id, command] of [["sh", "/bin/sh"], ["bash", "/bin/bash"], ["zsh", "/bin/zsh"]]) {
      if (existsSync(command) && canRun(command, ["-c", "exit 0"])) profiles.push(posixProfile(id, command));
    }
  }

  const powerShellCandidates = process.platform === "win32"
    ? [["pwsh", "pwsh.exe"], ["windows-powershell", "powershell.exe"]]
    : [["pwsh", "pwsh"]];

  for (const [id, command] of powerShellCandidates) {
    if (canRun(command, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "exit 0"])) {
      profiles.push(powerShellProfile(id, command));
      break;
    }
  }

  return profiles;
}

export function runShell(profile, commandText, options = {}) {
  return spawnSync(profile.command, profile.shellArgs(commandText), {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000
  });
}
