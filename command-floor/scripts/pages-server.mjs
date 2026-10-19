import { createReadStream, mkdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const pagesRoot = "/tmp/org-dashboard-pages";
const site = join(pagesRoot, "org-dashboard");
rmSync(pagesRoot, { recursive: true, force: true });
mkdirSync(pagesRoot);
symlinkSync("/workspace", site);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const port = 4174;
createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = normalize(resolve(pagesRoot, `.${pathname}`));
  if (file !== pagesRoot && !file.startsWith(pagesRoot + sep)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error("missing");
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, "127.0.0.1");
