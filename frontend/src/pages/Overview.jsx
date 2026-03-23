import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Box,
  Clock3,
  Cpu,
  Database,
  HardDrive,
  Network,
  Play,
  Server,
  Square,
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

function clampPercent(p) {
  const n = Number(p || 0);
  return Math.max(0, Math.min(100, n));
}

function formatDuration(seconds) {
  const s = Number(seconds || 0);
  if (!Number.isFinite(s) || s <= 0) return "--";
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function ProgressBar({ label, valueText, percent }) {
  const p = clampPercent(percent);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>
          {valueText}
        </div>
      </div>

      <div className="h-[8px] rounded-full overflow-hidden" style={{ backgroundColor: "rgba(26,42,61,0.7)" }}>
        <div
          className="h-full transition-all duration-200"
          style={{
            width: `${p}%`,
            backgroundImage: brand.accentGradient,
          }}
        />
      </div>
    </div>
  );
}

export default function Overview() {
  const [containers, setContainers] = useState([]);
  const [panelStats, setPanelStats] = useState(null);
  const [nodesSummary, setNodesSummary] = useState({ total: 0, active: 0, online: 0, offline: 0 });
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const total = containers.length;
    const running = containers.filter((c) => c.status === "running").length;
    const stopped = total - running;
    return { total, running, stopped };
  }, [containers]);

  async function fetchData() {
    setError("");
    const [cRes, pRes, nRes] = await Promise.allSettled([
      api.getJson("/api/containers"),
      api.getPanelStats(),
      api.getNodes(),
    ]);

    if (cRes.status === "fulfilled") setContainers(cRes.value || []);
    if (pRes.status === "fulfilled") setPanelStats(pRes.value);
    if (nRes.status === "fulfilled") setNodesSummary(nRes.value?.summary || { total: 0, active: 0, online: 0, offline: 0 });

    if (
      (cRes.status === "rejected" || pRes.status === "rejected") &&
      !panelStats
    ) {
      setError("Failed to load dashboard data.");
    }
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cpuPercent = Number(panelStats?.cpuPercent ?? 0);
  const cpuUsedCores = Number(panelStats?.cpu?.usedCores ?? 0);
  const cpuTotalCores = Number(panelStats?.cpu?.totalCores ?? 0);
  const cpuModel = String(panelStats?.cpu?.processor || "--");
  const ramUsedBytes = Number(panelStats?.ram?.usedBytes ?? 0);
  const ramTotalBytes = Number(panelStats?.ram?.totalBytes ?? 0);
  const ramFreeBytes = Number(panelStats?.ram?.freeBytes ?? 0);
  const diskUsedBytes = Number(panelStats?.disk?.usedBytes ?? 0);
  const diskTotalBytes = Number(panelStats?.disk?.totalBytes ?? 0);
  const diskFreeBytes = Number(panelStats?.disk?.freeBytes ?? 0);
  const uptime = formatDuration(panelStats?.system?.uptimeSeconds ?? 0);

  const ramPercent = ramTotalBytes > 0 ? (ramUsedBytes / ramTotalBytes) * 100 : 0;
  const diskPercent = diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes) * 100 : 0;

  const isPanelOnline = !!panelStats;

  const cards = [
    {
      key: "total",
      label: "Total Servers",
      value: counts.total,
      hint: "All deployments",
      Icon: Box,
      tone: brand.primaryColor,
    },
    {
      key: "running",
      label: "Running",
      value: counts.running,
      hint: "Currently online",
      Icon: Play,
      tone: brand.onlineColor,
    },
    {
      key: "stopped",
      label: "Stopped",
      value: counts.stopped,
      hint: "Currently offline",
      Icon: Square,
      tone: brand.offlineColor,
    },
    {
      key: "panel",
      label: "Panel Uptime",
      value: uptime,
      hint: "Control-plane uptime",
      Icon: Clock3,
      tone: brand.accentColor,
    },
    {
      key: "nodes",
      label: "Node Online",
      value: `${nodesSummary.online}/${nodesSummary.active || nodesSummary.total || 0}`,
      hint: "Active server nodes",
      Icon: Network,
      tone: nodesSummary.online > 0 ? brand.onlineColor : brand.warningColor,
    },
  ];

  return (
    <div className="space-y-6">
      <div
        className="rounded-[24px] border p-6 md:p-7"
        style={{
          backgroundImage:
            "radial-gradient(130% 160% at 0% 0%, rgba(255,157,46,0.16) 0%, rgba(255,157,46,0.04) 30%, rgba(4,10,18,0) 60%), radial-gradient(120% 160% at 100% 0%, rgba(47,128,255,0.16) 0%, rgba(47,128,255,0.03) 34%, rgba(4,10,18,0) 62%), linear-gradient(180deg, rgba(8,16,28,0.88), rgba(5,11,20,0.88))",
          borderColor: brand.border,
          boxShadow: "0 20px 46px rgba(3,10,20,0.46)",
        }}
      >
        <div className="inline-flex items-center px-3 py-1 rounded-full border mb-2" style={{ borderColor: `${brand.primaryColor}55`, color: brand.primaryColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
          DASHBOARD
        </div>
        <div className="text-3xl font-black" style={{ color: brand.textPrimary }}>
          Overview
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          {counts.running} running services across {counts.total} deployments.
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl border px-4 py-3"
          style={{
            backgroundColor: "rgba(255,110,110,0.08)",
            borderColor: "rgba(255,110,110,0.36)",
          }}
        >
          <span style={{ color: "#ffb3b3", fontSize: 13, fontWeight: 600 }}>
            {error}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((stat) => {
          return (
            <div
              key={stat.key}
              className="rounded-[22px] border transition-all duration-200"
              style={{
                backgroundColor: brand.cardBg,
                borderColor: brand.border,
                boxShadow: "0 14px 30px rgba(2,9,19,0.34)",
              }}
            >
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600 }}>
                    {stat.label}
                  </div>
                  <div className="mt-3 text-4xl font-black" style={{ color: brand.textPrimary }}>
                    {stat.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: brand.textMuted }}>
                    {stat.hint}
                  </div>
                </div>
                <stat.Icon size={18} style={{ color: stat.tone }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4">
        <div
          className="rounded-[22px] border p-5 space-y-5"
          style={{
            backgroundColor: brand.cardBg,
            borderColor: brand.border,
            boxShadow: "0 16px 34px rgba(2, 9, 19, 0.36)",
          }}
        >
          <div className="flex items-center justify-between">
            <div style={{ color: brand.textPrimary, fontSize: 14, fontWeight: 800 }}>Infrastructure Health</div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: isPanelOnline ? `${brand.onlineColor}1a` : `${brand.offlineColor}1a`, color: isPanelOnline ? brand.onlineColor : brand.offlineColor, border: `1px solid ${isPanelOnline ? brand.onlineColor : brand.offlineColor}` }}>
              <Activity size={13} />
              {isPanelOnline ? "Panel Live" : "Panel Offline"}
            </span>
          </div>
          <ProgressBar
            label="CPU"
            valueText={panelStats ? `${cpuPercent.toFixed(1)}% (${cpuUsedCores.toFixed(2)} / ${cpuTotalCores || 0} cores)` : "--"}
            percent={cpuPercent}
          />
          <ProgressBar
            label="RAM"
            valueText={panelStats ? `${formatBytes(ramUsedBytes)} / ${formatBytes(ramTotalBytes)}` : "--"}
            percent={ramPercent}
          />
          <ProgressBar
            label="Storage"
            valueText={panelStats ? `${formatBytes(diskUsedBytes)} / ${formatBytes(diskTotalBytes)}` : "--"}
            percent={diskPercent}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {[
              { label: "Processor", value: cpuModel, Icon: Cpu },
              { label: "Uptime", value: uptime, Icon: Clock3 },
              {
                label: "RAM Free",
                value: panelStats ? formatBytes(ramFreeBytes) : "--",
                Icon: Server,
              },
              {
                label: "Storage Free",
                value: panelStats ? formatBytes(diskFreeBytes) : "--",
                Icon: HardDrive,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border p-3" style={{ borderColor: brand.border, backgroundColor: "rgba(7,14,24,0.7)" }}>
                <div className="flex items-center gap-2" style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>
                  <item.Icon size={14} />
                  {item.label}
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: brand.textPrimary }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-[22px] border p-5"
            style={{
              backgroundColor: brand.cardBg,
              borderColor: brand.border,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
                  Active Plan
                </div>
                <div className="text-sm" style={{ color: brand.textMuted }}>
                  Hyzen Pro
                </div>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${brand.onlineColor}1a`, color: brand.onlineColor, border: `1px solid ${brand.onlineColor}` }}>
                Active
              </span>
            </div>
          </div>

          <div
            className="rounded-[22px] border p-5"
            style={{
              backgroundColor: brand.cardBg,
              borderColor: brand.border,
            }}
          >
            <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
              Help & Docs
            </div>
            <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
              Documentation and quick references.
            </div>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 transition-all duration-200 cursor-pointer"
              style={{
                backgroundImage: brand.sidebarActiveBg,
                border: `1px solid ${brand.inputBorder}`,
                color: brand.textPrimary,
              }}
              onClick={() => window.open("#", "_blank")}
            >
              <BookOpen size={16} />
              Docs
            </button>
          </div>

          <div
            className="rounded-[22px] border p-5"
            style={{
              backgroundColor: brand.cardBg,
              borderColor: brand.border,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
                  Panel Status
                </div>
                <div className="text-sm" style={{ color: brand.textMuted }}>
                  {isPanelOnline ? "Online" : "Offline"}
                </div>
              </div>
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
                style={{
                  backgroundColor: `${isPanelOnline ? brand.onlineColor : brand.offlineColor}1a`,
                  border: `1px solid ${isPanelOnline ? brand.onlineColor : brand.offlineColor}`,
                  color: isPanelOnline ? brand.onlineColor : brand.offlineColor,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 9999,
                    backgroundColor: isPanelOnline ? brand.onlineColor : brand.offlineColor,
                    display: "inline-block",
                  }}
                />
                {isPanelOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          <div
            className="rounded-[22px] border p-5"
            style={{
              backgroundColor: brand.cardBg,
              borderColor: brand.border,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
                  Node Status
                </div>
                <div className="text-sm" style={{ color: brand.textMuted }}>
                  {nodesSummary.online} online, {nodesSummary.offline} offline
                </div>
              </div>
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${nodesSummary.online > 0 ? brand.onlineColor : brand.warningColor}1a`,
                  border: `1px solid ${nodesSummary.online > 0 ? brand.onlineColor : brand.warningColor}`,
                  color: nodesSummary.online > 0 ? brand.onlineColor : brand.warningColor,
                }}
              >
                <Network size={13} /> {nodesSummary.online}/{nodesSummary.active || nodesSummary.total || 0}
              </span>
            </div>
          </div>

          <div className="rounded-[22px] border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
            <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Service Matrix</div>
            <div className="mt-3 space-y-2 text-sm" style={{ color: brand.textMuted }}>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><Cpu size={14} /> CPU Cores</span>
                <strong style={{ color: brand.textPrimary }}>{cpuUsedCores.toFixed(2)} / {cpuTotalCores || 0}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><Database size={14} /> RAM</span>
                <strong style={{ color: brand.textPrimary }}>{panelStats ? `${formatBytes(ramUsedBytes)} / ${formatBytes(ramTotalBytes)}` : "--"}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><HardDrive size={14} /> Storage</span>
                <strong style={{ color: brand.textPrimary }}>{panelStats ? `${formatBytes(diskUsedBytes)} / ${formatBytes(diskTotalBytes)}` : "--"}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><Server size={14} /> Processor</span>
                <strong style={{ color: brand.textPrimary, textAlign: "right" }}>{cpuModel}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

