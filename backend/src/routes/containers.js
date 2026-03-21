const express = require("express");
const Docker = require("dockerode");
const router = express.Router();
const { getSettings } = require("../db");
const { getCachedContainers, invalidate } = require("../containersCache");

function dockerFromSettings() {
  return new Docker({ socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock" });
}

function toUiStatus(state) {
  const s = String(state || "").toLowerCase();
  if (s === "running") return "running";
  if (s === "paused") return "paused";
  if (!s) return "unknown";
  return "stopped";
}

function inspectToUrl(inspect) {
  const ports = inspect?.NetworkSettings?.Ports || {};
  for (const bindings of Object.values(ports)) {
    if (Array.isArray(bindings) && bindings[0]?.HostPort) {
      const hostPort = bindings[0].HostPort;
      return `http://localhost:${hostPort}`;
    }
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const value = await getCachedContainers({
      fetcher: async () => {
        const settings = await getSettings().catch(() => null);
        const docker = dockerFromSettings(settings);

        const containers = await docker.listContainers({ all: true });
        const results = [];

        for (const c of containers) {
          const container = docker.getContainer(c.Id);
          let ramUsageBytes = null;
          try {
            const stats = await new Promise((resolve, reject) => {
              container.stats({ stream: false }, (err, s) => {
                if (err) return reject(err);
                resolve(s);
              });
            });

            ramUsageBytes = stats?.memory_stats?.usage || null;
          } catch {
            // Best effort: RAM usage is optional for the UI.
          }

          const state = c.State || (c.Status || "").split(" ")[0] || "";
          const status = toUiStatus(state);

          let url = null;
          try {
            const inspect = await container.inspect();
            url = inspectToUrl(inspect);
          } catch {}

          results.push({
            id: c.Id,
            name: (c.Names && c.Names[0] ? c.Names[0].replace(/^\//, "") : c.Id).slice(0, 64),
            status,
            image: c.Image || "",
            state,
            uptimeSeconds: c.UptimeSeconds || null,
            ramUsageBytes,
            url,
          });
        }

        return results;
      },
    });

    return res.json(value);
  } catch (err) {
    return res.status(500).json({ message: "Failed to list containers" });
  }
});

router.post("/:id/start", async (req, res) => {
  try {
    const settings = await getSettings().catch(() => null);
    const docker = dockerFromSettings(settings);
    const container = docker.getContainer(req.params.id);
    await container.start();
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to start container" });
  }
});

router.post("/:id/stop", async (req, res) => {
  try {
    const settings = await getSettings().catch(() => null);
    const docker = dockerFromSettings(settings);
    const container = docker.getContainer(req.params.id);
    await container.stop();
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to stop container" });
  }
});

router.post("/:id/restart", async (req, res) => {
  try {
    const settings = await getSettings().catch(() => null);
    const docker = dockerFromSettings(settings);
    const container = docker.getContainer(req.params.id);
    await container.restart();
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to restart container" });
  }
});

router.post("/:id/delete", async (req, res) => {
  try {
    const settings = await getSettings().catch(() => null);
    const docker = dockerFromSettings(settings);
    const container = docker.getContainer(req.params.id);

    try {
      await container.stop({ t: 10 });
    } catch {}
    await container.remove({ force: true });
    invalidate();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete container" });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    const settings = await getSettings().catch(() => null);
    const docker = dockerFromSettings(settings);
    const container = docker.getContainer(req.params.id);

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

    // Demux stdout/stderr so the frontend receives clean UTF-8 log lines.
    docker.modem.demuxStream(logStream, stdout, stderr);

    const cleanup = () => {
      try {
        logStream.destroy();
      } catch {}
      try {
        res.end();
      } catch {}
    };

    req.on("close", cleanup);
    req.on("end", cleanup);
  } catch (err) {
    return res.status(500).json({ message: "Failed to stream logs" });
  }
});

module.exports = router;

