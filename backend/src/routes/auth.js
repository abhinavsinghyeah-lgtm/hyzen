const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
require("dotenv").config();

const { getSettings, updateSettings } = require("../db");
const { requireAdmin } = require("../middleware/auth");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const settings = await getSettings().catch(() => null);
    const adminUser = settings?.admin_user || process.env.ADMIN_USER;
    const adminPassword = settings?.admin_password || process.env.ADMIN_PASSWORD;

    if (username !== adminUser || password !== adminPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { sub: username, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ message: "Login failed" });
  }
});

router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    return res.json({
      docker_socket_path: settings?.docker_socket_path || null,
      docker_host: settings?.docker_host || null,
      docker_port: settings?.docker_port || null,
      admin_user: settings?.admin_user || null,
      // Intentionally omit admin_password.
    });
  } catch {
    return res.status(500).json({ message: "Failed to load settings" });
  }
});

router.post("/settings", requireAdmin, async (req, res) => {
  try {
    const {
      docker_socket_path,
      docker_host,
      docker_port,
      admin_user,
      admin_password,
    } = req.body || {};

    if (!admin_user || !admin_password) {
      return res.status(400).json({ message: "Missing admin credentials" });
    }

    await updateSettings({
      docker_socket_path: docker_socket_path || null,
      docker_host: docker_host || null,
      docker_port: docker_port ? Number(docker_port) : null,
      admin_user,
      admin_password,
    });

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to save settings" });
  }
});

module.exports = router;

