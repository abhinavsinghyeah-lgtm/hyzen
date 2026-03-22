import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Network, Users2 } from "lucide-react";
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
  const [containers, setContainers] = useState([]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const token = api.getUserToken();
      const [meRes, containersRes] = await Promise.allSettled([
        api.getJson("/api/user/me", { token }),
        api.getJson("/api/user/containers", { token }),
      ]);

      if (meRes.status === "fulfilled") setMe(meRes.value);
      if (containersRes.status === "fulfilled") {
        setContainers(Array.isArray(containersRes.value?.containers) ? containersRes.value.containers : []);
      }

      if (meRes.status === "rejected") {
        throw meRes.reason;
      }
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
      <div className="border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div style={{ color: brand.textMuted }}>Loading...</div>
      </div>
    );
  }

  const planKey = me?.plan?.key || "free";
  const pColor = planColor(planKey);
  const days = me?.plan?.daysRemaining ?? 0;
  const running = containers.filter((c) => c.status === "running").length;
  const total = containers.length;
  const pendingInvoices = 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[40px] font-bold leading-none" style={{ color: brand.textPrimary }}>
          Hello, {me?.profile?.name || "User"}
        </div>
        <div className="text-base mt-2" style={{ color: brand.textMuted }}>
          You currently have {running} running servers.
        </div>
      </div>

      {error ? (
        <div className="border px-4 py-3" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      {me?.account?.isSuspended ? (
        <div className="border px-4 py-3" style={{ backgroundColor: `${brand.warningColor}12`, borderColor: `${brand.warningColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>
            {me?.account?.suspensionReason || "Your account is suspended by admin. Deploy and runtime actions are disabled."}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px] gap-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
              <div className="flex items-center justify-between">
                <div className="text-sm" style={{ color: brand.textMuted }}>Online players</div>
                <Users2 size={16} style={{ color: brand.textMuted }} />
              </div>
              <div className="mt-2 text-4xl font-bold" style={{ color: brand.textPrimary }}>{running}</div>
            </div>

            <div className="border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
              <div className="flex items-center justify-between">
                <div className="text-sm" style={{ color: brand.textMuted }}>Networks</div>
                <Network size={16} style={{ color: brand.textMuted }} />
              </div>
              <div className="mt-2 text-4xl font-bold" style={{ color: brand.textPrimary }}>{total}</div>
            </div>

            <div className="border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
              <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Pending invoices</div>
              <div className="text-sm mt-1" style={{ color: brand.textMuted }}>List of invoices pending payment</div>
              <div className="mt-4 border px-3 py-2" style={{ borderColor: "rgba(34,197,94,0.35)", backgroundColor: "rgba(34,197,94,0.12)" }}>
                <div className="inline-flex items-center gap-2 text-sm" style={{ color: brand.onlineColor }}>
                  <CheckCircle2 size={14} />
                  {pendingInvoices > 0 ? `${pendingInvoices} invoice(s) pending` : "You have no pending invoices."}
                </div>
              </div>
            </div>
          </div>

          <div className="border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
            <div className="text-2xl font-semibold" style={{ color: brand.textPrimary }}>Your Networks</div>
            <div className="mt-4 border px-6 py-14 text-center" style={{ borderColor: brand.border, backgroundColor: "#0a121f" }}>
              <div className="text-3xl font-bold" style={{ color: brand.textPrimary }}>{total === 0 ? "No networks yet" : `${total} network(s)`}</div>
              <div className="text-sm mt-2" style={{ color: brand.textMuted }}>
                {total === 0
                  ? "Create your first network to start protecting your servers from attacks."
                  : "Manage existing networks and connected servers from the Network page."}
              </div>
              <button
                type="button"
                className="mt-6 px-6 py-2 text-sm font-semibold transition-all duration-200"
                style={{ backgroundColor: brand.primaryColor, color: "#ffffff", border: `1px solid ${brand.primaryColor}` }}
                onClick={() => navigate("/user/containers")}
              >
                {total === 0 ? "Create Network" : "Open Network"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
            <div className="text-lg font-semibold" style={{ color: brand.textPrimary }}>Need help ?</div>
            <div className="text-sm mt-2" style={{ color: brand.textMuted }}>
              Difficulties using dashboard features? Consult documentation.
            </div>
            <button
              type="button"
              className="mt-4 w-full px-4 py-2 text-sm font-semibold transition-all duration-200"
              style={{ border: `1px solid ${brand.border}`, color: brand.textPrimary, backgroundColor: "transparent" }}
            >
              Documentation
            </button>
          </div>

          <div className="border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
            <div className="text-lg font-semibold" style={{ color: brand.textPrimary }}>Changing your plan ?</div>
            <div className="text-sm mt-2" style={{ color: brand.textMuted }}>
              {planName(planKey)} plan. Expires in {days} day{days === 1 ? "" : "s"}.
            </div>
            <div className="mt-3 inline-flex items-center px-2 py-1 text-xs font-semibold" style={{ color: pColor, border: `1px solid ${pColor}66`, backgroundColor: `${pColor}12` }}>
              Servers: {me?.containersUsed} / {me?.containersAllowed}
            </div>
            <button
              type="button"
              className="mt-4 w-full px-4 py-2 text-sm font-semibold transition-all duration-200"
              style={{ backgroundColor: "transparent", color: brand.textPrimary, border: `1px solid ${brand.border}` }}
              onClick={() => navigate("/user/billing")}
            >
              Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
