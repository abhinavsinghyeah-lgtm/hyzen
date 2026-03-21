const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const { deployProcess } = require("../deployService");

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

router.post("/", async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const { repoUrl, branch, containerName, env, buildCmd, startCmd } = req.body || {};

  if (!repoUrl || !containerName) {
    res.status(400).end("Missing repoUrl or containerName");
    return;
  }

  try {
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

    // Save to DB (best effort).
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO hyzen_deployments
           (repo_url, branch, container_name, status, output, url, pid, work_dir, log_file, start_cmd)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          repoUrl,
          result.usedBranch,
          result.safeName,
          "running",
          "deployed",
          result.url,
          result.pid,
          result.workDir,
          result.logFile,
          result.startCmd,
        ]
      );
    } catch {}

    res.end();
  } catch (err) {
    try { res.write(`\nDeployment failed: ${err?.message || String(err)}\n`); } catch {}
    try { res.end(); } catch {}
  }
});

module.exports = router;
