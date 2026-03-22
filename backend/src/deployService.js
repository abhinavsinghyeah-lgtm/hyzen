/**
 * deployService.js — process-based deployer, no Docker.
 * Clone → npm install (or custom buildCmd) → spawn app process.
 */
const path = require("path");
const os = require("os");
const fs = require("fs");
const net = require("net");
const { spawn, execFile } = require("child_process");
const util = require("util");
const { invalidate } = require("./containersCache");

const execFileAsync = util.promisify(execFile);

// ─── Name helpers ─────────────────────────────────────────────────────────────

function sanitizeContainerName(containerName) {
  const raw = String(containerName || "");
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function parseGitHubRepo(repoUrl) {
  try {
    const m = String(repoUrl).match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i
    );
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
  } catch {
    return null;
  }
}

async function getDefaultBranchFromGitHub(repoUrl) {
  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { headers: { "User-Agent": "hyzen" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.default_branch || null;
  } catch {
    return null;
  }
}

async function gitRemoteHasBranch(repoUrl, branchName) {
  if (!branchName) return false;
  try {
    const out = await execFileAsync(
      "git",
      ["ls-remote", "--heads", repoUrl, branchName],
      { windowsHide: true }
    );
    return (out?.stdout || "").trim().length > 0;
  } catch {
    return false;
  }
}

async function resolveCloneBranch(repoUrl, requestedBranch) {
  if (requestedBranch && (await gitRemoteHasBranch(repoUrl, requestedBranch)))
    return requestedBranch;
  if (await gitRemoteHasBranch(repoUrl, "main")) return "main";
  if (await gitRemoteHasBranch(repoUrl, "master")) return "master";
  return (await getDefaultBranchFromGitHub(repoUrl)) || requestedBranch || "main";
}

function isBranchNotFoundError(err) {
  const text =
    `${err?.message || ""}\n${err?.stderr || ""}\n${err?.stdout || ""}`.toLowerCase();
  return (
    text.includes("branch") &&
    (text.includes("not found") ||
      text.includes("couldn't find") ||
      text.includes("could not find") ||
      text.includes("remote ref") ||
      text.includes("no such remote branch"))
  );
}

// ─── Port helpers ─────────────────────────────────────────────────────────────

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });
}

async function getRandomAvailablePort(minPort = 3000, maxPort = 9000) {
  for (let i = 0; i < 120; i++) {
    const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) return port;
  }
  for (let port = minPort; port <= maxPort; port++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port in range ${minPort}-${maxPort}`);
}

// ─── Env helpers ──────────────────────────────────────────────────────────────

function envInputToPairs(envInput) {
  if (!envInput) return [];
  if (Array.isArray(envInput)) return envInput;
  if (typeof envInput === "object") {
    return Object.entries(envInput).map(([key, value]) => ({ key, value }));
  }
  return [];
}

function buildEnvObject(envPairs, port) {
  const obj = { ...process.env };
  for (const pair of envPairs) {
    const k = String(pair?.key || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .toUpperCase();
    if (k) obj[k] = String(pair?.value ?? "");
  }
  // Force public binding by default for web servers.
  if (!obj.HOST) obj.HOST = "0.0.0.0";
  // Always force platform-assigned port last.
  if (port != null) obj.PORT = String(port);
  return obj;
}

function listDirectories(rootDir, maxDepth = 2, depth = 0) {
  if (depth > maxDepth) return [];
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(rootDir, e.name);
    out.push(p);
    out.push(...listDirectories(p, maxDepth, depth + 1));
  }
  return out;
}

function scoreProjectDir(dir) {
  let score = 0;
  if (fs.existsSync(path.join(dir, "package.json"))) score += 10;
  if (fs.existsSync(path.join(dir, "vite.config.js"))) score += 3;
  if (fs.existsSync(path.join(dir, "next.config.js"))) score += 3;
  if (fs.existsSync(path.join(dir, "angular.json"))) score += 3;
  if (fs.existsSync(path.join(dir, "src"))) score += 1;
  if (fs.existsSync(path.join(dir, "index.html"))) score += 1;
  if (fs.existsSync(path.join(dir, "server.js"))) score += 5;
  if (fs.existsSync(path.join(dir, "app.js"))) score += 5;
  if (fs.existsSync(path.join(dir, "index.js"))) score += 4;
  if (fs.existsSync(path.join(dir, "src", "index.js"))) score += 4;
  if (/(^|[\\/])(backend|server|api)$/i.test(dir)) score += 3;
  return score;
}

function detectProjectDir(cloneDir, requestedStartCmd) {
  const cmd = String(requestedStartCmd || "").trim().toLowerCase();
  const rootHasPkg = fs.existsSync(path.join(cloneDir, "package.json"));
  if (rootHasPkg) return cloneDir;

  // If the command explicitly changes directories, preserve repo root so the command can control cwd.
  if (/\b(cd|pushd)\s+/i.test(cmd)) return cloneDir;

  const candidates = [cloneDir, ...listDirectories(cloneDir, 3)];

  // If user requested npm/yarn/pnpm command, prefer a folder with package.json.
  const pkgCommand = /^(npm|yarn|pnpm)\b/.test(cmd);
  const scored = candidates
    .map((d) => ({ dir: d, score: scoreProjectDir(d) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.dir.length - b.dir.length);

  if (!scored.length) return cloneDir;

  if (pkgCommand) {
    const withPkg = scored.find((x) => fs.existsSync(path.join(x.dir, "package.json")));
    if (withPkg) return withPkg.dir;
  }

  return scored[0].dir;
}

// ─── Start command detection ──────────────────────────────────────────────────

function detectStartCommand(cloneDir) {
  const pkgPath = path.join(cloneDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const devScript = String(pkg.scripts?.dev || "").toLowerCase();
      const previewScript = String(pkg.scripts?.preview || "").toLowerCase();
      const isViteProject =
        fs.existsSync(path.join(cloneDir, "vite.config.js")) ||
        devScript.includes("vite") ||
        previewScript.includes("vite");
      if (pkg.scripts?.start) return "npm start";
      if (isViteProject && pkg.scripts?.preview) return "npm run preview";
      if (pkg.scripts?.dev) return "npm run dev";
      if (pkg.main) return `node ${pkg.main}`;
    } catch {}
  }
  for (const candidate of ["server.js", "app.js", "src/index.js", "index.js"]) {
    if (fs.existsSync(path.join(cloneDir, candidate))) return `node ${candidate}`;
  }

  // Static-site fallback for plain HTML/CSS/JS repositories.
  if (fs.existsSync(path.join(cloneDir, "index.html"))) {
    return "node -e \"const http=require('http');const fs=require('fs');const p=require('path');const root=process.cwd();const m={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.webp':'image/webp'};http.createServer((req,res)=>{let u=decodeURIComponent((req.url||'/').split('?')[0]);if(u==='/'||!u)u='/index.html';let f=p.join(root,u);if(!f.startsWith(root)){res.statusCode=403;return res.end('Forbidden');}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=p.join(f,'index.html');if(!fs.existsSync(f)){const spa=p.join(root,'index.html');if(fs.existsSync(spa)){res.setHeader('Content-Type','text/html');return fs.createReadStream(spa).pipe(res);}res.statusCode=404;return res.end('Not found');}res.setHeader('Content-Type',m[p.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);}).listen(process.env.PORT||3000,'0.0.0.0');\"";
  }

  return "";
}

function detectBuildCommand(cloneDir, requestedBuildCmd) {
  const hasPackageJson = fs.existsSync(path.join(cloneDir, "package.json"));
  const explicit = String(requestedBuildCmd || "").trim();
  let pkg = null;
  if (hasPackageJson) {
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(cloneDir, "package.json"), "utf8"));
    } catch {}
  }
  const hasBuildScript = Boolean(pkg?.scripts?.build);

  if (explicit) {
    const looksLikeDefaultNpm = /^(npm\s+(install|ci))$/i.test(explicit);
    if (!hasPackageJson && looksLikeDefaultNpm) return "";
    if (looksLikeDefaultNpm && hasBuildScript) {
      return /^npm\s+ci$/i.test(explicit)
        ? "npm ci && npm run build"
        : "npm install && npm run build";
    }
    return explicit;
  }

  if (fs.existsSync(path.join(cloneDir, "package-lock.json"))) {
    return hasBuildScript ? "npm ci && npm run build" : "npm ci";
  }
  if (hasPackageJson) {
    return hasBuildScript ? "npm install && npm run build" : "npm install";
  }
  if (fs.existsSync(path.join(cloneDir, "yarn.lock"))) {
    return hasBuildScript ? "yarn install --frozen-lockfile && yarn build" : "yarn install --frozen-lockfile";
  }
  if (fs.existsSync(path.join(cloneDir, "pnpm-lock.yaml"))) {
    return hasBuildScript ? "pnpm install --frozen-lockfile && pnpm build" : "pnpm install --frozen-lockfile";
  }
  return "";
}

function readPackageJsonSafe(projectDir) {
  const pkgPath = path.join(projectDir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeStartCommand(projectDir, command, onLog) {
  const cmd = String(command || "").trim();
  if (!cmd) return cmd;

  const pkg = readPackageJsonSafe(projectDir);
  const devScript = String(pkg?.scripts?.dev || "").toLowerCase();
  const startScript = String(pkg?.scripts?.start || "").toLowerCase();
  const isViteProject =
    fs.existsSync(path.join(projectDir, "vite.config.js")) ||
    devScript.includes("vite") ||
    startScript.includes("vite");

  if (!isViteProject) return cmd;

  const hasHost = /--host(=|\s|$)/i.test(cmd);
  const hasPort = /--port(=|\s|$)/i.test(cmd);

  // Vite dev/preview defaults to localhost and may ignore PORT unless passed explicitly.
  if (/^npm\s+run\s+dev\b/i.test(cmd) || /^npm\s+run\s+preview\b/i.test(cmd)) {
    let next = cmd;
    if (!hasHost || !hasPort) {
      next += " --";
      if (!hasHost) next += " --host 0.0.0.0";
      if (!hasPort) next += " --port $PORT";
      try { onLog?.(`Adjusted start command for Vite: ${next}\n`); } catch {}
    }
    return next;
  }

  if (/^vite\b/i.test(cmd)) {
    let next = cmd;
    if (!hasHost) next += " --host 0.0.0.0";
    if (!hasPort) next += " --port $PORT";
    try { onLog?.(`Adjusted start command for Vite: ${next}\n`); } catch {}
    return next;
  }

  return cmd;
}

function runShellCommand(command, { cwd, env, log }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    child.stdout.on("data", (d) => log(d.toString()));
    child.stderr.on("data", (d) => log(d.toString()));
    child.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`Command exited with code ${code}: ${command}`));
    });
    child.on("error", (e) => reject(new Error(`Command failed to start: ${e.message}`)));
  });
}

function buildServiceUrl(hostPort, publicBaseUrl) {
  // Always store an internal target URL for reverse proxying.
  // Public URLs are exposed by API routes/subdomain mapping, not by this value.
  return `http://127.0.0.1:${hostPort}`;
}

// ─── Process helpers ──────────────────────────────────────────────────────────

/** Returns true if a process with the given PID is alive. */
function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

/** SIGTERM a PID, then SIGKILL after 3 s. */
function killProcess(pid) {
  if (!pid) return;
  try {
    process.kill(Number(pid), "SIGTERM");
  } catch {}
  setTimeout(() => {
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {}
  }, 3000);
}

/**
 * Spawn an app's process, redirecting stdout/stderr to logFile.
 * On Unix: detached + fd so child outlives server restarts.
 * On Windows: piped streams.
 */
function spawnApp({ command, cwd, env, logFile }) {
  try {
    fs.appendFileSync(
      logFile,
      `\n=== Start ${new Date().toISOString()} | ${command} ===\n`
    );
  } catch {}

  if (process.platform !== "win32") {
    const fd = fs.openSync(logFile, "a");
    const child = spawn(command, {
      cwd,
      env,
      stdio: ["ignore", fd, fd],
      detached: true,
      shell: true,
    });
    child.unref();
    setTimeout(() => {
      try { fs.closeSync(fd); } catch {}
    }, 200);
    child.on("exit", () => invalidate());
    return child;
  }

  // Windows: piped
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  const child = spawn(command, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });
  child.on("exit", (code) => {
    try { logStream.write(`\n=== Exited code ${code} ===\n`); } catch {}
    invalidate();
  });
  return child;
}

// ─── Clone helper ─────────────────────────────────────────────────────────────

async function cloneRepo(repoUrl, cloneDir, requestedBranch, log) {
  const usedBranch = await resolveCloneBranch(repoUrl, requestedBranch || null);
  log(`Resolved branch: ${usedBranch}\n`);

  const tryClone = async (branchToTry) => {
    if (fs.existsSync(cloneDir)) fs.rmSync(cloneDir, { recursive: true, force: true });
    log(`Cloning ${repoUrl} (${branchToTry})...\n`);
    await execFileAsync(
      "git",
      ["clone", "--depth", "1", "--branch", branchToTry, repoUrl, cloneDir],
      { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }
    );
    log("Clone complete.\n");
    return branchToTry;
  };

  let finalBranch = usedBranch;
  try {
    finalBranch = await tryClone(usedBranch);
  } catch (cloneErr) {
    if (isBranchNotFoundError(cloneErr)) {
      const fallback =
        usedBranch === "main" ? "master" : usedBranch === "master" ? "main" : null;
      if (fallback) {
        log(`Branch not found. Retrying with "${fallback}"...\n`);
        finalBranch = await tryClone(fallback);
      } else {
        const alt = await resolveCloneBranch(repoUrl, null);
        if (alt && alt !== usedBranch) {
          log(`Retrying with "${alt}" from detection...\n`);
          finalBranch = await tryClone(alt);
        } else throw cloneErr;
      }
    } else throw cloneErr;
  }
  return finalBranch;
}

// ─── Main deploy function ─────────────────────────────────────────────────────

/**
 * Clones repo, runs build command (default: npm install), then spawns the app.
 * Returns { safeName, usedBranch, url, hostPort, pid, workDir, logFile, startCmd }.
 */
async function deployProcess({
  repoUrl,
  branch,
  containerName,
  env,
  buildCmd,
  startCmd,
  publicBaseUrl,
  onLog,
}) {
  const log = (s) => { try { onLog?.(s); } catch {} };

  const safeName = sanitizeContainerName(containerName);
  if (!safeName) throw new Error("Invalid containerName");

  // Persistent directory, not /tmp, so we can restart without re-cloning.
  const appDir = path.join(os.homedir(), ".hyzen", "apps", safeName);
  fs.mkdirSync(appDir, { recursive: true });
  const cloneDir = path.join(appDir, "repo");
  const logFile = path.join(appDir, "app.log");

  invalidate();

  // 1. Clone
  const usedBranch = await cloneRepo(repoUrl, cloneDir, branch, log);

  // 1.5 Detect actual project directory (supports monorepos/subfolder apps)
  const projectDir = detectProjectDir(cloneDir, startCmd);
  if (projectDir !== cloneDir) {
    log(`Detected project directory: ${path.relative(cloneDir, projectDir)}\n`);
  }

  // 2. Build (auto-detected when omitted)
  const effectiveBuildCmd = detectBuildCommand(projectDir, buildCmd);
  if (effectiveBuildCmd) {
    log(`\nRunning build: ${effectiveBuildCmd}\n`);
    await runShellCommand(effectiveBuildCmd, {
      cwd: projectDir,
      env: { ...process.env },
      log,
    });
    log("Build complete.\n");
  } else {
    log("\nNo build step detected. Skipping build.\n");
  }

  // 3. Detect / use start command
  const requestedStartCmd = (startCmd || "").trim() || detectStartCommand(projectDir);
  const effectiveStartCmd = normalizeStartCommand(projectDir, requestedStartCmd, log);
  if (!effectiveStartCmd) {
    throw new Error(
      "Could not detect a start command. Provide one manually (for example: npm start or node server.js)."
    );
  }
  log(`Start command: ${effectiveStartCmd}\n`);

  // 4. Port
  const hostPort = await getRandomAvailablePort(3000, 9000);
  const url = buildServiceUrl(hostPort, publicBaseUrl);

  // 5. Env — inject PORT
  const envPairs = envInputToPairs(env);
  const processEnv = buildEnvObject(envPairs, hostPort);

  // 6. Spawn app
  log(`Starting app on port ${hostPort}...\n`);
  fs.writeFileSync(logFile, `=== Deployment ${new Date().toISOString()} ===\n`);

  const child = spawnApp({
    command: effectiveStartCmd,
    cwd: projectDir,
    env: processEnv,
    logFile,
  });

  // Wait 1.5 s and verify it didn't crash immediately.
  await new Promise((r) => setTimeout(r, 1500));

  if (!isPidRunning(child.pid)) {
    let logTail = "";
    try { logTail = fs.readFileSync(logFile, "utf8").slice(-1200); } catch {}
    throw new Error(
      `App process exited immediately. Check your start command ("${effectiveStartCmd}") ` +
      `and make sure your app listens on process.env.PORT.\nLast output:\n${logTail}`
    );
  }

  log(`\nApp started (PID ${child.pid}). URL: ${url}\n`);
  log(`Service URL: ${url}\n`);
  log(`${url}\n`);
  log("Deployment complete.\n");

  return {
    safeName,
    usedBranch,
    url,
    hostPort,
    pid: child.pid,
    workDir: projectDir,
    logFile,
    startCmd: effectiveStartCmd,
  };
}

// ─── Restart helper ───────────────────────────────────────────────────────────

/**
 * Re-runs an already-deployed app (for restart / start-after-stop).
 * Returns { pid, url }.
 */
async function rerunProcess({ workDir, startCmd, logFile, envPairs, publicBaseUrl }) {
  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(
      "Work directory not found. Please re-deploy the project from scratch."
    );
  }

  const hostPort = await getRandomAvailablePort(3000, 9000);
  const pairs = envPairs || [];
  const processEnv = buildEnvObject(pairs, hostPort);

  const rawCmd = (startCmd || detectStartCommand(workDir)).trim();
  const cmd = normalizeStartCommand(workDir, rawCmd);
  if (!cmd) throw new Error("No start command found for this deployment.");

  const effectiveLogFile = logFile || path.join(workDir, "..", "app.log");

  const child = spawnApp({
    command: cmd,
    cwd: workDir,
    env: processEnv,
    logFile: effectiveLogFile,
  });

  await new Promise((r) => setTimeout(r, 800));
  if (!isPidRunning(child.pid)) {
    throw new Error(`Process exited immediately (code ${child.exitCode ?? "?"}). Check start command.`);
  }

  return { pid: child.pid, url: buildServiceUrl(hostPort, publicBaseUrl) };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  deployProcess,
  rerunProcess,
  killProcess,
  isPidRunning,
  sanitizeContainerName,
  getRandomAvailablePort,
  envInputToPairs,
  buildEnvObject,
};

