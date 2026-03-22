const express = require("express");
const { getPool } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const config = require("../config");

const router = express.Router();

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63) || "server";
}

// ── GET / — list all subdomains (admin) ───────────────────────────────────────
router.get("/", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT s.id, s.subdomain, s.base_domain, s.user_container_id,
             s.admin_deployment_id, s.user_id, s.is_active, s.created_at,
             uc.name AS container_name,
             hd.container_name AS admin_deployment_name,
             u.email AS user_email,
             u.name AS user_name
      FROM hyzen_subdomains s
      LEFT JOIN user_containers uc ON uc.id = s.user_container_id
      LEFT JOIN hyzen_deployments hd ON hd.id = s.admin_deployment_id
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
    `);
    return res.json({
      subdomains: rows.map((r) => ({
        id: r.id,
        subdomain: r.subdomain,
        domain: `${r.subdomain}.${r.base_domain}`,
        baseDomain: r.base_domain,
        userContainerId: r.user_container_id,
        adminDeploymentId: r.admin_deployment_id,
        containerName: r.container_name || r.admin_deployment_name || null,
        userEmail: r.user_email || null,
        userName: r.user_name || null,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
      })),
    });
  } catch {
    return res.status(500).json({ message: "Failed to list subdomains" });
  }
});

// ── POST / — reserve a subdomain (admin) ──────────────────────────────────────
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { subdomain } = req.body || {};
    if (!subdomain) return res.status(400).json({ message: "subdomain is required" });
    const slug = slugify(subdomain);
    if (!slug) return res.status(400).json({ message: "Invalid subdomain" });

    const bd = config.baseDomain;
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO hyzen_subdomains (subdomain, base_domain) VALUES ($1, $2) RETURNING *`,
      [slug, bd]
    );
    const r = rows[0];
    return res.json({ subdomain: { id: r.id, subdomain: r.subdomain, domain: `${r.subdomain}.${r.base_domain}` } });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ message: "Subdomain already taken" });
    return res.status(500).json({ message: "Failed to create subdomain" });
  }
});

// ── PATCH /:id — assign subdomain to container (admin) ───────────────────────
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { userContainerId, adminDeploymentId, isActive } = req.body || {};
    const id = Number(req.params.id);

    let query = `UPDATE hyzen_subdomains SET `;
    const values = [];
    const updates = [];
    let idx = 1;

    if (userContainerId !== undefined) {
      updates.push(`user_container_id = $${idx++}`);
      values.push(userContainerId || null);
      if (userContainerId) { updates.push(`admin_deployment_id = NULL`); }
    }
    if (adminDeploymentId !== undefined) {
      updates.push(`admin_deployment_id = $${idx++}`);
      values.push(adminDeploymentId || null);
      if (adminDeploymentId) { updates.push(`user_container_id = NULL`); }
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(Boolean(isActive));
    }

    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });
    values.push(id);
    query += `${updates.join(", ")} WHERE id = $${idx} RETURNING *`;

    const { rows } = await pool.query(query, values);
    if (!rows.length) return res.status(404).json({ message: "Subdomain not found" });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to update subdomain" });
  }
});

// ── DELETE /:id — delete subdomain (admin) ────────────────────────────────────
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rowCount } = await pool.query(`DELETE FROM hyzen_subdomains WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: "Subdomain not found" });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to delete subdomain" });
  }
});

module.exports = router;
