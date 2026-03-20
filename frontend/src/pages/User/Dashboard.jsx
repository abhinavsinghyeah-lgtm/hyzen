import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { brand } from "../../config/brand.js";

function planColor(planKey) {
  return brand.planColors?.[planKey] || brand.planColors.free;
}

function planName(planKey) {
  if (planKey === "starter") return "Starter";
  if (planKey === "pro") return "Pro";
  if (planKey === "business") return "Business";
  return "Free";
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await api.getJson("/api/user/me", { token: api.getUserToken() });
      setMe(res);
    } catch (e) {
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div style={{ color: brand.textMuted }}>Loading...</div>
      </div>
    );
  }

  const planKey = me?.plan?.key || "free";
  const pColor = planColor(planKey);
  const days = me?.plan?.daysRemaining ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Hello, {me?.profile?.name || "User"} 👋
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          {me ? `${me.containersUsed} of ${me.containersAllowed} containers used` : ""}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Your Plan</div>
              <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
                Expires in {days} day{days === 1 ? "" : "s"}
              </div>
            </div>
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${pColor}1a`,
                border: `1px solid ${pColor}`,
                color: pColor,
              }}
            >
              {planName(planKey)}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-sm" style={{ color: brand.textMuted }}>
              Containers: {me?.containersUsed} / {me?.containersAllowed}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Quick Actions</div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              className="rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer font-semibold"
              style={{
                backgroundColor: brand.primaryColor,
                color: brand.darkBg,
                border: `1px solid ${brand.primaryColor}`,
              }}
              onClick={() => navigate("/user/deploy")}
            >
              Deploy
            </button>
            <button
              type="button"
              className="rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer font-semibold"
              style={{
                backgroundColor: "transparent",
                color: brand.textPrimary,
                border: `1px solid ${brand.border}`,
              }}
              onClick={() => navigate("/user/containers")}
            >
              View Containers
            </button>
            <button
              type="button"
              className="rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer font-semibold"
              style={{
                backgroundColor: `${pColor}15`,
                color: pColor,
                border: `1px solid ${pColor}55`,
              }}
              onClick={() => navigate("/user/billing")}
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

