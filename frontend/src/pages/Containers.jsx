import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Play,
  Square,
  RotateCcw,
  ScrollText,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "../api.js";
import { brand } from "../config/brand.js";

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
    tone === "success" ? brand.onlineColor : tone === "warning" ? brand.warningColor : brand.offlineColor;
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

function ActionIconButton({ title, disabled, onClick, Icon }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
      style={{
        width: 34,
        height: 34,
        backgroundColor: hovered ? brand.border : "transparent",
        border: `1px solid ${brand.border}`,
        color: brand.textPrimary,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Icon size={16} />
    </button>
  );
}

export default function Containers() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await api.getJson("/api/containers");
    setContainers(res || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.message || "Failed to load containers"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doAction(id, action) {
    setLoadingId(id);
    setError("");
    try {
      await api.request(`/api/containers/${id}/${action}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e?.message || `Failed to ${action}`);
    } finally {
      setLoadingId(null);
    }
  }

  const showEmpty = containers.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="inline-flex items-center px-3 py-1 rounded-full border mb-2" style={{ borderColor: `${brand.primaryColor}55`, color: brand.primaryColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
          SERVICE MATRIX
        </div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Servers
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Manage your deployed servers.
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl border px-4 py-3"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        >
          <span style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>
            {error}
          </span>
        </div>
      ) : null}

      {showEmpty ? (
        <div
          className="rounded-[22px] border flex flex-col items-center justify-center text-center px-6 py-12 gap-3"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border, boxShadow: "0 16px 34px rgba(2, 9, 19, 0.36)" }}
        >
          <Box size={22} style={{ color: brand.primaryColor }} />
          <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
            No servers running
          </div>
          <div className="text-sm" style={{ color: brand.textMuted, maxWidth: 360 }}>
            Deploy your first project to get started.
          </div>
          <button
            type="button"
            className="mt-2 rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer"
            style={{
              backgroundImage: brand.accentGradient,
              color: "#061220",
              border: `1px solid rgba(255,157,46,0.5)`,
            }}
            onClick={() => navigate("/deploy")}
          >
            Deploy your first project
          </button>
        </div>
      ) : (
        <div
          className="rounded-[22px] border overflow-hidden"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border, boxShadow: "0 16px 34px rgba(2, 9, 19, 0.36)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: brand.textMuted }}>
                  {["Name", "Status", "Image", "Uptime", "RAM", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3 font-semibold"
                      style={{ borderBottom: `1px solid ${brand.border}` }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${brand.border}` }}>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <div style={{ color: brand.textPrimary, fontWeight: 700 }}>
                          {c.name}
                        </div>
                        <div>
                          {c.url ? (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="cursor-pointer inline-flex items-center gap-2"
                              style={{ color: brand.primaryColor, fontSize: 12 }}
                              title={c.url}
                            >
                              {c.url}
                            </a>
                          ) : (
                            <span style={{ color: brand.textMuted, fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>
                      {c.image || "—"}
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>
                      {formatUptime(c.uptimeSeconds)}
                    </td>
                    <td className="px-5 py-4" style={{ color: brand.textMuted }}>
                      {c.ramUsageBytes != null ? formatBytes(c.ramUsageBytes) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <ActionIconButton
                          title="Start"
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "start")}
                          Icon={Play}
                        />
                        <ActionIconButton
                          title="Stop"
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "stop")}
                          Icon={Square}
                        />
                        <ActionIconButton
                          title="Restart"
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "restart")}
                          Icon={RotateCcw}
                        />
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
                          onClick={() => navigate("/logs", { state: { containerId: c.id } })}
                        >
                          <ScrollText size={16} />
                        </button>

                        <button
                          type="button"
                          title="Manage"
                          aria-label="Manage"
                          className="inline-flex items-center gap-2 rounded-xl transition-all duration-200 cursor-pointer px-3 py-2"
                          style={{
                            border: `1px solid ${brand.primaryColor}66`,
                            backgroundColor: "transparent",
                            color: brand.primaryColor,
                            opacity: loadingId === c.id ? 0.6 : 1,
                          }}
                          disabled={loadingId === c.id}
                          onClick={() => navigate(`/containers/${c.id}`)}
                        >
                          <SlidersHorizontal size={16} />
                          <span style={{ fontSize: 12, fontWeight: 700 }}>Manage</span>
                        </button>

                        <ActionIconButton
                          title="Delete"
                          disabled={loadingId === c.id}
                          onClick={() => doAction(c.id, "delete")}
                          Icon={Trash2}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

