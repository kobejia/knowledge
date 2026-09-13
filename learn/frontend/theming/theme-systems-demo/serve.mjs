import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const demoRoot = path.dirname(fileURLToPath(import.meta.url));
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"]
]);

export function createDemoServer() {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const relativePath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const filePath = path.resolve(demoRoot, `.${relativePath}`);
    const insideDemo = filePath === demoRoot || filePath.startsWith(`${demoRoot}${path.sep}`);

    if (!insideDemo) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream"
      });
      response.end(body);
    } catch (error) {
      const status = error && error.code === "ENOENT" ? 404 : 500;
      response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
      response.end(status === 404 ? "Not found" : "Internal server error");
    }
  });
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) {
  const configuredPort = Number.parseInt(process.env.THEME_DEMO_PORT ?? "4173", 10);
  const port = Number.isInteger(configuredPort) ? configuredPort : 4173;
  const server = createDemoServer();

  server.listen(port, "127.0.0.1", () => {
    console.log(`Theme Systems Demo: http://127.0.0.1:${port}`);
  });
}
