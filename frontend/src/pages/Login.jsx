import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiLogin } from "../api.js";
import { brand } from "../config/brand.js";

function accentWithOpacity(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const glow = accentWithOpacity(brand.accentColor, "1a");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await apiLogin({ username, password });
      localStorage.setItem("hyzen_jwt", token);
      navigate("/overview");
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundColor: brand.darkBg,
        backgroundImage: `radial-gradient(circle at top, ${glow} 0%, transparent 60%)`,
        transition: "all 200ms",
      }}
    >
      <div
        className="w-full max-w-[420px] backdrop-blur-xl rounded-2xl border transition-all duration-200"
        style={{
          backgroundColor: brand.glassCardBg,
          borderColor: brand.border,
        }}
      >
        <div className="p-7">
          <div className="mb-6">
            <div className="text-xl font-semibold tracking-wide" style={{ color: brand.textPrimary }}>
              {brand.name}
            </div>
            <div className="mt-1 text-sm" style={{ color: brand.textMuted }}>
              {brand.tagline}
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: brand.textMuted }}>
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-2xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
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
                className="w-full rounded-2xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
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
              className="w-full rounded-2xl py-3 font-semibold transition-all duration-200"
              style={{
                backgroundColor: brand.primaryColor,
                color: brand.darkBg,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-5 text-xs" style={{ color: brand.textMuted }}>
            Tip: update admin credentials in <span style={{ color: brand.textPrimary }}>Settings</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

