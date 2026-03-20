import React, { useEffect, useState } from "react";
import { api } from "../../api.js";
import { brand } from "../../config/brand.js";

function FieldLabel({ children }) {
  return (
    <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
      {children}
    </div>
  );
}

export default function UserSettings() {
  const token = api.getUserToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.getJson("/api/user/me", { token });
      setName(res?.profile?.name || "");
      setEmail(res?.profile?.email || "");
    } catch (e) {
      setError(e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.request("/api/user/settings", {
        method: "PUT",
        token,
        body: JSON.stringify({
          name,
          email,
          password: password || undefined,
        }),
      });
      setSuccess("Settings saved.");
      setPassword("");
    } catch (e2) {
      setError(e2?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>Settings</div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>Update your profile.</div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.dangerColor}12`, borderColor: `${brand.dangerColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.onlineColor}12`, borderColor: `${brand.onlineColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{success}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div style={{ color: brand.textMuted }}>Loading...</div>
        </div>
      ) : (
        <form
          className="rounded-2xl border p-5 space-y-6"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
          onSubmit={onSave}
        >
          <div className="space-y-4">
            <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Profile</div>
            <div style={{ borderTop: `1px solid ${brand.border}` }} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Name</FieldLabel>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl outline-none transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary, padding: "12px 16px" }}
                />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl outline-none transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary, padding: "12px 16px" }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Password</div>
            <div style={{ borderTop: `1px solid ${brand.border}` }} />
            <div>
              <FieldLabel>New password</FieldLabel>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl outline-none transition-all duration-200 cursor-pointer"
                style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary, padding: "12px 16px" }}
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl px-6 py-3 font-semibold transition-all duration-200 cursor-pointer inline-flex items-center justify-center"
              style={{
                backgroundColor: brand.primaryColor,
                border: `1px solid ${brand.primaryColor}`,
                color: brand.darkBg,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

