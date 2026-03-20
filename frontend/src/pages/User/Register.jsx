import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api.js";
import { brand } from "../../config/brand.js";

export default function UserRegister() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const glow = `${brand.accentColor}1a`;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${api.API_BASE_URL}/api/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let msg = text || `Registration failed (${res.status})`;
        try {
          const parsed = JSON.parse(text);
          msg = parsed?.message || parsed?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      await res.json();
      navigate("/user/login");
    } catch (err) {
      setError(err?.message || "Registration failed");
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
        style={{ backgroundColor: brand.glassCardBg, borderColor: brand.border }}
      >
        <div className="p-7">
          <div className="mb-6">
            <div className="text-xl font-semibold tracking-wide" style={{ color: brand.textPrimary }}>
              {brand.name}
            </div>
            <div className="mt-1 text-sm" style={{ color: brand.textMuted }}>
              Create your account to deploy.
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: brand.textMuted }}>
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: brand.textMuted }}>
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="you@example.com"
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
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium" style={{ color: brand.textMuted }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-2xl outline-none transition-all duration-200"
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
              className="w-full rounded-2xl py-3 font-semibold transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: brand.primaryColor,
                color: brand.darkBg,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creating..." : "Register"}
            </button>
          </form>

          <div className="mt-5 text-xs" style={{ color: brand.textMuted }}>
            Already have an account?{" "}
            <Link to="/user/login" style={{ color: brand.textPrimary }}>
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

