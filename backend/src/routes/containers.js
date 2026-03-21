const express = require("express");
const fs = require("fs");
const router = express.Router();
const { getPool } = require("../db");
const { invalidate } = require("../containersCache");
const { killProcess, isPidRunning, rerunProcess } = require("../deployService");

// ── GET / — list all deployments ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, repo_url, branch, container_name, status, url, pid,
              work_dir, log_file, start_cmd, created_at
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
    if (isPidRunning(row.pid)) return res.json({ ok: true, message: "Already running" });

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs: [],
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
      "UPDATE hyzen_deployments SET status = 'stopped' WHERE id = $1",
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
    killProcess(row.pid);
    await new Promise((r) => setTimeout(r, 600));

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs: [],
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
