import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, apiStream } from "../../api.js";
import { brand } from "../../config/brand.js";
import { X } from "lucide-react";

function formatContainerLabel(c) {
  return c?.name ? `${c.name}` : c?.id;
}

export default function UserLogs() {
  const location = useLocation();
  const initialContainerId = location?.state?.containerId || null;
  const token = api.getUserToken();

  const [containers, setContainers] = useState([]);
  const [selectedId, setSelectedId] = useState(initialContainerId);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef(null);
  const accRef = useRef("");

  const selected = useMemo(
    () => containers.find((c) => c.id === selectedId) || null,
    [containers, selectedId]
  );

  async function loadContainers() {
    const res = await api.getJson("/api/user/containers", { token });
    const list = res?.containers || [];
    setContainers(list);
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }

  useEffect(() => {
    loadContainers().catch((e) => setError(e?.message || "Failed to load containers"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;
    const controller = new AbortController();
    setError("");
    setOutput("");
    accRef.current = "";
    setStreaming(true);

    async function run() {
      try {
        const res = await apiStream(`/api/user/containers/${selectedId}/logs`, {
          method: "GET",
          token,
          signal: controller.signal,
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No log stream available");

        const decoder = new TextDecoder();
        while (!cancelled) {
          const result = await reader.read();
          if (result.done) break;
          if (result.value) {
            const chunk = decoder.decode(result.value, { stream: true });
            accRef.current += chunk;
            setOutput(accRef.current);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Log streaming failed");
      } finally {
        if (!cancelled) setStreaming(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [output]);

  function onClear() {
    accRef.current = "";
    setOutput("");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Logs
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Real-time log streaming.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.dangerColor}12`, borderColor: `${brand.dangerColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600 }}>Container</div>
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-2xl outline-none transition-all duration-200 cursor-pointer px-4 py-2"
            style={{ backgroundColor: brand.inputBg, border: `1px solid ${brand.inputBorder}`, color: brand.textPrimary }}
          >
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {formatContainerLabel(c)}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <div style={{ color: brand.textMuted, fontSize: 13 }}>
            {selected ? (selected.status === "running" ? "Streaming live" : "Container is not running") : ""}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div style={{ color: brand.textMuted, fontSize: 13, fontWeight: 600 }}>Log output</div>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
            style={{
              width: 36,
              height: 36,
              backgroundColor: "transparent",
              border: `1px solid ${brand.border}`,
              color: brand.textMuted,
            }}
            title="Clear logs"
            aria-label="Clear logs"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="rounded-xl border p-4 overflow-y-auto"
          style={{
            backgroundColor: brand.terminalBg,
            borderColor: brand.border,
            minHeight: 420,
            maxHeight: 600,
          }}
        >
          <pre className="whitespace-pre-wrap font-mono text-xs" style={{ color: brand.terminalText }}>
            {streaming ? output || "—" : output || "—"}
          </pre>
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}

