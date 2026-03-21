import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiStream } from "../api.js";
import ServerLogPanel from "../components/ServerLogPanel.jsx";
import { brand } from "../config/brand.js";

function normalizeEnv(envVars) {
  if (!envVars) return [];
  if (Array.isArray(envVars)) return envVars;
  if (typeof envVars === "object") {
    return Object.entries(envVars).map(([key, value]) => ({ key, value }));
  }
  return [];
}

export default function AdminUserContainerControl() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [deployOutput, setDeployOutput] = useState("");
  const [detail, setDetail] = useState(null);
  const [logRefreshKey, setLogRefreshKey] = useState(0);

  const [form, setForm] = useState({
    containerName: "",
    repoUrl: "",
    branch: "main",
    buildCmd: "",
    startCmd: "",
    env: [{ key: "", value: "" }],
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.getJson(`/api/admin/containers/${id}`);
      const c = res?.container;
      if (!c) throw new Error("Container not found");
      setDetail(c);
      setForm({
        containerName: c.name || "",
        repoUrl: c.repoUrl || "",
        branch: c.branch || "main",
        buildCmd: c.buildCmd || "",
        startCmd: c.startCmd || "",
        env: normalizeEnv(c.envVars).length ? normalizeEnv(c.envVars) : [{ key: "", value: "" }],
      });
      setInfo(c.suspended ? (c.suspendedReason || "This container is suspended.") : "");
    } catch (e) {
      setError(e?.message || "Failed to load container");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setEnvAt(idx, key, value) {
    setForm((prev) => ({
      ...prev,
      env: prev.env.map((item, index) => (index === idx ? { ...item, [key]: value } : item)),
    }));
  }

  function addEnv() {
    setForm((prev) => ({ ...prev, env: [...prev.env, { key: "", value: "" }] }));
  }

  function removeEnv(idx) {
    setForm((prev) => ({ ...prev, env: prev.env.filter((_, index) => index !== idx) }));
  }

  const cleanEnv = useMemo(
    () => (form.env || []).filter((item) => String(item?.key || "").trim()),
    [form.env]
  );

  async function saveConfig() {
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await api.request(`/api/admin/containers/${id}/config`, {
        method: "PUT",
        body: JSON.stringify({
          containerName: form.containerName,
          repoUrl: form.repoUrl,
          branch: form.branch,
          buildCmd: form.buildCmd,
          startCmd: form.startCmd,
          env: cleanEnv,
        }),
      });
      setInfo("Container config saved.");
      await load();
    } catch (e) {
      setError(e?.message || "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  async function redeploy() {
    setSaving(true);
    setError("");
    setInfo("");
    setDeployOutput("");
    try {
      const res = await apiStream(`/api/admin/containers/${id}/redeploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerName: form.containerName,
          repoUrl: form.repoUrl,
          branch: form.branch,
          buildCmd: form.buildCmd,
          startCmd: form.startCmd,
          env: cleanEnv,
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No deploy output available");
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        acc += decoder.decode(next.value, { stream: true });
        setDeployOutput(acc);
      }
      setInfo("Redeploy finished.");
      setLogRefreshKey((prev) => prev + 1);
      await load();
    } catch (e) {
      setError(e?.message || "Redeploy failed");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action) {
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await api.request(`/api/admin/containers/${id}/${action}`, { method: "POST" });
      if (action === "delete") {
        navigate("/admin/containers");
        return;
      }
      setInfo(`Container ${action} completed.`);
      setLogRefreshKey((prev) => prev + 1);
      await load();
    } catch (e) {
      setError(e?.message || `Failed to ${action}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspend() {
    if (!detail) return;
    await runAction(detail.suspended ? "unsuspend" : "suspend");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div style={{ color: brand.textMuted }}>Loading container...</div>
      </div>
    );
  }

  const statusColor = detail?.suspended
    ? brand.warningColor
    : detail?.status === "running"
      ? brand.onlineColor
      : brand.offlineColor;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>User Server Control</div>
          <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
            Owner: {detail?.userName || "-"} ({detail?.userEmail || "-"})
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {detail?.url ? (
            <a href={detail.url} target="_blank" rel="noreferrer" className="rounded-xl px-4 py-2 font-semibold" style={{ border: `1px solid ${brand.primaryColor}66`, color: brand.primaryColor }}>
              Open App
            </a>
          ) : null}
          <button type="button" className="rounded-xl px-4 py-2 font-semibold" style={{ border: `1px solid ${brand.border}`, color: brand.textMuted }} onClick={() => navigate("/admin/containers")}>
            Back
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-4 flex flex-wrap gap-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div>
          <div style={{ color: brand.textMuted, fontSize: 12 }}>Name</div>
          <div style={{ color: brand.textPrimary, fontWeight: 700 }}>{detail?.name || "-"}</div>
        </div>
        <div>
          <div style={{ color: brand.textMuted, fontSize: 12 }}>Status</div>
          <div style={{ color: statusColor, fontWeight: 700 }}>{detail?.suspended ? "Suspended" : detail?.status || "-"}</div>
        </div>
        <div>
          <div style={{ color: brand.textMuted, fontSize: 12 }}>Branch</div>
          <div style={{ color: brand.textPrimary, fontWeight: 700 }}>{detail?.branch || "main"}</div>
        </div>
        <div className="min-w-[240px]">
          <div style={{ color: brand.textMuted, fontSize: 12 }}>Repo</div>
          <div style={{ color: brand.textPrimary, fontWeight: 700, wordBreak: "break-all" }}>{detail?.repoUrl || "-"}</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.offlineColor}12`, borderColor: `${brand.offlineColor}55` }}>
          <div style={{ color: brand.textPrimary, fontWeight: 600, fontSize: 13 }}>{error}</div>
        </div>
      ) : null}

      {info ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.primaryColor}10`, borderColor: `${brand.primaryColor}55` }}>
          <div style={{ color: brand.textPrimary, fontWeight: 600, fontSize: 13 }}>{info}</div>
        </div>
      ) : null}

      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={saving || detail?.suspended} className="rounded-xl px-4 py-2 font-semibold" style={{ backgroundColor: brand.primaryColor, border: `1px solid ${brand.primaryColor}`, color: brand.darkBg, opacity: saving || detail?.suspended ? 0.7 : 1 }} onClick={() => runAction("start")}>
            Start
          </button>
          <button type="button" disabled={saving} className="rounded-xl px-4 py-2 font-semibold" style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary, opacity: saving ? 0.7 : 1 }} onClick={() => runAction("stop")}>
            Stop
          </button>
          <button type="button" disabled={saving || detail?.suspended} className="rounded-xl px-4 py-2 font-semibold" style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary, opacity: saving || detail?.suspended ? 0.7 : 1 }} onClick={() => runAction("restart")}>
            Restart
          </button>
          <button type="button" disabled={saving} className="rounded-xl px-4 py-2 font-semibold" style={{ border: `1px solid ${detail?.suspended ? brand.onlineColor : brand.warningColor}`, color: detail?.suspended ? brand.onlineColor : brand.warningColor, opacity: saving ? 0.7 : 1 }} onClick={toggleSuspend}>
            {detail?.suspended ? "Unsuspend" : "Suspend"}
          </button>
          <button type="button" disabled={saving} className="rounded-xl px-4 py-2 font-semibold" style={{ border: `1px solid ${brand.offlineColor}66`, color: brand.offlineColor, opacity: saving ? 0.7 : 1 }} onClick={() => runAction("delete")}>
            Delete
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>App Name</div>
            <input value={form.containerName} onChange={(e) => setField("containerName", e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none" style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }} />
          </label>
          <label className="space-y-2">
            <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>Branch</div>
            <input value={form.branch} onChange={(e) => setField("branch", e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none" style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }} />
          </label>
        </div>

        <label className="space-y-2 block">
          <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>Repository URL</div>
          <input value={form.repoUrl} onChange={(e) => setField("repoUrl", e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none" style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }} />
        </label>

        <label className="space-y-2 block">
          <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>Build Command</div>
          <input value={form.buildCmd} onChange={(e) => setField("buildCmd", e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none" style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }} />
        </label>

        <label className="space-y-2 block">
          <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>Start Command</div>
          <input value={form.startCmd} onChange={(e) => setField("startCmd", e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none" style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }} />
        </label>

        <div className="space-y-2">
          <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>Environment Variables</div>
          {form.env.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_44px] gap-2">
              <input value={item.key} onChange={(e) => setEnvAt(idx, "key", e.target.value)} className="rounded-xl px-4 py-2 outline-none" style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }} placeholder="KEY" />
              <input value={item.value} onChange={(e) => setEnvAt(idx, "value", e.target.value)} className="rounded-xl px-4 py-2 outline-none" style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }} placeholder="VALUE" />
              <button type="button" className="rounded-xl" style={{ backgroundColor: "transparent", border: `1px solid ${brand.border}`, color: brand.textMuted }} onClick={() => removeEnv(idx)}>X</button>
            </div>
          ))}
          <button type="button" className="rounded-xl px-4 py-2" style={{ backgroundColor: `${brand.primaryColor}15`, border: `1px solid ${brand.primaryColor}55`, color: brand.primaryColor }} onClick={addEnv}>Add Env</button>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="button" disabled={saving} className="rounded-xl px-5 py-2 font-semibold" style={{ backgroundColor: brand.primaryColor, border: `1px solid ${brand.primaryColor}`, color: brand.darkBg, opacity: saving ? 0.7 : 1 }} onClick={saveConfig}>
            Save Config
          </button>
          <button type="button" disabled={saving || detail?.suspended} className="rounded-xl px-5 py-2 font-semibold" style={{ backgroundColor: `${brand.primaryColor}20`, border: `1px solid ${brand.primaryColor}55`, color: brand.primaryColor, opacity: saving || detail?.suspended ? 0.7 : 1 }} onClick={redeploy}>
            Redeploy Latest Commit
          </button>
        </div>
      </div>

      <ServerLogPanel streamPath={`/api/admin/containers/${id}/logs`} refreshKey={logRefreshKey} />

      <div className="rounded-2xl border p-4" style={{ backgroundColor: brand.terminalBg, borderColor: brand.border }}>
        <div style={{ color: brand.textMuted, fontSize: 12, marginBottom: 8 }}>Redeploy Output</div>
        <pre className="whitespace-pre-wrap text-xs" style={{ color: brand.terminalText, minHeight: 160 }}>{deployOutput || "No redeploy output yet."}</pre>
      </div>
    </div>
  );
}
