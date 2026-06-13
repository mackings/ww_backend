const calculateQuotationPricing = ({
  items = [],
  costPrice,
  overheadCost,
  discount = 0
}) => {
  const totalCost = items.reduce(
    (sum, item) => sum + Number(item.costPrice || 0) * Number(item.quantity || 1),
    0
  );
  const itemSellingTotal = items.reduce(
    (sum, item) => sum + Number(item.sellingPrice || 0) * Number(item.quantity || 1),
    0
  );
  const quotationCostPrice = costPrice !== undefined && costPrice !== null
    ? Number(costPrice)
    : totalCost;
  const quotationOverheadCost = overheadCost !== undefined && overheadCost !== null
    ? Number(overheadCost)
    : 0;
  const totalSellingPrice = itemSellingTotal > 0
    ? itemSellingTotal
    : quotationCostPrice + quotationOverheadCost;
  const discountAmount = totalSellingPrice * Number(discount || 0) / 100;

  return {
    totalCost,
    costPrice: quotationCostPrice,
    overheadCost: quotationOverheadCost,
    totalSellingPrice,
    discountAmount,
    finalTotal: totalSellingPrice - discountAmount
  };
};

module.exports = { calculateQuotationPricing };
