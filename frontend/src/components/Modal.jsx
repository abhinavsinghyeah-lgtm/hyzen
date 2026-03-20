import React from "react";
import { brand } from "../config/brand.js";

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: brand.modalOverlayBg }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border transition-all duration-200"
        style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
      >
        <div className="p-5 flex items-center justify-between gap-3">
          <div style={{ color: brand.textPrimary }} className="font-semibold">
            {title}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-xl px-3 py-2 transition-all duration-200"
            style={{ border: `1px solid ${brand.border}`, color: brand.textMuted }}
          >
            Close
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

