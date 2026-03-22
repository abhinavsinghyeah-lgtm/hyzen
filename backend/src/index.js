require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const https = require("https");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { initDb, getPool } = require("./db");
const config = require("./config");
const authRoutes = require("./routes/auth");
const containersRoutes = require("./routes/containers");
const deployRoutes = require("./routes/deploy");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const subdomainRoutes = require("./routes/subdomains");

const { requireAdmin } = require("./middleware/auth");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const corsAllowList = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || corsAllowList.length === 0 || corsAllowList.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "1mb" }));
app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);

const VPS_CACHE_MS = 3000;
let vpsCache = { ts: 0, value: null };

function suspendedHtml(message) {
  const safe = String(message || "Your service has been suspended by HYZEN Administration, please contact for more info.")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Service Suspended</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: radial-gradient(80% 80% at 20% 0%, #1a2736 0%, #0a1018 55%, #05080f 100%);
      color: #e9f0fb;
    }
    .modal {
      width: min(90vw, 560px);
      background: rgba(12, 20, 33, 0.92);
      border: 1px solid rgba(120, 154, 196, 0.24);
      border-radius: 22px;
      padding: 26px;
      box-shadow: 0 30px 70px rgba(2, 8, 16, 0.55);
      backdrop-filter: blur(8px);
    }
    .badge {
      display: inline-flex;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .08em;
      border-radius: 999px;
      color: #ffb357;
      border: 1px solid rgba(255, 179, 87, 0.35);
      margin-bottom: 12px;
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p {
      margin: 0;
      color: #b6c4d7;
      line-height: 1.55;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="modal" role="dialog" aria-modal="true" aria-label="Service suspended notice">
    <div class="badge">SERVICE NOTICE</div>
    <h1>Service Suspended</h1>
    <p>${safe}</p>
  </div>
</body>
</html>`;
}

// ── Subdomain proxy middleware ─────────────────────────────────────────────────
// Routes *.hyzen.pro (wildcard) to the assigned container, hiding the VPS IP.
app.use(async (req, res, next) => {
  try {
    const host = String(req.headers.host || "").split(":")[0].toLowerCase();
    const baseDomain = config.baseDomain;
    const dashDomain = config.dashDomain;

    // Only intercept wildcard subdomains, skip the dashboard domain itself
    if (host === dashDomain || !host.endsWith(`.${baseDomain}`)) {
      return next();
    }

    const subdomain = host.slice(0, -(baseDomain.length + 1));
    if (!subdomain || subdomain.includes(".")) return next();

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT user_container_id, admin_deployment_id FROM hyzen_subdomains
       WHERE subdomain = $1 AND is_active = true`,
      [subdomain]
    );

    if (!rows.length) {
      return res.status(404).setHeader("Content-Type", "text/plain").send("Subdomain not found");
    }

    const entry = rows[0];
    let targetUrl = null;
    let isSuspended = false;
    let suspendedReason = "";

    if (entry.user_container_id) {
      const r = await pool.query(
        `SELECT c.url, c.suspended, c.suspended_reason,
                u.is_suspended, u.suspended_reason AS user_suspended_reason
         FROM user_containers c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = $1`,
        [entry.user_container_id]
      );
      const cnt = r.rows[0];
      if (!cnt) return res.status(404).send("Container not found");
      if (cnt.suspended || cnt.is_suspended) {
        isSuspended = true;
        suspendedReason = cnt.suspended_reason || cnt.user_suspended_reason || "Service suspended";
      }
      targetUrl = cnt.url;
    } else if (entry.admin_deployment_id) {
      const r = await pool.query(
        `SELECT url, suspended, suspended_reason FROM hyzen_deployments WHERE id = $1`,
        [entry.admin_deployment_id]
      );
      const dep = r.rows[0];
      if (!dep) return res.status(404).send("Deployment not found");
      if (dep.suspended) { isSuspended = true; suspendedReason = dep.suspended_reason || "Service suspended"; }
      targetUrl = dep.url;
    }

    if (isSuspended) {
      res.status(403).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(suspendedHtml(suspendedReason));
    }

    if (!targetUrl) return res.status(503).send("Service not available");

    let target;
    try { target = new URL(targetUrl); } catch { return res.status(503).send("Invalid service target"); }

    const isHttps = target.protocol === "https:";
    const client = isHttps ? https : http;
    const targetPort = Number(target.port || (isHttps ? 443 : 80));

    const proxyReq = client.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: target.host },
    }, (proxyRes) => {
      res.status(proxyRes.statusCode || 502);
      for (const [k, v] of Object.entries(proxyRes.headers || {})) {
        if (v != null) res.setHeader(k, v);
      }
      proxyRes.pipe(res);
    });

    proxyReq.on("error", () => { if (!res.headersSent) res.status(502); res.end("Service is unavailable"); });
    req.pipe(proxyReq);
  } catch {
    return next();
  }
});

app.use("/service/:scope/:id", async (req, res) => {
  try {
    const scope = String(req.params.scope || "").toLowerCase();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).send("Invalid service id");
    }

    const pool = getPool();
    let row = null;

    if (scope === "admin") {
      const r = await pool.query(
        `SELECT url, pid, suspended, suspended_reason FROM hyzen_deployments WHERE id = $1`,
        [id]
      );
      row = r.rows[0] || null;
    } else if (scope === "user") {
      const r = await pool.query(
        `SELECT c.url, c.pid, c.suspended, c.suspended_reason, u.is_suspended, u.suspended_reason AS user_suspended_reason
         FROM user_containers c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = $1`,
        [id]
      );
      row = r.rows[0] || null;
      if (row && row.is_suspended) {
        row.suspended = true;
        row.suspended_reason = row.user_suspended_reason || row.suspended_reason;
      }
    } else {
      return res.status(404).send("Service not found");
    }

    if (!row) {
      return res.status(404).send("Service not found");
    }

    if (row.suspended) {
      res.status(403).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(suspendedHtml(row.suspended_reason || "Your service has been suspended by HYZEN Administration, please contact for more info."));
    }

    if (!row.url) {
      return res.status(503).send("Service URL not available");
    }

    let target;
    try {
      target = new URL(row.url);
    } catch {
      return res.status(503).send("Service target is invalid");
    }

    const isHttps = target.protocol === "https:";
    const client = isHttps ? https : http;
    const targetPort = Number(target.port || (isHttps ? 443 : 80));

    const proxyReq = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: targetPort,
        method: req.method,
        path: req.url,
        headers: {
          ...req.headers,
          host: target.host,
        },
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        for (const [k, v] of Object.entries(proxyRes.headers || {})) {
          if (v != null) res.setHeader(k, v);
        }
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", () => {
      if (!res.headersSent) res.status(502);
      res.end("Service is unavailable");
    });

    req.pipe(proxyReq);
  } catch {
    res.status(500).send("Service proxy error");
  }
});

app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/containers", requireAdmin, containersRoutes);
app.use("/api/deploy", requireAdmin, deployRoutes);

// VPS stats (protected)
const systeminformation = require("systeminformation");
app.get("/api/vps/stats", requireAdmin, async (req, res) => {
  try {
    if (Date.now() - vpsCache.ts < VPS_CACHE_MS && vpsCache.value) {
      res.json(vpsCache.value);
      return;
    }

    const [load, mem, disks, cpu, time] = await Promise.all([
      systeminformation.currentLoad(),
      systeminformation.mem(),
      systeminformation.fsSize(),
      systeminformation.cpu(),
      systeminformation.time(),
    ]);

    const cpuPercent = Math.max(0, Math.min(100, Number(load.currentLoad || 0)));
    const totalCores = Number(cpu?.cores || load?.cpus?.length || 0);
    const usedCores = Number(((cpuPercent / 100) * totalCores).toFixed(2));
    const ramUsedBytes = Number(mem.used || 0);
    const ramTotalBytes = Number(mem.total || 0);
    const ramFreeBytes = Number(mem.available || 0);

    // Prefer root if present; otherwise take the first filesystem entry.
    const root =
      (Array.isArray(disks) ? disks.find((d) => d.mount === "/" || d.fs === "/") : null) ||
      (Array.isArray(disks) ? disks[0] : null);

    const diskUsedBytes = Number(root?.used || 0);
    const diskTotalBytes = Number(root?.size || 0);
    const diskFreeBytes = Math.max(0, diskTotalBytes - diskUsedBytes);
    const uptimeSeconds = Number(time?.uptime || 0);

    const value = {
      cpuPercent,
      cpu: {
        usedCores,
        totalCores,
        processor: [cpu?.manufacturer, cpu?.brand].filter(Boolean).join(" ").trim() || "Unknown CPU",
        speedGHz: Number(cpu?.speed || 0),
      },
      ram: {
        usedBytes: ramUsedBytes,
        totalBytes: ramTotalBytes,
        freeBytes: ramFreeBytes,
      },
      disk: {
        usedBytes: diskUsedBytes,
        totalBytes: diskTotalBytes,
        freeBytes: diskFreeBytes,
      },
      system: {
        uptimeSeconds,
        hostname: String(process.env.HOSTNAME || ""),
      },
    };

    vpsCache = { ts: Date.now(), value };
    return res.json(value);
  } catch {
    return res.status(500).json({ message: "Failed to get VPS stats" });
  }
});

app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subdomains", subdomainRoutes);

const PORT = Number(process.env.PORT || 4000);

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Hyzen backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  });

