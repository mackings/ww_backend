export const money = (value) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2
}).format(Number(value) || 0);

export const numberValue = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const materialLineTotal = (material) => {
  const authoritative = material?.calculation?.totalMaterialCost;
  if (authoritative !== undefined && authoritative !== null) return numberValue(authoritative);
  if (material?.calculation?.billableUnits !== undefined && material?.calculation?.billableUnits !== null) {
    return numberValue(material.price) * numberValue(material.calculation.billableUnits);
  }
  if (material?.calculation?.mode === "area_based" && numberValue(material.squareMeter) > 0) {
    return numberValue(material.price) * numberValue(material.squareMeter) * numberValue(material.quantity, 1);
  }
  return numberValue(material?.price) * numberValue(material?.quantity, 1);
};

export const calculateBomPricing = ({
  materials = [],
  additionalCosts = [],
  overheadCost = 0,
  markupPercentage = 0,
  pricingMethod = "direct_markup"
}) => {
  const materialsTotal = materials.reduce((sum, material) => sum + materialLineTotal(material), 0);
  const additionalTotal = additionalCosts.reduce((sum, cost) => sum + numberValue(cost.amount), 0);
  const includedOverhead = pricingMethod === "include_overhead" ? numberValue(overheadCost) : 0;
  const costPrice = materialsTotal + additionalTotal + includedOverhead;
  const markupAmount = (costPrice * numberValue(markupPercentage)) / 100;
  const sellingPrice = costPrice + markupAmount;

  return {
    pricingMethod,
    markupPercentage: numberValue(markupPercentage),
    materialsTotal,
    additionalTotal,
    overheadCost: numberValue(overheadCost),
    costPrice,
    markupAmount,
    sellingPrice
  };
};

const UNIT_ALIASES = {
  sqm: "sqm",
  "square meter": "sqm",
  "square meters": "sqm",
  "square metre": "sqm",
  "square metres": "sqm",
  m2: "sqm",
  "m^2": "sqm",
  piece: "piece",
  pieces: "piece",
  bag: "bag",
  bags: "bag",
  pair: "pair",
  pairs: "pair",
  pack: "pack",
  packs: "pack",
  set: "set",
  sets: "set",
  roll: "roll",
  rolls: "roll",
  yard: "yard",
  yards: "yard",
  liter: "liter",
  liters: "liter",
  litre: "liter",
  litres: "liter",
  pound: "pound",
  pounds: "pound",
  "pound weight": "pound",
  gallon: "gallon",
  gallons: "gallon",
  kilogram: "kilogram",
  kilograms: "kilogram",
  kg: "kilogram"
};

export const normalizeMaterialUnit = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^per\s+/, "");
  return UNIT_ALIASES[normalized] || normalized || "piece";
};

const MATERIAL_SALES_UNITS = new Set([
  "sqm", "piece", "bag", "pair", "pack", "set", "roll",
  "yard", "liter", "pound", "gallon", "kilogram"
]);

export const resolveVariantUnit = (variant) => {
  const canonicalApiUnit = normalizeMaterialUnit(variant?.apiUnit);
  if (variant?.apiUnit && MATERIAL_SALES_UNITS.has(canonicalApiUnit)) return canonicalApiUnit;

  const canonicalUnit = normalizeMaterialUnit(variant?.unit);
  if (variant?.unit && MATERIAL_SALES_UNITS.has(canonicalUnit)) return canonicalUnit;

  const canonicalPricingUnit = normalizeMaterialUnit(variant?.pricingUnit);
  if (variant?.pricingUnit && MATERIAL_SALES_UNITS.has(canonicalPricingUnit)) return canonicalPricingUnit;

  return "piece";
};

// The selected Unit-row value is the only source of truth for the BOM form.
// pricingUnit is pricing metadata and must not switch the UI into area mode.
export const materialUnit = (material) => normalizeMaterialUnit(
  material?.selectedUnit ?? resolveVariantUnit(material)
);

export const isAreaUnit = (material) => materialUnit(material) === "sqm";

export const isIntegerUnit = (unit) => [
  "piece", "bag", "pair", "pack", "set", "roll"
].includes(normalizeMaterialUnit(unit));

export const isDecimalUnit = (unit) => [
  "yard", "liter", "pound", "gallon", "kilogram"
].includes(normalizeMaterialUnit(unit));
