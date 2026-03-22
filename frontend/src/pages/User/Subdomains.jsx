import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Copy, CheckCheck, ExternalLink, Server } from "lucide-react";
import { api } from "../../api.js";
import { brand } from "../../config/brand.js";

export default function UserSubdomains() {
  const navigate = useNavigate();
  const [subdomains, setSubdomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.userGetSubdomains();
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

  function handleCopy(domain, id) {
    navigator.clipboard.writeText(`https://${domain}`).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          My Subdomains
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Each server you deploy gets its own{" "}
          <span style={{ color: brand.primaryColor }}>*.hyzen.pro</span> subdomain.
          No IP addresses exposed.
        </div>
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

      {loading ? (
        <div
          className="border p-6"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        >
          <div className="text-sm" style={{ color: brand.textMuted }}>
            Loading…
          </div>
        </div>
      ) : subdomains.length === 0 ? (
        <div
          className="border p-12 text-center"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        >
          <Globe
            size={40}
            style={{ color: brand.textMuted, margin: "0 auto 12px" }}
          />
          <div
            className="text-base font-semibold mb-2"
            style={{ color: brand.textPrimary }}
          >
            No subdomains yet
          </div>
          <div className="text-sm mb-5" style={{ color: brand.textMuted }}>
            Deploy a server and it will automatically receive a{" "}
            <span style={{ color: brand.primaryColor }}>yourapp.hyzen.pro</span>{" "}
            subdomain.
          </div>
          <button
            onClick={() => navigate("/user/deploy")}
            className="px-5 py-2 text-sm font-semibold transition-all"
            style={{ backgroundColor: brand.primaryColor, color: "#fff" }}
          >
            Deploy a Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {subdomains.map((s) => (
            <div
              key={s.id}
              className="border p-5"
              style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 38,
                      height: 38,
                      backgroundColor: `${brand.primaryColor}1a`,
                      border: `1px solid ${brand.primaryColor}44`,
                      color: brand.primaryColor,
                    }}
                  >
                    <Globe size={18} />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-base font-semibold truncate"
                      style={{ color: brand.textPrimary }}
                    >
                      {s.domain}
                    </div>
                    {s.containerName && (
                      <div
                        className="flex items-center gap-1.5 text-xs mt-0.5"
                        style={{ color: brand.textMuted }}
                      >
                        <Server size={11} />
                        Server: {s.containerName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Status badge */}
                  <span
                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor:
                        s.status === "running"
                          ? `${brand.onlineColor}1a`
                          : `${brand.border}66`,
                      border: `1px solid ${
                        s.status === "running" ? brand.onlineColor : brand.border
                      }`,
                      color:
                        s.status === "running"
                          ? brand.onlineColor
                          : brand.textMuted,
                    }}
                  >
                    {s.status === "running" ? "Online" : "Offline"}
                  </span>

                  {/* Active badge */}
                  {!s.isActive && (
                    <span
                      className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: `${brand.warningColor}1a`,
                        border: `1px solid ${brand.warningColor}66`,
                        color: brand.warningColor,
                      }}
                    >
                      Disabled
                    </span>
                  )}

                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(s.domain, s.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      backgroundColor:
                        copiedId === s.id
                          ? `${brand.onlineColor}1a`
                          : `${brand.border}66`,
                      border: `1px solid ${
                        copiedId === s.id ? brand.onlineColor : brand.border
                      }`,
                      color:
                        copiedId === s.id ? brand.onlineColor : brand.textMuted,
                    }}
                  >
                    {copiedId === s.id ? (
                      <CheckCheck size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                    {copiedId === s.id ? "Copied!" : "Copy"}
                  </button>

                  {/* Open button */}
                  <a
                    href={`https://${s.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: `${brand.primaryColor}1a`,
                      border: `1px solid ${brand.primaryColor}44`,
                      color: brand.primaryColor,
                      textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={12} />
                    Open
                  </a>

                  {/* Go to server */}
                  {s.containerId && (
                    <button
                      onClick={() => navigate(`/user/containers/${s.containerId}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: `${brand.border}66`,
                        border: `1px solid ${brand.border}`,
                        color: brand.textMuted,
                      }}
                    >
                      <Server size={12} />
                      Manage Server
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div
        className="border p-4"
        style={{ backgroundColor: brand.cardBg, borderColor: `${brand.primaryColor}33` }}
      >
        <div className="text-xs space-y-1" style={{ color: brand.textMuted }}>
          <div className="font-semibold mb-1" style={{ color: brand.primaryColor }}>
            How subdomains work
          </div>
          <div>
            • Each server gets a unique <strong style={{ color: brand.textPrimary }}>yourapp.hyzen.pro</strong> address automatically when deployed.
          </div>
          <div>
            • Your VPS IP is never exposed — all traffic routes through{" "}
            <strong style={{ color: brand.textPrimary }}>hyzen.pro</strong>.
          </div>
          <div>
            • If you need a custom subdomain, contact support.
          </div>
        </div>
      </div>
    </div>
  );
}
