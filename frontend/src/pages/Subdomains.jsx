import React, { useEffect, useState } from "react";
import { Globe, Plus, Trash2, Copy, CheckCheck, Link2, Unlink } from "lucide-react";
import { api } from "../api.js";
import { brand } from "../config/brand.js";

export default function Subdomains() {
  const [subdomains, setSubdomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSub, setNewSub] = useState("");
  const [createError, setCreateError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.adminGetSubdomains();
      setSubdomains(res?.subdomains || []);
    } catch (e) {
      setError(e?.message || "Failed to load subdomains");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newSub.trim()) return;
    setCreateError("");
    setCreating(true);
    try {
      await api.adminCreateSubdomain(newSub.trim());
      setNewSub("");
      await load();
    } catch (e) {
      setCreateError(e?.message || "Failed to create subdomain");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await api.adminDeleteSubdomain(id);
      setSubdomains((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e?.message || "Failed to delete subdomain");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(sub) {
    try {
      await api.adminUpdateSubdomain(sub.id, { isActive: !sub.isActive });
      setSubdomains((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, isActive: !sub.isActive } : s))
      );
    } catch (e) {
      setError(e?.message || "Failed to update subdomain");
    }
  }

  function handleCopy(domain, id) {
    navigator.clipboard.writeText(`https://${domain}`).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <div
          className="inline-flex items-center px-3 py-1 rounded-full border mb-2"
          style={{
            borderColor: `${brand.primaryColor}55`,
            color: brand.primaryColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
          }}
        >
          ADMIN PANEL
        </div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Subdomain Manager
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Manage all subdomains under{" "}
          <span style={{ color: brand.primaryColor }}>hyzen.pro</span>. Subdomains are
          auto-assigned when users deploy a server.
        </div>
      </div>

      {/* Create subdomain */}
      <div
        className="border p-5"
        style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
      >
        <div className="text-sm font-semibold mb-3" style={{ color: brand.textPrimary }}>
          Reserve a Subdomain
        </div>
        <form onSubmit={handleCreate} className="flex gap-3 items-start flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <div
              className="flex items-center border overflow-hidden"
              style={{ backgroundColor: brand.inputBg, borderColor: brand.inputBorder }}
            >
              <input
                type="text"
                placeholder="subdomain"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="flex-1 bg-transparent outline-none px-3 py-2 text-sm"
                style={{ color: brand.textPrimary }}
              />
              <span
                className="px-3 py-2 text-sm select-none"
                style={{
                  color: brand.textMuted,
                  borderLeft: `1px solid ${brand.inputBorder}`,
                  backgroundColor: `${brand.border}44`,
                }}
              >
                .hyzen.pro
              </span>
            </div>
            {createError && (
              <div className="text-xs mt-1" style={{ color: brand.warningColor }}>
                {createError}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={creating || !newSub.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
            style={{
              backgroundColor: brand.primaryColor,
              color: "#fff",
              opacity: creating || !newSub.trim() ? 0.5 : 1,
              cursor: creating || !newSub.trim() ? "not-allowed" : "pointer",
            }}
          >
            <Plus size={15} />
            {creating ? "Reserving…" : "Reserve"}
          </button>
        </form>
      </div>

      {error && (
        <div
          className="border px-4 py-3 text-sm"
          style={{
            backgroundColor: `${brand.warningColor}12`,
            borderColor: `${brand.warningColor}55`,
            color: brand.textPrimary,
          }}
        >
          {error}
        </div>
      )}

      {/* Subdomains table */}
      <div
        className="border overflow-hidden"
        style={{
          backgroundColor: brand.cardBg,
          borderColor: brand.border,
          boxShadow: "0 16px 34px rgba(2, 9, 19, 0.36)",
        }}
      >
        {loading ? (
          <div className="px-5 py-6 text-sm" style={{ color: brand.textMuted }}>
            Loading…
          </div>
        ) : subdomains.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Globe size={36} style={{ color: brand.textMuted, margin: "0 auto 12px" }} />
            <div className="text-sm font-semibold mb-1" style={{ color: brand.textPrimary }}>
              No subdomains yet
            </div>
            <div className="text-xs" style={{ color: brand.textMuted }}>
              Subdomains are auto-assigned when users deploy servers.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: brand.textMuted }}>
                  {["Subdomain", "Assigned To", "User", "Status", "Created", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 font-semibold"
                        style={{ borderBottom: `1px solid ${brand.border}` }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {subdomains.map((s) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${brand.border}` }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Globe size={14} style={{ color: brand.primaryColor, flexShrink: 0 }} />
                        <div>
                          <div
                            className="font-medium text-[13px]"
                            style={{ color: brand.textPrimary }}
                          >
                            {s.subdomain}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: brand.textMuted }}>
                            {s.domain}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>
                      {s.containerName ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: `${brand.primaryColor}1a`,
                            border: `1px solid ${brand.primaryColor}44`,
                            color: brand.primaryColor,
                          }}
                        >
                          <Link2 size={10} />
                          {s.containerName}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
                          style={{
                            backgroundColor: `${brand.border}66`,
                            border: `1px solid ${brand.border}`,
                            color: brand.textMuted,
                          }}
                        >
                          <Unlink size={10} />
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>
                      {s.userEmail ? (
                        <div className="text-[12px]">
                          <div style={{ color: brand.textPrimary }}>{s.userName}</div>
                          <div style={{ color: brand.textMuted }}>{s.userEmail}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor: s.isActive
                            ? `${brand.onlineColor}1a`
                            : `${brand.border}66`,
                          border: `1px solid ${s.isActive ? brand.onlineColor : brand.border}`,
                          color: s.isActive ? brand.onlineColor : brand.textMuted,
                        }}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[12px]" style={{ color: brand.textMuted }}>
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(s.domain, s.id)}
                          title="Copy URL"
                          className="p-1.5 transition-all"
                          style={{
                            color: copiedId === s.id ? brand.onlineColor : brand.textMuted,
                          }}
                        >
                          {copiedId === s.id ? <CheckCheck size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => handleToggleActive(s)}
                          title={s.isActive ? "Deactivate" : "Activate"}
                          className="p-1.5 text-[11px] font-semibold transition-all"
                          style={{
                            color: s.isActive ? brand.warningColor : brand.onlineColor,
                          }}
                        >
                          {s.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          title="Delete"
                          className="p-1.5 transition-all"
                          style={{
                            color: brand.offlineColor,
                            opacity: deletingId === s.id ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nginx setup info box */}
      <div
        className="border p-5"
        style={{ backgroundColor: brand.cardBg, borderColor: `${brand.primaryColor}44` }}
      >
        <div className="text-sm font-semibold mb-2" style={{ color: brand.primaryColor }}>
          VPS Setup Required
        </div>
        <div className="text-xs space-y-1" style={{ color: brand.textMuted }}>
          <div>
            To route subdomains to your servers, add these nginx server blocks on your VPS:
          </div>
          <pre
            className="mt-2 p-3 text-[11px] overflow-x-auto"
            style={{
              backgroundColor: `${brand.darkBg}aa`,
              border: `1px solid ${brand.border}`,
              color: brand.textPrimary,
            }}
          >
{`# Dashboard  →  port 3001 (frontend) + 4000 (API)
server {
  listen 80;
  server_name dash.hyzen.pro;
  location /api/ { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host; }
  location /service/ { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host; }
  location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }
}

# Wildcard subdomains → backend (handles routing via DB lookup)
server {
  listen 80;
  server_name *.hyzen.pro;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`}
          </pre>
          <div className="mt-2">
            Also add a DNS A record: <strong style={{ color: brand.textPrimary }}>*.hyzen.pro → YOUR_VPS_IP</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
