import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Box,
  Rocket,
  ScrollText,
  Settings,
  CreditCard,
  LogOut,
} from "lucide-react";
import { api, userLogout } from "../api.js";
import { brand } from "../config/brand.js";

function getInitials(name) {
  const parts = String(name || "Admin")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] || "A";
  const second = parts[1]?.[0] || "";
  return (first + second).toUpperCase();
}

function planBadgeTone(plan) {
  return brand.planColors?.[plan] || brand.planColors.free;
}

export default function UserSidebar() {
  const [profile, setProfile] = useState({ name: "Admin", email: "" });
  const [plan, setPlan] = useState("free");
  const [hoveredTo, setHoveredTo] = useState(null);

  async function load() {
    try {
      const res = await api.getJson("/api/user/me", { token: api.getUserToken() });
      setProfile({
        name: res?.profile?.name || "Admin",
        email: res?.profile?.email || "",
      });
      setPlan(res?.plan?.key || "free");
    } catch {
      // Ignore; user will be redirected by route guard if token is invalid.
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const version = "v1.0.0";
  const initials = getInitials(profile.name);
  const planColor = planBadgeTone(plan);
  const planBg = `${planColor}1a`;

  const navItems = [
    { label: "Dashboard", to: "/user/dashboard", Icon: LayoutDashboard },
    { label: "Containers", to: "/user/containers", Icon: Box },
    { label: "Deploy", to: "/user/deploy", Icon: Rocket },
    { label: "Logs", to: "/user/logs", Icon: ScrollText },
    { label: "Billing", to: "/user/billing", Icon: CreditCard },
    { label: "Settings", to: "/user/settings", Icon: Settings },
  ];

  return (
    <aside
      className="transition-all duration-200"
      style={{
        width: 220,
        borderRight: `1px solid ${brand.border}`,
        backgroundImage: brand.sidebarBg,
      }}
    >
      <div className="relative h-full flex flex-col px-4 py-5">
        <div className="flex items-center gap-3 px-1">
          <div
            className="rounded-xl"
            style={{
              width: 36,
              height: 36,
              backgroundImage: brand.accentGradient,
              border: `1px solid ${brand.border}`,
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div
                className="font-semibold tracking-wide text-[15px] truncate"
                style={{ color: brand.textPrimary }}
              >
                {brand.name}
              </div>
              <span
                className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor: planBg,
                  border: `1px solid ${planColor}`,
                  color: planColor,
                  flexShrink: 0,
                }}
              >
                {plan === "free"
                  ? "Free"
                  : plan === "starter"
                    ? "Starter"
                    : plan === "pro"
                      ? "Pro"
                      : "Business"}
              </span>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="rounded-2xl transition-all duration-200 cursor-pointer flex items-center gap-3 px-3 py-3"
              style={({ isActive }) => {
                return {
                  color: isActive ? brand.textPrimary : brand.textMuted,
                  backgroundImage: isActive ? brand.sidebarActiveBg : "none",
                  borderLeft: isActive ? `3px solid ${brand.primaryColor}` : `3px solid transparent`,
                  backgroundColor:
                    !isActive && hoveredTo === item.to ? brand.border : "transparent",
                };
              }}
              onMouseEnter={() => setHoveredTo(item.to)}
              onMouseLeave={() => setHoveredTo(null)}
            >
              <item.Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 mb-3 border-t" style={{ borderColor: brand.border }} />

        <div className="flex-1" />

        <div className="pb-7">
          <div className="flex items-center gap-3 px-1">
            <div
              className="rounded-full flex items-center justify-center font-bold"
              style={{
                width: 34,
                height: 34,
                backgroundImage: brand.accentGradient,
                color: brand.darkBg,
                fontSize: 12,
                border: `1px solid ${brand.border}`,
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: brand.textPrimary }}>
                {profile.name}
              </div>
              <div className="text-xs" style={{ color: brand.textMuted }}>
                {profile.email}
              </div>
            </div>
          </div>

          <div
            className="absolute left-4 right-4"
            style={{ bottom: 12, fontSize: 12, color: brand.textMuted }}
          >
            {version}
          </div>
        </div>
      </div>
    </aside>
  );
}

