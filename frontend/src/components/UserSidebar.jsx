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
      style={{ width: 212 }}
    >
      <div
        className="relative h-full flex flex-col px-3 py-6 hyzen-sidebar-shell"
        style={{ backgroundImage: brand.sidebarBg, borderColor: brand.border }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-1">
          <div
            className="rounded-md flex items-center justify-center font-extrabold"
            style={{
              width: 24,
              height: 24,
              background: `${brand.primaryColor}20`,
              color: brand.primaryColor,
              border: `1px solid ${brand.primaryColor}60`,
              fontSize: 12,
            }}
          >
            H
          </div>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <div
              className="font-semibold tracking-tight text-[15px] truncate"
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
                backgroundImage: "none",
                border: isActive ? `1px solid ${brand.primaryColor}44` : `1px solid transparent`,
                boxShadow: "none",
                backgroundColor: isActive
                  ? brand.sidebarActiveBg
                  : hoveredTo === item.to
                    ? "rgba(63,111,240,0.08)"
                    : "transparent",
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
                backgroundImage: "none",
                border: isActive ? `1px solid ${brand.primaryColor}44` : `1px solid transparent`,
                backgroundColor: isActive
                  ? brand.sidebarActiveBg
                  : hoveredTo === "/overview"
                    ? "rgba(63,111,240,0.08)"
                    : "transparent",
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
              backgroundColor: hoveredTo === "__logout__" ? "rgba(63,111,240,0.08)" : "transparent",
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

