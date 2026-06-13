"use client";

import { getNestedValue } from "@/features/operations/config/operation-modules";

/* eslint-disable @next/next/no-img-element */
const money = (value) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const presets = {
  quotations: {
    title: "quotationNumber",
    subtitle: "clientName",
    status: "status",
    amount: "finalTotal",
    meta: [["BOMs", "boms", (value) => value?.length || 0], ["Items", "items", (value) => value?.length || 0], ["Created", "createdAt", (value) => new Date(value).toLocaleDateString()]]
  },
  boms: {
    title: "bomNumber",
    subtitle: "name",
    amount: "totalCost",
    meta: [["Materials", "materials", (value) => value?.length || 0], ["Material cost", "materialsCost", money], ["Selling", "pricing.sellingPrice", money]]
  },
  orders: {
    title: "orderNumber",
    subtitle: "clientName",
    status: "status",
    secondaryStatus: "paymentStatus",
    amount: "totalAmount",
    progress: true,
    meta: [["Paid", "amountPaid", money], ["Balance", "balance", money], ["Assigned", "assignedTo.fullname", (value) => value || "Unassigned"]]
  },
  invoices: {
    title: "invoiceNumber",
    subtitle: "clientName",
    status: "status",
    secondaryStatus: "paymentStatus",
    amount: "finalTotal",
    progress: true,
    meta: [["Paid", "amountPaid", money], ["Balance", "balance", money], ["Assigned", "assignedTo.fullname", (value) => value || "Unassigned"]]
  },
  products: {
    title: "name",
    subtitle: "productId",
    status: "status",
    image: "image",
    meta: [["Category", "category"], ["Type", "subCategory"], ["Company", "companyName"]]
  }
};

export function RecordCards({ type, rows, actions, onAction, onView, busy }) {
  const preset = presets[type];
  if (!rows.length) return <div className="empty-state"><strong>No records found</strong><p>Create a record or adjust the filters.</p></div>;

  return (
    <div className="record-card-grid">
      {rows.map((row, rowIndex) => {
        const amount = preset.amount ? getNestedValue(row, preset.amount) : 0;
        const paid = Number(row.amountPaid || 0);
        const total = Number(amount || 0);
        return (
          <article className="record-card" key={row._id || row.id || rowIndex}>
            <div className="record-card-head">
              {preset.image && getNestedValue(row, preset.image) ? <img src={getNestedValue(row, preset.image)} alt="" /> : <span className="record-monogram">{String(getNestedValue(row, preset.subtitle) || getNestedValue(row, preset.title) || "WW").slice(0, 2).toUpperCase()}</span>}
              <div>
                <small>{getNestedValue(row, preset.title)}</small>
                <h3>{getNestedValue(row, preset.subtitle) || getNestedValue(row, preset.title)}</h3>
              </div>
              {preset.status && <span className={`status-badge status-${String(getNestedValue(row, preset.status)).replaceAll("_", "-")}`}>{getNestedValue(row, preset.status)}</span>}
            </div>

            {preset.amount && <strong className="record-amount">{money(amount)}</strong>}
            {preset.progress && (
              <div className="payment-progress">
                <div><i style={{ width: `${total > 0 ? Math.min((paid / total) * 100, 100) : 0}%` }} /></div>
                <span>{total > 0 ? Math.round((paid / total) * 100) : 0}% collected</span>
                {preset.secondaryStatus && <span className={`status-badge status-${getNestedValue(row, preset.secondaryStatus)}`}>{getNestedValue(row, preset.secondaryStatus)}</span>}
              </div>
            )}

            <div className="record-meta">
              {preset.meta.map(([label, path, formatter]) => {
                const value = getNestedValue(row, path);
                return <div key={label}><span>{label}</span><strong>{formatter ? formatter(value) : value || "-"}</strong></div>;
              })}
            </div>

            <div className="record-card-actions">
              <button className="row-button" onClick={() => onView(row)}>View details</button>
              {(actions || []).filter((action) => !action.show || action.show(row)).map((action) => (
                <button className={action.danger ? "row-button danger" : "row-button"} disabled={busy} key={action.label} onClick={() => onAction(action, row, rowIndex)}>{action.label}</button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
