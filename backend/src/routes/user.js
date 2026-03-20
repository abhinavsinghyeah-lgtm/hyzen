const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const { requireUser } = require("../middleware/auth");
const config = require("../config");
const { getPool } = require("../db");
const { deployToDocker } = require("../deployService");
const { invalidate } = require("../containersCache");

const Docker = require("dockerode");
const tarfs = require("tar-fs");
const path = require("path");
const os = require("os");
const fs = require("fs");
const util = require("util");
const { execFile } = require("child_process");

const router = express.Router();
const execFileAsync = util.promisify(execFile);

function dockerInstance() {
  return new Docker({ host: "localhost", port: 2375 });
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

function sanitizeEnvPairs(env) {
  if (!env) return [];
  if (Array.isArray(env)) return env;
  if (typeof env === "object") {
    return Object.entries(env).map(([key, value]) => ({ key, value }));
  }
  return [];
}

function normalizeEnvForDocker(envPairs) {
  const envArr = [];
  for (const pair of envPairs) {
    const rawKey = String(pair?.key || "").trim();
    const rawValue = String(pair?.value ?? "").toString();
    if (!rawKey) continue;
    const safeKey = rawKey
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .toUpperCase();
    envArr.push(`${safeKey}=${rawValue}`);
  }
  return envArr;
}

function parseCpuToNanoCpus(cpu) {
  const n = Number(cpu);
  if (Number.isNaN(n)) return 500000000;
  return Math.round(n * 1e9);
}

function ramMbToBytes(ramMb) {
  const n = Number(ramMb);
  if (Number.isNaN(n)) return 512 * 1024 * 1024;
  return n * 1024 * 1024;
}

function getContainerUrlFromInspect(inspect) {
  const ports = inspect?.NetworkSettings?.Ports || {};
  for (const bindings of Object.values(ports)) {
    if (Array.isArray(bindings) && bindings[0]?.HostPort) {
      const hostPort = bindings[0].HostPort;
      return `http://localhost:${hostPort}`;
    }
  }
  return null;
}

function toUiStatus(state) {
  const s = String(state || "").toLowerCase();
  if (s === "running") return "running";
  if (s === "paused") return "paused";
  if (!s) return "unknown";
  return "stopped";
}

async function detectExposedPort(docker, imageTag, fallbackPort) {
  try {
    const img = docker.getImage(imageTag);
    const info = await img.inspect();
    const exposed = info?.Config?.ExposedPorts || {};
    const keys = Object.keys(exposed);
    if (!keys.length) return fallbackPort;
    const key = keys[0];
    const port = Number(String(key).split("/")[0]);
    if (!Number.isNaN(port) && port > 0) return port;
    return fallbackPort;
  } catch {
    return fallbackPort;
  }
}

function isPortAvailable(port) {
  const net = require("net");
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function getRandomAvailablePort(minPort = 3000, maxPort = 9000) {
  const attempts = 120;
  for (let i = 0; i < attempts; i++) {
    const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
    // eslint-disable-next-line no-await-in-loop
    const ok = await isPortAvailable(port);
    if (ok) return port;
  }
  for (let port = minPort; port <= maxPort; port++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isPortAvailable(port);
    if (ok) return port;
  }
  throw new Error(`No available port in range ${minPort}-${maxPort}`);
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const pool = getPool();
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1;`, [
      email,
    ]);
    if (existing.rows.length) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await pool.query(
      `
      INSERT INTO users (email, password, name, plan, plan_expires_at)
      VALUES ($1, $2, $3, 'free', NULL)
      RETURNING id, email, name, plan, plan_expires_at;
      `,
      [email, passwordHash, name]
    );

    const user = inserted.rows[0];
    return res.json({ user });
  } catch (err) {
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
  } catch (err) {
    return res.status(500).json({ message: "Login failed" });
  }
});

router.get("/me", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const u = await pool.query(`SELECT id, email, name, plan, plan_expires_at FROM users WHERE id = $1;`, [userId]);
    const user = u.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    const containersUsed = await getContainerCount(pool, userId);
    const plan = user.plan || "free";
    const planMeta = planInfoFor(plan);
    const days = daysRemaining(user.plan_expires_at);

    return res.json({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      plan: {
        ...planMeta,
        key: plan,
        daysRemaining: days,
      },
      containersUsed,
      containersAllowed: planMeta.containers,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load profile" });
  }
});

router.get("/containers", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;

    const rows = await pool.query(
      `SELECT id, container_id, name, url, ram, cpu, status, env_vars, created_at
       FROM user_containers
       WHERE user_id = $1
       ORDER BY created_at DESC;`,
      [userId]
    );

    const docker = dockerInstance();
    const results = [];

    for (const r of rows.rows) {
      const containerId = r.container_id;
      let uptimeSeconds = null;
      let uiStatus = r.status;
      let actualUrl = r.url;
      try {
        const container = docker.getContainer(containerId);
        const inspect = await container.inspect();
        const state = inspect?.State?.Status || (inspect?.State?.Running ? "running" : "stopped");
        uiStatus = toUiStatus(state);
        actualUrl = actualUrl || getContainerUrlFromInspect(inspect);
        const startedAt = inspect?.State?.StartedAt ? new Date(inspect.State.StartedAt) : null;
        if (startedAt) {
          uptimeSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
        }
      } catch {
        // Container missing; keep DB values.
      }

      results.push({
        id: r.id,
        name: r.name,
        status: uiStatus,
        url: actualUrl,
        ram: r.ram,
        cpu: r.cpu,
        uptimeSeconds,
        envVars: r.env_vars,
      });
    }

    return res.json({ containers: results });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load containers" });
  }
});

router.post("/deploy", requireUser, async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const { repoUrl, branch, containerName, ramMb, cpuCores, ram, cpu, env } = req.body || {};

  if (!repoUrl || !containerName) {
    res.status(400).end("Missing repoUrl or containerName");
    return;
  }

  const userId = req.user.sub;
  const pool = getPool();

  try {
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

    const outputParts = [];
    const onLog = (s) => {
      outputParts.push(String(s));
      res.write(String(s));
    };

    const deployed = await deployToDocker({
      repoUrl,
      branch: branch || null,
      containerName,
      ramMb: ramMb || ram,
      cpuCores: cpuCores || cpu,
      env,
      onLog,
    });

    await pool.query(
      `
      INSERT INTO user_containers
        (user_id, container_id, name, url, ram, cpu, status, env_vars)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8);
      `,
      [
        userId,
        deployed.containerId,
        deployed.safeName,
        deployed.url,
        deployed.ram,
        deployed.cpu,
        "running",
        env || [],
      ]
    );

    res.end();
  } catch (err) {
    res.write(`\nDeployment failed: ${err?.message || String(err)}\n`);
    res.end();
  }
});

router.post("/containers/:id/start", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const r = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const docker = dockerInstance();
    await docker.getContainer(row.container_id).start();
    await pool.query(`UPDATE user_containers SET status = 'running' WHERE id = $1;`, [row.id]);
    invalidate();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to start container" });
  }
});

router.post("/containers/:id/stop", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const r = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const docker = dockerInstance();
    await docker.getContainer(row.container_id).stop();
    await pool.query(`UPDATE user_containers SET status = 'stopped' WHERE id = $1;`, [row.id]);
    invalidate();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to stop container" });
  }
});

router.post("/containers/:id/restart", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const r = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const docker = dockerInstance();
    await docker.getContainer(row.container_id).restart();
    await pool.query(`UPDATE user_containers SET status = 'running' WHERE id = $1;`, [row.id]);
    invalidate();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to restart container" });
  }
});

router.get("/containers/:id/logs", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const r = await pool.query(
      `SELECT container_id FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const docker = dockerInstance();
    const container = docker.getContainer(row.container_id);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const { Writable } = require("stream");
    const stdout = new Writable({
      write(chunk, enc, cb) {
        try {
          res.write(chunk.toString("utf8"));
        } catch {}
        cb();
      },
    });
    const stderr = new Writable({
      write(chunk, enc, cb) {
        try {
          res.write(chunk.toString("utf8"));
        } catch {}
        cb();
      },
    });

    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      since: 0,
    });

    docker.modem.demuxStream(logStream, stdout, stderr);

    req.on("close", () => {
      try {
        logStream.destroy();
      } catch {}
      try {
        res.end();
      } catch {}
    });
  } catch {
    return res.status(500).json({ message: "Failed to stream logs" });
  }
});

// Update env vars and recreate container from existing image.
router.put("/containers/:id/env", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const { env } = req.body || {};

    const r = await pool.query(
      `SELECT * FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const envPairs = sanitizeEnvPairs(env);
    const envArr = normalizeEnvForDocker(envPairs);

    // Recreate container.
    const docker = dockerInstance();
    const imageTag = `hyzen/${row.name}:latest`;

    // Stop/remove old container.
    try {
      await docker.getContainer(row.container_id).stop({ t: 10 });
    } catch {}
    try {
      await docker.getContainer(row.container_id).remove({ force: true });
    } catch {}

    const hostPort = await getRandomAvailablePort(3000, 9000);
    const url = `http://localhost:${hostPort}`;

    const fallbackPort = 3000;
    const containerPort = await detectExposedPort(docker, imageTag, fallbackPort);
    const containerPortKey = `${containerPort}/tcp`;

    const hostConfig = {
      NanoCPUs: parseCpuToNanoCpus(row.cpu),
      Memory: ramMbToBytes(row.ram),
      PortBindings: {
        [containerPortKey]: [{ HostPort: String(hostPort) }],
      },
    };

    let newContainer;
    try {
      newContainer = await docker.createContainer({
        name: row.name,
        Image: imageTag,
        HostConfig: hostConfig,
        ExposedPorts: { [containerPortKey]: {} },
        ...(envArr.length ? { Env: envArr } : {}),
      });
    } catch (createErr) {
      return res.status(500).json({
        message: `Failed to recreate container: ${createErr?.message || String(createErr)}`,
      });
    }

    await newContainer.start();

    await pool.query(
      `
      UPDATE user_containers
      SET container_id = $1,
          url = $2,
          status = 'running',
          env_vars = $3
      WHERE id = $4;
      `,
      [newContainer.id, url, envPairs, row.id]
    );

    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update env" });
  }
});

router.post("/containers/:id/delete", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const r = await pool.query(
      `SELECT container_id FROM user_containers WHERE id = $1 AND user_id = $2;`,
      [req.params.id, userId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ message: "Container not found" });

    const docker = dockerInstance();
    const container = docker.getContainer(row.container_id);
    try {
      await container.stop({ t: 10 });
    } catch {}
    try {
      await container.remove({ force: true });
    } catch {}

    await pool.query(`DELETE FROM user_containers WHERE id = $1;`, [req.params.id]);
    invalidate();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to delete container" });
  }
});

router.get("/billing", requireUser, async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user.sub;
    const u = await pool.query(`SELECT plan, plan_expires_at FROM users WHERE id = $1;`, [
      userId,
    ]);
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
  } catch (err) {
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

    // Determine plan from order receipt/notes if needed; best-effort from body.
    const { plan } = req.body || {};
    const finalPlan = plan && Object.prototype.hasOwnProperty.call(config.plans, plan) ? plan : "starter";

    const pool = getPool();
    await pool.query(
      `
      UPDATE users
      SET plan = $1,
          plan_expires_at = NOW() + INTERVAL '30 days'
      WHERE id = $2;
      `,
      [finalPlan, req.user.sub]
    );

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to verify payment" });
  }
});

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
      // Ensure email uniqueness.
      const exists = await pool.query(`SELECT id FROM users WHERE email = $1 AND id <> $2;`, [
        email,
        userId,
      ]);
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

