import React, { useEffect, useState } from "react";
import { api } from "../../api.js";
import { brand } from "../../config/brand.js";

const plans = [
  { key: "starter", label: "Starter", price: 10000, display: "₹100", ram: "512m", cpu: 0.5, containers: 1 },
  { key: "pro", label: "Pro", price: 20000, display: "₹200", ram: "1g", cpu: 1, containers: 3 },
  { key: "business", label: "Business", price: 50000, display: "₹500", ram: "2g", cpu: 2, containers: 10 },
];

function planColor(planKey) {
  return brand.planColors?.[planKey] || brand.planColors.free;
}

export default function UserBilling() {
  const token = api.getUserToken();

  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingPlan, setPayingPlan] = useState(null);
  const [success, setSuccess] = useState("");

  async function load() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await api.getJson("/api/user/billing", { token });
      setBilling(res);
    } catch (e) {
      setError(e?.message || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createOrder(planKey) {
    const res = await api.request("/api/user/billing/create-order", {
      method: "POST",
      token,
      body: JSON.stringify({ plan: planKey }),
    });
    return res.json();
  }

  async function verifyPayment({ planKey, response }) {
    await api.request("/api/user/billing/verify", {
      method: "POST",
      token,
      body: JSON.stringify({
        order_id: response.razorpay_order_id,
        payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        plan: planKey,
      }),
    });
  }

  function openRazorpay(order, planKey) {
    if (!window.Razorpay) {
      throw new Error("Razorpay checkout script not loaded.");
    }

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: brand.name,
      order_id: order.orderId,
      handler: async function (response) {
        try {
          await verifyPayment({ planKey, response });
          setSuccess("Plan upgraded successfully.");
          await load();
        } catch (e) {
          setError(e?.message || "Payment verification failed.");
        } finally {
          setPayingPlan(null);
        }
      },
      theme: {
        color: brand.primaryColor,
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  async function onUpgrade(planKey) {
    setError("");
    setSuccess("");
    setPayingPlan(planKey);
    try {
      const order = await createOrder(planKey);
      openRazorpay(order, planKey);
    } catch (e) {
      setError(e?.message || "Failed to start checkout.");
      setPayingPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div style={{ color: brand.textMuted }}>Loading...</div>
      </div>
    );
  }

  const currentPlanKey = billing?.plan?.key || "free";
  const currentDays = billing?.plan?.daysRemaining ?? 0;
  const currentExpires = billing?.plan?.plan_expires_at;
  const currentColor = planColor(currentPlanKey);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold" style={{ color: brand.textPrimary }}>
          Billing
        </div>
        <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
          Upgrade to deploy more containers.
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.dangerColor}12`, borderColor: `${brand.dangerColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: `${brand.onlineColor}12`, borderColor: `${brand.onlineColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{success}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        <div className="rounded-2xl border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Current Plan</div>
              <div className="text-sm mt-1" style={{ color: brand.textMuted }}>
                Expires in {currentDays} day{currentDays === 1 ? "" : "s"}
              </div>
            </div>
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${currentColor}1a`, border: `1px solid ${currentColor}`, color: currentColor }}
            >
              {currentPlanKey === "free"
                ? "Free"
                : currentPlanKey === "starter"
                  ? "Starter"
                  : currentPlanKey === "pro"
                    ? "Pro"
                    : "Business"}
            </span>
          </div>
          <div className="mt-4 text-sm" style={{ color: brand.textMuted }}>
            {currentExpires ? `Expiry date: ${new Date(currentExpires).toLocaleDateString()}` : "No active subscription"}
          </div>
        </div>

        <div className="rounded-2xl border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
          <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>Plan Usage</div>
          <div className="mt-3">
            <div className="text-sm" style={{ color: brand.textMuted }}>
              {billing?.containersUsed} of {billing?.containersAllowed} containers used
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const color = planColor(p.key);
          const disabled = payingPlan === p.key;
          const active = currentPlanKey === p.key;
          return (
            <div
              key={p.key}
              className="rounded-2xl border p-5 transition-all duration-200"
              style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold" style={{ color: brand.textPrimary }}>{p.label}</div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${color}1a`, border: `1px solid ${color}`, color }}>
                  {p.display}
                </span>
              </div>
              <div className="mt-3 text-sm" style={{ color: brand.textMuted }}>
                Containers: {p.containers}
              </div>
              <div className="text-sm" style={{ color: brand.textMuted }}>
                RAM: {p.ram} • CPU: {p.cpu}
              </div>

              <button
                type="button"
                className="mt-4 w-full rounded-2xl px-5 py-2 transition-all duration-200 cursor-pointer font-semibold"
                disabled={active || disabled}
                style={{
                  backgroundColor: active ? `${color}15` : brand.primaryColor,
                  border: `1px solid ${active ? `${color}55` : brand.primaryColor}`,
                  color: active ? color : brand.darkBg,
                  opacity: active || disabled ? 0.7 : 1,
                }}
                onClick={() => onUpgrade(p.key)}
              >
                {active ? "Current plan" : disabled ? "Processing..." : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

