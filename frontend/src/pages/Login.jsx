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

  const glowBlue = accentWithOpacity(brand.accentColor, "2b");
  const glowOrange = accentWithOpacity(brand.primaryColor, "30");

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
        backgroundImage: `radial-gradient(circle at 20% 15%, ${glowOrange} 0%, transparent 50%), radial-gradient(circle at 86% 10%, ${glowBlue} 0%, transparent 52%)`,
        transition: "all 200ms",
      }}
    >
      <div
        className="w-full max-w-[440px] backdrop-blur-xl rounded-[28px] border transition-all duration-200"
        style={{
          backgroundColor: brand.glassCardBg,
          borderColor: brand.border,
          boxShadow: "0 26px 54px rgba(2, 9, 18, 0.56)",
        }}
      >
        <div className="p-8">
          <div className="mb-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full border mb-4" style={{ borderColor: `${brand.primaryColor}55`, color: brand.primaryColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
              DASHBOARD ACCESS
            </div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: brand.textPrimary }}>
              {brand.name}
            </div>
            <div className="mt-2 text-sm" style={{ color: brand.textMuted }}>
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
                className="w-full rounded-xl outline-none transition-all duration-200"
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
                className="w-full rounded-xl outline-none transition-all duration-200"
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
              className="w-full rounded-xl py-3 font-semibold transition-all duration-200"
              style={{
                backgroundImage: brand.accentGradient,
                color: "#061220",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 14px 30px rgba(255, 130, 42, 0.24)",
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

