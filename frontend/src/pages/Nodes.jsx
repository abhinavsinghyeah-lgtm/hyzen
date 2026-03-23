import React, { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw, Server, Shield, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { brand } from "../config/brand.js";

function timeAgo(iso) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TokenBox({ token }) {
  if (!token) return null;
  return (
    <div
      className="rounded-2xl border p-3 space-y-2"
      style={{
        backgroundColor: "rgba(255,157,46,0.08)",
        borderColor: "rgba(255,157,46,0.32)",
      }}
    >
      <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 700 }}>
        Node token (save now, shown once)
      </div>
      <div
        className="rounded-xl border p-2 text-xs break-all"
        style={{ backgroundColor: brand.inputBg, borderColor: brand.inputBorder, color: brand.textPrimary }}
      >
        {token}
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs cursor-pointer"
        style={{ border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary, backgroundColor: "transparent" }}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(token);
          } catch {}
        }}
      >
        <Copy size={14} /> Copy token
      </button>
    </div>
  );
}

export default function Nodes() {
  const [nodes, setNodes] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, online: 0, offline: 0 });
  const [heartbeatTimeout, setHeartbeatTimeout] = useState(45);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const res = await api.getNodes();
    setNodes(res?.nodes || []);
    setSummary(res?.summary || { total: 0, active: 0, online: 0, offline: 0 });
    setHeartbeatTimeout(Number(res?.heartbeatTimeoutSeconds || 45));
  }

  useEffect(() => {
    load().catch((e) => setError(e?.message || "Failed to load nodes"));
    const id = setInterval(() => {
      load().catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const activeCount = useMemo(() => nodes.filter((n) => n.isActive).length, [nodes]);

  async function createNode(e) {
    e.preventDefault();
    setError("");
    setToken("");
    setCreating(true);
    try {
      const res = await api.createNode({ name, host });
      setToken(res?.token || "");
      setName("");
      setHost("");
      await load();
    } catch (err) {
      setError(err?.message || "Failed to create node");
    } finally {
      setCreating(false);
    }
  }

  async function updateNode(id, payload) {
    setError("");
    setBusyId(id);
    setToken("");
    try {
      const res = await api.updateNode(id, payload);
      if (res?.token) setToken(res.token);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to update node");
    } finally {
      setBusyId(null);
    }
  }

  async function removeNode(id) {
    if (!window.confirm("Delete this node?")) return;
    setError("");
    setBusyId(id);
    try {
      await api.deleteNode(id);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to delete node");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="inline-flex items-center px-3 py-1 rounded-full border mb-2" style={{ borderColor: `${brand.primaryColor}55`, color: brand.primaryColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
          NODE CONTROL
        </div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Nodes
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Manage server VPS nodes separately from the panel instance.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.dangerColor}12`, borderColor: `${brand.dangerColor}55` }}>
          <span style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Total", summary.total],
          ["Active", activeCount],
          ["Online", summary.online],
          ["Offline", summary.offline],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
            <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 600 }}>{label}</div>
            <div className="text-2xl font-black mt-1" style={{ color: brand.textPrimary }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
        <div className="rounded-[22px] border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div className="text-sm font-semibold mb-3" style={{ color: brand.textPrimary }}>Registered Nodes</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr style={{ color: brand.textMuted }}>
                  {[
                    "Name",
                    "Host",
                    "Status",
                    "Last Seen",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ borderBottom: `1px solid ${brand.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => {
                  const statusColor = n.isOnline ? brand.onlineColor : n.isActive ? brand.warningColor : brand.offlineColor;
                  const statusText = n.isOnline ? "Online" : n.isActive ? "Offline" : "Disabled";
                  return (
                    <tr key={n.id} style={{ borderTop: `1px solid ${brand.border}` }}>
                      <td className="px-3 py-3" style={{ color: brand.textPrimary, fontWeight: 700 }}>{n.name}</td>
                      <td className="px-3 py-3" style={{ color: brand.textMuted }}>{n.host || "-"}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${statusColor}1a`, color: statusColor, border: `1px solid ${statusColor}` }}>
                          <span style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: statusColor, display: "inline-block" }} />
                          {statusText}
                        </span>
                      </td>
                      <td className="px-3 py-3" style={{ color: brand.textMuted }}>{timeAgo(n.lastSeenAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Toggle active"
                            className="inline-flex items-center justify-center rounded-xl"
                            style={{ width: 32, height: 32, border: `1px solid ${brand.border}`, color: brand.textPrimary, opacity: busyId === n.id ? 0.6 : 1 }}
                            disabled={busyId === n.id}
                            onClick={() => updateNode(n.id, { isActive: !n.isActive })}
                          >
                            <Shield size={15} />
                          </button>
                          <button
                            type="button"
                            title="Rotate token"
                            className="inline-flex items-center justify-center rounded-xl"
                            style={{ width: 32, height: 32, border: `1px solid ${brand.border}`, color: brand.primaryColor, opacity: busyId === n.id ? 0.6 : 1 }}
                            disabled={busyId === n.id}
                            onClick={() => updateNode(n.id, { rotateToken: true })}
                          >
                            <RefreshCcw size={15} />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            className="inline-flex items-center justify-center rounded-xl"
                            style={{ width: 32, height: 32, border: `1px solid ${brand.border}`, color: brand.offlineColor, opacity: busyId === n.id ? 0.6 : 1 }}
                            disabled={busyId === n.id}
                            onClick={() => removeNode(n.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!nodes.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center" style={{ color: brand.textMuted }}>
                      No nodes registered yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <form className="rounded-[22px] border p-4 space-y-3" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }} onSubmit={createNode}>
            <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Register Node</div>
            <div>
              <div style={{ color: brand.textMuted, fontSize: 12, marginBottom: 6 }}>Node name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl px-3 py-2 outline-none"
                style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }}
                placeholder="Mumbai-1"
              />
            </div>
            <div>
              <div style={{ color: brand.textMuted, fontSize: 12, marginBottom: 6 }}>Public or internal host/IP</div>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full rounded-xl px-3 py-2 outline-none"
                style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }}
                placeholder="10.0.0.21"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundImage: brand.accentGradient, color: "#061220", opacity: creating ? 0.7 : 1, border: `1px solid rgba(255,157,46,0.55)` }}
            >
              {creating ? "Creating..." : "Create Node"}
            </button>
          </form>

          <TokenBox token={token} />

          <div className="rounded-[22px] border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
            <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Node heartbeat contract</div>
            <div className="text-xs mt-2" style={{ color: brand.textMuted, lineHeight: 1.6 }}>
              POST /api/nodes/heartbeat every 10-15s with header x-node-token and payload stats.
              Node is considered offline if no heartbeat is received for {heartbeatTimeout}s.
            </div>
            <div className="mt-3 rounded-xl border p-3 text-[11px] break-all" style={{ borderColor: brand.inputBorder, color: brand.textMuted, backgroundColor: brand.inputBg }}>
              {`curl -X POST https://dash.hyzen.pro/api/nodes/heartbeat -H "x-node-token: <TOKEN>" -H "content-type: application/json" -d '{"name":"node-1","host":"10.0.0.21","stats":{"cpuPercent":12.5,"ram":{"usedBytes":1230000000,"totalBytes":2147483648},"disk":{"usedBytes":12900000000,"totalBytes":34359738368},"system":{"uptimeSeconds":70211}}}'`}
            </div>
          </div>

          <div className="rounded-[22px] border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
            <div className="inline-flex items-center gap-2" style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 700 }}>
              <Server size={15} />
              Architecture note
            </div>
            <div className="text-xs mt-2" style={{ color: brand.textMuted, lineHeight: 1.6 }}>
              The panel runs independently on its own instance. Nodes can go offline and the panel still stays usable.
              This keeps panel resource usage low and avoids coupling control-plane with app workloads.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
