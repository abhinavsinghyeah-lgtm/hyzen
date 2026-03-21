import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { brand } from "../config/brand.js";

export default function AdminUserContainers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.getJson("/api/admin/containers");
      setRows(res?.containers || []);
    } catch (e) {
      setError(e?.message || "Failed to load user containers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function action(id, name) {
    setBusyId(id);
    setError("");
    try {
      await api.request(`/api/admin/containers/${id}/${name}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e?.message || `Failed to ${name}`);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div style={{ color: brand.textMuted }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>All User Servers</div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>Manage every user container from admin.</div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div style={{ color: brand.textPrimary, fontWeight: 600, fontSize: 13 }}>{error}</div>
        </div>
      ) : null}

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: brand.textMuted }}>
                {[
                  "Server",
                  "Owner",
                  "Status",
                  "URL",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-semibold" style={{ borderBottom: `1px solid ${brand.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${brand.border}` }}>
                  <td className="px-5 py-4" style={{ color: brand.textPrimary, fontWeight: 700 }}>{c.name}</td>
                  <td className="px-5 py-4" style={{ color: brand.textMuted }}>{c.userEmail}</td>
                  <td className="px-5 py-4" style={{ color: c.suspended ? brand.warningColor : c.status === "running" ? brand.onlineColor : brand.offlineColor }}>
                    {c.suspended ? "suspended" : c.status}
                  </td>
                  <td className="px-5 py-4">
                    {c.url ? <a href={c.url} target="_blank" rel="noreferrer" style={{ color: brand.primaryColor }}>{c.url}</a> : <span style={{ color: brand.textMuted }}>-</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busyId === c.id} className="rounded-xl px-3 py-1" style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary }} onClick={() => action(c.id, "start")}>Start</button>
                      <button type="button" disabled={busyId === c.id} className="rounded-xl px-3 py-1" style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary }} onClick={() => action(c.id, "stop")}>Stop</button>
                      <button type="button" disabled={busyId === c.id} className="rounded-xl px-3 py-1" style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary }} onClick={() => action(c.id, "restart")}>Restart</button>
                      <button type="button" disabled={busyId === c.id} className="rounded-xl px-3 py-1" style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary }} onClick={() => action(c.id, c.suspended ? "unsuspend" : "suspend")}>{c.suspended ? "Unsuspend" : "Suspend"}</button>
                      <button type="button" disabled={busyId === c.id} className="rounded-xl px-3 py-1" style={{ border: `1px solid ${brand.primaryColor}66`, color: brand.primaryColor }} onClick={() => navigate(`/admin/containers/${c.id}`)}>Control</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8" style={{ color: brand.textMuted, textAlign: "center" }}>No user containers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
