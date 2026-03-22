import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api } from "../../api.js";
import { brand } from "../../config/brand.js";

const plans = [
  {
    key: "starter",
    title: "Launch",
    display: "$20",
    label: "Get Started",
    features: [
      "Up to 2 domains",
      "Unlimited DDoS mitigation",
      "Layer 4 & 7 protection",
      "Email support",
      "Basic analytics",
      "Asia Pacific location",
    ],
  },
  {
    key: "pro",
    title: "Growth",
    display: "$45",
    label: "Start Growth Plan",
    featured: true,
    features: [
      "Up to 10 domains",
      "4Tbps mitigation capacity",
      "Priority Layer 4 & 7 protection",
      "24/7 priority support",
      "Advanced analytics dashboard",
      "Multi-location access",
      "Server IP hiding",
      "HAProxy + Cloudflare Spectrum",
    ],
  },
  {
    key: "business",
    title: "Enterprise",
    display: "$95",
    label: "Contact Sales",
    features: [
      "Unlimited domains",
      "Full 4Tbps capacity guarantee",
      "Dedicated protection engineer",
      "Custom integration support",
      "99.99% uptime SLA",
      "Global multi-location setup",
      "India location access",
      "White-label options",
    ],
  },
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
      theme: { color: brand.primaryColor },
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
      <div className="border p-4" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div style={{ color: brand.textMuted }}>Loading...</div>
      </div>
    );
  }

  const currentPlanKey = billing?.plan?.key || "free";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[44px] font-bold leading-none" style={{ color: brand.textPrimary }}>
          Plans & Pricing
        </div>
        <div className="text-base mt-2" style={{ color: brand.textMuted }}>
          Choose the perfect plan for your gaming network
        </div>
      </div>

      {error ? (
        <div className="border px-4 py-3" style={{ backgroundColor: `${brand.dangerColor}12`, borderColor: `${brand.dangerColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      {success ? (
        <div className="border px-4 py-3" style={{ backgroundColor: `${brand.onlineColor}12`, borderColor: `${brand.onlineColor}55` }}>
          <div style={{ color: brand.textPrimary, fontSize: 13, fontWeight: 600 }}>{success}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map((p) => {
          const color = planColor(p.key);
          const active = currentPlanKey === p.key;
          const disabled = active || payingPlan === p.key;

          return (
            <div key={p.key} className="border p-5 relative" style={{ backgroundColor: brand.cardBg, borderColor: p.featured ? `${brand.primaryColor}77` : brand.border }}>
              {p.featured ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold" style={{ backgroundColor: brand.primaryColor, color: "#ffffff" }}>
                  Most Popular
                </div>
              ) : null}

              <div className="text-4xl font-bold" style={{ color: brand.textPrimary }}>{p.title}</div>
              <div className="mt-3 flex items-end gap-1">
                <div className="text-5xl font-bold leading-none" style={{ color: brand.textPrimary }}>{p.display}</div>
                <div className="text-xl" style={{ color: brand.textMuted }}>/month</div>
              </div>

              <button
                type="button"
                className="mt-5 w-full px-4 py-2 text-sm font-semibold transition-all duration-200"
                disabled={disabled}
                style={{
                  backgroundColor: p.featured ? brand.primaryColor : "#02050b",
                  border: `1px solid ${p.featured ? brand.primaryColor : brand.border}`,
                  color: "#ffffff",
                  opacity: disabled ? 0.7 : 1,
                }}
                onClick={() => onUpgrade(p.key)}
              >
                {active ? "Current Plan" : payingPlan === p.key ? "Processing..." : p.label}
              </button>

              <div className="mt-5 space-y-3">
                {p.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm" style={{ color: brand.textMuted }}>
                    <CheckCircle2 size={15} style={{ color }} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border p-5" style={{ backgroundColor: brand.cardBg, borderColor: brand.border }}>
        <div className="text-2xl font-semibold" style={{ color: brand.textPrimary }}>Credits Balance</div>
        <div className="text-sm mt-2" style={{ color: brand.textMuted }}>
          Your current credits for bandwidth and protection services
        </div>
        <div className="mt-4 text-5xl font-bold" style={{ color: brand.textPrimary }}>0</div>
      </div>
    </div>
  );
}
