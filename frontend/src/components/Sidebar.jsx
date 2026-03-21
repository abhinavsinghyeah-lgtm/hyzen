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
} from "lucide-react";
import { brand } from "../config/brand.js";

const navItems = [
  { label: "Overview", to: "/overview", Icon: LayoutDashboard },
  { label: "Containers", to: "/containers", Icon: Box },
  { label: "Deploy", to: "/deploy", Icon: Rocket },
  { label: "Logs", to: "/logs", Icon: ScrollText },
  { label: "Settings", to: "/settings", Icon: Settings },
  { label: "Users", to: "/users", Icon: Users },
  { label: "User Servers", to: "/admin/containers", Icon: Server },
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
        width: 244,
      }}
    >
      <div
        className="relative h-full flex flex-col px-4 py-5 hyzen-sidebar-shell"
        style={{
          backgroundImage: brand.sidebarBg,
          borderColor: brand.border,
        }}
      >
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
          <div className="min-w-0">
            <div
              className="font-bold tracking-wide text-[17px] truncate"
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
                  backgroundImage: isActive ? brand.sidebarActiveBg : "none",
                  border: isActive ? `1px solid rgba(255,157,46,0.38)` : `1px solid transparent`,
                  boxShadow: isActive ? "0 8px 24px rgba(2,9,19,0.4)" : "none",
                  backgroundColor: !isActive && hoveredTo === item.to ? "rgba(23,38,57,0.58)" : "transparent",
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
              backgroundColor: hoveredTo === "support" ? "rgba(23,38,57,0.58)" : "transparent",
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
              backgroundColor: hoveredTo === "docs" ? "rgba(23,38,57,0.58)" : "transparent",
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

        <div className="pb-7">
          <div className="flex items-center gap-3 px-1">
            <div
              className="rounded-full flex items-center justify-center font-bold"
              style={{
                width: 34,
                height: 34,
                background: "#ff9d2e",
                color: "#061220",
                fontSize: 12,
                border: `1px solid ${brand.border}`,
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

