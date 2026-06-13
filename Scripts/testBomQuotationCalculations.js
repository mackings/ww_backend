const assert = require('assert');
const { calculateQuotationPricing } = require('../Utils/quotationPricing');

const totals = calculateQuotationPricing({
  items: [
    { costPrice: 10000, sellingPrice: 14000, quantity: 2 },
    { costPrice: 5000, sellingPrice: 7500, quantity: 1 }
  ],
  overheadCost: 3000,
  discount: 10
});

assert.strictEqual(totals.totalCost, 25000);
assert.strictEqual(totals.totalSellingPrice, 35500);
assert.strictEqual(totals.finalTotal, 31950);

assert.notStrictEqual(
  totals.totalSellingPrice,
  totals.totalCost + 3000,
  'Quotation selling total must preserve BOM markup instead of collapsing to cost plus overhead'
);

console.log('BOM and quotation calculation tests passed');
