const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const { getPool } = require("../db");
const config = require("../config");
const {
  killProcess,
  isPidRunning,
  rerunProcess,
  deployProcess,
  envInputToPairs,
} = require("../deployService");
const { invalidate } = require("../containersCache");

const router = express.Router();

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

function sanitizeConfigInput(body = {}) {
  const next = {};
  if (typeof body.containerName === "string") next.containerName = body.containerName.trim();
  if (typeof body.repoUrl === "string") next.repoUrl = body.repoUrl.trim();
  if (typeof body.branch === "string") next.branch = body.branch.trim();
  if (typeof body.buildCmd === "string") next.buildCmd = body.buildCmd.trim();
  if (typeof body.startCmd === "string") next.startCmd = body.startCmd.trim();
  if (body.env != null) next.env = envInputToPairs(body.env);
  return next;
}

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const users = await pool.query(
      `SELECT id, email, name, plan, plan_expires_at, is_suspended, suspended_reason, created_at
       FROM users
       ORDER BY created_at DESC;`
    );

    const rows = [];
    for (const u of users.rows) {
      // eslint-disable-next-line no-await-in-loop
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS count FROM user_containers WHERE user_id = $1;`,
        [u.id]
      );
      rows.push({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        plan_expires_at: u.plan_expires_at,
        is_suspended: Boolean(u.is_suspended),
        suspended_reason: u.suspended_reason || null,
        joined_at: u.created_at,
        containers_used: countRes.rows[0]?.count || 0,
      });
    }

    return res.json({ users: rows });
  } catch {
    return res.status(500).json({ message: "Failed to load users" });
  }
});

router.post("/users/:id/plan", requireAdmin, async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!plan || !Object.prototype.hasOwnProperty.call(config.plans, plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const pool = getPool();
    await pool.query(
      `
      UPDATE users
      SET plan = $1,
          plan_expires_at = CASE
            WHEN $1 = 'free' THEN NULL
            ELSE (NOW() + INTERVAL '30 days')
          END
      WHERE id = $2;
      `,
      [plan, req.params.id]
    );

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to update user plan" });
  }
});

router.post("/users/:id/suspend", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const reason = String(req.body?.reason || "User account suspended by admin.").trim();

    await pool.query(
      `UPDATE users SET is_suspended = TRUE, suspended_reason = $1 WHERE id = $2`,
      [reason, req.params.id]
    );

    const { rows } = await pool.query(
      `SELECT id, pid FROM user_containers WHERE user_id = $1`,
      [req.params.id]
    );

    for (const row of rows) {
      killProcess(row.pid);
      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        `UPDATE user_containers
         SET status = 'suspended', pid = NULL, suspended = TRUE, suspended_reason = $1
         WHERE id = $2`,
        [reason, row.id]
      );
    }

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to suspend user" });
  }
});

router.post("/users/:id/unsuspend", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();

    await pool.query(
      `UPDATE users SET is_suspended = FALSE, suspended_reason = NULL WHERE id = $1`,
      [req.params.id]
    );

    await pool.query(
      `UPDATE user_containers
       SET suspended = FALSE, suspended_reason = NULL,
           status = CASE WHEN status = 'suspended' THEN 'stopped' ELSE status END
       WHERE user_id = $1`,
      [req.params.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to unsuspend user" });
  }
});

router.get("/containers", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT c.*, u.email AS user_email, u.name AS user_name, u.is_suspended AS user_suspended
       FROM user_containers c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC`
    );

    return res.json({
      containers: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.user_email,
        userName: r.user_name,
        name: r.name,
        repoUrl: r.repo_url || null,
        branch: r.branch || null,
        buildCmd: r.build_cmd || "",
        startCmd: r.start_cmd || "",
        status: r.pid && isPidRunning(r.pid) ? "running" : (r.status || "stopped"),
        url: r.url || null,
        suspended: Boolean(r.suspended) || Boolean(r.user_suspended),
        suspendedReason: r.suspended_reason || null,
        createdAt: r.created_at,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to load user containers" });
  }
});

router.get("/containers/:id", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT c.*, u.email AS user_email, u.name AS user_name, u.is_suspended AS user_suspended, u.suspended_reason AS user_suspended_reason
       FROM user_containers c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    return res.json({
      container: {
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        userName: row.user_name,
        name: row.name,
        repoUrl: row.repo_url || "",
        branch: row.branch || "main",
        buildCmd: row.build_cmd || "",
        startCmd: row.start_cmd || "",
        envVars: row.env_vars || [],
        workDir: row.work_dir || "",
        logFile: row.log_file || "",
        status: row.pid && isPidRunning(row.pid) ? "running" : (row.status || "stopped"),
        url: row.url || null,
        suspended: Boolean(row.suspended) || Boolean(row.user_suspended),
        suspendedReason: row.suspended_reason || row.user_suspended_reason || null,
      },
    });
  } catch {
    return res.status(500).json({ message: "Failed to load container" });
  }
});

router.put("/containers/:id/config", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM user_containers WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const next = sanitizeConfigInput(req.body || {});
    const updates = [];
    const params = [];

    if (next.containerName) {
      updates.push(`name = $${updates.length + 1}`);
      params.push(next.containerName.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    }
    if (next.repoUrl) {
      updates.push(`repo_url = $${updates.length + 1}`);
      params.push(next.repoUrl);
    }
    if (next.branch) {
      updates.push(`branch = $${updates.length + 1}`);
      params.push(next.branch);
    }
    if (Object.prototype.hasOwnProperty.call(next, "buildCmd")) {
      updates.push(`build_cmd = $${updates.length + 1}`);
      params.push(next.buildCmd || null);
    }
    if (Object.prototype.hasOwnProperty.call(next, "startCmd")) {
      updates.push(`start_cmd = $${updates.length + 1}`);
      params.push(next.startCmd || null);
    }
    if (Object.prototype.hasOwnProperty.call(next, "env")) {
      updates.push(`env_vars = $${updates.length + 1}`);
      params.push(next.env);
    }

    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });

    params.push(row.id);
    await pool.query(
      `UPDATE user_containers SET ${updates.join(", ")} WHERE id = $${updates.length + 1}`,
      params
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to update container config" });
  }
});

router.post("/containers/:id/start", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM user_containers WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });
    if (row.suspended) return res.status(403).json({ message: row.suspended_reason || "Container is suspended." });
    if (isPidRunning(row.pid)) return res.json({ ok: true, message: "Already running" });

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs: row.env_vars || [],
      publicBaseUrl: getPublicBaseUrl(req),
    });

    await pool.query(
      `UPDATE user_containers SET pid = $1, url = $2, status = 'running' WHERE id = $3`,
      [pid, url, row.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to start" });
  }
});

router.post("/containers/:id/stop", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT pid FROM user_containers WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    killProcess(row.pid);
    await pool.query(`UPDATE user_containers SET status = 'stopped', pid = NULL WHERE id = $1`, [req.params.id]);

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to stop" });
  }
});

router.post("/containers/:id/restart", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM user_containers WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });
    if (row.suspended) return res.status(403).json({ message: row.suspended_reason || "Container is suspended." });

    killProcess(row.pid);
    await new Promise((r) => setTimeout(r, 600));

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs: row.env_vars || [],
      publicBaseUrl: getPublicBaseUrl(req),
    });

    await pool.query(
      `UPDATE user_containers SET pid = $1, url = $2, status = 'running' WHERE id = $3`,
      [pid, url, row.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to restart" });
  }
});

router.post("/containers/:id/suspend", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const reason = String(req.body?.reason || "Container suspended by admin.").trim();
    const { rows } = await pool.query(`SELECT pid FROM user_containers WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    killProcess(row.pid);

    await pool.query(
      `UPDATE user_containers
       SET status = 'suspended', pid = NULL, suspended = TRUE, suspended_reason = $1
       WHERE id = $2`,
      [reason, req.params.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to suspend container" });
  }
});

router.post("/containers/:id/unsuspend", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT id FROM user_containers WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Container not found" });

    await pool.query(
      `UPDATE user_containers
       SET suspended = FALSE, suspended_reason = NULL,
           status = CASE WHEN status = 'suspended' THEN 'stopped' ELSE status END
       WHERE id = $1`,
      [req.params.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to unsuspend container" });
  }
});

router.post("/containers/:id/delete", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT pid FROM user_containers WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    killProcess(row.pid);
    await pool.query(`DELETE FROM user_containers WHERE id = $1`, [req.params.id]);

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to delete" });
  }
});

router.post("/containers/:id/redeploy", requireAdmin, async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM user_containers WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) {
      res.status(404).end("Container not found");
      return;
    }

    const override = sanitizeConfigInput(req.body || {});
    const repoUrl = override.repoUrl || row.repo_url;
    const branch = override.branch || row.branch || "main";
    const containerName = override.containerName || row.name;
    const buildCmd = Object.prototype.hasOwnProperty.call(override, "buildCmd")
      ? override.buildCmd
      : (row.build_cmd || "");
    const startCmd = Object.prototype.hasOwnProperty.call(override, "startCmd")
      ? override.startCmd
      : (row.start_cmd || "");
    const env = Object.prototype.hasOwnProperty.call(override, "env")
      ? override.env
      : (row.env_vars || []);

    if (!repoUrl) {
      res.status(400).end("Container missing repo_url; update config first");
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
      onLog: (s) => {
        try {
          res.write(s);
        } catch {}
      },
    });

    await pool.query(
      `UPDATE user_containers
       SET name = $1, repo_url = $2, branch = $3, build_cmd = $4, start_cmd = $5,
           env_vars = $6, url = $7, pid = $8, work_dir = $9, log_file = $10, status = 'running'
       WHERE id = $11`,
      [
        result.safeName,
        repoUrl,
        result.usedBranch || branch,
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
    try {
      res.write(`\nRedeploy failed: ${err?.message || String(err)}\n`);
    } catch {}
    try {
      res.end();
    } catch {}
  }
});

module.exports = router;
