// Post-build: turn TanStack's SPA output into a flat static dist/ for Netlify.
// dist/client/* -> dist/*, _shell.html -> index.html, and dist/server is removed (no server bundle).
import { cpSync, existsSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");

if (!existsSync(client)) {
  console.error("flatten-dist: dist/client not found. Did vite build run?");
  process.exit(1);
}

// Copy client output into a temp dir, then swap, so dist/ never ends up half-written.
const tmp = join(root, ".dist-flat");
rmSync(tmp, { recursive: true, force: true });
cpSync(client, tmp, { recursive: true });

rmSync(dist, { recursive: true, force: true });
cpSync(tmp, dist, { recursive: true });
rmSync(tmp, { recursive: true, force: true });

const shell = join(dist, "_shell.html");
if (existsSync(shell)) renameSync(shell, join(dist, "index.html"));
if (!existsSync(join(dist, "index.html"))) {
  console.error("flatten-dist: no index.html produced");
  process.exit(1);
}

console.log(`flatten-dist: dist/index.html + ${readdirSync(join(dist, "assets")).length} asset files (server bundle removed: ${!existsSync(server)})`);
