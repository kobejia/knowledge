import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "@mermaid-js/mermaid-cli";

export function namespaceSvg(svg, namespace) {
  const safeNamespace = namespace.replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  return svg.replaceAll("my-svg", `personal-learn-${safeNamespace}`);
}

export async function renderMermaid(source, context) {
  const directory = await mkdtemp(path.join(tmpdir(), "personal-learn-mermaid-"));
  const input = path.join(directory, "diagram.mmd");
  const output = path.join(directory, "diagram.svg");
  try {
    await writeFile(input, source, "utf8");
    await run(input, output, { quiet: true });
    const svg = await readFile(output, "utf8");
    const namespace = `${context.relativePath}-${context.index + 1}`;
    return namespaceSvg(svg, namespace);
  } catch (error) {
    throw new Error(`${context.relativePath}: Mermaid block ${context.index + 1}: ${error.message}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
