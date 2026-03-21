import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { brand } from "../config/brand.js";

const planOptions = ["free", "starter", "pro", "business"];

function planLabel(plan) {
  const p = planOptions.includes(plan) ? plan : "free";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export default function Users() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [savingId, setSavingId] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await api.getJson("/api/admin/users");
      setUsers(res?.users || []);
    } catch (e) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setPlan(userId, plan) {
    setSavingId(userId);
    setError("");
    try {
      await api.request(`/api/admin/users/${userId}/plan`, {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      await load();
    } catch (e) {
      setError(e?.message || "Failed to update plan");
    } finally {
      setSavingId(null);
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
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center px-3 py-1 rounded-full border mb-2" style={{ borderColor: `${brand.primaryColor}55`, color: brand.primaryColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
          ADMIN PANEL
        </div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Users
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Manage user plans and see usage.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      <div className="rounded-[22px] border overflow-hidden" style={{ backgroundColor: brand.cardBg, borderColor: brand.border, boxShadow: "0 16px 34px rgba(2, 9, 19, 0.36)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: brand.textMuted }}>
                {["Email", "Plan", "Containers", "Joined", "Change Plan"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 font-semibold" style={{ borderBottom: `1px solid ${brand.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((u) => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${brand.border}` }}>
                    <td className="px-5 py-4" style={{ color: brand.textPrimary }}>
                      {u.email}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${(brand.planColors?.[u.plan] || brand.planColors.free)}1a`,
                          border: `1px solid ${(brand.planColors?.[u.plan] || brand.planColors.free)}`,
                          color: brand.planColors?.[u.plan] || brand.planColors.free,
                        }}
                      >
                        {planLabel(u.plan)}
                      </span>
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>
                      {u.containers_used}
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>
                      {u.joined_at ? new Date(u.joined_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <select
                          value={u.plan}
                          onChange={(e) => setPlan(u.id, e.target.value)}
                          disabled={savingId === u.id}
                          className="rounded-xl outline-none transition-all duration-200 cursor-pointer px-3 py-2"
                          style={{
                            backgroundColor: brand.inputBg,
                            border: `1px solid ${brand.inputBorder}`,
                            color: brand.textPrimary,
                          }}
                        >
                          {planOptions.map((p) => (
                            <option key={p} value={p}>
                              {planLabel(p)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10" style={{ color: brand.textMuted, textAlign: "center" }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

