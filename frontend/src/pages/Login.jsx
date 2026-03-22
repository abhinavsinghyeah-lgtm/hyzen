import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, apiLogin } from "../api.js";
import { brand } from "../config/brand.js";

function accentWithOpacity(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const glowBlue = accentWithOpacity(brand.accentColor, "2b");
  const glowPrimary = accentWithOpacity(brand.primaryColor, "26");
  const fromPath = location.state?.from?.pathname || "";

  function routeAfterUserLogin(token) {
    const payload = api.decodeJwtPayload(token);
    if (payload?.is_admin === true) {
      navigate("/overview", { replace: true });
      return;
    }

    if (fromPath.startsWith("/user/")) {
      navigate(fromPath, { replace: true });
      return;
    }

    navigate("/user/dashboard", { replace: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      localStorage.removeItem("hyzen_jwt");
      localStorage.removeItem("hyzen_user_jwt");

      try {
        const userRes = await fetch(`${api.API_BASE_URL}/api/user/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: identifier, password }),
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          localStorage.setItem("hyzen_user_jwt", userData.token);
          routeAfterUserLogin(userData.token);
          return;
        }
      } catch {
        // Fall back to admin credentials flow.
      }

      const { token } = await apiLogin({ username: identifier, password });
      localStorage.setItem("hyzen_jwt", token);
      navigate("/overview", { replace: true });
    } catch (err) {
      setError(err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundColor: brand.darkBg,
        backgroundImage: `radial-gradient(circle at 16% 12%, ${glowPrimary} 0%, transparent 45%), radial-gradient(circle at 82% 10%, ${glowBlue} 0%, transparent 48%)`,
        transition: "all 200ms",
      }}
    >
      <div
        className="w-full max-w-[460px] backdrop-blur-xl rounded-[28px] border transition-all duration-200"
        style={{
          backgroundColor: "rgba(11, 19, 32, 0.94)",
          borderColor: brand.border,
          boxShadow: "0 14px 40px rgba(2, 9, 18, 0.5)",
        }}
      >
        <div className="p-8">
          <div className="mb-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full border mb-4" style={{ borderColor: `${brand.primaryColor}55`, color: brand.primaryColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}>
              SECURE LOGIN
            </div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: brand.textPrimary }}>
              {brand.name}
            </div>
            <div className="mt-2 text-sm" style={{ color: brand.textMuted }}>
              One account entry point. Access level is detected after login.
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: brand.textMuted }}>
                Email or Admin Username
              </label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="you@example.com or admin"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: brand.textMuted }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <div
                className="rounded-2xl border p-3 text-sm"
                style={{
                  borderColor: `${brand.dangerColor}55`,
                  color: brand.textPrimary,
                  backgroundColor: `${brand.dangerColor}12`,
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 font-semibold transition-all duration-200"
              style={{
                background: brand.primaryColor,
                color: "#f8fbff",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 10px 22px rgba(59, 130, 246, 0.32)",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-5 text-xs" style={{ color: brand.textMuted }}>
            New here?{" "}
            <Link to="/user/register" style={{ color: brand.textPrimary }}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

