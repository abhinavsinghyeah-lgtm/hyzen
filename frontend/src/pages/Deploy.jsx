import React, { useEffect, useRef, useState } from "react";
import { Rocket, X, GitBranch, Globe, Terminal, Zap, Info } from "lucide-react";
import { apiStream } from "../api.js";
import { brand } from "../config/brand.js";

function humanizeError(msg) {
  const t = String(msg || "").toLowerCase();
  if (t.includes("git clone") || t.includes("fatal: repository") || t.includes("errno"))
    return "Couldn't reach the repository. Check that the URL is correct and the repo is public.";
  if (t.includes("exited immediately") || t.includes("process.env.port"))
    return "Your app crashed right after starting. Make sure it listens on process.env.PORT and your start command is correct.";
  if (t.includes("build command") || (t.includes("exited with code") && !t.includes("exited immediately")))
    return "The build step failed. Check your package.json and build command.";
  if (t.includes("no available port"))
    return "No free port is available right now. Try again in a moment.";
  if (t.includes("branch") && (t.includes("not found") || t.includes("no such")))
    return "Branch not found. Check the branch name in your repository.";
  return msg;
}

function DeployErrorModal({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(2,8,16,0.82)" }}
      onClick={onClose}
    >
      <div
        className="rounded-[22px] border w-full max-w-lg p-6 relative"
        style={{
          backgroundColor: brand.cardBg,
          borderColor: `${brand.dangerColor}55`,
          boxShadow: "0 24px 48px rgba(2,8,16,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 rounded-xl p-1 transition-all duration-200 cursor-pointer"
          style={{ color: brand.textMuted, border: `1px solid ${brand.border}` }}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <div
          className="inline-flex items-center px-3 py-1 rounded-full border mb-3"
          style={{ borderColor: `${brand.dangerColor}55`, color: brand.dangerColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}
        >
          DEPLOYMENT FAILED
        </div>
        <div style={{ color: brand.textPrimary, fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>
          {humanizeError(message)}
        </div>
        <div style={{ color: brand.textMuted, fontSize: 12, marginTop: 8 }}>
          See the deployment log below for the full error output.
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl py-2.5 font-semibold transition-all duration-200 cursor-pointer"
          style={{ backgroundImage: brand.accentGradient, color: "#061220", border: "1px solid rgba(255,157,46,0.5)" }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-2" style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>
      {Icon && <Icon size={13} />}
      {children}
    </div>
  );
}

function StyledInput({ value, onChange, placeholder, mono }) {
  return (
    <input
      value={value}
      onChange={onChange}
      className="w-full rounded-xl outline-none transition-all duration-200"
      style={{
        backgroundColor: brand.inputBg,
        border: `1px solid ${brand.inputBorder}`,
        color: brand.textPrimary,
        padding: "11px 14px",
        fontFamily: mono ? "monospace" : "inherit",
        fontSize: mono ? 13 : 14,
      }}
      placeholder={placeholder}
    />
  );
}

function sanitizeContainerName(containerName) {
  const raw = String(containerName || "");
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export default function Deploy() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [containerNameInput, setContainerNameInput] = useState("");
  const [buildCmd, setBuildCmd] = useState("");
  const [startCmd, setStartCmd] = useState("");
  const [envPairs, setEnvPairs] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [error, setError] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [output, setOutput] = useState("");
  const endRef = useRef(null);
  const accRef = useRef("");

  const safeContainerName = sanitizeContainerName(containerNameInput);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [output]);

  async function onDeploy(e) {
    e.preventDefault();
    setError("");
    setShowErrorModal(false);
    setOutput("");
    setDeploySuccess(false);
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
          buildCmd,
          startCmd,
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

      const finalOutput = accRef.current;
      setOutput(finalOutput);
      if (finalOutput.includes("Deployment failed:")) {
        const match = finalOutput.match(/Deployment failed: (.+)/);
        if (match) { setError(match[1]); setShowErrorModal(true); }
      } else if (finalOutput.toLowerCase().includes("deployed")) {
        setDeploySuccess(true);
      }
    } catch (err) {
      const msg = err?.message || "Deployment failed";
      setError(msg);
      setShowErrorModal(true);
    } finally {
      setDeploying(false);
    }
  }

  const canDeploy = !!safeContainerName && !!repoUrl && !deploying;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-[24px] border p-6"
        style={{
          backgroundColor: brand.cardBg,
          borderColor: brand.border,
          boxShadow: "none",
        }}
      >
        <div className="inline-flex items-center px-3 py-1 rounded-full border mb-2" style={{ borderColor: `${brand.primaryColor}55`, color: brand.primaryColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
          DEPLOY PIPELINE
        </div>
        <div className="text-3xl font-black" style={{ color: brand.textPrimary }}>Deploy a Server</div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Keep it simple: repo URL + server name. Use advanced only if needed.
        </div>
      </div>

      {/* Layout: form + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Main form */}
        <form className="space-y-4" onSubmit={onDeploy}>
          {/* Source */}
          <div
            className="rounded-[22px] border p-5 space-y-4"
            style={{ backgroundColor: brand.cardBg, borderColor: brand.border, boxShadow: "0 10px 28px rgba(2,9,19,0.3)" }}
          >
            <div style={{ color: brand.textPrimary, fontSize: 14, fontWeight: 800 }}>Repository</div>
            <div>
              <FieldLabel icon={Globe}>Repo URL</FieldLabel>
              <StyledInput
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                mono
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel icon={GitBranch}>Branch</FieldLabel>
                <StyledInput value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" mono />
              </div>
              <div>
                <FieldLabel icon={Zap}>Server name</FieldLabel>
                <StyledInput
                  value={containerNameInput}
                  onChange={(e) => setContainerNameInput(e.target.value)}
                  placeholder="my-app"
                />
                {containerNameInput && (
                  <div className="mt-1.5" style={{ color: brand.textMuted, fontSize: 11 }}>
                    Will be created as{" "}
                    <span style={{ color: brand.primaryColor, fontFamily: "monospace", fontWeight: 700 }}>
                      {safeContainerName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="px-3 py-2 text-sm font-semibold transition-all duration-200"
              style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary, backgroundColor: "transparent" }}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide Advanced" : "Show Advanced"}
            </button>
          </div>

          {/* Commands */}
          {showAdvanced && <div
            className="rounded-[22px] border p-5 space-y-4"
            style={{ backgroundColor: brand.cardBg, borderColor: brand.border, boxShadow: "none" }}
          >
            <div style={{ color: brand.textPrimary, fontSize: 14, fontWeight: 800 }}>Build & Start</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel icon={Terminal}>Build command</FieldLabel>
                <StyledInput
                  value={buildCmd}
                  onChange={(e) => setBuildCmd(e.target.value)}
                  placeholder="npm install && npm run build"
                  mono
                />
              </div>
              <div>
                <FieldLabel icon={Terminal}>Start command</FieldLabel>
                <StyledInput
                  value={startCmd}
                  onChange={(e) => setStartCmd(e.target.value)}
                  placeholder="npm start"
                  mono
                />
              </div>
            </div>
            <div style={{ color: brand.textMuted, fontSize: 12 }}>
              Leave blank to auto-detect from <span style={{ fontFamily: "monospace", color: brand.textPrimary }}>package.json</span>.
            </div>
          </div>}

          {/* Env vars */}
          {showAdvanced && <div
            className="rounded-[22px] border p-5 space-y-3"
            style={{ backgroundColor: brand.cardBg, borderColor: brand.border, boxShadow: "none" }}
          >
            <div className="flex items-center justify-between gap-4">
              <div style={{ color: brand.textPrimary, fontSize: 14, fontWeight: 800 }}>Environment Variables</div>
              <button
                type="button"
                className="rounded-xl px-4 py-1.5 text-sm font-semibold transition-all duration-200 cursor-pointer"
                style={{ backgroundColor: `${brand.primaryColor}18`, border: `1px solid ${brand.primaryColor}55`, color: brand.primaryColor }}
                onClick={() => setEnvPairs((prev) => [...prev, { key: "", value: "" }])}
              >
                + Add
              </button>
            </div>

            {envPairs.length === 0 ? (
              <div style={{ color: brand.textMuted, fontSize: 13 }}>
                No env vars added. Click <strong style={{ color: brand.textPrimary }}>+ Add</strong> to inject KEY=VALUE pairs.
              </div>
            ) : (
              <div className="space-y-2">
                {envPairs.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      value={p.key}
                      onChange={(e) => { const v = e.target.value; setEnvPairs((prev) => prev.map((x, i) => i === idx ? { ...x, key: v } : x)); }}
                      className="flex-1 rounded-xl outline-none transition-all duration-200"
                      style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.primaryColor, padding: "9px 12px", fontFamily: "monospace", fontSize: 12, minWidth: 0 }}
                      placeholder="KEY"
                    />
                    <input
                      value={p.value}
                      onChange={(e) => { const v = e.target.value; setEnvPairs((prev) => prev.map((x, i) => i === idx ? { ...x, value: v } : x)); }}
                      className="flex-1 rounded-xl outline-none transition-all duration-200"
                      style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary, padding: "9px 12px", fontFamily: "monospace", fontSize: 12, minWidth: 0 }}
                      placeholder="value"
                    />
                    <button
                      type="button"
                      onClick={() => setEnvPairs((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-xl flex-shrink-0 inline-flex items-center justify-center transition-all duration-200 cursor-pointer"
                      style={{ width: 36, height: 36, backgroundColor: "transparent", border: `1px solid ${brand.border}`, color: brand.textMuted }}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {/* Deploy button */}
          <button
            type="submit"
            disabled={!canDeploy}
            className="w-full rounded-2xl py-3.5 font-bold text-base transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
            style={{
              backgroundImage: canDeploy ? brand.accentGradient : undefined,
              backgroundColor: canDeploy ? undefined : "rgba(26,42,61,0.6)",
              color: canDeploy ? "#ffffff" : brand.textMuted,
              border: canDeploy ? `1px solid ${brand.primaryColor}` : `1px solid ${brand.border}`,
              boxShadow: "none",
              cursor: canDeploy ? "pointer" : "not-allowed",
            }}
          >
            <Rocket size={18} />
            {deploying ? "Deploying…" : "Launch Server"}
          </button>
        </form>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div
            className="rounded-[22px] border p-5"
            style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Info size={15} style={{ color: brand.primaryColor }} />
              <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 800 }}>Quickstart Tips</div>
            </div>
            <div className="space-y-3">
              {[
                { label: "PORT env var", desc: "Your app must listen on process.env.PORT — we assign it automatically." },
                { label: "Public repos only", desc: "Private repos aren't supported yet. Make sure your repo is public." },
                { label: "Node.js auto-detect", desc: "If no build/start command is given, we read npm scripts from package.json." },
                { label: "Redeploy anytime", desc: "From the Servers page, click a server to redeploy with updated code." },
              ].map((tip) => (
                <div key={tip.label} className="rounded-xl p-3" style={{ backgroundColor: "#091426", border: `1px solid ${brand.border}` }}>
                  <div style={{ color: brand.primaryColor, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{tip.label}</div>
                  <div style={{ color: brand.textMuted, fontSize: 12, lineHeight: 1.5 }}>{tip.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {deploying && (
            <div
              className="rounded-[22px] border p-4 flex items-center gap-3"
              style={{ backgroundColor: `${brand.primaryColor}12`, borderColor: `${brand.primaryColor}55` }}
            >
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: brand.primaryColor }} />
              <div style={{ color: brand.primaryColor, fontSize: 13, fontWeight: 600 }}>Building & deploying…</div>
            </div>
          )}

          {deploySuccess && !deploying && (
            <div
              className="rounded-[22px] border p-4"
              style={{ backgroundColor: `${brand.onlineColor}12`, borderColor: `${brand.onlineColor}55` }}
            >
              <div style={{ color: brand.onlineColor, fontSize: 13, fontWeight: 700 }}>Deployed successfully</div>
              <div style={{ color: brand.textMuted, fontSize: 12, marginTop: 4 }}>Check the Servers page to access your app.</div>
            </div>
          )}
        </div>
      </div>

      {/* Deploy log */}
      <div
        className="rounded-[22px] border p-5"
        style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={14} style={{ color: brand.textMuted }} />
          <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 700 }}>Deployment Log</div>
          {deploying && (
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${brand.primaryColor}18`, color: brand.primaryColor, border: `1px solid ${brand.primaryColor}55` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: brand.primaryColor, display: "inline-block" }} />
              Live
            </span>
          )}
        </div>
        <div
          className="rounded-xl border p-4 overflow-y-auto"
          style={{ backgroundColor: brand.terminalBg, borderColor: brand.border, minHeight: 220, maxHeight: 450 }}
        >
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed" style={{ color: brand.terminalText }}>
            {output || "Waiting for deployment…"}
          </pre>
          <div ref={endRef} />
        </div>
      </div>

      <DeployErrorModal message={showErrorModal ? error : null} onClose={() => setShowErrorModal(false)} />
    </div>
  );
}
