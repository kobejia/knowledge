import process from "node:process";

const pattern = process.argv[2];
if (pattern === undefined) {
  process.stderr.write("usage: node line-filter.mjs <literal-pattern>\n");
  process.exitCode = 2;
} else {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  const matches = input.split(/\r?\n/u).filter((line) => line.includes(pattern));
  if (matches.length > 0) process.stdout.write(`${matches.join("\n")}\n`);
  process.exitCode = matches.length > 0 ? 0 : 1;
}
