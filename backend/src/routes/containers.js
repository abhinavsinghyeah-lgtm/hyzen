const express = require("express");
const fs = require("fs");
const router = express.Router();
const { getPool } = require("../db");
const { invalidate } = require("../containersCache");
const { killProcess, isPidRunning, rerunProcess, deployProcess, envInputToPairs } = require("../deployService");

function getPublicBaseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const rawHost = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  const hostOnly = rawHost.replace(/:\d+$/, "");
  if (!hostOnly) return "";
  return `${proto}://${hostOnly}`;
}

// ── GET / — list all deployments ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
            `SELECT id, repo_url, branch, container_name, status, url, pid,
              work_dir, log_file, start_cmd, build_cmd, env_vars, suspended, suspended_reason, created_at
       FROM hyzen_deployments
       ORDER BY id DESC`
    );

    const result = rows.map((row) => {
      const alive = row.pid ? isPidRunning(row.pid) : false;
      return {
        id: String(row.id),
        name: row.container_name || "",
        status: alive ? "running" : "stopped",
        url: row.url || null,
        pid: row.pid || null,
        workDir: row.work_dir || null,
        logFile: row.log_file || null,
        startCmd: row.start_cmd || null,
        buildCmd: row.build_cmd || null,
        envVars: row.env_vars || [],
        suspended: Boolean(row.suspended),
        suspendedReason: row.suspended_reason || null,
        branch: row.branch || null,
        repoUrl: row.repo_url || null,
        createdAt: row.created_at || null,
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "Failed to list deployments" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM hyzen_deployments WHERE id = $1`,
      [req.params.id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Deployment not found" });

    return res.json({
      container: {
        id: String(row.id),
        name: row.container_name || "",
        repoUrl: row.repo_url || "",
        branch: row.branch || "main",
        buildCmd: row.build_cmd || "",
        startCmd: row.start_cmd || "",
        envVars: row.env_vars || [],
        status: row.pid && isPidRunning(row.pid) ? "running" : "stopped",
        url: row.url || null,
        suspended: Boolean(row.suspended),
        suspendedReason: row.suspended_reason || null,
      },
    });
  } catch {
    return res.status(500).json({ message: "Failed to load deployment" });
  }
});

// ── POST /:id/start ───────────────────────────────────────────────────────────
router.post("/:id/start", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT * FROM hyzen_deployments WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Deployment not found" });

    const row = rows[0];
    if (row.suspended) {
      return res.status(403).json({
        message: row.suspended_reason || "Deployment is suspended.",
      });
    }
    if (isPidRunning(row.pid)) return res.json({ ok: true, message: "Already running" });

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs: [],
      publicBaseUrl: getPublicBaseUrl(req),
    });

    await pool.query(
      "UPDATE hyzen_deployments SET pid = $1, url = $2, status = 'running' WHERE id = $3",
      [pid, url, row.id]
    );
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to start" });
  }
});

// ── POST /:id/stop ────────────────────────────────────────────────────────────
router.post("/:id/stop", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT pid FROM hyzen_deployments WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Deployment not found" });

    killProcess(rows[0].pid);
    await pool.query(
      "UPDATE hyzen_deployments SET status = 'stopped', pid = NULL WHERE id = $1",
      [req.params.id]
    );
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to stop" });
  }
});

// ── POST /:id/restart ─────────────────────────────────────────────────────────
router.post("/:id/restart", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT * FROM hyzen_deployments WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Deployment not found" });

    const row = rows[0];
    if (row.suspended) {
      return res.status(403).json({
        message: row.suspended_reason || "Deployment is suspended.",
      });
    }
    killProcess(row.pid);
    await new Promise((r) => setTimeout(r, 600));

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs: [],
      publicBaseUrl: getPublicBaseUrl(req),
    });

    await pool.query(
      "UPDATE hyzen_deployments SET pid = $1, url = $2, status = 'running' WHERE id = $3",
      [pid, url, row.id]
    );
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to restart" });
  }
});

router.put("/:id/config", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM hyzen_deployments WHERE id = $1`,
      [req.params.id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Deployment not found" });

    const payload = req.body || {};
    const updates = [];
    const params = [];

    if (typeof payload.containerName === "string") {
      updates.push(`container_name = $${updates.length + 1}`);
      params.push(payload.containerName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    }
    if (typeof payload.repoUrl === "string") {
      updates.push(`repo_url = $${updates.length + 1}`);
      params.push(payload.repoUrl.trim());
    }
    if (typeof payload.branch === "string") {
      updates.push(`branch = $${updates.length + 1}`);
      params.push(payload.branch.trim());
    }
    if (typeof payload.buildCmd === "string") {
      updates.push(`build_cmd = $${updates.length + 1}`);
      params.push(payload.buildCmd.trim() || null);
    }
    if (typeof payload.startCmd === "string") {
      updates.push(`start_cmd = $${updates.length + 1}`);
      params.push(payload.startCmd.trim() || null);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "env")) {
      updates.push(`env_vars = $${updates.length + 1}`);
      params.push(envInputToPairs(payload.env));
    }

    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });

    params.push(row.id);
    await pool.query(
      `UPDATE hyzen_deployments SET ${updates.join(", ")} WHERE id = $${updates.length + 1}`,
      params
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to update deployment config" });
  }
});

router.post("/:id/suspend", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query("SELECT pid FROM hyzen_deployments WHERE id = $1", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Deployment not found" });

    const reason = String(req.body?.reason || "Deployment suspended by admin.").trim();
    killProcess(row.pid);

    await pool.query(
      `UPDATE hyzen_deployments
       SET status = 'suspended', pid = NULL, suspended = TRUE, suspended_reason = $1
       WHERE id = $2`,
      [reason, req.params.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to suspend deployment" });
  }
});

router.post("/:id/unsuspend", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query("SELECT id FROM hyzen_deployments WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Deployment not found" });

    await pool.query(
      `UPDATE hyzen_deployments
       SET suspended = FALSE, suspended_reason = NULL,
           status = CASE WHEN status = 'suspended' THEN 'stopped' ELSE status END
       WHERE id = $1`,
      [req.params.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to unsuspend deployment" });
  }
});

router.post("/:id/redeploy", async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const pool = getPool();
    const { rows } = await pool.query("SELECT * FROM hyzen_deployments WHERE id = $1", [req.params.id]);
    const row = rows[0];
    if (!row) {
      res.status(404).end("Deployment not found");
      return;
    }
    if (row.suspended) {
      res.status(403).end(row.suspended_reason || "Deployment is suspended.");
      return;
    }

    const payload = req.body || {};
    const repoUrl = String(payload.repoUrl || row.repo_url || "").trim();
    const branch = String(payload.branch || row.branch || "main").trim();
    const containerName = String(payload.containerName || row.container_name || "").trim();
    const buildCmd = typeof payload.buildCmd === "string" ? payload.buildCmd.trim() : (row.build_cmd || "");
    const startCmd = typeof payload.startCmd === "string" ? payload.startCmd.trim() : (row.start_cmd || "");
    const env = Object.prototype.hasOwnProperty.call(payload, "env")
      ? envInputToPairs(payload.env)
      : (row.env_vars || []);

    if (!repoUrl || !containerName) {
      res.status(400).end("repoUrl and containerName are required");
      return;
    }

    killProcess(row.pid);
    await new Promise((r) => setTimeout(r, 600));

    const result = await deployProcess({
      repoUrl,
      branch,
      containerName,
      env,
      buildCmd,
      startCmd,
      publicBaseUrl: getPublicBaseUrl(req),
      onLog: (s) => { try { res.write(s); } catch {} },
    });

    await pool.query(
      `UPDATE hyzen_deployments
       SET repo_url = $1, branch = $2, container_name = $3, build_cmd = $4, start_cmd = $5,
           env_vars = $6, url = $7, pid = $8, work_dir = $9, log_file = $10, status = 'running'
       WHERE id = $11`,
      [
        repoUrl,
        result.usedBranch || branch,
        result.safeName,
        buildCmd || null,
        result.startCmd,
        envInputToPairs(env),
        result.url,
        result.pid,
        result.workDir,
        result.logFile,
        row.id,
      ]
    );

    invalidate();
    res.end();
  } catch (err) {
    try { res.write(`\nRedeploy failed: ${err?.message || String(err)}\n`); } catch {}
    try { res.end(); } catch {}
  }
});

// ── POST /:id/delete ──────────────────────────────────────────────────────────
router.post("/:id/delete", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT pid FROM hyzen_deployments WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Deployment not found" });

    killProcess(rows[0].pid);
    await pool.query("DELETE FROM hyzen_deployments WHERE id = $1", [req.params.id]);
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete" });
  }
});

// ── GET /:id/logs — stream from log file ──────────────────────────────────────
router.get("/:id/logs", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT log_file FROM hyzen_deployments WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Deployment not found" });

    const logFile = rows[0].log_file;
    if (!logFile || !fs.existsSync(logFile)) {
      return res.status(404).json({ message: "Log file not found" });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    let offset = 0;
    // Send existing content first.
    try {
      const initial = fs.readFileSync(logFile, "utf8");
      res.write(initial);
      offset = Buffer.byteLength(initial, "utf8");
    } catch {}

    const interval = setInterval(() => {
      try {
        const stat = fs.statSync(logFile);
        if (stat.size > offset) {
          const fd = fs.openSync(logFile, "r");
          const len = stat.size - offset;
          const buf = Buffer.alloc(len);
          fs.readSync(fd, buf, 0, len, offset);
          fs.closeSync(fd);
          offset = stat.size;
          res.write(buf.toString("utf8"));
        }
      } catch {}
    }, 500);

    const cleanup = () => {
      clearInterval(interval);
      try { res.end(); } catch {}
    };
    req.on("close", cleanup);
    req.on("end", cleanup);
  } catch (err) {
    return res.status(500).json({ message: "Failed to stream logs" });
  }
});

module.exports = router;
