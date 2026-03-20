import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Play,
  Square,
  RotateCcw,
  ScrollText,
  Trash2,
  Settings as SettingsIcon,
} from "lucide-react";
import { api } from "../../api.js";
import { brand } from "../../config/brand.js";
import Modal from "../../components/Modal.jsx";

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  const gb = n / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = n / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

function formatUptime(seconds) {
  const s = Number(seconds || 0);
  if (!s) return "—";
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function StatusBadge({ status }) {
  const tone =
    status === "running" ? "success" : status === "paused" ? "warning" : "danger";
  const color =
    tone === "success"
      ? brand.onlineColor
      : tone === "warning"
        ? brand.warningColor
        : brand.offlineColor;
  const bg = `${color}1a`;
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
      style={{ backgroundColor: bg, border: `1px solid ${color}`, color }}
    >
      {tone === "success" ? "Running" : tone === "warning" ? "Paused" : "Stopped"}
    </span>
  );
}

function envPairsFromJson(envVars) {
  if (!envVars) return [];
  if (Array.isArray(envVars)) return envVars;
  if (typeof envVars === "object") {
    return Object.entries(envVars).map(([key, value]) => ({ key, value }));
  }
  return [];
}

export default function UserContainers() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [envTarget, setEnvTarget] = useState(null);
  const [envPairs, setEnvPairs] = useState([]);

  const token = api.getUserToken();

  async function load() {
    setError("");
    try {
      const res = await api.getJson("/api/user/containers", { token });
      setContainers(res?.containers || []);
    } catch (e) {
      setError(e?.message || "Failed to load containers");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doAction(id, action) {
    setLoadingId(id);
    setError("");
    try {
      await api.request(`/api/user/containers/${id}/${action}`, {
        method: "POST",
        token,
      });
      await load();
    } catch (e) {
      setError(e?.message || `Failed to ${action}`);
    } finally {
      setLoadingId(null);
    }
  }

  const empty = containers.length === 0;

  function openEnvModal(containerRow) {
    setEnvTarget(containerRow);
    setEnvPairs(envPairsFromJson(containerRow.envVars));
    setEnvModalOpen(true);
  }

  async function saveEnv() {
    if (!envTarget) return;
    setLoadingId(envTarget.id);
    setError("");
    try {
      await api.request(`/api/user/containers/${envTarget.id}/env`, {
        method: "PUT",
        token,
        body: JSON.stringify({ env: envPairs }),
      });
      setEnvModalOpen(false);
      setEnvTarget(null);
      await load();
    } catch (e) {
      setError(e?.message || "Failed to update environment variables");
    } finally {
      setLoadingId(null);
    }
  }

  const modalTitle = envTarget ? `Env Vars: ${envTarget.name}` : "Env Vars";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Containers
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Manage your deployments.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-2xl border flex flex-col items-center justify-center text-center px-6 py-12 gap-3" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <Box size={22} style={{ color: brand.primaryColor }} />
          <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
            No containers yet
          </div>
          <div className="text-sm" style={{ color: brand.textMuted, maxWidth: 360 }}>
            Deploy your first project to see it here.
          </div>
          <button
            type="button"
            className="mt-2 rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer font-semibold"
            style={{ backgroundColor: brand.primaryColor, color: brand.darkBg, border: `1px solid ${brand.primaryColor}` }}
            onClick={() => navigate("/user/deploy")}
          >
            Deploy
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: brand.textMuted }}>
                  {["Name", "Status", "URL", "RAM", "CPU", "Uptime", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 font-semibold" style={{ borderBottom: `1px solid ${brand.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${brand.border}` }}>
                    <td className="px-5 py-4" style={{ color: brand.textPrimary, fontWeight: 700 }}>{c.name}</td>
                    <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-4">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="cursor-pointer"
                          style={{ color: brand.primaryColor, fontSize: 12 }}
                          title={c.url}
                        >
                          {c.url}
                        </a>
                      ) : (
                        <span style={{ color: brand.textMuted, fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>{c.ram ? `${c.ram}MB` : "—"}</td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>{c.cpu ?? "—"}</td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>{formatUptime(c.uptimeSeconds)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Start"
                          aria-label="Start"
                          className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
                          style={{
                            width: 34,
                            height: 34,
                            border: `1px solid ${brand.border}`,
                            backgroundColor: loadingId === c.id ? brand.border : "transparent",
                            color: brand.textPrimary,
                            opacity: loadingId === c.id ? 0.6 : 1,
                          }}
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "start")}
                        >
                          <Play size={16} />
                        </button>
                        <button
                          type="button"
                          title="Stop"
                          aria-label="Stop"
                          className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
                          style={{
                            width: 34,
                            height: 34,
                            border: `1px solid ${brand.border}`,
                            backgroundColor: "transparent",
                            color: brand.textPrimary,
                            opacity: loadingId === c.id ? 0.6 : 1,
                          }}
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "stop")}
                        >
                          <Square size={16} />
                        </button>
                        <button
                          type="button"
                          title="Restart"
                          aria-label="Restart"
                          className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
                          style={{
                            width: 34,
                            height: 34,
                            border: `1px solid ${brand.border}`,
                            backgroundColor: "transparent",
                            color: brand.textPrimary,
                            opacity: loadingId === c.id ? 0.6 : 1,
                          }}
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "restart")}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          type="button"
                          title="Logs"
                          aria-label="Logs"
                          className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
                          style={{
                            width: 34,
                            height: 34,
                            border: `1px solid ${brand.border}`,
                            backgroundColor: "transparent",
                            color: brand.primaryColor,
                            opacity: loadingId === c.id ? 0.6 : 1,
                          }}
                          disabled={loadingId === c.id}
                          onClick={() => navigate("/user/logs", { state: { containerId: c.id } })}
                        >
                          <ScrollText size={16} />
                        </button>
                        <button
                          type="button"
                          title="Env Vars"
                          aria-label="Env Vars"
                          className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
                          style={{
                            width: 34,
                            height: 34,
                            border: `1px solid ${brand.border}`,
                            backgroundColor: "transparent",
                            color: brand.textMuted,
                            opacity: loadingId === c.id ? 0.6 : 1,
                          }}
                          disabled={loadingId === c.id}
                          onClick={() => openEnvModal(c)}
                        >
                          <SettingsIcon size={16} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete"
                          className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
                          style={{
                            width: 34,
                            height: 34,
                            border: `1px solid ${brand.offlineColor}55`,
                            backgroundColor: `${brand.offlineColor}12`,
                            color: brand.offlineColor,
                            opacity: loadingId === c.id ? 0.6 : 1,
                          }}
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "delete")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={envModalOpen} title={modalTitle} onClose={() => setEnvModalOpen(false)}>
        <div className="space-y-3">
          <div style={{ color: brand.textMuted, fontSize: 13, marginBottom: 2 }}>
            Add `KEY=VALUE` pairs for this container.
          </div>

          <div className="space-y-3">
            {envPairs.length ? (
              envPairs.map((p, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_44px] gap-3 items-center">
                  <input
                    value={p.key}
                    onChange={(e) => setEnvPairs((prev) => prev.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))}
                    className="w-full rounded-xl outline-none transition-all duration-200 cursor-pointer"
                    style={{
                      backgroundColor: brand.inputBg,
                      border: `1px solid ${brand.inputBorder}`,
                      color: brand.textPrimary,
                      padding: "12px 16px",
                    }}
                    placeholder="KEY"
                  />
                  <input
                    value={p.value}
                    onChange={(e) => setEnvPairs((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                    className="w-full rounded-xl outline-none transition-all duration-200 cursor-pointer"
                    style={{
                      backgroundColor: brand.inputBg,
                      border: `1px solid ${brand.inputBorder}`,
                      color: brand.textPrimary,
                      padding: "12px 16px",
                    }}
                    placeholder="VALUE"
                  />
                  <button
                    type="button"
                    className="rounded-xl transition-all duration-200 cursor-pointer inline-flex items-center justify-center"
                    style={{
                      width: 44,
                      height: 44,
                      backgroundColor: "transparent",
                      border: `1px solid ${brand.border}`,
                      color: brand.textMuted,
                    }}
                    onClick={() => setEnvPairs((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove env var"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div style={{ color: brand.textMuted, fontSize: 13 }}>
                No env vars yet.
              </div>
            )}
          </div>

          <button
            type="button"
            className="rounded-2xl px-4 py-2 transition-all duration-200 cursor-pointer font-semibold"
            style={{
              backgroundColor: `${brand.primaryColor}15`,
              border: `1px solid ${brand.primaryColor}55`,
              color: brand.primaryColor,
            }}
            onClick={() => setEnvPairs((prev) => [...prev, { key: "", value: "" }])}
          >
            Add
          </button>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer font-semibold"
              style={{
                backgroundColor: "transparent",
                border: `1px solid ${brand.border}`,
                color: brand.textMuted,
              }}
              onClick={() => setEnvModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer font-semibold"
              style={{
                backgroundColor: brand.primaryColor,
                border: `1px solid ${brand.primaryColor}`,
                color: brand.darkBg,
                opacity: loadingId === envTarget?.id ? 0.7 : 1,
              }}
              disabled={loadingId === envTarget?.id}
              onClick={saveEnv}
            >
              Save & Redeploy
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

