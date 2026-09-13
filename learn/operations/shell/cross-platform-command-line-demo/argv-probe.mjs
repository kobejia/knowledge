import process from "node:process";

const selectedEnvironment = {};
for (const name of ["SHELL", "ComSpec", "COMSPEC", "SHELL_LAB_VALUE"]) {
  if (process.env[name] !== undefined) selectedEnvironment[name] = process.env[name];
}

process.stdout.write(`${JSON.stringify({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  platform: process.platform,
  selectedEnvironment
})}\n`);
