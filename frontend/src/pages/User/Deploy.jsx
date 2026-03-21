import React, { useEffect, useRef, useState } from "react";
import { Rocket, X } from "lucide-react";
import { apiStream, api } from "../../api.js";
import { brand } from "../../config/brand.js";

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
          style={{
            backgroundImage: brand.accentGradient,
            color: "#061220",
            border: "1px solid rgba(255,157,46,0.5)",
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
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
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export default function UserDeploy() {
  const token = api.getUserToken();

  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [containerNameInput, setContainerNameInput] = useState("");
  const [buildCmd, setBuildCmd] = useState("npm install");
  const [startCmd, setStartCmd] = useState("");
  const [envPairs, setEnvPairs] = useState([]);

  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [output, setOutput] = useState("");
  const endRef = useRef(null);
  const accRef = useRef("");

  const [billing, setBilling] = useState(null);

  const safeContainerName = sanitizeContainerName(containerNameInput);

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const res = await api.getJson("/api/user/billing", { token });
        setBilling(res);
      } catch (e) {
        setError(e?.message || "Failed to load billing");
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [output]);

  const planKey = billing?.plan?.key || "free";
  const containersAllowed = billing?.containersAllowed ?? 0;
  const containersUsed = billing?.containersUsed ?? 0;
  const isFree = containersAllowed === 0;
  const atLimit = containersUsed >= containersAllowed && !isFree;

  async function onDeploy(e) {
    e.preventDefault();
    setError("");
    setShowErrorModal(false);
    setOutput("");
    accRef.current = "";
    setDeploying(true);

    try {
      const res = await apiStream("/api/user/deploy", {
        method: "POST",
        token,
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
        if (match) {
          setError(match[1]);
          setShowErrorModal(true);
        }
      }
    } catch (err) {
      const msg = err?.message || "Deployment failed";
      setError(msg);
      setShowErrorModal(true);
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
          Deploy your project within plan limits.
        </div>
      </div>

      {billing ? (
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>
                Plan: {planKey === "free" ? "Free" : planKey === "starter" ? "Starter" : planKey === "pro" ? "Pro" : "Business"}
              </div>
              <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
                {containersUsed} of {containersAllowed} containers used
              </div>
            </div>
            {isFree ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${brand.planColors.free}1a`, border: `1px solid ${brand.planColors.free}`, color: brand.planColors.free }}>
                Choose a plan
              </span>
            ) : atLimit ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${brand.warningColor}1a`, border: `1px solid ${brand.warningColor}`, color: brand.warningColor }}>
                At limit
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${brand.onlineColor}1a`, border: `1px solid ${brand.onlineColor}`, color: brand.onlineColor }}>
                Ready
              </span>
            )}
          </div>
        </div>
      ) : null}

      {isFree ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.primaryColor}10`, borderColor: brand.border }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>
            Choose a plan to start deploying.
          </div>
        </div>
      ) : null}

      {atLimit ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.warningColor}10`, borderColor: brand.border }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>
            Upgrade your plan to deploy more containers.
          </div>
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
              <FieldLabel>App name</FieldLabel>
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
              <div style={{ color: brand.textMuted, fontSize: 12, marginTop: 6 }}>
                Name:{" "}
                <span style={{ color: brand.textPrimary, fontWeight: 700 }}>
                  {safeContainerName || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Build command</FieldLabel>
              <input
                value={buildCmd}
                onChange={(e) => setBuildCmd(e.target.value)}
                className="w-full rounded-xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="npm install"
              />
            </div>
            <div>
              <FieldLabel>Start command</FieldLabel>
              <input
                value={startCmd}
                onChange={(e) => setStartCmd(e.target.value)}
                className="w-full rounded-xl outline-none transition-all duration-200"
                style={{
                  backgroundColor: brand.inputBg,
                  border: `1px solid ${brand.inputBorder}`,
                  color: brand.textPrimary,
                  padding: "12px 16px",
                }}
                placeholder="auto-detected from package.json"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
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
                <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_44px] gap-3 items-center">
                  <input
                    value={p.key}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEnvPairs((prev) => prev.map((x, i) => (i === idx ? { ...x, key: v } : x)));
                    }}
                    className="w-full rounded-xl outline-none transition-all duration-200"
                    style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary, padding: "12px 16px" }}
                    placeholder="KEY"
                  />
                  <input
                    value={p.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEnvPairs((prev) => prev.map((x, i) => (i === idx ? { ...x, value: v } : x)));
                    }}
                    className="w-full rounded-xl outline-none transition-all duration-200"
                    style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary, padding: "12px 16px" }}
                    placeholder="VALUE"
                  />
                  <button
                    type="button"
                    className="rounded-xl transition-all duration-200 cursor-pointer inline-flex items-center justify-center"
                    style={{ width: 44, height: 44, backgroundColor: "transparent", border: `1px solid ${brand.border}`, color: brand.textMuted }}
                    onClick={() => setEnvPairs((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: brand.textMuted, fontSize: 13 }}>
              Add KEY=VALUE pairs to inject environment variables into your app.
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={deploying || isFree || atLimit || !safeContainerName || !repoUrl}
          className="w-full rounded-2xl py-3 font-semibold transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
          style={{
            backgroundColor: brand.primaryColor,
            color: brand.darkBg,
            opacity: deploying || isFree || atLimit || !safeContainerName || !repoUrl ? 0.7 : 1,
            border: `1px solid ${brand.primaryColor}`,
          }}
        >
          <Rocket size={18} />
          {deploying ? "Deploying..." : "Deploy"}
        </button>
      </form>

      <div className="rounded-2xl border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600 }}>Deployment log</div>
        </div>
        <div
          className="rounded-xl border p-4 overflow-y-auto"
          style={{ backgroundColor: brand.terminalBg, borderColor: brand.border, minHeight: 200, maxHeight: 420 }}
        >
          <pre className="whitespace-pre-wrap font-mono text-xs" style={{ color: brand.terminalText }}>
            {output || "—"}
          </pre>
          <div ref={endRef} />
        </div>
      </div>

      <DeployErrorModal
        message={showErrorModal ? error : null}
        onClose={() => setShowErrorModal(false)}
      />
    </div>
  );
}
