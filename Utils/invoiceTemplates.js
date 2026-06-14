const INVOICE_TEMPLATES = Object.freeze(['classic', 'modern', 'minimal']);

const normalizeInvoiceTemplate = (value, fallback = 'classic') => {
  const normalized = String(value || '').trim().toLowerCase();
  return INVOICE_TEMPLATES.includes(normalized) ? normalized : fallback;
};

const isInvoiceTemplate = (value) => INVOICE_TEMPLATES.includes(
  String(value || '').trim().toLowerCase()
);

module.exports = {
  INVOICE_TEMPLATES,
  isInvoiceTemplate,
  normalizeInvoiceTemplate
};
