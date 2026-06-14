const money = (value) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const itemName = (item) => item.woodType || item.foamType || item.description || item.name || item.product?.name || "Item";
const itemAmount = (item) => Number(item.sellingPrice || item.totalPrice || item.pricing?.sellingPrice || item.totalCost || 0) * Number(item.quantity || 1);
const shortDate = (value) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export function InvoiceTemplatePreview({ template, quotation, dueDate }) {
  const items = (quotation?.items?.length ? quotation.items : quotation?.boms || []).slice(0, 3);
  const subtotal = quotation?.totalSellingPrice ?? quotation?.finalTotal ?? 0;
  const discount = quotation?.discountAmount || 0;
  const total = quotation?.finalTotal || 0;

  return (
    <div className={`invoice-template-preview invoice-template-${template}`} aria-hidden="true">
      <div className="invoice-preview-page">
        <header className="invoice-preview-header">
          <div className="invoice-preview-brand">
            <span>W</span>
            <strong>WOODWORK</strong>
          </div>
          <div className="invoice-preview-title">
            <strong>INVOICE</strong>
            <small>{quotation?.quotationNumber ? `For ${quotation.quotationNumber}` : "Select quotation"}</small>
          </div>
        </header>

        <div className="invoice-preview-meta">
          <span><small>Invoice date</small><strong>{shortDate(new Date())}</strong></span>
          <span><small>Due date</small><strong>{shortDate(dueDate || quotation?.dueDate)}</strong></span>
        </div>

        <section className="invoice-preview-bill">
          <small>BILL TO</small>
          <strong>{quotation?.clientName || "Choose a quotation"}</strong>
          <span>{quotation?.email || "Client email"}</span>
          <span>{quotation?.clientAddress || "Client address"}</span>
        </section>

        <div className="invoice-preview-table">
          <div className="invoice-preview-table-head">
            <span>Description</span><span>Qty</span><span>Amount</span>
          </div>
          {items.length ? items.map((item, index) => (
            <div className="invoice-preview-table-row" key={item._id || `${itemName(item)}-${index}`}>
              <span>{itemName(item)}</span><span>{item.quantity || 1}</span><span>{money(itemAmount(item))}</span>
            </div>
          )) : (
            <div className="invoice-preview-empty">Quotation items will appear here.</div>
          )}
        </div>

        <section className="invoice-preview-summary">
          <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div><span>Discount</span><strong>{money(discount)}</strong></div>
          <div className="invoice-preview-total"><span>Total due</span><strong>{money(total)}</strong></div>
        </section>

        <footer>
          <span>Payment status: UNPAID</span>
          <small>Thank you for your business.</small>
        </footer>
      </div>
    </div>
  );
}
