"use client";

import { useState } from "react";

const label = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());

const hiddenKeys = new Set([
  "_id",
  "id",
  "__v",
  "catalogKey",
  "submittedBy",
  "approvedBy",
  "performedBy",
  "userId",
  "materialId",
  "productId"
]);

const imageKeys = new Set(["image", "imageUrl", "thumbnail", "photo", "picture"]);
const isHiddenKey = (key) => hiddenKeys.has(key) || key.startsWith("_") || /Id$/.test(key);
const isImageUrl = (value) => typeof value === "string" && (
  /^data:image\//i.test(value)
  || /^blob:/i.test(value)
  || /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(value)
  || /imagekit\.io/i.test(value)
);
const isUrl = (value) => typeof value === "string" && /^https?:\/\//i.test(value);
const isDateKey = (key) => /(At|Date|date|created|updated|submitted|approved)$/i.test(key);
const isCurrencyKey = (key) => /(price|cost|amount|total|balance|revenue)/i.test(key);

const visibleEntries = (value) => Object.entries(value || {}).filter(([key, nested]) => (
  !isHiddenKey(key)
  && !imageKeys.has(key)
  && nested !== undefined
));

const formatPrimitive = (value, fieldKey = "") => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && isCurrencyKey(fieldKey)) {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value);
  }
  if (isDateKey(fieldKey) && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return String(value);
};

const findImage = (record) => {
  for (const key of imageKeys) {
    if (isUrl(record?.[key]) || isImageUrl(record?.[key])) return record[key];
  }
  if (Array.isArray(record?.images)) {
    const image = record.images.find((value) => isImageUrl(typeof value === "object" ? value?.url : value));
    return typeof image === "object" ? image?.url : image;
  }
  return "";
};

function DetailValue({ value, fieldKey = "" }) {
  if (value === null || value === undefined || value === "") return <span className="muted-value">Not provided</span>;
  if (isImageUrl(value)) return <span className="detail-inline-image" style={{ backgroundImage: `url("${value}")` }} role="img" aria-label={label(fieldKey)} />;
  if (isUrl(value)) return <a className="detail-link" href={value} target="_blank" rel="noreferrer">Open link</a>;
  if (typeof value !== "object") return formatPrimitive(value, fieldKey);
  if (Array.isArray(value)) {
    if (!value.length) return <span className="muted-value">None</span>;
    return (
      <div className="detail-array">
        {value.map((item, index) => (
          <div className="detail-array-item" key={item?._id || index}>
            {typeof item === "object" ? visibleEntries(item).map(([key, nested]) => (
              <div key={key}><strong>{label(key)}</strong><DetailValue fieldKey={key} value={nested} /></div>
            )) : formatPrimitive(item, fieldKey)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="detail-object">
      {visibleEntries(value).map(([key, nested]) => (
        <div key={key}><strong>{label(key)}</strong><DetailValue fieldKey={key} value={nested} /></div>
      ))}
    </div>
  );
}

export function RecordDetail({ record, onClose }) {
  const [template, setTemplate] = useState("minimal");
  const isDocument = Boolean(record.invoiceNumber || record.receiptNumber || record.client?.name);
  const image = findImage(record);
  const title = String(record.name || record.clientName || record.orderNumber || record.invoiceNumber || record.quotationNumber || "Details").replaceAll("_", " ");
  const subtitle = [record.category, record.subCategory, record.companyName].filter(Boolean).join(" · ");
  const entries = visibleEntries(record);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card detail-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="record-detail-header">
          <div className="record-detail-title">
            {image && <span className="record-detail-thumb" style={{ backgroundImage: `url("${image}")` }} role="img" aria-label={title} />}
            <div>
              <span className="eyebrow">Details</span>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button className="material-close" onClick={onClose} type="button" aria-label="Close">×</button>
        </header>
        {isDocument ? (
          <>
            <div className="document-toolbar">
              <label>Template
                <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                  <option value="modern">Modern Dark</option>
                  <option value="minimal">Minimal Clean</option>
                  <option value="botanical">Elegant Botanical</option>
                </select>
              </label>
              <button className="primary-button" onClick={() => window.print()}>Print / Download PDF</button>
            </div>
            <DocumentPreview record={record} template={template} />
          </>
        ) : (
          <div className="detail-grid">
            {entries.map(([key, value]) => (
              <div className={typeof value === "object" && value !== null ? "detail-field wide" : "detail-field"} key={key}>
                <span>{label(key)}</span>
                {key === "status"
                  ? <span className={`status-badge status-${String(value).replaceAll("_", "-")}`}>{String(value).replaceAll("_", " ")}</span>
                  : <DetailValue fieldKey={key} value={value} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentPreview({ record, template }) {
  const client = record.client || {
    name: record.clientName,
    phone: record.phoneNumber,
    email: record.email,
    address: record.clientAddress
  };
  const items = record.items || record.boms || [];
  const total = record.finalTotal ?? record.totalAmount ?? record.grandTotal ?? 0;
  const paid = record.amountPaid ?? 0;
  const balance = record.balance ?? Math.max(Number(total) - Number(paid), 0);
  const number = record.invoiceNumber || record.receiptNumber || `RCPT-${record.orderNumber || ""}`;

  return (
    <article className={`document-preview document-${template}`}>
      <header>
        <div><span className="document-brand">W</span><strong>{record.business?.name || "WoodWork"}</strong></div>
        <div><span>{record.invoiceNumber ? "INVOICE" : "RECEIPT"}</span><strong>{number}</strong></div>
      </header>
      <section className="document-parties">
        <div><small>Billed to</small><strong>{client?.name || "-"}</strong><span>{client?.email}</span><span>{client?.phone}</span><span>{client?.address}</span></div>
        <div><small>Date</small><strong>{record.createdAt || record.receiptDate ? new Date(record.createdAt || record.receiptDate).toLocaleDateString() : "-"}</strong><small>Due date</small><strong>{record.dueDate ? new Date(record.dueDate).toLocaleDateString() : "-"}</strong></div>
      </section>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item._id || index}>
              <td>{item.product?.name || item.name || item.woodType || item.description || `Item ${index + 1}`}</td>
              <td>{item.quantity || 1}</td>
              <td>{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(item.sellingPrice || item.totalCost || item.subtotal || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="document-totals">
        <div><span>Total</span><strong>₦{Number(total).toLocaleString()}</strong></div>
        <div><span>Amount paid</span><strong>₦{Number(paid).toLocaleString()}</strong></div>
        <div className="grand"><span>Balance</span><strong>₦{Number(balance).toLocaleString()}</strong></div>
      </section>
      <footer>Thank you for your business.</footer>
    </article>
  );
}
