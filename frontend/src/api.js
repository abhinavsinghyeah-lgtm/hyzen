function resolveApiBaseUrl() {
  const raw = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (raw) {
    if (typeof window !== "undefined" && window.location.protocol === "https:" && raw.startsWith("http://")) {
      try {
        const rawUrl = new URL(raw);
        if (rawUrl.hostname === window.location.hostname || rawUrl.hostname === "160.187.211.242") {
          return window.location.origin.replace(/\/$/, "");
        }
      } catch {
        return window.location.origin.replace(/\/$/, "");
      }
    }
    return raw.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const u = new URL(window.location.origin);
    if (u.port === "3001") u.port = "4000";
    return u.origin;
  }

  return "http://localhost:4000";
}

const API_BASE_URL = resolveApiBaseUrl();

function decodeJwtPayload(token) {
  try {
    const base64Url = String(token || "").split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
  } catch {
    return null;
  }
}

function getUserIsAdmin() {
  const token = localStorage.getItem("hyzen_user_jwt");
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  return payload?.is_admin === true;
}

function getAdminToken() {
  // Old-style dedicated admin JWT takes priority.
  const adminToken = localStorage.getItem("hyzen_jwt");
  if (adminToken) return adminToken;
  // If logged in as a regular user who has admin rights, use the user JWT.
  const userToken = localStorage.getItem("hyzen_user_jwt");
  if (userToken && getUserIsAdmin()) return userToken;
  return null;
}

function getUserToken() {
  return localStorage.getItem("hyzen_user_jwt");
}

async function request(path, options = {}) {
  const token = options.token || getAdminToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    if (parsed && typeof parsed === "object") {
      const message =
        parsed?.message || parsed?.error || parsed?.detail || parsed?.title;
      if (message) throw new Error(String(message));
      throw new Error(`Request failed (${res.status})`);
    }
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res;
}

async function getJson(path, options = {}) {
  const res = await request(path, { method: "GET", ...options });
  return res.json();
}

export async function apiLogin({ username, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Login failed (${res.status})`);
  }
  return res.json();
}

export function adminLogout() {
  localStorage.removeItem("hyzen_jwt");
  localStorage.removeItem("hyzen_user_jwt");
  window.location.href = "/login";
}

export function userLogout() {
  localStorage.removeItem("hyzen_user_jwt");
  localStorage.removeItem("hyzen_jwt");
  window.location.href = "/login";
}

export const api = {
  API_BASE_URL,
  getJson,
  request,
  getAdminToken,
  getUserToken,
  getUserIsAdmin,
  decodeJwtPayload,

  // ── Subdomains (admin) ─────────────────────────────────────────────────────
  async adminGetSubdomains() {
    return getJson("/api/subdomains");
  },
  async adminCreateSubdomain(subdomain) {
    const res = await request("/api/subdomains", {
      method: "POST",
      body: JSON.stringify({ subdomain }),
    });
    return res.json();
  },
  async adminUpdateSubdomain(id, data) {
    const res = await request(`/api/subdomains/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async adminDeleteSubdomain(id) {
    const res = await request(`/api/subdomains/${id}`, { method: "DELETE" });
    return res.json();
  },

  // ── Subdomains (user) ──────────────────────────────────────────────────────
  async userGetSubdomains() {
    return getJson("/api/user/subdomains", { token: getUserToken() });
  },
};

export async function apiStream(path, options = {}) {
  const token = options.token || getAdminToken();
  const headers = {
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}
    if (parsed && typeof parsed === "object") {
      const message =
        parsed?.message || parsed?.error || parsed?.detail || parsed?.title;
      if (message) throw new Error(String(message));
      throw new Error(`Request failed (${res.status})`);
    }
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res;
}

