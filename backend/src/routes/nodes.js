const express = require("express");
const crypto = require("crypto");
const { getPool } = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const ONLINE_WINDOW_SECONDS = Number(process.env.NODE_HEARTBEAT_TIMEOUT_SECONDS || 45);

function buildNodeView(row) {
  const nowMs = Date.now();
  const seenMs = row?.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const isOnline = Boolean(row?.is_active) && seenMs > 0 && nowMs - seenMs <= ONLINE_WINDOW_SECONDS * 1000;

  return {
    id: row.id,
    name: row.name,
    host: row.host || "",
    isActive: Boolean(row.is_active),
    isOnline,
    lastSeenAt: row.last_seen_at,
    stats: row.last_stats_json || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateNodeToken() {
  return crypto.randomBytes(24).toString("hex");
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, name, host, is_active, last_seen_at, last_stats_json, created_at, updated_at
       FROM hyzen_nodes
       ORDER BY created_at DESC`
    );

    const nodes = rows.map(buildNodeView);
    const summary = {
      total: nodes.length,
      active: nodes.filter((n) => n.isActive).length,
      online: nodes.filter((n) => n.isOnline).length,
      offline: nodes.filter((n) => n.isActive && !n.isOnline).length,
    };

    return res.json({ nodes, summary, heartbeatTimeoutSeconds: ONLINE_WINDOW_SECONDS });
  } catch {
    return res.status(500).json({ message: "Failed to load nodes" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const host = String(req.body?.host || "").trim();
    if (!name) return res.status(400).json({ message: "Node name is required" });

    const token = generateNodeToken();
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO hyzen_nodes (name, host, node_token)
       VALUES ($1, $2, $3)
       RETURNING id, name, host, is_active, last_seen_at, last_stats_json, created_at, updated_at`,
      [name, host || null, token]
    );

    return res.json({
      node: buildNodeView(rows[0]),
      token,
      message: "Save this token securely. It is shown only once.",
    });
  } catch {
    return res.status(500).json({ message: "Failed to create node" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid node id" });

    const updates = [];
    const values = [];

    if (typeof req.body?.name === "string") {
      const name = req.body.name.trim();
      if (!name) return res.status(400).json({ message: "Node name cannot be empty" });
      updates.push(`name = $${updates.length + 1}`);
      values.push(name);
    }

    if (typeof req.body?.host === "string") {
      updates.push(`host = $${updates.length + 1}`);
      values.push(req.body.host.trim() || null);
    }

    if (typeof req.body?.isActive === "boolean") {
      updates.push(`is_active = $${updates.length + 1}`);
      values.push(req.body.isActive);
    }

    let newToken = null;
    if (req.body?.rotateToken === true) {
      newToken = generateNodeToken();
      updates.push(`node_token = $${updates.length + 1}`);
      values.push(newToken);
    }

    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE hyzen_nodes
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, name, host, is_active, last_seen_at, last_stats_json, created_at, updated_at`,
      values
    );

    if (!rows.length) return res.status(404).json({ message: "Node not found" });

    return res.json({ node: buildNodeView(rows[0]), token: newToken });
  } catch {
    return res.status(500).json({ message: "Failed to update node" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid node id" });

    const pool = getPool();
    const { rowCount } = await pool.query(`DELETE FROM hyzen_nodes WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ message: "Node not found" });

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to delete node" });
  }
});

router.post("/heartbeat", async (req, res) => {
  try {
    const token = String(req.headers["x-node-token"] || req.body?.token || "").trim();
    if (!token) return res.status(401).json({ message: "Missing node token" });

    const name = String(req.body?.name || "").trim();
    const host = String(req.body?.host || "").trim();
    const stats = req.body?.stats && typeof req.body.stats === "object" ? req.body.stats : null;

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE hyzen_nodes
       SET last_seen_at = NOW(),
           last_stats_json = COALESCE($1, last_stats_json),
           name = CASE WHEN $2 <> '' THEN $2 ELSE name END,
           host = CASE WHEN $3 <> '' THEN $3 ELSE host END,
           updated_at = NOW()
       WHERE node_token = $4 AND is_active = TRUE
       RETURNING id, name, host, is_active, last_seen_at, last_stats_json, created_at, updated_at`,
      [stats, name, host, token]
    );

    if (!rows.length) return res.status(401).json({ message: "Invalid or inactive node token" });

    return res.json({ ok: true, node: buildNodeView(rows[0]), heartbeatTimeoutSeconds: ONLINE_WINDOW_SECONDS });
  } catch {
    return res.status(500).json({ message: "Failed to record heartbeat" });
  }
});

module.exports = router;
