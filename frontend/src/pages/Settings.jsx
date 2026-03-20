import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { brand } from "../config/brand.js";

function FieldLabel({ children }) {
  return (
    <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
      {children}
    </div>
  );
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dockerSocketPath, setDockerSocketPath] = useState("");
  const [dockerHost, setDockerHost] = useState("");
  const [dockerPort, setDockerPort] = useState("");

  const [adminUser, setAdminUser] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      setSuccess("");
      try {
        const settings = await api.getJson("/api/auth/settings");
        if (cancelled) return;
        setDockerSocketPath(settings?.docker_socket_path || "");
        setDockerHost(settings?.docker_host || "");
        setDockerPort(
          settings?.docker_port != null ? String(settings?.docker_port) : ""
        );
        setAdminUser(settings?.admin_user || "");
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.request("/api/auth/settings", {
        method: "POST",
        body: JSON.stringify({
          docker_socket_path: dockerSocketPath || null,
          docker_host: dockerHost || null,
          docker_port: dockerPort ? Number(dockerPort) : null,
          admin_user: adminUser,
          admin_password: adminPassword,
        }),
      });
      setSuccess("Settings saved.");
      setAdminPassword("");
    } catch (e2) {
      setError(e2?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Settings
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Docker connection and admin credentials.
        </div>
      </div>

      {loading ? (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        >
          <div style={{ color: brand.textMuted }}>Loading...</div>
        </div>
      ) : (
        <form
          className="rounded-2xl border p-5 space-y-6"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
          onSubmit={onSave}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div style={{ color: brand.textPrimary, fontSize: 14, fontWeight: 700 }}>
                Docker connection
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${brand.border}` }} />

            <div className="space-y-5">
              <div>
                <FieldLabel>Unix socket path</FieldLabel>
                <input
                  value={dockerSocketPath}
                  onChange={(e) => setDockerSocketPath(e.target.value)}
                  className="w-full rounded-xl outline-none transition-all duration-200"
                  style={{
                    backgroundColor: brand.inputBg,
                    border: `1px solid ${brand.inputBorder}`,
                    color: brand.textPrimary,
                    padding: "12px 16px",
                  }}
                  placeholder="/var/run/docker.sock"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <FieldLabel>Remote TCP host</FieldLabel>
                  <input
                    value={dockerHost}
                    onChange={(e) => setDockerHost(e.target.value)}
                    className="w-full rounded-xl outline-none transition-all duration-200"
                    style={{
                      backgroundColor: brand.inputBg,
                      border: `1px solid ${brand.inputBorder}`,
                      color: brand.textPrimary,
                      padding: "12px 16px",
                    }}
                    placeholder="tcp.example.com"
                  />
                </div>
                <div>
                  <FieldLabel>Port</FieldLabel>
                  <input
                    value={dockerPort}
                    onChange={(e) => setDockerPort(e.target.value)}
                    className="w-full rounded-xl outline-none transition-all duration-200"
                    style={{
                      backgroundColor: brand.inputBg,
                      border: `1px solid ${brand.inputBorder}`,
                      color: brand.textPrimary,
                      padding: "12px 16px",
                    }}
                    placeholder="2375"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div style={{ color: brand.textPrimary, fontSize: 14, fontWeight: 700 }}>
              Admin credentials
            </div>
            <div style={{ borderTop: `1px solid ${brand.border}` }} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Admin username</FieldLabel>
                <input
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
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
                <FieldLabel>New password</FieldLabel>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
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
            </div>
          </div>

          {error ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                backgroundColor: `${brand.dangerColor}12`,
                borderColor: `${brand.dangerColor}55`,
              }}
            >
              <span style={{ color: brand.textPrimary, fontWeight: 600 }}>{error}</span>
            </div>
          ) : null}
          {success ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                backgroundColor: `${brand.successColor}12`,
                borderColor: `${brand.successColor}55`,
              }}
            >
              <span style={{ color: brand.textPrimary, fontWeight: 600 }}>{success}</span>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl px-6 py-3 font-semibold transition-all duration-200 cursor-pointer inline-flex items-center justify-center"
              style={{
                backgroundColor: brand.primaryColor,
                color: brand.darkBg,
                opacity: saving ? 0.7 : 1,
                border: `1px solid ${brand.primaryColor}`,
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

