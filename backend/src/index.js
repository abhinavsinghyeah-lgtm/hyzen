require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initDb } = require("./db");
const authRoutes = require("./routes/auth");
const containersRoutes = require("./routes/containers");
const deployRoutes = require("./routes/deploy");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");

const { requireAdmin } = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const VPS_CACHE_MS = 3000;
let vpsCache = { ts: 0, value: null };

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

    const [load, mem, disks] = await Promise.all([
      systeminformation.currentLoad(),
      systeminformation.mem(),
      systeminformation.fsSize(),
    ]);

    const cpuPercent = Math.max(0, Math.min(100, Number(load.currentLoad || 0)));
    const ramUsedBytes = Number(mem.used || 0);
    const ramTotalBytes = Number(mem.total || 0);

    // Prefer root if present; otherwise take the first filesystem entry.
    const root =
      (Array.isArray(disks) ? disks.find((d) => d.mount === "/" || d.fs === "/") : null) ||
      (Array.isArray(disks) ? disks[0] : null);

    const diskUsedBytes = Number(root?.used || 0);
    const diskTotalBytes = Number(root?.size || 0);

    const value = {
      cpuPercent,
      ram: { usedBytes: ramUsedBytes, totalBytes: ramTotalBytes },
      disk: { usedBytes: diskUsedBytes, totalBytes: diskTotalBytes },
    };

    vpsCache = { ts: Date.now(), value };
    return res.json(value);
  } catch {
    return res.status(500).json({ message: "Failed to get VPS stats" });
  }
});

app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);

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

