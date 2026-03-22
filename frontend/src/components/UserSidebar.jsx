import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  Rocket,
  ScrollText,
  Settings,
  CreditCard,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { api, userLogout } from "../api.js";
import { brand } from "../config/brand.js";

function getInitials(name) {
  const parts = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] || "U";
  const second = parts[1]?.[0] || "";
  return (first + second).toUpperCase();
}

function planBadgeTone(plan) {
  return brand.planColors?.[plan] || brand.planColors.free;
}

export default function UserSidebar() {
  const [profile, setProfile] = useState({ name: "User", email: "" });
  const [plan, setPlan] = useState("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [hoveredTo, setHoveredTo] = useState(null);

  async function load() {
    try {
      const res = await api.getJson("/api/user/me", { token: api.getUserToken() });
      setProfile({
        name: res?.profile?.name || "User",
        email: res?.profile?.email || "",
      });
      setPlan(res?.plan?.key || "free");
      setIsAdmin(Boolean(res?.is_admin));
    } catch {
      // Ignore; route guard will redirect if token is invalid.
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
    { label: "Servers", to: "/user/containers", Icon: Server },
    { label: "Deploy", to: "/user/deploy", Icon: Rocket },
    { label: "Logs", to: "/user/logs", Icon: ScrollText },
    { label: "Billing", to: "/user/billing", Icon: CreditCard },
    { label: "Settings", to: "/user/settings", Icon: Settings },
  ];

  return (
    <aside
      className="transition-all duration-200 hyzen-sidebar"
      style={{ width: 244 }}
    >
      <div
        className="relative h-full flex flex-col px-4 py-5 hyzen-sidebar-shell"
        style={{ backgroundImage: brand.sidebarBg, borderColor: brand.border }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-1">
          <div
            className="rounded-full"
            style={{
              width: 28,
              height: 28,
              background: "#ff9d2e",
              boxShadow: "0 0 0 3px rgba(255,157,46,0.1), 0 0 22px rgba(255,157,46,0.36)",
              border: `1px solid ${brand.border}`,
            }}
          />
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <div
              className="font-bold tracking-wide text-[17px] truncate"
              style={{ color: brand.textPrimary }}
            >
              {brand.name}
            </div>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                backgroundColor: planBg,
                border: `1px solid ${planColor}`,
                color: planColor,
                flexShrink: 0,
              }}
            >
              {plan === "free" ? "Free" : plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Business"}
            </span>
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 px-3 py-3"
              style={({ isActive }) => ({
                color: isActive ? brand.textPrimary : brand.textMuted,
                backgroundImage: isActive ? brand.sidebarActiveBg : "none",
                border: isActive ? `1px solid rgba(255,157,46,0.38)` : `1px solid transparent`,
                boxShadow: isActive ? "0 8px 24px rgba(2,9,19,0.4)" : "none",
                backgroundColor: !isActive && hoveredTo === item.to ? "rgba(23,38,57,0.58)" : "transparent",
              })}
              onMouseEnter={() => setHoveredTo(item.to)}
              onMouseLeave={() => setHoveredTo(null)}
            >
              <item.Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {isAdmin && (
          <>
            <div className="mt-4 mb-2 border-t" style={{ borderColor: brand.border }} />
            <NavLink
              to="/overview"
              className="rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 px-3 py-3"
              style={({ isActive }) => ({
                color: isActive ? brand.primaryColor : brand.textMuted,
                backgroundImage: isActive ? brand.sidebarActiveBg : "none",
                border: isActive ? `1px solid rgba(255,157,46,0.38)` : `1px solid transparent`,
                backgroundColor: hoveredTo === "/overview" ? "rgba(23,38,57,0.58)" : "transparent",
              })}
              onMouseEnter={() => setHoveredTo("/overview")}
              onMouseLeave={() => setHoveredTo(null)}
            >
              <ShieldCheck size={18} />
              <span className="text-sm font-medium">Admin Panel</span>
            </NavLink>
          </>
        )}

        <div className="mt-auto pt-5 border-t" style={{ borderColor: brand.border }}>
          <button
            type="button"
            onClick={userLogout}
            className="w-full rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all duration-200 cursor-pointer mb-4"
            style={{
              color: brand.textMuted,
              border: `1px solid transparent`,
              backgroundColor: hoveredTo === "__logout__" ? "rgba(23,38,57,0.58)" : "transparent",
            }}
            onMouseEnter={() => setHoveredTo("__logout__")}
            onMouseLeave={() => setHoveredTo(null)}
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>

          <div className="flex items-center gap-3 px-1">
            <div
              className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                background: brand.accentGradient,
                color: brand.darkBg,
                fontSize: 12,
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: brand.textPrimary }}>
                {profile.name}
              </div>
              <div className="text-xs truncate" style={{ color: brand.textMuted }}>
                {profile.email}
              </div>
            </div>
          </div>

          <div className="mt-3" style={{ fontSize: 11, color: brand.textMuted, paddingLeft: 4 }}>
            {version}
          </div>
        </div>
      </div>
    </aside>
  );
}

