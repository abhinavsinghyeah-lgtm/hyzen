const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

function verifyToken(req) {
  const auth = req.headers.authorization || "";
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return null;
  const token = match[1];
  return jwt.verify(token, jwtSecret);
}

function requireUser(req, res, next) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ message: "Missing token" });
    if (decoded.role !== "user") return res.status(403).json({ message: "Forbidden" });
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ message: "Missing token" });
    const isOldAdmin = decoded.role === "admin";
    const isUserAdmin = decoded.role === "user" && decoded.is_admin === true;
    if (!isOldAdmin && !isUserAdmin) return res.status(403).json({ message: "Forbidden" });
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = {
  requireUser,
  requireAdmin,
};

