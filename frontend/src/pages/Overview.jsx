import React, { useEffect, useMemo, useState } from "react";
import { Box, Play, Square, Database, BookOpen } from "lucide-react";
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

      <div
        className="h-[6px] rounded-full overflow-hidden"
        style={{ backgroundColor: brand.border, border: `1px solid ${brand.border}` }}
      >
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

function StatusBadge({ tone, children }) {
  const bg =
    tone === "success"
      ? `${brand.onlineColor}1a`
      : tone === "warning"
        ? `${brand.warningColor}1a`
        : `${brand.offlineColor}1a`;
  const border =
    tone === "success"
      ? brand.onlineColor
      : tone === "warning"
        ? brand.warningColor
        : brand.offlineColor;
  const text =
    tone === "success"
      ? brand.onlineColor
      : tone === "warning"
        ? brand.warningColor
        : brand.offlineColor;

  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
      style={{ backgroundColor: bg, border: `1px solid ${border}`, color: text }}
    >
      {children}
    </span>
  );
}

export default function Overview() {
  const [containers, setContainers] = useState([]);
  const [vpsStats, setVpsStats] = useState(null);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(null);

  const counts = useMemo(() => {
    const total = containers.length;
    const running = containers.filter((c) => c.status === "running").length;
    const stopped = total - running;
    return { total, running, stopped };
  }, [containers]);

  async function fetchData() {
    setError("");
    const [cRes, vRes] = await Promise.allSettled([
      api.getJson("/api/containers"),
      api.getJson("/api/vps/stats"),
    ]);

    if (cRes.status === "fulfilled") setContainers(cRes.value || []);
    if (vRes.status === "fulfilled") setVpsStats(vRes.value);

    if (
      (cRes.status === "rejected" || vRes.status === "rejected") &&
      !vpsStats
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

  const cpuPercent = Number(vpsStats?.cpuPercent ?? 0);
  const ramUsedBytes = Number(vpsStats?.ram?.usedBytes ?? 0);
  const ramTotalBytes = Number(vpsStats?.ram?.totalBytes ?? 0);
  const diskUsedBytes = Number(vpsStats?.disk?.usedBytes ?? 0);
  const diskTotalBytes = Number(vpsStats?.disk?.totalBytes ?? 0);

  const ramPercent = ramTotalBytes > 0 ? (ramUsedBytes / ramTotalBytes) * 100 : 0;
  const diskPercent = diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes) * 100 : 0;

  const isOnline = !!vpsStats;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Hello, Admin 👋
        </div>
        <div className="text-sm" style={{ color: brand.textMuted }}>
          {counts.running} running • {counts.total} total containers
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl border px-4 py-3"
          style={{
            backgroundColor: brand.cardBg,
            borderColor: brand.border,
          }}
        >
          <span style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>
            {error}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            key: "total",
            label: "Total Containers",
            value: counts.total,
            icon: Box,
            color: brand.primaryColor,
          },
          {
            key: "running",
            label: "Running",
            value: counts.running,
            icon: Play,
            color: brand.onlineColor,
          },
          {
            key: "stopped",
            label: "Stopped",
            value: counts.stopped,
            icon: Square,
            color: brand.offlineColor,
          },
          {
            key: "vpsRam",
            label: "VPS RAM Used",
            value: vpsStats ? formatBytes(ramUsedBytes) : "--",
            icon: Database,
            color: brand.primaryColor,
          },
        ].map((stat) => {
          const active = hovered === stat.key;
          return (
            <div
              key={stat.key}
              className="rounded-2xl border transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: brand.cardBg,
                borderColor: brand.border,
                transform: active ? "translateY(-2px)" : "translateY(0px)",
                boxShadow: active ? brand.accentOutlineShadow : "none",
              }}
              onMouseEnter={() => setHovered(stat.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600 }}>
                    {stat.label}
                  </div>
                  <div className="mt-3 text-4xl font-black" style={{ color: brand.textPrimary }}>
                    {stat.value}
                  </div>
                </div>
                <stat.icon size={18} style={{ color: stat.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div
          className="rounded-2xl border p-5 space-y-5"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        >
          <ProgressBar
            label="CPU"
            valueText={vpsStats ? `${cpuPercent.toFixed(1)}%` : "--"}
            percent={cpuPercent}
          />
          <ProgressBar
            label="RAM"
            valueText={vpsStats ? `${formatBytes(ramUsedBytes)} / ${formatBytes(ramTotalBytes)}` : "--"}
            percent={ramPercent}
          />
          <ProgressBar
            label="Disk"
            valueText={vpsStats ? `${formatBytes(diskUsedBytes)} / ${formatBytes(diskTotalBytes)}` : "--"}
            percent={diskPercent}
          />
        </div>

        <div className="space-y-4">
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
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
              <StatusBadge tone="success">Active</StatusBadge>
            </div>
          </div>

          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
          >
            <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
              Need Help?
            </div>
            <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
              Quick docs and best practices.
            </div>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: `${brand.primaryColor}15`,
                border: `1px solid ${brand.primaryColor}55`,
                color: brand.primaryColor,
              }}
              onClick={() => window.open("#", "_blank")}
            >
              <BookOpen size={16} />
              Docs
            </button>
          </div>

          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
                  VPS Status
                </div>
                <div className="text-sm" style={{ color: brand.textMuted }}>
                  {isOnline ? "Online" : "Offline"}
                </div>
              </div>
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
                style={{
                  backgroundColor: `${isOnline ? brand.onlineColor : brand.offlineColor}1a`,
                  border: `1px solid ${isOnline ? brand.onlineColor : brand.offlineColor}`,
                  color: isOnline ? brand.onlineColor : brand.offlineColor,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 9999,
                    backgroundColor: isOnline ? brand.onlineColor : brand.offlineColor,
                    display: "inline-block",
                  }}
                />
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

