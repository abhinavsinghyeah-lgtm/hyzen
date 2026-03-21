import React, { useEffect, useRef, useState } from "react";
import { apiStream } from "../api.js";
import { brand } from "../config/brand.js";

export default function ServerLogPanel({ streamPath, token, title = "Server Logs", refreshKey = 0 }) {
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [streaming, setStreaming] = useState(false);
  const accRef = useRef("");
  const endRef = useRef(null);

  useEffect(() => {
    if (!streamPath) return;

    let cancelled = false;
    const controller = new AbortController();
    accRef.current = "";
    setOutput("");
    setError("");
    setStreaming(true);

    async function run() {
      try {
        const res = await apiStream(streamPath, {
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
        if (!cancelled) setError(e?.message || "Failed to stream logs");
      } finally {
        if (!cancelled) setStreaming(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [streamPath, token, refreshKey]);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [output]);

  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: brand.terminalBg, borderColor: brand.border }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div style={{ color: brand.textMuted, fontSize: 12, fontWeight: 700 }}>{title}</div>
        <div style={{ color: error ? brand.offlineColor : brand.textMuted, fontSize: 12 }}>
          {error ? "Stream error" : streaming ? "Live" : "Disconnected"}
        </div>
      </div>
      {error ? (
        <div style={{ color: brand.offlineColor, fontSize: 12, marginBottom: 8 }}>{error}</div>
      ) : null}
      <pre className="whitespace-pre-wrap text-xs" style={{ color: brand.terminalText, minHeight: 220, maxHeight: 420, overflowY: "auto" }}>
        {output || "No logs yet."}
        <span ref={endRef} />
      </pre>
    </div>
  );
}
