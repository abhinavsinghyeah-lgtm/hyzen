import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";
import UserSidebar from "./components/UserSidebar.jsx";
import { api } from "./api.js";
import { brand } from "./config/brand.js";

import Login from "./pages/Login.jsx";
import Overview from "./pages/Overview.jsx";
import Containers from "./pages/Containers.jsx";
import Deploy from "./pages/Deploy.jsx";
import Logs from "./pages/Logs.jsx";
import Settings from "./pages/Settings.jsx";
import Users from "./pages/Users.jsx";
import ContainerControl from "./pages/ContainerControl.jsx";
import AdminUserContainers from "./pages/AdminUserContainers.jsx";
import AdminUserContainerControl from "./pages/AdminUserContainerControl.jsx";
import AdminSubdomains from "./pages/Subdomains.jsx";

import UserRegister from "./pages/User/Register.jsx";
import UserDashboard from "./pages/User/Dashboard.jsx";
import UserContainers from "./pages/User/Containers.jsx";
import UserDeploy from "./pages/User/Deploy.jsx";
import UserLogs from "./pages/User/Logs.jsx";
import UserBilling from "./pages/User/Billing.jsx";
import UserSettings from "./pages/User/Settings.jsx";
import UserContainerControl from "./pages/User/ContainerControl.jsx";
import UserSubdomains from "./pages/User/Subdomains.jsx";

function RequireAdminAuth({ children }) {
  const adminToken = localStorage.getItem("hyzen_jwt");
  const location = useLocation();
  if (adminToken) return children;
  // Also allow users with is_admin=true.
  if (api.getUserIsAdmin()) return children;
  return <Navigate to="/login" replace state={{ from: location }} />;
}

function RequireUserAuth({ children }) {
  const token = localStorage.getItem("hyzen_user_jwt");
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function MobileTopbar({ onOpen, title }) {
  return (
    <div
      className="lg:hidden sticky top-0 z-20 border-b px-3 py-3 flex items-center gap-3"
      style={{
        backgroundColor: "rgba(6, 15, 27, 0.94)",
        backdropFilter: "blur(8px)",
        borderColor: brand.border,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          border: `1px solid ${brand.border}`,
          color: brand.textPrimary,
          backgroundColor: "transparent",
        }}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: brand.textPrimary }}>
          {brand.name}
        </div>
        <div className="text-xs" style={{ color: brand.textMuted }}>
          {title}
        </div>
      </div>
    </div>
  );
}

function ResponsiveLayout({ children, role = "admin" }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const title = role === "user" ? "User Dashboard" : "Admin Dashboard";

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: brand.darkBg }}>
      {isCompact ? (
        <>
          <div
            className={`fixed inset-0 z-30 transition-opacity duration-200 ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
            onClick={() => setSidebarOpen(false)}
          />

          <div
            className={`fixed inset-y-0 left-0 z-40 h-screen transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <div className="h-full relative">
              {role === "user" ? <UserSidebar /> : <Sidebar />}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute top-3 right-3 inline-flex items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  border: `1px solid ${brand.border}`,
                  color: brand.textPrimary,
                  backgroundColor: "rgba(8, 15, 26, 0.95)",
                }}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </>
      ) : role === "user" ? (
        <UserSidebar />
      ) : (
        <Sidebar />
      )}

      <main className="flex-1 min-w-0 overflow-y-auto hyzen-fade-in">
        {isCompact ? <MobileTopbar onOpen={() => setSidebarOpen(true)} title={title} /> : null}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6">{children}</div>
      </main>
    </div>
  );
}

function ProtectedAdminLayout({ children }) {
  return (
    <ResponsiveLayout role="admin">{children}</ResponsiveLayout>
  );
}

function ProtectedUserLayout({ children }) {
  return (
    <ResponsiveLayout role="user">{children}</ResponsiveLayout>
  );
}

export default function App() {
  const adminToken = localStorage.getItem("hyzen_jwt");
  const userToken = localStorage.getItem("hyzen_user_jwt");
  const isAdminUser = api.getUserIsAdmin();

  const defaultAuthedRoute = adminToken || isAdminUser ? "/overview" : userToken ? "/user/dashboard" : "/login";

  return (
    <Routes>
      <Route path="/login" element={adminToken || userToken ? <Navigate to={defaultAuthedRoute} replace /> : <Login />} />

      <Route path="/user/login" element={<Navigate to="/login" replace />} />
      <Route path="/user/register" element={<UserRegister />} />

      <Route
        path="/"
        element={<Navigate to={defaultAuthedRoute} replace />}
      />

      <Route
        path="/overview"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <Overview />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/containers"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <Containers />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/containers/:id"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <ContainerControl />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/deploy"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <Deploy />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/logs"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <Logs />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <Settings />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />

      <Route
        path="/users"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <Users />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/containers"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <AdminUserContainers />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/admin/containers/:id"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <AdminUserContainerControl />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />
      <Route
        path="/subdomains"
        element={
          <RequireAdminAuth>
            <ProtectedAdminLayout>
              <AdminSubdomains />
            </ProtectedAdminLayout>
          </RequireAdminAuth>
        }
      />

      <Route
        path="/user/dashboard"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserDashboard />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />
      <Route
        path="/user/containers"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserContainers />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />
      <Route
        path="/user/containers/:id"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserContainerControl />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />
      <Route
        path="/user/deploy"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserDeploy />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />
      <Route
        path="/user/logs"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserLogs />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />
      <Route
        path="/user/billing"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserBilling />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />
      <Route
        path="/user/settings"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserSettings />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />
      <Route
        path="/user/subdomains"
        element={
          <RequireUserAuth>
            <ProtectedUserLayout>
              <UserSubdomains />
            </ProtectedUserLayout>
          </RequireUserAuth>
        }
      />

      <Route path="*" element={<Navigate to={defaultAuthedRoute} replace />} />
    </Routes>
  );
}

