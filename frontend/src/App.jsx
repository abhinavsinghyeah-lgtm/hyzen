import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import UserSidebar from "./components/UserSidebar.jsx";

import Login from "./pages/Login.jsx";
import Overview from "./pages/Overview.jsx";
import Containers from "./pages/Containers.jsx";
import Deploy from "./pages/Deploy.jsx";
import Logs from "./pages/Logs.jsx";
import Settings from "./pages/Settings.jsx";
import Users from "./pages/Users.jsx";

import UserLogin from "./pages/User/Login.jsx";
import UserRegister from "./pages/User/Register.jsx";
import UserDashboard from "./pages/User/Dashboard.jsx";
import UserContainers from "./pages/User/Containers.jsx";
import UserDeploy from "./pages/User/Deploy.jsx";
import UserLogs from "./pages/User/Logs.jsx";
import UserBilling from "./pages/User/Billing.jsx";
import UserSettings from "./pages/User/Settings.jsx";

function RequireAdminAuth({ children }) {
  const token = localStorage.getItem("hyzen_jwt");
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function RequireUserAuth({ children }) {
  const token = localStorage.getItem("hyzen_user_jwt");
  const location = useLocation();
  if (!token) return <Navigate to="/user/login" replace state={{ from: location }} />;
  return children;
}

function ProtectedAdminLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 transition-all duration-200 hyzen-fade-in">
        {children}
      </main>
    </div>
  );
}

function ProtectedUserLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      <UserSidebar />
      <main className="flex-1 overflow-y-auto p-8 transition-all duration-200 hyzen-fade-in">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const adminToken = localStorage.getItem("hyzen_jwt");
  const userToken = localStorage.getItem("hyzen_user_jwt");

  return (
    <Routes>
      <Route path="/login" element={adminToken ? <Navigate to="/overview" replace /> : <Login />} />

      <Route path="/user/login" element={userToken ? <Navigate to="/user/dashboard" replace /> : <UserLogin />} />
      <Route path="/user/register" element={<UserRegister />} />

      <Route
        path="/"
        element={<Navigate to="/user/login" replace />}
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

      <Route path="*" element={<Navigate to={adminToken ? "/overview" : "/user/login"} replace />} />
    </Routes>
  );
}

