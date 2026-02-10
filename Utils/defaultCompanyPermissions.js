const ALL_PERMISSIONS = Object.freeze({
  quotation: true,
  sales: true,
  order: true,
  database: true,
  receipts: true,
  backupAlerts: true,
  invoice: true,
  products: true,
  boms: true
});

const getEffectivePermissions = (companyData) => {
  if (!companyData) return {};
  if (['owner', 'admin'].includes(companyData.role)) return { ...ALL_PERMISSIONS };
  return { ...(companyData.permissions || {}) };
};

module.exports = {
  ALL_PERMISSIONS,
  getEffectivePermissions
};

