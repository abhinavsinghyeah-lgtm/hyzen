import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Box,
  Rocket,
  ScrollText,
  Settings,
  HelpCircle,
  BookOpen,
  Users,
  Server,
  Globe,
  Network,
  LogOut,
} from "lucide-react";
import { brand } from "../config/brand.js";
import { adminLogout } from "../api.js";

const navItems = [
  { label: "Overview", to: "/overview", Icon: LayoutDashboard },
  { label: "Servers", to: "/containers", Icon: Box },
  { label: "Deploy", to: "/deploy", Icon: Rocket },
  { label: "Logs", to: "/logs", Icon: ScrollText },
  { label: "Settings", to: "/settings", Icon: Settings },
  { label: "Users", to: "/users", Icon: Users },
  { label: "Nodes", to: "/nodes", Icon: Network },
  { label: "User Servers", to: "/admin/containers", Icon: Server },
  { label: "Subdomains", to: "/subdomains", Icon: Globe },
];

function getInitials(name) {
  const parts = String(name || "Admin").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "A";
  const second = parts[1]?.[0] || "";
  return (first + second).toUpperCase();
}

export default function Sidebar() {
  const version = "v1.0.0";
  const userName = "Admin";
  const initials = getInitials(userName);
  const [hoveredTo, setHoveredTo] = useState(null);

  return (
    <aside
      className="transition-all duration-200 hyzen-sidebar"
      style={{
        width: 212,
      }}
    >
      <div
        className="relative h-full flex flex-col px-3 py-6 hyzen-sidebar-shell overflow-y-auto"
        style={{
          backgroundImage: brand.sidebarBg,
          borderColor: brand.border,
        }}
      >
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
          <div className="min-w-0">
            <div
              className="font-semibold tracking-tight text-[15px] truncate"
              style={{ color: brand.textPrimary }}
            >
              {brand.name}
            </div>
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 px-3 py-3"
              style={({ isActive }) => {
                return {
                  color: isActive ? brand.textPrimary : brand.textMuted,
                  backgroundImage: "none",
                  border: isActive ? `1px solid ${brand.primaryColor}44` : `1px solid transparent`,
                  boxShadow: "none",
                  backgroundColor: isActive
                    ? brand.sidebarActiveBg
                    : hoveredTo === item.to
                      ? "rgba(63,111,240,0.08)"
                      : "transparent",
                };
              }}
              onMouseEnter={() => setHoveredTo(item.to)}
              onMouseLeave={() => setHoveredTo(null)}
            >
              {/*
                lucide icons inherit currentColor; active state switches text color via above style.
              */}
              <item.Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 mb-3 border-t" style={{ borderColor: brand.border }} />

        <div className="flex flex-col gap-1">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 px-3 py-3"
            style={{
              color: brand.textMuted,
              backgroundColor: hoveredTo === "support" ? "rgba(63,111,240,0.08)" : "transparent",
              border: "1px solid transparent",
            }}
            onMouseEnter={() => setHoveredTo("support")}
            onMouseLeave={() => setHoveredTo(null)}
          >
            <HelpCircle size={18} />
            <span className="text-sm font-medium">Support</span>
          </a>

          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 px-3 py-3"
            style={{
              color: brand.textMuted,
              backgroundColor: hoveredTo === "docs" ? "rgba(63,111,240,0.08)" : "transparent",
              border: "1px solid transparent",
            }}
            onMouseEnter={() => setHoveredTo("docs")}
            onMouseLeave={() => setHoveredTo(null)}
          >
            <BookOpen size={18} />
            <span className="text-sm font-medium">Docs</span>
          </a>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-1">
          <button
            onClick={adminLogout}
            className="rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 px-3 py-3 w-full text-left"
            style={{
              color: brand.textMuted,
              backgroundColor: hoveredTo === "logout" ? "rgba(63,111,240,0.08)" : "transparent",
              border: "1px solid transparent",
            }}
            onMouseEnter={() => setHoveredTo("logout")}
            onMouseLeave={() => setHoveredTo(null)}
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>

        <div className="pb-7">
          <div className="flex items-center gap-3 px-1">
            <div
              className="rounded-full flex items-center justify-center font-bold"
              style={{
                width: 34,
                height: 34,
                background: `${brand.primaryColor}20`,
                color: brand.primaryColor,
                fontSize: 12,
                border: `1px solid ${brand.primaryColor}55`,
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: brand.textPrimary }}>
                {userName}
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

