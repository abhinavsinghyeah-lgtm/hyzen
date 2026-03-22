const express = require("express");
const { getPool } = require("../db");
const { invalidate } = require("../containersCache");
const { deployProcess, envInputToPairs } = require("../deployService");
const config = require("../config");

const router = express.Router();

function generateSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55) || "server";
}

async function findFreeSubdomain(pool, slug) {
  let candidate = slug;
  for (let i = 2; i <= 100; i++) {
    const { rows } = await pool.query(
      `SELECT id FROM hyzen_subdomains WHERE subdomain = $1`,
      [candidate]
    );
    if (!rows.length) return candidate;
    candidate = `${slug}-${i}`;
  }
  return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildSubdomainUrl(subdomain, baseDomain) {
  if (!subdomain) return null;
  return `https://${subdomain}.${baseDomain || config.baseDomain}`;
}

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
      branch: branch || null,
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

    const pool = getPool();
    const envPairs = envInputToPairs(env);
    const inserted = await pool.query(
      `INSERT INTO hyzen_deployments
         (repo_url, branch, container_name, status, url, pid, work_dir, log_file, start_cmd, build_cmd, env_vars, suspended)
       VALUES
         ($1, $2, $3, 'running', $4, $5, $6, $7, $8, $9, $10, FALSE)
       RETURNING id`,
      [
        repoUrl,
        result.usedBranch || branch || "main",
        result.safeName,
        result.url,
        result.pid,
        result.workDir,
        result.logFile,
        result.startCmd,
        buildCmd || null,
        envPairs || [],
      ]
    );

    // Auto-assign subdomain for admin deployments too.
    try {
      const deploymentId = inserted.rows[0].id;
      const slug = generateSlug(result.safeName);
      const freeSlug = await findFreeSubdomain(pool, slug);
      await pool.query(
        `INSERT INTO hyzen_subdomains (subdomain, base_domain, admin_deployment_id)
         VALUES ($1, $2, $3) ON CONFLICT (subdomain) DO NOTHING`,
        [freeSlug, config.baseDomain, deploymentId]
      );
      const publicUrl = buildSubdomainUrl(freeSlug, config.baseDomain);
      try { res.write(`Public URL: ${publicUrl}\n`); } catch {}
    } catch {}

    invalidate();
    res.end();
  } catch (err) {
    try {
      res.write(`\nDeployment failed: ${err?.message || String(err)}\n`);
    } catch {}
    try {
      res.end();
    } catch {}
  }
});

module.exports = router;
