"use client";

const money = (value) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

export function SalesAnalytics({ payload }) {
  const data = payload?.data || {};
  const metrics = data.metrics || {};
  const performance = data.salesPerformance || [];
  const maxRevenue = Math.max(...performance.map((item) => item.revenue || 0), 1);

  const cards = [
    ["Revenue", money(metrics.revenue?.total), `${Number(metrics.revenue?.change || 0).toFixed(1)}% vs previous`],
    ["Projects", metrics.projects?.total || 0, `${Number(metrics.projects?.change || 0).toFixed(1)}% vs previous`],
    ["Customers", metrics.customers?.total || 0, `${money(metrics.customers?.avgRevenuePerCustomer)} average`],
    ["Profit", money(metrics.profit?.total), `${Number(metrics.profit?.margin || 0).toFixed(1)}% margin`]
  ];

  return (
    <div className="analytics-layout">
      <div className="analytics-cards">
        {cards.map(([label, value, note]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span><strong>{value}</strong><small>{note}</small>
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <article className="analytics-panel wide">
          <div className="panel-heading"><div><span className="eyebrow">Performance</span><h2>Sales over time</h2></div><span className="count-pill">{data.period || "daily"}</span></div>
          <div className="bar-chart">
            {performance.length ? performance.map((item) => (
              <div className="bar-column" key={String(item.period)}>
                <span className="bar-value">{money(item.revenue)}</span>
                <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max((item.revenue / maxRevenue) * 100, 4)}%` }} /></div>
                <small>{item.period}</small>
              </div>
            )) : <div className="empty-inline">No sales in this period.</div>}
          </div>
        </article>

        <article className="analytics-panel">
          <span className="eyebrow">Project mix</span>
          <h2>Production categories</h2>
          <div className="progress-list">
            {(data.projectTypes || []).slice(0, 8).map((item) => (
              <div key={item.type || "Other"}>
                <span><strong>{item.type || "Other"}</strong><small>{Number(item.percentage || 0).toFixed(0)}%</small></span>
                <div><i style={{ width: `${item.percentage || 0}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-panel">
          <span className="eyebrow">Collections</span>
          <h2>Payment distribution</h2>
          <div className="payment-stack">
            {(data.paymentDistribution || []).map((item) => (
              <div key={item.status}>
                <span className={`status-badge status-${item.status}`}>{item.status}</span>
                <strong>{item.count} orders</strong>
                <small>{money(item.paidAmount)} received of {money(item.totalAmount)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-panel wide">
          <span className="eyebrow">Customers</span>
          <h2>Top customer value</h2>
          <div className="customer-ranking">
            {(data.topCustomers || []).map((customer, index) => (
              <div key={customer.name}>
                <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{customer.name}</strong><small>{customer.totalOrders} orders</small></span>
                <strong>{money(customer.totalRevenue)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
