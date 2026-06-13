const assert = require('node:assert/strict');
const { buildApprovedMaterialScope } = require('../Utils/materialVisibility');

assert.deepEqual(
  buildApprovedMaterialScope({
    isPlatformOwner: true
  }),
  { status: 'approved' }
);

assert.deepEqual(
  buildApprovedMaterialScope({
    isPlatformOwner: true,
    requestedCompanyName: 'Showroom'
  }),
  {
    status: 'approved',
    companyName: {
      $regex: '^Showroom$',
      $options: 'i'
    }
  }
);

assert.deepEqual(
  buildApprovedMaterialScope(),
  { status: 'approved' }
);

console.log('Material visibility tests passed');
