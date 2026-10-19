import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appRoot, "..");
const dist = join(appRoot, "dist");
const manifestPath = join(repoRoot, "assets", "floor-manifest.json");

if (!existsSync(join(dist, "index.html"))) {
  throw new Error("command-floor/dist/index.html is missing. Run vite build first.");
}

if (existsSync(manifestPath)) {
  const previous = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const rel of previous.files ?? []) {
    if (typeof rel !== "string" || rel.includes("..") || rel.startsWith("/")) continue;
    rmSync(join(repoRoot, rel), { force: true });
  }
}

const files = [];

function copyRel(fromAbs, rel) {
  if (rel.split("/").includes("..")) throw new Error(`refusing to publish ${rel}`);
  const dest = join(repoRoot, rel);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(fromAbs, dest);
  files.push(rel);
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walk(abs);
      continue;
    }
    const rel = relative(dist, abs).split("\\").join("/");
    copyRel(abs, rel);
  }
}

walk(dist);

const listed = [...new Set([...files, "assets/floor-manifest.json"])];
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify({ files: listed }, null, 2)}\n`);
