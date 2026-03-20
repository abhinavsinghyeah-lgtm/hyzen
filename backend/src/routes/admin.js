const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const { getPool } = require("../db");
const config = require("../config");

const router = express.Router();

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    const users = await pool.query(
      `SELECT id, email, name, plan, plan_expires_at, created_at
       FROM users
       ORDER BY created_at DESC;`
    );

    const rows = [];
    for (const u of users.rows) {
      // eslint-disable-next-line no-await-in-loop
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS count FROM user_containers WHERE user_id = $1;`,
        [u.id]
      );
      rows.push({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        plan_expires_at: u.plan_expires_at,
        joined_at: u.created_at,
        containers_used: countRes.rows[0]?.count || 0,
      });
    }

    return res.json({ users: rows });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load users" });
  }
});

router.post("/users/:id/plan", requireAdmin, async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!plan || !Object.prototype.hasOwnProperty.call(config.plans, plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const pool = getPool();
    await pool.query(
      `
      UPDATE users
      SET plan = $1,
          plan_expires_at = CASE
            WHEN $1 = 'free' THEN NULL
            ELSE (NOW() + INTERVAL '30 days')
          END
      WHERE id = $2;
      `,
      [plan, req.params.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update user plan" });
  }
});

module.exports = router;

