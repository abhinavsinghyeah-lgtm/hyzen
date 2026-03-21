const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function getAdminToken() {
  return localStorage.getItem("hyzen_jwt");
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
  window.location.href = "/login";
}

export function userLogout() {
  localStorage.removeItem("hyzen_user_jwt");
  window.location.href = "/user/login";
}

export const api = {
  API_BASE_URL,
  getJson,
  request,
  getAdminToken,
  getUserToken,
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

