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
  if (port != null) obj.PORT = String(port);
  for (const pair of envPairs) {
    const k = String(pair?.key || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .toUpperCase();
    if (k) obj[k] = String(pair?.value ?? "");
  }
  return obj;
}

// ─── Start command detection ──────────────────────────────────────────────────

function detectStartCommand(cloneDir) {
  const pkgPath = path.join(cloneDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.scripts?.start) return "npm start";
      if (pkg.scripts?.dev) return "npm run dev";
      if (pkg.main) return `node ${pkg.main}`;
    } catch {}
  }
  for (const candidate of ["server.js", "app.js", "src/index.js", "index.js"]) {
    if (fs.existsSync(path.join(cloneDir, candidate))) return `node ${candidate}`;
  }
  return "npm start";
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
function spawnApp({ cmd, args, cwd, env, logFile }) {
  try {
    fs.appendFileSync(
      logFile,
      `\n=== Start ${new Date().toISOString()} | ${cmd} ${args.join(" ")} ===\n`
    );
  } catch {}

  if (process.platform !== "win32") {
    const fd = fs.openSync(logFile, "a");
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["ignore", fd, fd],
      detached: true,
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
  const child = spawn(cmd, args, {
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

  // 2. Build (npm install or custom)
  const effectiveBuildCmd = (buildCmd || "").trim() || "npm install";
  log(`\nRunning build: ${effectiveBuildCmd}\n`);

  await new Promise((resolve, reject) => {
    const parts = effectiveBuildCmd.split(/\s+/);
    const buildProc = spawn(parts[0], parts.slice(1), {
      cwd: cloneDir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    buildProc.stdout.on("data", (d) => log(d.toString()));
    buildProc.stderr.on("data", (d) => log(d.toString()));
    buildProc.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`Build command exited with code ${code}`));
    });
    buildProc.on("error", (e) =>
      reject(new Error(`Build command failed to start: ${e.message}`))
    );
  });
  log("Build complete.\n");

  // 3. Detect / use start command
  const effectiveStartCmd = (startCmd || "").trim() || detectStartCommand(cloneDir);
  log(`Start command: ${effectiveStartCmd}\n`);

  // 4. Port
  const hostPort = await getRandomAvailablePort(3000, 9000);
  const url = `http://localhost:${hostPort}`;

  // 5. Env — inject PORT
  const envPairs = envInputToPairs(env);
  const processEnv = buildEnvObject(envPairs, hostPort);

  // 6. Spawn app
  log(`Starting app on port ${hostPort}...\n`);
  fs.writeFileSync(logFile, `=== Deployment ${new Date().toISOString()} ===\n`);

  const startParts = effectiveStartCmd.split(/\s+/);
  const child = spawnApp({
    cmd: startParts[0],
    args: startParts.slice(1),
    cwd: cloneDir,
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
    workDir: cloneDir,
    logFile,
    startCmd: effectiveStartCmd,
  };
}

// ─── Restart helper ───────────────────────────────────────────────────────────

/**
 * Re-runs an already-deployed app (for restart / start-after-stop).
 * Returns { pid, url }.
 */
async function rerunProcess({ workDir, startCmd, logFile, envPairs }) {
  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(
      "Work directory not found. Please re-deploy the project from scratch."
    );
  }

  const hostPort = await getRandomAvailablePort(3000, 9000);
  const pairs = envPairs || [];
  const processEnv = buildEnvObject(pairs, hostPort);

  const cmd = (startCmd || "npm start").trim();
  const parts = cmd.split(/\s+/);

  const effectiveLogFile = logFile || path.join(workDir, "..", "app.log");

  const child = spawnApp({
    cmd: parts[0],
    args: parts.slice(1),
    cwd: workDir,
    env: processEnv,
    logFile: effectiveLogFile,
  });

  await new Promise((r) => setTimeout(r, 800));
  if (!isPidRunning(child.pid)) {
    throw new Error(`Process exited immediately (code ${child.exitCode ?? "?"}). Check start command.`);
  }

  return { pid: child.pid, url: `http://localhost:${hostPort}` };
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

