const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const fs = require("fs");

const { requireUser } = require("../middleware/auth");
const config = require("../config");
const { getPool } = require("../db");
const { deployProcess, rerunProcess, killProcess, isPidRunning, envInputToPairs } = require("../deployService");
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

function daysRemaining(planExpiresAt) {
  if (!planExpiresAt) return 0;
  const expires = new Date(planExpiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 3600 * 1000));
}

function planInfoFor(plan) {
  return config.plans[plan] || config.plans.free;
}

async function getContainerCount(pool, userId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS count FROM user_containers WHERE user_id = $1;`,
    [userId]
  );
  return r.rows[0]?.count || 0;
}

async function getUserAccessState(pool, userId) {
  const r = await pool.query(
    `SELECT is_suspended, suspended_reason FROM users WHERE id = $1;`,
    [userId]
  );
  const row = r.rows[0] || {};
  return {
    isSuspended: Boolean(row.is_suspended),
    reason: row.suspended_reason || "Your account is suspended by admin.",
  };
}

function sanitizeConfigInput(body = {}) {
  const next = {};
  if (typeof body.containerName === "string") {
    next.containerName = body.containerName.trim();
  }
  if (typeof body.repoUrl === "string") {
    next.repoUrl = body.repoUrl.trim();
  }
  if (typeof body.branch === "string") {
    next.branch = body.branch.trim();
  }
  if (typeof body.buildCmd === "string") {
    next.buildCmd = body.buildCmd.trim();
  }
  if (typeof body.startCmd === "string") {
    next.startCmd = body.startCmd.trim();
  }
  if (body.env != null) {
    next.env = envInputToPairs(body.env);
  }
  return next;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const pool = getPool();
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1;`, [email]);
    if (existing.rows.length) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await pool.query(
      `INSERT INTO users (email, password, name, plan, plan_expires_at)
       VALUES ($1, $2, $3, 'free', NULL)
       RETURNING id, email, name, plan, plan_expires_at;`,
      [email, passwordHash, name]
    );

    return res.json({ user: inserted.rows[0] });
  } catch {
    return res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Missing credentials" });

    const pool = getPool();
    const u = await pool.query(`SELECT * FROM users WHERE email = $1;`, [email]);
    const user = u.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      { sub: user.id, role: "user", email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch {
    return res.status(500).json({ message: "Login failed" });
  }
});

router.get("/me", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const u = await pool.query(
      `SELECT id, email, name, plan, plan_expires_at, is_suspended, suspended_reason FROM users WHERE id = $1;`,
      [userId]
    );
    const user = u.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    const containersUsed = await getContainerCount(pool, userId);
    const plan = user.plan || "free";
    const planMeta = planInfoFor(plan);
    const days = daysRemaining(user.plan_expires_at);

    return res.json({
      profile: { id: user.id, email: user.email, name: user.name },
      account: {
        isSuspended: Boolean(user.is_suspended),
        suspensionReason: user.suspended_reason || null,
      },
      plan: { ...planMeta, key: plan, daysRemaining: days },
      containersUsed,
      containersAllowed: planMeta.containers,
    });
  } catch {
    return res.status(500).json({ message: "Failed to load profile" });
  }
});

// ── User containers ───────────────────────────────────────────────────────────

router.get("/containers", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;

    const access = await getUserAccessState(pool, userId);

    const { rows } = await pool.query(
      `SELECT id, name, url, status, pid, work_dir, log_file, start_cmd, build_cmd,
              repo_url, branch, env_vars, suspended, suspended_reason, created_at
       FROM user_containers
       WHERE user_id = $1
       ORDER BY created_at DESC;`,
      [userId]
    );

    const results = rows.map((r) => ({
      id: r.id,
      name: r.name,
      repoUrl: r.repo_url || null,
      branch: r.branch || null,
      status: r.pid && isPidRunning(r.pid) ? "running" : "stopped",
      url: r.url || null,
      buildCmd: r.build_cmd || "",
      startCmd: r.start_cmd || "",
      suspended: Boolean(r.suspended) || access.isSuspended,
      suspendedReason: r.suspended_reason || (access.isSuspended ? access.reason : null),
      envVars: r.env_vars || [],
    }));

    return res.json({
      account: {
        isSuspended: access.isSuspended,
        suspensionReason: access.reason,
      },
      containers: results,
    });
  } catch {
    return res.status(500).json({ message: "Failed to load containers" });
  }
});

router.post("/deploy", requireUser, async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const { repoUrl, branch, containerName, env, buildCmd, startCmd } = req.body || {};

  if (!repoUrl || !containerName) {
    res.status(400).end("Missing repoUrl or containerName");
    return;
  }

  const userId = req.user.sub;
  const pool = getPool();

  try {
    const access = await getUserAccessState(pool, userId);
    if (access.isSuspended) {
      res.status(403);
      res.write(`${access.reason}\n`);
      res.end();
      return;
    }

    const u = await pool.query(`SELECT plan, plan_expires_at FROM users WHERE id = $1;`, [userId]);
    const user = u.rows[0];
    const planKey = user?.plan || "free";
    const planMeta = planInfoFor(planKey);
    const containersUsed = await getContainerCount(pool, userId);

    if (planMeta.containers === 0) {
      res.status(403);
      res.write("Choose a plan to start deploying.\n");
      res.end();
      return;
    }

    if (containersUsed >= planMeta.containers) {
      res.status(403);
      res.write("Upgrade your plan to deploy more containers.\n");
      res.end();
      return;
    }

    const result = await deployProcess({
      repoUrl,
      branch: branch || null,
      containerName,
      env,
      buildCmd,
      startCmd,
      publicBaseUrl: getPublicBaseUrl(req),
      onLog: (s) => { try { res.write(s); } catch {} },
    });

    await pool.query(
      `INSERT INTO user_containers
         (user_id, container_id, name, url, status, pid, work_dir, log_file, start_cmd, build_cmd, repo_url, branch, env_vars, suspended)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE);`,
      [
        userId,
        result.safeName,
        result.safeName,
        result.url,
        "running",
        result.pid,
        result.workDir,
        result.logFile,
        result.startCmd,
        buildCmd || null,
        repoUrl,
        result.usedBranch || branch || "main",
        envInputToPairs(env),
      ]
    );

    res.end();
  } catch (err) {
    try { res.write(`\nDeployment failed: ${err?.message || String(err)}\n`); } catch {}
    try { res.end(); } catch {}
  }
});

router.get("/containers/:id", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const access = await getUserAccessState(pool, userId);

    const { rows } = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    return res.json({
      container: {
        id: row.id,
        name: row.name,
        repoUrl: row.repo_url || "",
        branch: row.branch || "main",
        buildCmd: row.build_cmd || "",
        startCmd: row.start_cmd || "",
        envVars: row.env_vars || [],
        workDir: row.work_dir || "",
        logFile: row.log_file || "",
        status: row.pid && isPidRunning(row.pid) ? "running" : "stopped",
        url: row.url || null,
        suspended: Boolean(row.suspended) || access.isSuspended,
        suspendedReason: row.suspended_reason || (access.isSuspended ? access.reason : null),
      },
    });
  } catch {
    return res.status(500).json({ message: "Failed to load container" });
  }
});

router.post("/containers/:id/start", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const access = await getUserAccessState(pool, userId);
    if (access.isSuspended) {
      return res.status(403).json({ message: access.reason });
    }

    const { rows } = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });
    if (row.suspended) {
      return res.status(403).json({
        message: row.suspended_reason || "Container is suspended by admin.",
      });
    }
    if (isPidRunning(row.pid)) return res.json({ ok: true, message: "Already running" });

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs: row.env_vars || [],
      publicBaseUrl: getPublicBaseUrl(req),
    });

    await pool.query(
      `UPDATE user_containers SET pid = $1, url = $2, status = 'running' WHERE id = $3;`,
      [pid, url, row.id]
    );
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to start" });
  }
});

router.post("/containers/:id/stop", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const { rows } = await pool.query(
      `SELECT pid FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    killProcess(row.pid);
    await pool.query(
      `UPDATE user_containers SET status = 'stopped', pid = NULL WHERE id = $1;`,
      [req.params.id]
    );
    invalidate();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to stop" });
  }
});

router.post("/containers/:id/restart", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const access = await getUserAccessState(pool, userId);
    if (access.isSuspended) {
      return res.status(403).json({ message: access.reason });
    }

    const { rows } = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });
    if (row.suspended) {
      return res.status(403).json({
        message: row.suspended_reason || "Container is suspended by admin.",
      });
    }

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
      `UPDATE user_containers SET pid = $1, url = $2, status = 'running' WHERE id = $3;`,
      [pid, url, row.id]
    );
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to restart" });
  }
});

router.put("/containers/:id/config", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const access = await getUserAccessState(pool, userId);
    if (access.isSuspended) {
      return res.status(403).json({ message: access.reason });
    }

    const { rows } = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
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

    if (!updates.length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

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

router.post("/containers/:id/redeploy", requireUser, async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const pool = getPool();
    const userId = req.user.sub;
    const access = await getUserAccessState(pool, userId);
    if (access.isSuspended) {
      res.status(403);
      res.write(`${access.reason}\n`);
      res.end();
      return;
    }

    const { rows } = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) {
      res.status(404).end("Container not found");
      return;
    }
    if (row.suspended) {
      res.status(403);
      res.write(`${row.suspended_reason || "Container is suspended by admin."}\n`);
      res.end();
      return;
    }

    const override = sanitizeConfigInput(req.body || {});
    const repoUrl = override.repoUrl || row.repo_url;
    const branch = override.branch || row.branch || "main";
    const containerName = override.containerName || row.name;
    const buildCmd = Object.prototype.hasOwnProperty.call(override, "buildCmd") ? override.buildCmd : (row.build_cmd || "");
    const startCmd = Object.prototype.hasOwnProperty.call(override, "startCmd") ? override.startCmd : (row.start_cmd || "");
    const env = Object.prototype.hasOwnProperty.call(override, "env") ? override.env : (row.env_vars || []);

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
      onLog: (s) => { try { res.write(s); } catch {} },
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
    try { res.end(); } catch {}
  }
});

router.post("/containers/:id/redeploy-latest", requireUser, async (req, res) => {
  return res.status(400).json({
    message: "Use /containers/:id/redeploy for latest-commit redeploy.",
  });
});

router.get("/containers/:id/logs", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const { rows } = await pool.query(
      `SELECT log_file FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const logFile = row.log_file;
    if (!logFile || !fs.existsSync(logFile)) {
      return res.status(404).json({ message: "Log file not found" });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    let offset = 0;
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
  } catch {
    return res.status(500).json({ message: "Failed to stream logs" });
  }
});

router.put("/containers/:id/env", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const access = await getUserAccessState(pool, userId);
    if (access.isSuspended) {
      return res.status(403).json({ message: access.reason });
    }

    const { env } = req.body || {};

    const { rows } = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });
    if (row.suspended) {
      return res.status(403).json({
        message: row.suspended_reason || "Container is suspended by admin.",
      });
    }

    const envPairs = envInputToPairs(env);

    // Stop existing process, restart with new env.
    killProcess(row.pid);
    await new Promise((r) => setTimeout(r, 600));

    const { pid, url } = await rerunProcess({
      workDir: row.work_dir,
      startCmd: row.start_cmd,
      logFile: row.log_file,
      envPairs,
      publicBaseUrl: getPublicBaseUrl(req),
    });

    await pool.query(
      `UPDATE user_containers SET pid = $1, url = $2, status = 'running', env_vars = $3 WHERE id = $4;`,
      [pid, url, envPairs, row.id]
    );
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to update env" });
  }
});

router.post("/containers/:id/delete", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const { rows } = await pool.query(
      `SELECT pid FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    killProcess(row.pid);
    await pool.query(`DELETE FROM user_containers WHERE id = $1;`, [req.params.id]);
    invalidate();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to delete" });
  }
});

// ── Billing ───────────────────────────────────────────────────────────────────

router.get("/billing", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const u = await pool.query(
      `SELECT plan, plan_expires_at FROM users WHERE id = $1;`,
      [userId]
    );
    const user = u.rows[0];
    const planKey = user?.plan || "free";
    const meta = planInfoFor(planKey);
    const days = daysRemaining(user?.plan_expires_at);
    const used = await getContainerCount(pool, userId);

    return res.json({
      plan: {
        key: planKey,
        name: meta.name,
        price: meta.price,
        containers: meta.containers,
        ram: meta.ram,
        cpu: meta.cpu,
        daysRemaining: days,
        plan_expires_at: user?.plan_expires_at,
      },
      containersUsed: used,
      containersAllowed: meta.containers,
    });
  } catch {
    return res.status(500).json({ message: "Failed to load billing" });
  }
});

router.post("/billing/create-order", requireUser, async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!plan || !Object.prototype.hasOwnProperty.call(config.plans, plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const meta = config.plans[plan];
    const razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });

    const order = await razorpay.orders.create({
      amount: meta.price * 100,
      currency: "INR",
      receipt: `hyzen_${req.user.sub}_${plan}_${Date.now()}`,
      notes: { plan },
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
      plan,
    });
  } catch {
    return res.status(500).json({ message: "Failed to create Razorpay order" });
  }
});

router.post("/billing/verify", requireUser, async (req, res) => {
  try {
    const { order_id, payment_id, razorpay_signature } = req.body || {};
    if (!order_id || !payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    const expected = crypto
      .createHmac("sha256", config.razorpay.keySecret)
      .update(`${order_id}|${payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const { plan } = req.body || {};
    const finalPlan =
      plan && Object.prototype.hasOwnProperty.call(config.plans, plan) ? plan : "starter";

    const pool = getPool();
    await pool.query(
      `UPDATE users SET plan = $1, plan_expires_at = NOW() + INTERVAL '30 days' WHERE id = $2;`,
      [finalPlan, req.user.sub]
    );

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to verify payment" });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.put("/settings", requireUser, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const pool = getPool();
    const userId = req.user.sub;

    const updates = [];
    const params = [];

    if (name) {
      updates.push(`name = $${updates.length + 1}`);
      params.push(name);
    }

    if (email) {
      const exists = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id <> $2;`,
        [email, userId]
      );
      if (exists.rows.length) {
        return res.status(409).json({ message: "Email already in use" });
      }
      updates.push(`email = $${updates.length + 1}`);
      params.push(email);
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      updates.push(`password = $${updates.length + 1}`);
      params.push(passwordHash);
    }

    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });

    params.push(userId);
    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${updates.length + 1};`,
      params
    );

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to update settings" });
  }
});

module.exports = router;
