import React from "react";
import { brand } from "../config/brand.js";

export default function ProgressBar({ value, color }) {
  const percent = Math.max(0, Math.min(100, Number(value || 0)));
  const fillColor = color || brand.accentColor;

  return (
    <div className="w-full">
      <div
        className="h-3 rounded-full overflow-hidden"
        style={{ backgroundColor: brand.border, border: `1px solid ${brand.border}` }}
      >
        <div
          className="h-full transition-all duration-200"
          style={{
            width: `${percent}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>
    </div>
  );
}

