import DockerfileHelpModal from "../components/DockerfileHelpModal.jsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import { apiStream } from "../api.js";
import { brand } from "../config/brand.js";

function formatRamLabel(mb) {
  const n = Number(mb);
  if (n >= 1024) return `${(n / 1024).toFixed(0)}GB`;
  return `${n}MB`;
}

function FieldLabel({ children }) {
  return (
    <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function sanitizeContainerName(containerName) {
  const raw = String(containerName || "");
  const safeName = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return safeName;
}

export default function Deploy() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [containerNameInput, setContainerNameInput] = useState("");
  const [ramMb, setRamMb] = useState("512");
  const [cpuCores, setCpuCores] = useState("0.5");

  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const endRef = useRef(null);
  const accRef = useRef("");

  const [showDockerfileHelp, setShowDockerfileHelp] = useState(false);
  const safeContainerName = sanitizeContainerName(containerNameInput);

  const [envPairs, setEnvPairs] = useState([]);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [output]);

  const ramOptions = useMemo(() => ["256", "512", "1024"], []);
  const cpuOptions = useMemo(() => ["0.25", "0.5", "1"], []);

  async function onDeploy(e) {
    e.preventDefault();
    setError("");
    setOutput("");
    accRef.current = "";
    setDeploying(true);

    try {
      const res = await apiStream("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          branch,
          containerName: safeContainerName,
          ram: ramMb,
          cpu: cpuCores,
          env: envPairs
            .filter((p) => String(p?.key || "").trim())
            .map((p) => ({ key: String(p.key), value: String(p.value ?? "") })),
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const chunk = decoder.decode(result.value, { stream: true });
          accRef.current += chunk;
          setOutput(accRef.current);
        }
      }

    setOutput(accRef.current);
if (accRef.current.includes("No Dockerfile found")) {
  alert("TRIGGER");
  setShowDockerfileHelp(true);
}
    } catch (err) {
      const msg = err?.message || "Deployment failed";
      setError(msg);
      if (msg.includes("No Dockerfile found")) setShowDockerfileHelp(true);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Deploy
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Clone a GitHub repo, build an image, run with resource limits.
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl border px-4 py-3"
          style={{
            backgroundColor: `${brand.dangerColor}12`,
            borderColor: `${brand.dangerColor}55`,
          }}
        >
          <span style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>
            {error}
          </span>
        </div>
      ) : null}

      <form
        className="rounded-2xl border p-5 space-y-5"
        style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        onSubmit={onDeploy}
      >
        <div className="space-y-4">
          <div>
            <FieldLabel>GitHub repo URL</FieldLabel>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full rounded-xl outline-none transition-all duration-200"
              style={{
                backgroundColor: brand.inputBg,
                border: `1px solid ${brand.inputBorder}`,
                color: brand.textPrimary,
                padding: "12px 16px",
              }}
              placeholder="https://github.com/user/repo.git"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Branch name</FieldLabel>
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full rounded-xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="main"
              />
            </div>
            <div>
              <FieldLabel>Container name</FieldLabel>
              <input
                value={containerNameInput}
                onChange={(e) => setContainerNameInput(e.target.value)}
                className="w-full rounded-xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="my-app"
              />
              <div style={{ color: brand.textMuted, fontSize: 12, marginTop: 10 }}>
                Sanitized:{" "}
                <span style={{ color: brand.textPrimary, fontWeight: 700 }}>
                  {safeContainerName || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        >
          <div className="flex items-center justify-between gap-4">
            <div style={{ color: brand.textPrimary, fontSize: 14, fontWeight: 800 }}>
              Environment variables
            </div>
            <button
              type="button"
              className="rounded-2xl px-4 py-2 transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: `${brand.primaryColor}15`,
                border: `1px solid ${brand.primaryColor}55`,
                color: brand.primaryColor,
              }}
              onClick={() => setEnvPairs((prev) => [...prev, { key: "", value: "" }])}
            >
              Add
            </button>
          </div>

          {envPairs.length ? (
            <div className="space-y-3">
              {envPairs.map((p, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_44px] gap-3 items-center"
                >
                  <input
                    value={p.key}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEnvPairs((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, key: v } : x))
                      );
                    }}
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
                    onChange={(e) => {
                      const v = e.target.value;
                      setEnvPairs((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, value: v } : x))
                      );
                    }}
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
                    aria-label="Remove environment variable"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: brand.textMuted, fontSize: 13 }}>
              Add `KEY=VALUE` pairs to inject environment variables into your container.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>RAM</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {ramOptions.map((v) => {
                const active = String(ramMb) === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRamMb(v)}
                    className="px-4 py-2 rounded-2xl transition-all duration-200 cursor-pointer text-sm font-semibold"
                    style={{
                      border: `1px solid ${brand.inputBorder}`,
                      backgroundColor: active ? `${brand.primaryColor}18` : "transparent",
                      color: active ? brand.primaryColor : brand.textMuted,
                    }}
                  >
                    {formatRamLabel(v)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <FieldLabel>CPU</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {cpuOptions.map((v) => {
                const active = String(cpuCores) === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCpuCores(v)}
                    className="px-4 py-2 rounded-2xl transition-all duration-200 cursor-pointer text-sm font-semibold"
                    style={{
                      border: `1px solid ${brand.inputBorder}`,
                      backgroundColor: active ? `${brand.primaryColor}18` : "transparent",
                      color: active ? brand.primaryColor : brand.textMuted,
                    }}
                  >
                    {v} core
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={deploying || !safeContainerName}
          className="w-full rounded-2xl py-3 font-semibold transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
          style={{
            backgroundColor: brand.primaryColor,
            color: brand.darkBg,
            opacity: deploying || !safeContainerName ? 0.7 : 1,
            border: `1px solid ${brand.primaryColor}`,
          }}
        >
          <Rocket size={18} />
          {deploying ? "Deploying..." : "Deploy"}
        </button>
      </form>

<div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600 }}>
            Deployment log
          </div>
        </div>
        <div
          className="rounded-xl border p-4 overflow-y-auto"
          style={{
            backgroundColor: brand.terminalBg,
            borderColor: brand.border,
            minHeight: 200,
            maxHeight: 420,
          }}
        >
          <pre className="whitespace-pre-wrap font-mono text-xs" style={{ color: brand.terminalText }}>
            {output || "—"}
          </pre>
          <div ref={endRef} />
        </div>
      </div>

      <DockerfileHelpModal
        open={showDockerfileHelp}
        onClose={() => setShowDockerfileHelp(false)}
      />
    </div>
  );
}

