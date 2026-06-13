const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildApprovedMaterialScope = ({
  isPlatformOwner = false,
  requestedCompanyName = null
} = {}) => {
  if (isPlatformOwner && requestedCompanyName) {
    const requestedCompany = String(requestedCompanyName || '').trim();

    return {
      status: 'approved',
      companyName: {
        $regex: `^${escapeRegex(requestedCompany)}$`,
        $options: 'i'
      }
    };
  }

  return { status: 'approved' };
};

module.exports = {
  buildApprovedMaterialScope
};
