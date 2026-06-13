"use client";

import { useMemo, useState } from "react";
import { money, resolveVariantUnit } from "@/features/operations/utils/bom-pricing";

const unique = (values) => [...new Set(values.filter(Boolean))];
const normalizeSearchText = (value) => String(value || "")
  .toLowerCase()
  .replace(/[_/\\-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const searchableVariant = (variant, category, subCategory) => normalizeSearchText([
  variant.name,
  category,
  subCategory,
  variant.type,
  variant.size,
  variant.color,
  variant.unit,
  variant.apiUnit,
  variant.pricingUnit,
  variant.billingMode,
  variant.status,
  variant.isPriced ? "priced has price" : "unpriced manual price",
  variant.isGlobal ? "global" : "company"
].filter(Boolean).join(" "));

export function MaterialCatalogSelector({ groups, selected, onSelect }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(groups[0]?.category || "");
  const categoryNode = groups.find((group) => group.category === category) || groups[0];
  const [subCategory, setSubCategory] = useState(categoryNode?.subCategories?.[0]?.subCategory || "");
  const subCategoryNode = categoryNode?.subCategories?.find((item) => item.subCategory === subCategory)
    || categoryNode?.subCategories?.[0];
  const units = unique((subCategoryNode?.variants || []).map(resolveVariantUnit));
  const [unit, setUnit] = useState(units[0] || "");
  const searchTerms = useMemo(() => normalizeSearchText(search).split(" ").filter(Boolean), [search]);
  const searchResults = useMemo(() => {
    if (!searchTerms.length) return [];

    return groups.flatMap((group) => group.subCategories.flatMap((item) => (
      item.variants.map((variant) => ({
        ...variant,
        category: group.category,
        subCategory: item.subCategory,
        resolvedUnit: resolveVariantUnit(variant)
      }))
    ))).filter((variant) => {
      const searchable = searchableVariant(variant, variant.category, variant.subCategory);
      return searchTerms.every((term) => searchable.includes(term));
    });
  }, [groups, searchTerms]);

  const chooseCategory = (nextCategory) => {
    const nextNode = groups.find((group) => group.category === nextCategory);
    const nextSubCategory = nextNode?.subCategories?.[0]?.subCategory || "";
    const nextUnits = unique((nextNode?.subCategories?.[0]?.variants || []).map(resolveVariantUnit));
    setCategory(nextCategory);
    setSubCategory(nextSubCategory);
    setUnit(nextUnits[0] || "");
    onSelect(null);
  };

  const chooseSubCategory = (nextSubCategory) => {
    const nextNode = categoryNode?.subCategories?.find((item) => item.subCategory === nextSubCategory);
    const nextUnits = unique((nextNode?.variants || []).map(resolveVariantUnit));
    setSubCategory(nextSubCategory);
    setUnit(nextUnits[0] || "");
    onSelect(null);
  };

  const variants = useMemo(() => {
    return (subCategoryNode?.variants || []).filter((variant) => {
      const variantUnit = resolveVariantUnit(variant);
      return !unit || variantUnit === unit;
    });
  }, [subCategoryNode, unit]);

  if (!groups.length) return <div className="empty-state"><h3>No approved materials</h3><p>Approved material records will appear here.</p></div>;

  return (
    <div className="material-catalog">
      <label className="catalog-search">
        Search all materials
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try willow, board, black, sqm, priced..." />
      </label>

      {searchTerms.length ? (
        <div className="selector-step material-search-results">
          <div className="selector-step-heading">
            <span>Search results</span>
            <small>{searchResults.length} found</small>
          </div>
          <div className="variant-grid">
            {searchResults.map((variant) => (
              <VariantCard
                active={selected?.id === variant.id}
                category={variant.category}
                key={variant.id}
                onClick={() => onSelect({
                  ...variant,
                  selectedUnit: variant.resolvedUnit,
                  category: variant.category,
                  subCategory: variant.subCategory
                })}
                subCategory={variant.subCategory}
                unit={variant.resolvedUnit}
                variant={variant}
              />
            ))}
          </div>
          {!searchResults.length && (
            <div className="material-search-empty">
              <strong>No matching materials</strong>
              <p>Try a different name, category, size, colour or unit.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <SelectorRail label="1. Category" items={groups.map((group) => ({
            value: group.category,
            label: group.category,
            detail: `${group.total} materials`
          }))} value={category} onChange={chooseCategory} />

          <SelectorRail label="2. Subcategory" items={(categoryNode?.subCategories || []).map((item) => ({
            value: item.subCategory,
            label: item.subCategory,
            detail: `${item.total} variants`
          }))} value={subCategoryNode?.subCategory || ""} onChange={chooseSubCategory} />

          {units.length > 0 && (
            <SelectorRail label="3. Unit" items={units.map((item) => ({
              value: item,
              label: item,
              detail: item.toLowerCase() === "sqm" ? "Area calculated" : "Quantity based"
            }))} value={unit} onChange={(nextUnit) => { setUnit(nextUnit); onSelect(null); }} />
          )}

          <div className="selector-step">
            <div className="selector-step-heading">
              <span>4. Size / colour variant</span>
              <small>{variants.length} available</small>
            </div>
            <div className="variant-grid">
              {variants.map((variant) => (
                <VariantCard
                  active={selected?.id === variant.id}
                  category={categoryNode.category}
                  key={variant.id}
                  onClick={() => onSelect({
                    ...variant,
                    selectedUnit: unit,
                    category: categoryNode.category,
                    subCategory: subCategoryNode.subCategory
                  })}
                  subCategory={subCategoryNode.subCategory}
                  unit={unit}
                  variant={variant}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function VariantCard({ active, category, subCategory, unit, variant, onClick }) {
  return (
    <button type="button" className={active ? "variant-card selected" : "variant-card"} onClick={onClick}>
      <span
        className={variant.image ? "variant-visual has-image" : "variant-visual"}
        style={variant.image ? { backgroundImage: `url("${variant.image}")` } : undefined}
        aria-label={variant.image ? `${variant.name} material image` : undefined}
      >
        {variant.image ? null : variant.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="variant-copy">
        <strong>{variant.name}</strong>
        <small>{[category, subCategory].filter(Boolean).join(" · ")}</small>
        <small>{[variant.size, variant.color, unit].filter(Boolean).join(" · ") || "Standard variant"}</small>
      </span>
      <span className={variant.isPriced ? "price-tag" : "price-tag unpriced"}>
        {variant.isPriced ? money(variant.unitPrice || variant.pricePerSqm) : "Manual price"}
      </span>
    </button>
  );
}

function SelectorRail({ label, items, value, onChange }) {
  if (!items.length) return null;
  return (
    <div className="selector-step">
      <div className="selector-step-heading"><span>{label}</span><small>Slide to explore</small></div>
      <div className="selector-rail">
        {items.map((item) => (
          <button type="button" className={value === item.value ? "selector-card active" : "selector-card"} key={item.value} onClick={() => onChange(item.value)}>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
