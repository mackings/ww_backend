const assert = require('node:assert/strict');
const { getEffectivePermissions, ALL_PERMISSIONS } = require('../Utils/defaultCompanyPermissions');

assert.deepEqual(
  getEffectivePermissions({ role: 'staff', accessGranted: true, permissions: {} }),
  ALL_PERMISSIONS
);

assert.deepEqual(
  getEffectivePermissions({ role: 'staff', accessGranted: false }),
  {}
);

console.log('Company operational access tests passed');
