import { spawn } from "node:child_process";
import { existsSync, readFileSync, watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const outputDir = resolve(root, "dist");

if (!existsSync(envPath)) {
  console.error("Missing .env. Copy .env.example to .env and add your Supabase development settings.");
  process.exit(1);
}

const envValues = new Map();
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match) continue;
  envValues.set(match[1], match[2].replace(/^(?:"(.*)"|'(.*)')$/, "$1$2"));
}

const requiredEnv = [
  "APP_ORIGIN",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SESSION_ENCRYPTION_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
];
const missingEnv = requiredEnv.filter((key) => !envValues.get(key));

if (missingEnv.length > 0) {
  console.error(`Missing required settings in .env: ${missingEnv.join(", ")}`);
  process.exit(1);
}

if (envValues.get("APP_ORIGIN") !== "http://localhost:8788") {
  console.error("Set APP_ORIGIN=http://localhost:8788 in .env so local API requests use the correct origin.");
  process.exit(1);
}

const expo = resolve(root, "node_modules/expo/bin/cli");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");

for (const executable of [expo, wrangler]) {
  if (!existsSync(executable)) {
    console.error("Dependencies are missing. Run pnpm install, then try pnpm dev:web again.");
    process.exit(1);
  }
}

const children = new Set();
const watchers = [];
let shuttingDown = false;

function writeLines(stream, name, chunk) {
  for (const line of chunk.toString().split(/(?<=\n)/)) {
    if (line) stream.write(`[${name}] ${line}`);
  }
}

function stop(signal = "SIGTERM", exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const watcher of watchers) watcher.close();
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }

  const forceStop = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }, 5000);
  forceStop.unref();
}

function runExport() {
  return new Promise((resolveExit) => {
    const child = spawn(
      process.execPath,
      [expo, "export", "--platform", "web", "--output-dir", outputDir],
      { cwd: root, env: process.env, stdio: ["inherit", "pipe", "pipe"] },
    );
    children.add(child);
    child.stdout.on("data", (chunk) => writeLines(process.stdout, "expo", chunk));
    child.stderr.on("data", (chunk) => writeLines(process.stderr, "expo", chunk));
    child.on("error", (error) => {
      console.error(`[expo] Could not start the web export: ${error.message}`);
      children.delete(child);
      resolveExit(1);
    });
    child.on("exit", (code, signal) => {
      children.delete(child);
      resolveExit(signal ? 1 : (code ?? 1));
    });
  });
}

function startServer(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });
  children.add(child);
  child.stdout.on("data", (chunk) => writeLines(process.stdout, name, chunk));
  child.stderr.on("data", (chunk) => writeLines(process.stderr, name, chunk));
  child.on("error", (error) => {
    console.error(`[${name}] Could not start: ${error.message}`);
    stop("SIGTERM", 1);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
      console.error(`[${name}] Stopped unexpectedly (${reason}); stopping the other local servers.`);
      stop("SIGTERM", code && code !== 0 ? code : 1);
    }
  });
}

function watchForWebChanges() {
  let timer;
  let exporting = false;
  let rebuildPending = false;

  const scheduleExport = () => {
    if (shuttingDown) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (exporting) {
        rebuildPending = true;
        return;
      }

      exporting = true;
      console.log("Web source changed; rebuilding the local site...");
      const exitCode = await runExport();
      exporting = false;

      if (!shuttingDown) {
        if (exitCode === 0) console.log("Local site rebuilt; Pages will refresh the browser.");
        else console.error("Web export failed. Fix the error and save a file to try again.");
        if (rebuildPending) {
          rebuildPending = false;
          scheduleExport();
        }
      }
    }, 350);
  };

  const rootFiles = new Set([
    "app.json",
    "babel.config.js",
    "metro.config.js",
    "package.json",
    "tailwind.config.js",
    "tsconfig.json",
    "uniwind.config.ts",
  ]);

  const rootWatcher = watch(root, (_event, filename) => {
    if (!filename || rootFiles.has(filename.toString())) scheduleExport();
  });
  rootWatcher.on("error", (error) => console.error(`[watch] ${error.message}`));
  watchers.push(rootWatcher);

  for (const directory of ["assets", "public", "src"]) {
    const watchPath = resolve(root, directory);
    if (!existsSync(watchPath)) continue;
    try {
      const watcher = watch(watchPath, { recursive: true }, scheduleExport);
      watcher.on("error", (error) => console.error(`[watch:${directory}] ${error.message}`));
      watchers.push(watcher);
    } catch (error) {
      console.error(`[watch:${directory}] Could not watch files: ${error.message}`);
    }
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

async function main() {
  console.log("Building the local web site. First startup can take a minute...");
  const exportExitCode = await runExport();
  if (shuttingDown) return;
  if (exportExitCode !== 0) {
    console.error("The initial web export failed; local servers were not started.");
    stop("SIGTERM", exportExitCode);
    return;
  }

  console.log("Starting Cloudflare Pages and the local session worker. Open http://localhost:8788 when ready.");
  startServer("session-store", [
    wrangler,
    "dev",
    "--config",
    "cloudflare/session-store/wrangler.jsonc",
    "--ip",
    "127.0.0.1",
    "--inspector-port",
    "9230",
    "--port",
    "8787",
    "--env-file",
    envPath,
  ]);
  startServer("pages", [
    wrangler,
    "pages",
    "dev",
    outputDir,
    "--ip",
    "127.0.0.1",
    "--inspector-port",
    "9231",
    "--port",
    "8788",
    "--compatibility-date",
    "2026-11-26",
    "--do",
    "SESSION_STORE=SessionStore@revit-auth-session-store",
    "--env-file",
    envPath,
    "--live-reload",
  ]);
  watchForWebChanges();
  console.log("Watching app code and assets; changes rebuild the static web bundle and refresh the page.");
}

main().catch((error) => {
  console.error(error);
  stop("SIGTERM", 1);
});
