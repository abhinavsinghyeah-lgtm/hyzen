import React, { useEffect } from "react";
import { X, FileCode, Copy, CheckCheck } from "lucide-react";
import { brand } from "../config/brand.js";

const EXAMPLES = [
  {
    label: "Node.js",
    code: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]`,
  },
  {
    label: "Python",
    code: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]`,
  },
  {
    label: "Static (Nginx)",
    code: `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80`,
  },
];

export default function DockerfileHelpModal({ open, onClose }) {
  const [copiedIdx, setCopiedIdx] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState(0);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function copy(idx) {
    navigator.clipboard.writeText(EXAMPLES[idx].code).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: brand.modalOverlayBg, backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: brand.cardBg,
          borderColor: brand.border,
          boxShadow: `0 0 0 1px rgba(99,102,241,0.15), 0 24px 64px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Top accent line */}
        <div
          className="h-[2px] w-full"
          style={{ backgroundImage: brand.accentGradient }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 38,
                height: 38,
                backgroundColor: `${brand.primaryColor}18`,
                border: `1px solid ${brand.primaryColor}33`,
              }}
            >
              <FileCode size={18} style={{ color: brand.primaryColor }} />
            </div>
            <div>
              <div className="font-bold text-base" style={{ color: brand.textPrimary }}>
                No Dockerfile found
              </div>
              <div className="text-xs mt-0.5" style={{ color: brand.textMuted }}>
                Add a Dockerfile to your repo root to deploy
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl transition-all duration-200 inline-flex items-center justify-center cursor-pointer"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "transparent",
              border: `1px solid ${brand.border}`,
              color: brand.textMuted,
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ borderTop: `1px solid ${brand.border}` }} />

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div style={{ color: brand.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            Hyzen needs a <code style={{ color: brand.primaryColor, backgroundColor: `${brand.primaryColor}15`, padding: "1px 6px", borderRadius: 5 }}>Dockerfile</code> in your repo's root directory to build and run your app. Pick a template below, copy it, and add it to your project.
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: brand.darkBg, border: `1px solid ${brand.border}` }}>
            {EXAMPLES.map((ex, idx) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setActiveTab(idx)}
                className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: activeTab === idx ? brand.primaryColor : "transparent",
                  color: activeTab === idx ? brand.darkBg : brand.textMuted,
                  border: "none",
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div
            className="relative rounded-xl border overflow-hidden"
            style={{ backgroundColor: brand.terminalBg, borderColor: brand.border }}
          >
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ borderBottom: `1px solid ${brand.border}` }}
            >
              <div className="flex items-center gap-1.5">
                {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c, opacity: 0.7 }} />
                ))}
              </div>
              <div style={{ color: brand.textMuted, fontSize: 11 }}>Dockerfile</div>
              <button
                type="button"
                onClick={() => copy(activeTab)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all duration-200 cursor-pointer text-xs font-medium"
                style={{
                  backgroundColor: copiedIdx === activeTab ? `${brand.successColor}18` : `${brand.primaryColor}15`,
                  border: `1px solid ${copiedIdx === activeTab ? brand.successColor + "44" : brand.primaryColor + "33"}`,
                  color: copiedIdx === activeTab ? brand.successColor : brand.primaryColor,
                }}
              >
                {copiedIdx === activeTab ? <CheckCheck size={12} /> : <Copy size={12} />}
                {copiedIdx === activeTab ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre
              className="p-4 text-xs font-mono overflow-x-auto"
              style={{ color: brand.terminalText, margin: 0, lineHeight: 1.7 }}
            >
              {EXAMPLES[activeTab].code}
            </pre>
          </div>

          <div
            className="rounded-xl border px-4 py-3 text-xs"
            style={{
              backgroundColor: `${brand.primaryColor}08`,
              borderColor: `${brand.primaryColor}22`,
              color: brand.textMuted,
              lineHeight: 1.6,
            }}
          >
            💡 Save the file as <code style={{ color: brand.textPrimary }}>Dockerfile</code> (no extension) in your repo root, then push and redeploy.
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-6 py-4"
          style={{ borderTop: `1px solid ${brand.border}` }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-5 py-2 font-semibold text-sm transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: brand.primaryColor,
              color: brand.darkBg,
              border: `1px solid ${brand.primaryColor}`,
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
