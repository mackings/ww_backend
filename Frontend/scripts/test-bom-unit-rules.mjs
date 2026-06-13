import assert from "node:assert/strict";
import {
  isAreaUnit,
  isDecimalUnit,
  isIntegerUnit,
  materialUnit,
  numberValue,
  normalizeMaterialUnit,
  resolveVariantUnit
} from "../features/operations/utils/bom-pricing.js";

assert.equal(materialUnit({ selectedUnit: "sqm", pricingUnit: "piece" }), "sqm");
assert.equal(materialUnit({ selectedUnit: "Roll", pricingUnit: "sqm" }), "roll");
assert.equal(materialUnit({ unit: "Yard", pricingUnit: "sqm" }), "yard");
assert.equal(resolveVariantUnit({ pricingUnit: "sqm" }), "sqm");
assert.equal(resolveVariantUnit({ unit: "per square meter", pricingUnit: "piece" }), "sqm");
assert.equal(resolveVariantUnit({ unit: "inches", pricingUnit: "sqm" }), "sqm");
assert.equal(resolveVariantUnit({ unit: "Roll", pricingUnit: "sqm" }), "roll");
assert.equal(materialUnit({ pricingUnit: "sqm" }), "sqm");

assert.equal(isAreaUnit({ selectedUnit: "sqm" }), true);
for (const unit of ["Piece", "Bag", "Pair", "Pack", "Set", "Roll", "Yard", "Liter", "Pound Weight", "Gallon", "Kilogram"]) {
  assert.equal(isAreaUnit({ selectedUnit: unit }), false, `${unit} must never show length and width`);
}

for (const unit of ["Piece", "Bag", "Pair", "Pack", "Set", "Roll"]) {
  assert.equal(isIntegerUnit(unit), true, `${unit} must use integer quantity`);
}

for (const unit of ["Yard", "Liter", "Pound Weight", "Gallon", "Kilogram"]) {
  assert.equal(isDecimalUnit(unit), true, `${unit} must allow decimal quantity`);
  assert.equal(isIntegerUnit(unit), false, `${unit} must not be restricted to integers`);
}

assert.equal(normalizeMaterialUnit("Square Meters"), "sqm");
assert.equal(normalizeMaterialUnit("Pound Weight"), "pound");
assert.equal(numberValue("300,000"), 300000);
assert.equal(numberValue("2,500.50"), 2500.5);

console.log("BOM unit rules passed");
