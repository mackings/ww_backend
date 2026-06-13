"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/features/navigation/components/app-shell";
import { WorkspaceIcon } from "@/features/navigation/components/workspace-icon";
import { useAuth } from "@/features/auth/context/auth-context";
import { productNavigation } from "@/features/operations/config/operation-modules";
import { loadDashboard } from "@/features/dashboard/services/dashboard-service";

const valueFrom = (object, paths, fallback = 0) => {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], object);
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
};

export function DashboardScreen() {
  const { token, user, isAdmin } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [companiesTotal, setCompaniesTotal] = useState(null);
  const [recentQuotations, setRecentQuotations] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    loadDashboard({ token, isAdmin }).then((result) => {
      setDashboard(result.dashboard);
      setMaterials(result.materials);
      setCompaniesTotal(result.companiesTotal);
      setRecentQuotations(result.quotations);
      setRecentProducts(result.products);
      if (result.unavailable) {
        setError("Dashboard data could not be loaded. Use the workspaces to inspect individual services.");
      }
    });
  }, [isAdmin, token]);

  const cards = isAdmin
    ? [
        ["Companies", companiesTotal ?? valueFrom(dashboard, ["stats.companies.total", "companies.total", "totalCompanies"])],
        ["Users", valueFrom(dashboard, ["stats.users", "users.total", "totalUsers"])],
        ["Pending products", valueFrom(dashboard, ["stats.products.pending", "products.pending", "pendingProducts"])],
        ["Approved materials", materials?.count || 0]
      ]
    : [
        ["Revenue", valueFrom(dashboard, ["totalRevenue"], 0), "currency"],
        ["Orders", valueFrom(dashboard, ["totalOrders"])],
        ["Outstanding", valueFrom(dashboard, ["totalBalance"], 0), "currency"],
        ["Approved materials", materials?.count || 0]
      ];
  const visibleNavigation = productNavigation.filter(([id, , admin]) => {
    if (isAdmin) return ["materials", "products", "platform"].includes(id);
    return !admin;
  });

  return (
    <AppShell>
      <section className="hero-row">
        <div>
          <h1>Good day, {user?.fullname?.split(" ")[0]}.</h1>
          <p>{isAdmin ? "Review platform activity and clear approval queues." : "Your operational tools and live company data in one place."}</p>
        </div>
        <Link className="primary-button inline" href={isAdmin ? "/workspace/platform" : "/workspace/materials"}>
          {isAdmin ? "Open admin tools" : "Browse materials"}
        </Link>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="stat-grid">
        {cards.map(([label, value, format]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>
              {format === "currency"
                ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value) || 0)
                : new Intl.NumberFormat().format(Number(value) || 0)}
            </strong>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">Workspaces</span><h2>Run the business</h2></div>
            <span className="count-pill">Live operational data</span>
          </div>
          <div className="module-grid">
            {visibleNavigation.map(([id, label]) => (
              <Link className="module-card" href={`/workspace/${id}`} key={id}>
                <div className="module-card-heading">
                  <span className="module-icon"><WorkspaceIcon name={id} /></span>
                  <span>{label}</span>
                </div>
                <p>View live records, manage activity and complete related workflows.</p>
                <small>Open workspace</small>
              </Link>
            ))}
          </div>
        </article>
      </section>

      {!isAdmin && (
        <section className="recent-grid">
          <article className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Recent activity</span><h2>Quotations</h2></div>
              <Link className="text-link" href="/workspace/quotations">View all</Link>
            </div>
            <div className="recent-list">
              {recentQuotations.map((quotation) => (
                <Link href="/workspace/quotations" key={quotation._id}>
                  <span className="recent-icon">Q</span>
                  <span><strong>{quotation.clientName}</strong><small>{quotation.quotationNumber} · {quotation.status}</small></span>
                  <strong>{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(quotation.finalTotal || 0)}</strong>
                </Link>
              ))}
              {!recentQuotations.length && <p>No recent quotations.</p>}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Product library</span><h2>Recent products</h2></div>
              <Link className="text-link" href="/workspace/products">View all</Link>
            </div>
            <div className="recent-list">
              {recentProducts.slice(0, 5).map((product) => (
                <Link href="/workspace/products" key={product._id}>
                  <span className="recent-icon">P</span>
                  <span><strong>{product.name}</strong><small>{product.category} · {product.status}</small></span>
                  <span className={`status-badge status-${product.status}`}>{product.status}</span>
                </Link>
              ))}
              {!recentProducts.length && <p>No recent products.</p>}
            </div>
          </article>
        </section>
      )}
    </AppShell>
  );
}
