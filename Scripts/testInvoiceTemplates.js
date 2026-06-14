const assert = require('node:assert/strict');
const {
  INVOICE_TEMPLATES,
  isInvoiceTemplate,
  normalizeInvoiceTemplate
} = require('../Utils/invoiceTemplates');

assert.deepEqual(INVOICE_TEMPLATES, ['classic', 'modern', 'minimal']);
assert.equal(normalizeInvoiceTemplate('modern'), 'modern');
assert.equal(normalizeInvoiceTemplate(' MINIMAL '), 'minimal');
assert.equal(normalizeInvoiceTemplate(undefined), 'classic');
assert.equal(normalizeInvoiceTemplate('unknown'), 'classic');
assert.equal(isInvoiceTemplate('classic'), true);
assert.equal(isInvoiceTemplate('MODERN'), true);
assert.equal(isInvoiceTemplate('unknown'), false);

console.log('Invoice template contract tests passed.');
