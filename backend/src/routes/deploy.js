const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const { deployProcess } = require("../deployService");

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
