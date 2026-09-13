import process from "node:process";

const stdoutLines = [];
const stderrLines = [];
let exitCode = 0;
let readStdin = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const option = process.argv[index];
  if (option === "--stdout" || option === "--stderr" || option === "--exit") {
    const value = process.argv[index + 1];
    if (value === undefined) {
      process.stderr.write(`missing value for ${option}\n`);
      process.exitCode = 2;
      process.exit();
    }
    index += 1;
    if (option === "--stdout") stdoutLines.push(value);
    if (option === "--stderr") stderrLines.push(value);
    if (option === "--exit") {
      exitCode = Number(value);
      if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
        process.stderr.write("--exit must be an integer from 0 to 255\n");
        process.exitCode = 2;
        process.exit();
      }
    }
    continue;
  }
  if (option === "--read-stdin") {
    readStdin = true;
    continue;
  }
  process.stderr.write(`unknown option: ${option}\n`);
  process.exitCode = 2;
  process.exit();
}

if (readStdin) {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  stdoutLines.push(`stdin:${JSON.stringify(input)}`);
}

for (const line of stdoutLines) process.stdout.write(`${line}\n`);
for (const line of stderrLines) process.stderr.write(`${line}\n`);
process.exitCode = exitCode;
