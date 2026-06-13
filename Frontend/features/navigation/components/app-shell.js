"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/context/auth-context";
import { productNavigation } from "@/features/operations/config/operation-modules";
import { WorkspaceIcon } from "@/features/navigation/components/workspace-icon";

export function AppShell({ children }) {
  const { user, isAdmin, logout, ready } = useAuth();
  const pathname = usePathname();

  if (!ready || !user) {
    return <div className="page-loader"><span className="spinner" />Loading workspace...</div>;
  }

  const activeCompany = user.activeCompany || user.companies?.[user.activeCompanyIndex || 0];
  const canAccess = (id, admin) => {
    if (isAdmin) return ["materials", "products", "platform"].includes(id);
    if (admin) return false;
    return true;
  };
  const visibleModules = productNavigation.filter(([id, , admin]) => canAccess(id, admin));

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <span><strong>WoodWork</strong></span>
        </div>

        <nav className="nav-list">
          <Link className={pathname === "/dashboard" ? "nav-item active" : "nav-item"} href="/dashboard">
            <span className="nav-icon"><WorkspaceIcon name="overview" /></span>
            Overview
          </Link>
          {visibleModules.map(([id, label]) => (
            <Link
              key={id}
              className={pathname === `/workspace/${id}` ? "nav-item active" : "nav-item"}
              href={`/workspace/${id}`}
            >
              <span className="nav-icon"><WorkspaceIcon name={id} /></span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <div>
            <strong>{activeCompany?.name || (isAdmin ? "Platform" : "No company")}</strong>
            <small>{isAdmin ? "Platform administrator" : activeCompany?.role || "User"}</small>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">Workspace</span>
            <strong>{activeCompany?.name || "Platform administration"}</strong>
          </div>
          <div className="user-menu">
            <span className="avatar">{user.fullname?.slice(0, 2).toUpperCase() || "WW"}</span>
            <span className="user-copy"><strong>{user.fullname}</strong><small>{user.email}</small></span>
            <button className="text-button" onClick={logout}>Sign out</button>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
